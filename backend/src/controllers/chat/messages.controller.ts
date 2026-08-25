import { Response } from 'express';
import mongoose from 'mongoose';
import Chat from '../../models/Chat.model';
import Message from '../../models/Message.model';
import { AuthRequest } from '../../middleware/auth.middleware';
import { getWebSocketService } from '../../services/wsRegistry';
import { CHAT_POPULATE, toChatDto, assertChatMember, findChatForUser, getParticipantIds } from '../../services/chat.service';
import { createAndBroadcastMessage, MESSAGE_POPULATE } from '../../services/message.service';
import { serializeMessage, serializeReactionsMap } from '../../serializers/message.serializer';
import { sendInternalError } from '../../utils/errors';

const ALLOWED_EMOJIS = ['👍', '😂', '🔥', '❤️', '👎', '👀', '💯'];

export const getChatMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      limit = 50, before, after, messageId,
    } = req.query;

    await findChatForUser(id, req.userId!);

    const query: Record<string, unknown> = { chatId: id };
    let sortOrder: 1 | -1 = -1;

    if (messageId) {
      const anchorMessage = await Message.findOne({ _id: messageId, chatId: id });
      if (!anchorMessage) {
        res.status(404).json({ error: 'Сообщение не найдено' });
        return;
      }
      query.createdAt = { $lte: anchorMessage.createdAt };
    } else if (after) {
      query.createdAt = { $gt: new Date(after as string) };
      sortOrder = 1;
    } else if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .populate(MESSAGE_POPULATE as unknown as string)
      .sort({ createdAt: sortOrder })
      .limit(Number(limit))
      .exec();

    if (sortOrder === -1) {
      messages.reverse();
    }

    res.json(messages.map((msg) => serializeMessage(msg)).filter(Boolean));
  } catch (error) {
    sendInternalError(res, error, 'getChatMessages');
  }
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      content, type = 'text', fileUrl, replyTo,
    } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Содержимое сообщения обязательно' });
      return;
    }

    const dto = await createAndBroadcastMessage({
      chatId: id,
      senderId: req.userId!,
      content,
      type,
      fileUrl,
      replyTo,
    });

    res.status(201).json(dto);
  } catch (error) {
    sendInternalError(res, error, 'sendMessage');
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: chatId, messageId } = req.params;
    const chat = assertChatMember(
      await Chat.findById(chatId).populate('participants', 'username avatar status lastSeen'),
      req.userId,
    );

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ error: 'Сообщение не найдено' });
      return;
    }
    if (message.chatId.toString() !== chatId) {
      res.status(400).json({ error: 'Сообщение не принадлежит этому чату' });
      return;
    }

    const isOwnMessage = message.senderId.toString() === req.userId;
    const isGroupAdmin = chat.type === 'group' && chat.admin?.toString() === req.userId;
    if (!isOwnMessage && !isGroupAdmin) {
      res.status(403).json({ error: 'Недостаточно прав для удаления этого сообщения' });
      return;
    }
    if (message.type === 'system') {
      res.status(400).json({ error: 'Нельзя удалять системные сообщения' });
      return;
    }

    await Message.findByIdAndDelete(messageId);
    await Chat.updateOne(
      { _id: chatId, pinnedMessage: new mongoose.Types.ObjectId(messageId) },
      { $unset: { pinnedMessage: '' } },
    );

    const lastMsg = chat.lastMessage;
    const currentLastMessageId = lastMsg
      ? (typeof lastMsg === 'object' && lastMsg !== null && '_id' in lastMsg
        ? (lastMsg as { _id: { toString(): string } })._id.toString()
        : String(lastMsg))
      : null;

    if (currentLastMessageId === messageId) {
      const lastMessage = await Message.findOne({ chatId }).sort({ createdAt: -1 });
      if (lastMessage) {
        await Chat.updateOne({ _id: chatId }, { $set: { lastMessage: lastMessage._id } });
      } else {
        await Chat.updateOne({ _id: chatId }, { $unset: { lastMessage: '' } });
      }
    }

    const participantIds = getParticipantIds(chat);
    const ws = getWebSocketService();
    ws?.broadcastMessageDeleted(chatId, messageId, participantIds);

    const updatedChat = await Chat.findById(chatId).populate(CHAT_POPULATE);
    if (updatedChat) {
      ws?.broadcastChatUpdated(toChatDto(updatedChat));
    }

    res.json({ success: true, messageId });
  } catch (error) {
    sendInternalError(res, error, 'deleteMessage');
  }
};

