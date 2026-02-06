import { Response } from 'express';
import mongoose from 'mongoose';
import Chat from '../models/Chat.model';
import Message from '../models/Message.model';
import User from '../models/User.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { wsService } from '../server';

// Функция для преобразования чата в нужный формат
const formatChat = (chat: any): any => {
  const chatObj = chat.toObject() as any;
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
  // Обрабатываем lastMessage если он есть
  if (chatObj.lastMessage && typeof chatObj.lastMessage === 'object') {
    if (chatObj.lastMessage.senderId && typeof chatObj.lastMessage.senderId === 'object') {
      chatObj.lastMessage.senderId = {
        id: chatObj.lastMessage.senderId._id.toString(),
        username: chatObj.lastMessage.senderId.username || 'Пользователь',
        avatar: chatObj.lastMessage.senderId.avatar,
        status: chatObj.lastMessage.senderId.status,
        lastSeen: chatObj.lastMessage.senderId.lastSeen
      };
    }
    // Не присваиваем _id вложенному объекту (getter-only). Создаём новый объект с _id-строкой.
    const lm = chatObj.lastMessage;
    const idStr = lm._id != null ? (typeof lm._id === 'object' && 'toString' in lm._id ? (lm._id as { toString(): string }).toString() : String(lm._id)) : undefined;
    if (idStr !== undefined) {
      chatObj.lastMessage = { ...lm, _id: idStr };
    }
  }
  return chatObj;
};

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
      const chatObj = chat.toObject() as any;
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

    // Получаем информацию об активных групповых звонках для групповых чатов пользователя
    const groupChatIds = chatsWithId.filter((c) => c.type === 'group').map((c) => c._id.toString());
    const activeGroupCalls = wsService.getActiveGroupCallsForChats(groupChatIds);

    res.json({ chats: chatsWithId, activeGroupCalls });
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
        const chatObj = existingChat.toObject() as any;
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

    // Если это группа, создаем системное сообщение о добавлении участников
    if (type === 'group') {
      const adminUser = await User.findById(currentUserId);
      const adminName = adminUser?.username || 'Администратор';
      
      // Получаем имена всех участников (включая создателя)
      const allParticipantUsers = await User.find({
        _id: { $in: allParticipants }
      }).select('username');
      
      const participantNames = allParticipantUsers
        .filter(user => user._id.toString() !== currentUserId.toString())
        .map(user => user.username);
      
      let systemContent: string;
      if (participantNames.length > 0) {
        systemContent = `${adminName} создал(а) группу и добавил(а): ${participantNames.join(', ')}`;
      } else {
        systemContent = `${adminName} создал(а) группу`;
      }
      
      const systemMessage = new Message({
        chatId: chat._id,
        senderId: currentUserId,
        content: systemContent,
        type: 'system',
        readBy: allParticipants
      });

      await systemMessage.save();
      await systemMessage.populate('senderId', 'username avatar status lastSeen');

      chat.lastMessage = systemMessage._id;
      await chat.save();

      // Преобразуем системное сообщение для отправки через WebSocket
      const messageObj = systemMessage.toObject() as any;
      messageObj._id = messageObj._id.toString();
      messageObj.chatId = messageObj.chatId.toString();
      if (messageObj.senderId && typeof messageObj.senderId === 'object') {
        messageObj.senderId = {
          id: messageObj.senderId._id.toString(),
          username: messageObj.senderId.username,
          avatar: messageObj.senderId.avatar,
          status: messageObj.senderId.status,
          lastSeen: messageObj.senderId.lastSeen
        };
      }
      messageObj.readBy = messageObj.readBy.map((id: any) => id.toString());

      // Отправляем системное сообщение всем участникам через WebSocket
      if (wsService) {
        const participantIds = allParticipants.map((id: any) => id.toString());
        wsService.broadcastMessage(messageObj, participantIds);
      }
    }

    // Преобразуем участников: _id -> id
    const chatObj = chat.toObject() as any;
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
    
    // Отправляем WebSocket событие всем участникам чата
    if (wsService) {
      wsService.broadcastChatCreated(chatObj);
    }
    
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
    const chatObj = chat.toObject() as any;
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

    if (newParticipants.length === 0) {
      res.status(400).json({ error: 'Все указанные пользователи уже являются участниками группы' });
      return;
    }

    // Сохраняем ID новых участников для системного сообщения
    const newParticipantIds = newParticipants.map((pid: string) => new mongoose.Types.ObjectId(pid));

    chat.participants.push(...newParticipants as any);
    await chat.save();
    await chat.populate('participants', 'username avatar status lastSeen email');
    await chat.populate('admin', 'username avatar');

    // Создаем системное сообщение о добавлении участников
    const adminUser = await User.findById(req.userId);
    const adminName = adminUser?.username || 'Администратор';

    const newParticipantUsers = await User.find({
      _id: { $in: newParticipantIds }
    }).select('username');

    const participantNames = newParticipantUsers.map(user => user.username);

    const systemContent = `${adminName} добавил(а) в группу: ${participantNames.join(', ')}`;

    const systemMessage = new Message({
      chatId: chat._id,
      senderId: req.userId,
      content: systemContent,
      type: 'system',
      readBy: chat.participants.map((p: any) => p._id || p)
    });

    await systemMessage.save();
    await systemMessage.populate('senderId', 'username avatar status lastSeen');

    chat.lastMessage = systemMessage._id;
    await chat.save();

    // Преобразуем системное сообщение для отправки через WebSocket
    const messageObj = systemMessage.toObject() as any;
    messageObj._id = messageObj._id.toString();
    messageObj.chatId = messageObj.chatId.toString();
    if (messageObj.senderId && typeof messageObj.senderId === 'object') {
      messageObj.senderId = {
        id: messageObj.senderId._id.toString(),
        username: messageObj.senderId.username,
        avatar: messageObj.senderId.avatar,
        status: messageObj.senderId.status,
        lastSeen: messageObj.senderId.lastSeen
      };
    }
    messageObj.readBy = messageObj.readBy.map((id: any) => id.toString());

    const chatObj = formatChat(chat);

    // Отправляем WebSocket событие об обновлении группы всем участникам
    if (wsService) {
      wsService.broadcastChatUpdated(chatObj);
      
      // Отправляем системное сообщение всем участникам группы
      const allParticipantIds = chat.participants.map((p: any) => {
        if (typeof p === 'string') return p;
        return p.id || p._id?.toString();
      }).filter(Boolean) as string[];
      
      wsService.broadcastMessage(messageObj, allParticipantIds);
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
      .populate('senderId', 'username avatar status lastSeen')
      .populate({
        path: 'replyTo',
        select: 'content senderId type',
        populate: {
          path: 'senderId',
          select: 'username'
        }
      })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .exec();
    
    // Переворачиваем массив, чтобы сообщения были в хронологическом порядке (от старых к новым)
    messages.reverse();

    // Преобразуем _id в id для senderId и replyTo, а также reactions
    const messagesWithId = messages.map(msg => {
      const messageObj = msg.toObject() as any;
      if (messageObj.senderId && typeof messageObj.senderId === 'object') {
        messageObj.senderId = {
          id: messageObj.senderId._id.toString(),
          username: messageObj.senderId.username,
          avatar: messageObj.senderId.avatar,
          status: messageObj.senderId.status,
          lastSeen: messageObj.senderId.lastSeen
        };
      }
      if (messageObj.replyTo && typeof messageObj.replyTo === 'object') {
        const replyToObj: any = {
          _id: messageObj.replyTo._id.toString(),
          content: messageObj.replyTo.content,
          type: messageObj.replyTo.type
        };
        if (messageObj.replyTo.senderId && typeof messageObj.replyTo.senderId === 'object') {
          replyToObj.senderId = {
            id: messageObj.replyTo.senderId._id.toString(),
            username: messageObj.replyTo.senderId.username
          };
        }
        messageObj.replyTo = replyToObj;
      }
      // Преобразуем Map reactions в объект
      if (messageObj.reactions && messageObj.reactions instanceof Map) {
        const reactionsObj: { [key: string]: string[] } = {};
        messageObj.reactions.forEach((userIds: mongoose.Types.ObjectId[], emoji: string) => {
          reactionsObj[emoji] = userIds.map((id: mongoose.Types.ObjectId) => id.toString());
        });
        messageObj.reactions = reactionsObj;
      } else if (!messageObj.reactions) {
        messageObj.reactions = {};
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
    const { content, type = 'text', fileUrl, replyTo } = req.body;

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

    // Проверяем, что replyTo существует и принадлежит этому чату
    let replyToId = null;
    if (replyTo) {
      const replyMessage = await Message.findById(replyTo);
      if (replyMessage && replyMessage.chatId.toString() === id) {
        replyToId = replyTo;
      }
    }

    const message = new Message({
      chatId: id,
      senderId: req.userId,
      content,
      type,
      fileUrl: fileUrl || '',
      replyTo: replyToId
    });

    await message.save();
    await message.populate('senderId', 'username avatar status lastSeen');
    if (message.replyTo) {
      await message.populate({
        path: 'replyTo',
        select: 'content senderId type',
        populate: {
          path: 'senderId',
          select: 'username'
        }
      });
    }

    chat.lastMessage = message._id;
    await chat.save();

    // Преобразуем _id в id для senderId и replyTo
    const messageObj = message.toObject() as any;
    if (messageObj.senderId && typeof messageObj.senderId === 'object') {
      messageObj.senderId = {
        id: messageObj.senderId._id.toString(),
        username: messageObj.senderId.username,
        avatar: messageObj.senderId.avatar,
        status: messageObj.senderId.status,
        lastSeen: messageObj.senderId.lastSeen
      };
    }
    if (messageObj.replyTo && typeof messageObj.replyTo === 'object') {
      const replyToObj: any = {
        _id: messageObj.replyTo._id.toString(),
        content: messageObj.replyTo.content,
        type: messageObj.replyTo.type
      };
      if (messageObj.replyTo.senderId && typeof messageObj.replyTo.senderId === 'object') {
        replyToObj.senderId = {
          id: messageObj.replyTo.senderId._id.toString(),
          username: messageObj.replyTo.senderId.username
        };
      }
      messageObj.replyTo = replyToObj;
    }
    // Преобразуем Map reactions в объект
    if (messageObj.reactions && messageObj.reactions instanceof Map) {
      const reactionsObj: { [key: string]: string[] } = {};
      messageObj.reactions.forEach((userIds: mongoose.Types.ObjectId[], emoji: string) => {
        reactionsObj[emoji] = userIds.map((id: mongoose.Types.ObjectId) => id.toString());
      });
      messageObj.reactions = reactionsObj;
    } else if (!messageObj.reactions) {
      messageObj.reactions = {};
    }

    res.status(201).json(messageObj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateGroupName = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { groupName } = req.body;

    if (!groupName || typeof groupName !== 'string' || groupName.trim().length === 0) {
      res.status(400).json({ error: 'Название группы обязательно' });
      return;
    }

    const chat = await Chat.findById(id);

    if (!chat) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }

    if (chat.type !== 'group') {
      res.status(400).json({ error: 'Можно изменять название только у групповых чатов' });
      return;
    }

    if (chat.admin?.toString() !== req.userId) {
      res.status(403).json({ error: 'Только администратор может изменять название группы' });
      return;
    }

    chat.groupName = groupName.trim();
    await chat.save();
    await chat.populate('participants', 'username avatar status lastSeen email');
    await chat.populate('admin', 'username avatar');

    const chatObj = formatChat(chat);

    // Отправляем WebSocket событие об обновлении группы
    if (wsService) {
      wsService.broadcastChatUpdated(chatObj);
    }

    res.json(chatObj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateGroupAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { groupAvatar } = req.body;

    const chat = await Chat.findById(id);

    if (!chat) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }

    if (chat.type !== 'group') {
      res.status(400).json({ error: 'Можно изменять аватар только у групповых чатов' });
      return;
    }

    if (chat.admin?.toString() !== req.userId) {
      res.status(403).json({ error: 'Только администратор может изменять аватар группы' });
      return;
    }

    chat.groupAvatar = groupAvatar || '';
    await chat.save();
    await chat.populate('participants', 'username avatar status lastSeen email');
    await chat.populate('admin', 'username avatar');
    // Populate lastMessage с senderId для корректного отображения
    if (chat.lastMessage) {
      await chat.populate({
        path: 'lastMessage',
        populate: {
          path: 'senderId',
          select: 'username avatar status lastSeen'
        }
      });
    }

    const chatObj = formatChat(chat);

    // Отправляем WebSocket событие об обновлении группы
    if (wsService) {
      wsService.broadcastChatUpdated(chatObj);
    }

    res.json(chatObj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const removeParticipants = async (req: AuthRequest, res: Response): Promise<void> => {
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
      res.status(400).json({ error: 'Можно удалять участников только из групповых чатов' });
      return;
    }

    if (chat.admin?.toString() !== req.userId) {
      res.status(403).json({ error: 'Только администратор может удалять участников' });
      return;
    }

    // Сохраняем ID удаляемых участников для системного сообщения
    const removedParticipantIds = participantIds.map((pid: string) => new mongoose.Types.ObjectId(pid));
    
    // Получаем информацию об удаляемых участниках до удаления
    const removedParticipantUsers = await User.find({
      _id: { $in: removedParticipantIds }
    }).select('username');

    // Удаляем участников из массива
    chat.participants = chat.participants.filter((pid: any) => 
      !participantIds.includes(pid.toString())
    );

    // Нельзя удалить всех участников
    if (chat.participants.length === 0) {
      res.status(400).json({ error: 'Нельзя удалить всех участников группы' });
      return;
    }

    await chat.save();
    await chat.populate('participants', 'username avatar status lastSeen email');
    await chat.populate('admin', 'username avatar');

    // Создаем системное сообщение об удалении участников
    const adminUser = await User.findById(req.userId);
    const adminName = adminUser?.username || 'Администратор';

    const participantNames = removedParticipantUsers.map(user => user.username);

    const systemContent = `${adminName} удалил(а) из группы: ${participantNames.join(', ')}`;

    const systemMessage = new Message({
      chatId: chat._id,
      senderId: req.userId,
      content: systemContent,
      type: 'system',
      readBy: chat.participants.map((p: any) => p._id || p)
    });

    await systemMessage.save();
    await systemMessage.populate('senderId', 'username avatar status lastSeen');

    chat.lastMessage = systemMessage._id;
    await chat.save();

    // Преобразуем системное сообщение для отправки через WebSocket
    const messageObj = systemMessage.toObject() as any;
    messageObj._id = messageObj._id.toString();
    messageObj.chatId = messageObj.chatId.toString();
    if (messageObj.senderId && typeof messageObj.senderId === 'object') {
      messageObj.senderId = {
        id: messageObj.senderId._id.toString(),
        username: messageObj.senderId.username,
        avatar: messageObj.senderId.avatar,
        status: messageObj.senderId.status,
        lastSeen: messageObj.senderId.lastSeen
      };
    }
    messageObj.readBy = messageObj.readBy.map((id: any) => id.toString());

    const chatObj = formatChat(chat);

    // Отправляем WebSocket событие об обновлении группы всем оставшимся участникам
    if (wsService) {
      // Отправляем обновление чата оставшимся участникам
      wsService.broadcastChatUpdated(chatObj);
      
      // Отправляем системное сообщение всем оставшимся участникам группы
      const remainingParticipantIds = chat.participants.map((p: any) => {
        if (typeof p === 'string') return p;
        return p.id || p._id?.toString();
      }).filter(Boolean) as string[];
      
      wsService.broadcastMessage(messageObj, remainingParticipantIds);
      
      // Отправляем событие об удалении чата удаленным участникам
      // чтобы они удалили чат из своего списка
      wsService.broadcastChatDeleted(chat._id.toString(), participantIds);
    }

    res.json(chatObj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const leaveGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const chat = await Chat.findById(id);

    if (!chat) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }

    if (chat.type !== 'group') {
      res.status(400).json({ error: 'Можно выйти только из групповых чатов' });
      return;
    }

    // Проверяем, является ли пользователь участником группы
    if (!chat.participants.includes(req.userId as any)) {
      res.status(403).json({ error: 'Вы не являетесь участником этой группы' });
      return;
    }

    // Сохраняем информацию о выходящем пользователе
    const leavingUser = await User.findById(req.userId);
    const leavingUserName = leavingUser?.username || 'Пользователь';

    // Если админ выходит и он единственный участник, удаляем группу
    const isAdmin = chat.admin?.toString() === req.userId;
    const remainingParticipants = chat.participants.filter((pid: any) => pid.toString() !== req.userId);

    if (isAdmin && remainingParticipants.length === 0) {
      // Удаляем все сообщения чата
      await Message.deleteMany({ chatId: id });
      // Удаляем чат
      await Chat.findByIdAndDelete(id);

      // Отправляем WebSocket событие об удалении группы
      if (wsService) {
        wsService.broadcastChatDeleted(id, [req.userId!]);
      }

      res.json({ message: 'Группа удалена' });
      return;
    }

    // Если админ выходит, передаем админство первому участнику
    if (isAdmin && remainingParticipants.length > 0) {
      chat.admin = remainingParticipants[0];
    }

    // Удаляем пользователя из участников
    chat.participants = remainingParticipants;
    await chat.save();
    await chat.populate('participants', 'username avatar status lastSeen email');
    await chat.populate('admin', 'username avatar');

    // Создаем системное сообщение о выходе пользователя
    const systemContent = `${leavingUserName} покинул(а) группу`;

    const systemMessage = new Message({
      chatId: chat._id,
      senderId: req.userId,
      content: systemContent,
      type: 'system',
      readBy: chat.participants.map((p: any) => p._id || p)
    });

    await systemMessage.save();
    await systemMessage.populate('senderId', 'username avatar status lastSeen');

    chat.lastMessage = systemMessage._id;
    await chat.save();

    // Преобразуем системное сообщение для отправки через WebSocket
    const messageObj = systemMessage.toObject() as any;
    messageObj._id = messageObj._id.toString();
    messageObj.chatId = messageObj.chatId.toString();
    if (messageObj.senderId && typeof messageObj.senderId === 'object') {
      messageObj.senderId = {
        id: messageObj.senderId._id.toString(),
        username: messageObj.senderId.username,
        avatar: messageObj.senderId.avatar,
        status: messageObj.senderId.status,
        lastSeen: messageObj.senderId.lastSeen
      };
    }
    messageObj.readBy = messageObj.readBy.map((id: any) => id.toString());

    const chatObj = formatChat(chat);

    // Отправляем WebSocket событие об обновлении группы оставшимся участникам
    if (wsService) {
      // Отправляем обновление чата оставшимся участникам
      wsService.broadcastChatUpdated(chatObj);
      
      // Отправляем системное сообщение всем оставшимся участникам группы
      const remainingParticipantIds = chat.participants.map((p: any) => {
        if (typeof p === 'string') return p;
        return p.id || p._id?.toString();
      }).filter(Boolean) as string[];
      
      wsService.broadcastMessage(messageObj, remainingParticipantIds);
      
      // Отправляем событие об удалении чата выходящему пользователю
      wsService.broadcastChatDeleted(chat._id.toString(), [req.userId!]);
    }

    res.json({ message: 'Вы вышли из группы' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const chat = await Chat.findById(id);

    if (!chat) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }

    if (chat.type !== 'group') {
      res.status(400).json({ error: 'Можно удалять только групповые чаты' });
      return;
    }

    if (chat.admin?.toString() !== req.userId) {
      res.status(403).json({ error: 'Только администратор может удалять группу' });
      return;
    }

    // Сохраняем ID участников перед удалением для отправки события
    const participantIds = chat.participants.map((p: any) => p.toString());

    // Удаляем все сообщения чата
    await Message.deleteMany({ chatId: id });

    // Удаляем чат
    await Chat.findByIdAndDelete(id);

    // Отправляем WebSocket событие об удалении группы
    if (wsService) {
      wsService.broadcastChatDeleted(id, participantIds);
    }

    res.json({ message: 'Группа успешно удалена' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: chatId, messageId } = req.params;

    // Загружаем чат без populate lastMessage и admin — admin нужен как ObjectId для проверки прав
    const chat = await Chat.findById(chatId)
      .populate('participants', 'username avatar status lastSeen email');

    if (!chat) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }

    // Проверяем, что пользователь является участником чата
    if (!chat.participants.some((p: any) => p._id.toString() === req.userId)) {
      res.status(403).json({ error: 'Нет доступа к этому чату' });
      return;
    }

    const message = await Message.findById(messageId);

    if (!message) {
      res.status(404).json({ error: 'Сообщение не найдено' });
      return;
    }

    // Проверяем, что сообщение принадлежит этому чату
    if (message.chatId.toString() !== chatId) {
      res.status(400).json({ error: 'Сообщение не принадлежит этому чату' });
      return;
    }

    // Проверяем права на удаление:
    // 1. Пользователь может удалять свои сообщения
    // 2. Админ группы может удалять любые сообщения в группе
    const isOwnMessage = message.senderId.toString() === req.userId;
    const isGroupAdmin = chat.type === 'group' && chat.admin?.toString() === req.userId;

    if (!isOwnMessage && !isGroupAdmin) {
      res.status(403).json({ error: 'Недостаточно прав для удаления этого сообщения' });
      return;
    }

    // Нельзя удалять системные сообщения
    if (message.type === 'system') {
      res.status(400).json({ error: 'Нельзя удалять системные сообщения' });
      return;
    }

    // Удаляем сообщение
    await Message.findByIdAndDelete(messageId);

    // Если это было последнее сообщение, обновляем lastMessage чата
    // Получаем ID текущего lastMessage (может быть ObjectId или populated объект)
    const lastMsg = chat.lastMessage;
    const currentLastMessageId = lastMsg
      ? (typeof lastMsg === 'object' && lastMsg !== null && '_id' in lastMsg
          ? (lastMsg as { _id: { toString(): string } })._id.toString()
          : String(lastMsg))
      : null;

    if (currentLastMessageId === messageId) {
      const lastMessage = await Message.findOne({ chatId })
        .sort({ createdAt: -1 });

      // Используем updateOne для прямого обновления в БД, чтобы избежать проблем с populated объектами
      if (lastMessage) {
        await Chat.updateOne(
          { _id: chatId },
          { $set: { lastMessage: lastMessage._id } }
        );
      } else {
        await Chat.updateOne(
          { _id: chatId },
          { $unset: { lastMessage: '' } }
        );
      }
      
      // Обновляем локальный объект для дальнейшего использования
      chat.lastMessage = lastMessage ? lastMessage._id as any : undefined;
    }

    // Отправляем WebSocket событие об удалении сообщения
    if (wsService) {
      wsService.broadcastMessageDeleted(chatId, messageId, chat.participants.map((p: any) => p._id.toString()));
      
      // Перезагружаем чат для получения актуального lastMessage и отправки обновления
      const updatedChat = await Chat.findById(chatId)
        .populate('participants', 'username avatar status lastSeen email')
        .populate('lastMessage')
        .populate('admin', 'username avatar');
      
      if (updatedChat) {
        const chatObj = formatChat(updatedChat);
        wsService.broadcastChatUpdated(chatObj);
      }
    }

    res.json({ success: true, messageId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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

    const chat = await Chat.findById(chatId)
      .populate('participants', 'username avatar status lastSeen email')
      .populate('admin', 'username avatar');

    if (!chat) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }

    if (!chat.participants.some((p: any) => p._id.toString() === req.userId)) {
      res.status(403).json({ error: 'Нет доступа к этому чату' });
      return;
    }

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

    const messageDoc = await Message.findById(messageId)
      .populate('senderId', 'username avatar status lastSeen');

    const messageObj = messageDoc!.toObject() as any;
    messageObj._id = messageObj._id.toString();
    messageObj.chatId = messageObj.chatId.toString();
    if (messageObj.senderId && typeof messageObj.senderId === 'object') {
      messageObj.senderId = {
        id: messageObj.senderId._id.toString(),
        username: messageObj.senderId.username || 'Пользователь',
        avatar: messageObj.senderId.avatar,
        status: messageObj.senderId.status,
        lastSeen: messageObj.senderId.lastSeen
      };
    }
    messageObj.readBy = (messageObj.readBy || []).map((id: any) => id.toString());
    if (messageObj.reactions && messageObj.reactions instanceof Map) {
      const reactionsObj: { [key: string]: string[] } = {};
      messageObj.reactions.forEach((userIds: mongoose.Types.ObjectId[], emoji: string) => {
        reactionsObj[emoji] = userIds.map((id: mongoose.Types.ObjectId) => id.toString());
      });
      messageObj.reactions = reactionsObj;
    } else if (!messageObj.reactions) {
      messageObj.reactions = {};
    }

    if (wsService) {
      const participantIds = chat.participants.map((p: any) => p._id.toString());
      wsService.broadcastMessageEdited(chatId, messageObj, participantIds);
    }

    res.json(messageObj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const toggleReaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, messageId } = req.params;
    const { emoji } = req.body;

    // Валидация emoji
    const allowedEmojis = ['👍', '😂', '🔥', '❤️', '👎', '👀', '💯'];
    if (!emoji || !allowedEmojis.includes(emoji)) {
      res.status(400).json({ error: 'Недопустимая реакция' });
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

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ error: 'Сообщение не найдено' });
      return;
    }

    if (message.chatId.toString() !== id) {
      res.status(400).json({ error: 'Сообщение не принадлежит этому чату' });
      return;
    }

    // Проверяем, что пользователь не является отправителем сообщения
    if (message.senderId.toString() === req.userId) {
      res.status(403).json({ error: 'Нельзя добавлять реакции на свои сообщения' });
      return;
    }

    // Инициализируем reactions если его нет
    if (!message.reactions) {
      (message as any).reactions = new Map<string, mongoose.Types.ObjectId[]>();
    }

    const reactionsMap = (message.reactions as unknown) as Map<string, mongoose.Types.ObjectId[]>;
    const userIdObj = new mongoose.Types.ObjectId(req.userId);

    // Проверяем, стоит ли уже у пользователя эта реакция (снять или заменить)
    const currentUsersForEmoji = reactionsMap.get(emoji) || [];
    const hasThisEmoji = currentUsersForEmoji.some((id: mongoose.Types.ObjectId) => id.toString() === req.userId);

    if (hasThisEmoji) {
      // Снимаем реакцию (повторный клик по той же)
      const newUsers = currentUsersForEmoji.filter((id: mongoose.Types.ObjectId) => id.toString() !== req.userId);
      if (newUsers.length === 0) {
        reactionsMap.delete(emoji);
      } else {
        reactionsMap.set(emoji, newUsers);
      }
    } else {
      // Удаляем пользователя из всех других реакций (только одна реакция на сообщение)
      reactionsMap.forEach((userIds, emojiKey) => {
        if (emojiKey === emoji) return;
        const idx = userIds.findIndex((id: mongoose.Types.ObjectId) => id.toString() === req.userId);
        if (idx >= 0) {
          const newUsers = userIds.filter((_: mongoose.Types.ObjectId, i: number) => i !== idx);
          if (newUsers.length === 0) {
            reactionsMap.delete(emojiKey);
          } else {
            reactionsMap.set(emojiKey, newUsers);
          }
        }
      });
      // Добавляем новую реакцию
      const updated = reactionsMap.get(emoji) || [];
      updated.push(userIdObj);
      reactionsMap.set(emoji, updated);
    }

    (message as any).reactions = reactionsMap;
    await message.save();

    // Преобразуем Map в объект для ответа
    const reactionsObj: { [key: string]: string[] } = {};
    reactionsMap.forEach((userIds: mongoose.Types.ObjectId[], emojiKey: string) => {
      reactionsObj[emojiKey] = userIds.map((id: mongoose.Types.ObjectId) => id.toString());
    });

    // Отправляем WebSocket событие об обновлении реакций
    if (wsService) {
      const participantIds = chat.participants.map((p: any) => p.toString());
      wsService.broadcastReaction(messageId, reactionsObj, participantIds);
    }

    res.json({ reactions: reactionsObj });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
