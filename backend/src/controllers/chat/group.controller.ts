import { Response } from 'express';
import Chat from '../../models/Chat.model';
import Message from '../../models/Message.model';
import User from '../../models/User.model';
import { AuthRequest } from '../../middleware/auth.middleware';
import { getWebSocketService } from '../../services/wsRegistry';
import { CHAT_POPULATE, toChatDto, parseObjectIds, findChatForUser } from '../../services/chat.service';
import { createAndBroadcastMessage } from '../../services/message.service';
import { sendInternalError } from '../../utils/errors';
import { sanitizeFileUrl } from '../../utils/sanitize';

const requireGroupAdmin = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const chat = await Chat.findById(id);
  if (!chat) {
    res.status(404).json({ error: 'Чат не найден' });
    return null;
  }
  if (chat.type !== 'group') {
    res.status(400).json({ error: 'Операция доступна только для групповых чатов' });
    return null;
  }
  if (chat.admin?.toString() !== req.userId) {
    res.status(403).json({ error: 'Только администратор может выполнить это действие' });
    return null;
  }
  return chat;
};

export const addParticipants = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { participantIds } = req.body;
    if (!participantIds || !Array.isArray(participantIds)) {
      res.status(400).json({ error: 'Неверные параметры' });
      return;
    }

    const chat = await requireGroupAdmin(req, res);
    if (!chat) return;

    const newParticipants = participantIds.filter((pid: string) => !chat.participants.some((p) => p.toString() === pid));
    if (newParticipants.length === 0) {
      res.status(400).json({ error: 'Все указанные пользователи уже являются участниками группы' });
      return;
    }

    const newParticipantIds = parseObjectIds(newParticipants);
    chat.participants.push(...newParticipantIds);
    await chat.save();

    const adminUser = await User.findById(req.userId);
    const newParticipantUsers = await User.find({ _id: { $in: newParticipantIds } }).select('username');
    const systemContent = `${adminUser?.username || 'Администратор'} добавил(а) в группу: ${newParticipantUsers.map((u) => u.username).join(', ')}`;

    await createAndBroadcastMessage({
      chatId: chat._id.toString(),
      senderId: req.userId!,
      content: systemContent,
      isSystem: true,
      readBy: chat.participants,
    });

    const updated = await Chat.findById(chat._id).populate(CHAT_POPULATE);
    const chatObj = toChatDto(updated);
    getWebSocketService()?.broadcastChatUpdated(chatObj);
    res.json(chatObj);
  } catch (error) {
    sendInternalError(res, error, 'addParticipants');
  }
};

export const removeParticipants = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { participantIds } = req.body;
    if (!participantIds || !Array.isArray(participantIds)) {
      res.status(400).json({ error: 'Неверные параметры' });
      return;
    }

    const chat = await requireGroupAdmin(req, res);
    if (!chat) return;

    const removedParticipantIds = parseObjectIds(participantIds);
    const removedParticipantUsers = await User.find({ _id: { $in: removedParticipantIds } }).select('username');

    chat.participants = chat.participants.filter((pid) => !participantIds.includes(pid.toString()));
    if (chat.participants.length === 0) {
      res.status(400).json({ error: 'Нельзя удалить всех участников группы' });
      return;
    }

    await chat.save();

    const adminUser = await User.findById(req.userId);
    const systemContent = `${adminUser?.username || 'Администратор'} удалил(а) из группы: ${removedParticipantUsers.map((u) => u.username).join(', ')}`;

    await createAndBroadcastMessage({
      chatId: chat._id.toString(),
      senderId: req.userId!,
      content: systemContent,
      isSystem: true,
      readBy: chat.participants,
    });

    const updated = await Chat.findById(chat._id).populate(CHAT_POPULATE);
    const chatObj = toChatDto(updated);
    const ws = getWebSocketService();
    ws?.broadcastChatUpdated(chatObj);
    ws?.broadcastRemovedFromGroup(chat._id.toString(), chat.groupName || 'Группа', participantIds);
    res.json(chatObj);
  } catch (error) {
    sendInternalError(res, error, 'removeParticipants');
  }
};

export const updateGroupName = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupName } = req.body;
    if (!groupName || typeof groupName !== 'string' || groupName.trim().length === 0) {
      res.status(400).json({ error: 'Название группы обязательно' });
      return;
    }

    const chat = await requireGroupAdmin(req, res);
    if (!chat) return;

    chat.groupName = groupName.trim();
    await chat.save();
    const updated = await Chat.findById(chat._id).populate(CHAT_POPULATE);
    const chatObj = toChatDto(updated);
    getWebSocketService()?.broadcastChatUpdated(chatObj);
    res.json(chatObj);
  } catch (error) {
    sendInternalError(res, error, 'updateGroupName');
  }
};

export const updateGroupAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupAvatar } = req.body;
    const chat = await requireGroupAdmin(req, res);
    if (!chat) return;

    chat.groupAvatar = sanitizeFileUrl(groupAvatar);
    await chat.save();
    const updated = await Chat.findById(chat._id).populate(CHAT_POPULATE);
    const chatObj = toChatDto(updated);
    getWebSocketService()?.broadcastChatUpdated(chatObj);
    res.json(chatObj);
  } catch (error) {
    sendInternalError(res, error, 'updateGroupAvatar');
  }
};

export const leaveGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const chat = await findChatForUser(id, req.userId!);

    if (chat.type !== 'group') {
      res.status(400).json({ error: 'Можно выйти только из групповых чатов' });
      return;
    }

    const leavingUser = await User.findById(req.userId);
    const leavingUserName = leavingUser?.username || 'Пользователь';
    const isAdmin = chat.admin?.toString() === req.userId;
    const remainingParticipants = chat.participants.filter((pid) => pid.toString() !== req.userId);

    if (isAdmin && remainingParticipants.length === 0) {
      await Message.deleteMany({ chatId: id });
      await Chat.findByIdAndDelete(id);
      getWebSocketService()?.broadcastChatDeleted(id, [req.userId!]);
      res.json({ message: 'Группа удалена' });
      return;
    }

    if (isAdmin && remainingParticipants.length > 0) {
      chat.admin = remainingParticipants[0];
    }

    chat.participants = remainingParticipants;
    await chat.save();

    await createAndBroadcastMessage({
      chatId: chat._id.toString(),
      senderId: req.userId!,
      content: `${leavingUserName} покинул(а) группу`,
      isSystem: true,
      readBy: remainingParticipants,
    });

    const updated = await Chat.findById(chat._id).populate(CHAT_POPULATE);
    const chatObj = toChatDto(updated);
    const ws = getWebSocketService();
    ws?.broadcastChatUpdated(chatObj);
    ws?.broadcastChatDeleted(chat._id.toString(), [req.userId!]);
    res.json({ message: 'Вы вышли из группы' });
  } catch (error) {
    sendInternalError(res, error, 'leaveGroup');
  }
};
