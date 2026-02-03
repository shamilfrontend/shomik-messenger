import { Response } from 'express';
import mongoose from 'mongoose';
import Chat from '../models/Chat.model';
import Message from '../models/Message.model';
import User from '../models/User.model';
import { AuthRequest } from '../middleware/auth.middleware';

export const getChats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const chats = await Chat.find({
      participants: req.userId
    })
      .populate('participants', 'username avatar status lastSeen email')
      .populate('lastMessage')
      .populate('admin', 'username avatar')
      .sort({ updatedAt: -1 });

    // Преобразуем участников: _id -> id
    const chatsWithId = chats.map(chat => {
      const chatObj = chat.toObject();
      chatObj.participants = chatObj.participants.map((p: any) => ({
        id: p._id.toString(),
        username: p.username,
        email: p.email,
        avatar: p.avatar,
        status: p.status,
        lastSeen: p.lastSeen
      }));
      if (chatObj.admin) {
        chatObj.admin = {
          id: chatObj.admin._id.toString(),
          username: chatObj.admin.username,
          avatar: chatObj.admin.avatar
        };
      }
      return chatObj;
    });

    res.json(chatsWithId);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('Создание чата:', { body: req.body, userId: req.userId });
    const { type, participantIds, groupName } = req.body;

    if (!type || !participantIds || !Array.isArray(participantIds)) {
      console.error('Неверные параметры:', { type, participantIds });
      res.status(400).json({ error: 'Неверные параметры' });
      return;
    }

    if (!req.userId) {
      console.error('Пользователь не авторизован');
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
      if (!participantIds || participantIds.length < 1) {
        res.status(400).json({ error: 'Групповой чат должен иметь минимум одного участника' });
        return;
      }
    }

    // Преобразуем строковые ID в ObjectId
    const currentUserId = new mongoose.Types.ObjectId(req.userId);
    const participantObjectIds = participantIds.map((id: string) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Невалидный ID участника: ${id}`);
      }
      return new mongoose.Types.ObjectId(id);
    });

    // Проверяем, что участники существуют
    const participantsExist = await User.countDocuments({
      _id: { $in: participantObjectIds }
    });

    if (participantsExist !== participantObjectIds.length) {
      res.status(400).json({ error: 'Один или несколько участников не найдены' });
      return;
    }

    const allParticipants = [currentUserId, ...participantObjectIds];

    if (type === 'private') {
      const existingChat = await Chat.findOne({
        type: 'private',
        participants: { $all: allParticipants, $size: 2 }
      });

      if (existingChat) {
        await existingChat.populate('participants', 'username avatar status lastSeen email');
        await existingChat.populate('admin', 'username avatar');
        
        // Преобразуем участников: _id -> id
        const chatObj = existingChat.toObject();
        chatObj.participants = chatObj.participants.map((p: any) => ({
          id: p._id.toString(),
          username: p.username,
          email: p.email,
          avatar: p.avatar,
          status: p.status,
          lastSeen: p.lastSeen
        }));
        if (chatObj.admin) {
          chatObj.admin = {
            id: chatObj.admin._id.toString(),
            username: chatObj.admin.username,
            avatar: chatObj.admin.avatar
          };
        }
        
        res.json(chatObj);
        return;
      }
    }

    const chat = new Chat({
      type,
      participants: allParticipants,
      groupName: type === 'group' ? groupName : undefined,
      admin: type === 'group' ? currentUserId : undefined
    });

    await chat.save();
    await chat.populate('participants', 'username avatar status lastSeen email');
    await chat.populate('admin', 'username avatar');

    // Преобразуем участников: _id -> id
    const chatObj = chat.toObject();
    chatObj.participants = chatObj.participants.map((p: any) => ({
      id: p._id.toString(),
      username: p.username,
      email: p.email,
      avatar: p.avatar,
      status: p.status,
      lastSeen: p.lastSeen
    }));
    if (chatObj.admin) {
      chatObj.admin = {
        id: chatObj.admin._id.toString(),
        username: chatObj.admin.username,
        avatar: chatObj.admin.avatar
      };
    }

    console.log('Чат успешно создан:', chat._id);
    res.status(201).json(chatObj);
  } catch (error: any) {
    console.error('Ошибка создания чата:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      body: req.body,
      userId: req.userId
    });
    res.status(500).json({ 
      error: error.message || 'Внутренняя ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const getChatById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const chat = await Chat.findById(id)
      .populate('participants', 'username avatar status lastSeen email')
      .populate('lastMessage')
      .populate('admin', 'username avatar');

    if (!chat) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }

    if (!chat.participants.some((p: any) => p._id.toString() === req.userId)) {
      res.status(403).json({ error: 'Нет доступа к этому чату' });
      return;
    }

    // Преобразуем участников: _id -> id
    const chatObj = chat.toObject();
    chatObj.participants = chatObj.participants.map((p: any) => ({
      id: p._id.toString(),
      username: p.username,
      email: p.email,
      avatar: p.avatar,
      status: p.status,
      lastSeen: p.lastSeen
    }));
    if (chatObj.admin) {
      chatObj.admin = {
        id: chatObj.admin._id.toString(),
        username: chatObj.admin.username,
        avatar: chatObj.admin.avatar
      };
    }

    res.json(chatObj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addParticipants = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { participantIds } = req.body;

    if (!participantIds || !Array.isArray(participantIds)) {
      res.status(400).json({ error: 'Неверные параметры' });
      return;
    }

    const chat = await Chat.findById(id);

    if (!chat) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }

    if (chat.type !== 'group') {
      res.status(400).json({ error: 'Можно добавлять участников только в групповые чаты' });
      return;
    }

    if (chat.admin?.toString() !== req.userId) {
      res.status(403).json({ error: 'Только администратор может добавлять участников' });
      return;
    }

    const newParticipants = participantIds.filter((pid: string) => 
      !chat.participants.includes(pid as any)
    );

    chat.participants.push(...newParticipants as any);
    await chat.save();
    await chat.populate('participants', 'username avatar status lastSeen email');
    await chat.populate('admin', 'username avatar');

    // Преобразуем участников: _id -> id
    const chatObj = chat.toObject();
    chatObj.participants = chatObj.participants.map((p: any) => ({
      id: p._id.toString(),
      username: p.username,
      email: p.email,
      avatar: p.avatar,
      status: p.status,
      lastSeen: p.lastSeen
    }));
    if (chatObj.admin) {
      chatObj.admin = {
        id: chatObj.admin._id.toString(),
        username: chatObj.admin.username,
        avatar: chatObj.admin.avatar
      };
    }

    res.json(chatObj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getChatMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { limit = 50, before } = req.query;

    const chat = await Chat.findById(id);

    if (!chat) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }

    if (!chat.participants.includes(req.userId as any)) {
      res.status(403).json({ error: 'Нет доступа к этому чату' });
      return;
    }

    const query: any = { chatId: id };
    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'username avatar')
      .sort({ createdAt: 1 })
      .limit(Number(limit))
      .exec();

    // Преобразуем _id в id для senderId
    const messagesWithId = messages.map(msg => {
      const messageObj = msg.toObject();
      if (messageObj.senderId && typeof messageObj.senderId === 'object') {
        messageObj.senderId = {
          id: messageObj.senderId._id.toString(),
          username: messageObj.senderId.username,
          avatar: messageObj.senderId.avatar
        };
      }
      return messageObj;
    });

    res.json(messagesWithId);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { content, type = 'text', fileUrl } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Содержимое сообщения обязательно' });
      return;
    }

    const chat = await Chat.findById(id);

    if (!chat) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }

    if (!chat.participants.includes(req.userId as any)) {
      res.status(403).json({ error: 'Нет доступа к этому чату' });
      return;
    }

    const message = new Message({
      chatId: id,
      senderId: req.userId,
      content,
      type,
      fileUrl: fileUrl || ''
    });

    await message.save();
    await message.populate('senderId', 'username avatar');

    chat.lastMessage = message._id;
    await chat.save();

    // Преобразуем _id в id для senderId
    const messageObj = message.toObject();
    if (messageObj.senderId && typeof messageObj.senderId === 'object') {
      messageObj.senderId = {
        id: messageObj.senderId._id.toString(),
        username: messageObj.senderId.username,
        avatar: messageObj.senderId.avatar
      };
    }

    res.status(201).json(messageObj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