export const editMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: chatId, messageId } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'Текст сообщения не может быть пустым' });
      return;
    }

    const chat = assertChatMember(
      await Chat.findById(chatId).populate('participants', 'username avatar status lastSeen'),
      req.userId,
    );

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ error: 'Сообщение не найдено' });
      return;
    }
    if (message.chatId.toString() !== chatId) {
      res.status(400).json({ error: 'Сообщение не принадлежит этому чату' });
      return;
    }
    if (message.senderId.toString() !== req.userId) {
      res.status(403).json({ error: 'Можно редактировать только свои сообщения' });
      return;
    }
    if (message.type !== 'text') {
      res.status(400).json({ error: 'Редактировать можно только текстовые сообщения' });
      return;
    }

    message.content = content.trim();
    await message.save();

    const messageDoc = await Message.findById(messageId).populate(MESSAGE_POPULATE as unknown as string);
    const messageObj = serializeMessage(messageDoc);
    const participantIds = getParticipantIds(chat);
    getWebSocketService()?.broadcastMessageEdited(chatId, messageObj, participantIds);
    res.json(messageObj);
  } catch (error) {
    sendInternalError(res, error, 'editMessage');
  }
};

export const toggleReaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
      res.status(400).json({ error: 'Недопустимая реакция' });
      return;
    }

    const chat = await findChatForUser(id, req.userId!);

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ error: 'Сообщение не найдено' });
      return;
    }
    if (message.chatId.toString() !== id) {
      res.status(400).json({ error: 'Сообщение не принадлежит этому чату' });
      return;
    }
    if (message.senderId.toString() === req.userId) {
      res.status(403).json({ error: 'Нельзя добавлять реакции на свои сообщения' });
      return;
    }

    if (!message.reactions) {
      (message as unknown as { reactions: Map<string, mongoose.Types.ObjectId[]> }).reactions = new Map();
    }

    const reactionsMap = message.reactions as unknown as Map<string, mongoose.Types.ObjectId[]>;
    const userIdObj = new mongoose.Types.ObjectId(req.userId);
    const currentUsersForEmoji = reactionsMap.get(emoji) || [];
    const hasThisEmoji = currentUsersForEmoji.some((item) => item.toString() === req.userId);

    if (hasThisEmoji) {
      const newUsers = currentUsersForEmoji.filter((item) => item.toString() !== req.userId);
      if (newUsers.length === 0) reactionsMap.delete(emoji);
      else reactionsMap.set(emoji, newUsers);
    } else {
      reactionsMap.forEach((userIds, emojiKey) => {
        if (emojiKey === emoji) return;
        const filtered = userIds.filter((item) => item.toString() !== req.userId);
        if (filtered.length === 0) reactionsMap.delete(emojiKey);
        else reactionsMap.set(emojiKey, filtered);
      });
      const updated = reactionsMap.get(emoji) || [];
      updated.push(userIdObj);
      reactionsMap.set(emoji, updated);
    }

    (message as unknown as { reactions: Map<string, mongoose.Types.ObjectId[]> }).reactions = reactionsMap;
    await message.save();

    const reactionsObj = serializeReactionsMap(reactionsMap);
    getWebSocketService()?.broadcastReaction(
      messageId,
      reactionsObj,
      getParticipantIds(chat),
    );
    res.json({ reactions: reactionsObj });
  } catch (error) {
    sendInternalError(res, error, 'toggleReaction');
  }
};
