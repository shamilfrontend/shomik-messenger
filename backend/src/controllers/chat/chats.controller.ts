import { Response } from 'express';
import Chat from '../../models/Chat.model';
import Message from '../../models/Message.model';
import User from '../../models/User.model';
import { AuthRequest } from '../../middleware/auth.middleware';
import { getWebSocketService } from '../../services/wsRegistry';
import { CHAT_POPULATE, toChatDto, parseObjectId, parseObjectIds, assertChatMember, findChatForUser, getParticipantIds } from '../../services/chat.service';
import { createAndBroadcastMessage, getUnreadCounts } from '../../services/message.service';
import { sendInternalError } from '../../utils/errors';

export const getChats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const chats = await Chat.find({ participants: req.userId })
      .populate(CHAT_POPULATE)
      .sort({ updatedAt: -1 });

    const chatIds = chats.map((chat) => chat._id.toString());
    const unreadMap = await getUnreadCounts(req.userId!, chatIds);
    const chatsDto = chats.map((chat) => toChatDto(chat, unreadMap.get(chat._id.toString()) || 0));

    const groupChatIds = chatsDto.filter((c) => c.type === 'group').map((c) => c.id);
    const activeGroupCalls = getWebSocketService()?.getActiveGroupCallsForChats(groupChatIds) || [];

    const currentUser = await User.findById(req.userId).select('pinnedChats');
    const pinnedChats = currentUser?.pinnedChats?.map((id) => id.toString()) || [];

    res.json({ chats: chatsDto, activeGroupCalls, pinnedChats });
  } catch (error) {
    sendInternalError(res, error, 'getChats');
  }
};

export const createChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, participantIds, groupName } = req.body;

    if (!type || !participantIds || !Array.isArray(participantIds)) {
      res.status(400).json({ error: 'Неверные параметры' });
      return;
    }

    if (!req.userId) {
      res.status(401).json({ error: 'Пользователь не авторизован' });
      return;
    }

    if (type === 'private' && participantIds.length !== 1) {
      res.status(400).json({ error: 'Приватный чат должен содержать одного участника' });
      return;
    }

    if (type === 'group') {
      if (!groupName || typeof groupName !== 'string' || groupName.trim().length === 0) {
        res.status(400).json({ error: 'Групповой чат должен иметь название' });
        return;
      }
      if (participantIds.length < 1) {
        res.status(400).json({ error: 'Групповой чат должен иметь минимум одного участника' });
        return;
      }
    }

    const currentUserId = parseObjectId(req.userId, 'ID пользователя');
    const participantObjectIds = parseObjectIds(participantIds);

    const participantsExist = await User.countDocuments({ _id: { $in: participantObjectIds } });
    if (participantsExist !== participantObjectIds.length) {
      res.status(400).json({ error: 'Один или несколько участников не найдены' });
      return;
    }

    const allParticipants = [currentUserId, ...participantObjectIds];

    if (type === 'private') {
      const existingChat = await Chat.findOne({
        type: 'private',
        participants: { $all: allParticipants, $size: 2 },
      }).populate(CHAT_POPULATE);

      if (existingChat) {
        res.json(toChatDto(existingChat));
        return;
      }
    }

    const chat = new Chat({
      type,
      participants: allParticipants,
      groupName: type === 'group' ? groupName : undefined,
      admin: type === 'group' ? currentUserId : undefined,
    });

    await chat.save();
    await chat.populate(CHAT_POPULATE);

    if (type === 'group') {
      const adminUser = await User.findById(currentUserId);
      const adminName = adminUser?.username || 'Администратор';
      const allParticipantUsers = await User.find({ _id: { $in: allParticipants } }).select('username');
      const participantNames = allParticipantUsers
        .filter((user) => user._id.toString() !== currentUserId.toString())
        .map((user) => user.username);
      const systemContent = participantNames.length > 0
        ? `${adminName} создал(а) группу и добавил(а): ${participantNames.join(', ')}`
        : `${adminName} создал(а) группу`;

      await createAndBroadcastMessage({
        chatId: chat._id.toString(),
        senderId: req.userId,
        content: systemContent,
        isSystem: true,
        readBy: allParticipants,
      });
      await chat.populate(CHAT_POPULATE);
    }

    const chatObj = toChatDto(chat);
    getWebSocketService()?.broadcastChatCreated(chatObj);
    res.status(201).json(chatObj);
  } catch (error) {
    sendInternalError(res, error, 'createChat');
  }
};

export const getChatById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    parseObjectId(id, 'ID чата');
    const chat = assertChatMember(
      await Chat.findById(id).populate(CHAT_POPULATE),
      req.userId,
    );

    const unreadMap = await getUnreadCounts(req.userId!, [id]);
    res.json(toChatDto(chat, unreadMap.get(id) || 0));
  } catch (error) {
    sendInternalError(res, error, 'getChatById');
  }
};

export const updatePinnedMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: chatId } = req.params;
    const { messageId } = req.body;

    const chat = await findChatForUser(chatId, req.userId!);

    if (messageId != null && messageId !== '') {
      const message = await Message.findOne({ _id: messageId, chatId });
      if (!message) {
        res.status(404).json({ error: 'Сообщение не найдено в этом чате' });
        return;
      }
      if (message.type === 'system') {
        res.status(400).json({ error: 'Нельзя закрепить системное сообщение' });
        return;
      }
      chat.pinnedMessage = message._id;
    } else {
      chat.pinnedMessage = undefined;
    }

    await chat.save();
    const updated = await Chat.findById(chatId).populate(CHAT_POPULATE);
    const chatObj = toChatDto(updated);
    getWebSocketService()?.broadcastChatUpdated(chatObj);
    res.json(chatObj);
  } catch (error) {
    sendInternalError(res, error, 'updatePinnedMessage');
  }
};

export const togglePinChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: chatId } = req.params;
    const chat = await findChatForUser(chatId, req.userId!);

    const userDoc = await User.findById(req.userId);
    if (!userDoc) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const isPinned = userDoc.pinnedChats.some((id) => id.toString() === chatId);

    if (isPinned) {
      userDoc.pinnedChats = userDoc.pinnedChats.filter((id) => id.toString() !== chatId);
    } else {
      userDoc.pinnedChats.push(chat._id);
    }

    await userDoc.save();
    res.json({
      pinned: !isPinned,
      pinnedChats: userDoc.pinnedChats.map((id) => id.toString()),
    });
  } catch (error) {
    sendInternalError(res, error, 'togglePinChat');
  }
};

export const deleteChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const chat = await findChatForUser(id, req.userId!);

    const participantIds = getParticipantIds(chat);

    if (chat.type === 'group' && chat.admin?.toString() !== req.userId) {
      res.status(403).json({ error: 'Только администратор может удалять группу' });
      return;
    }

    await Message.deleteMany({ chatId: id });
    await Chat.findByIdAndDelete(id);
    getWebSocketService()?.broadcastChatDeleted(id, participantIds);

    res.json({
      message: chat.type === 'group' ? 'Группа успешно удалена' : 'Чат успешно удалён',
    });
  } catch (error) {
    sendInternalError(res, error, 'deleteChat');
  }
};
