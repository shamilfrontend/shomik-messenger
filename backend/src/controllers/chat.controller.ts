import { Response } from 'express';
import mongoose from 'mongoose';
import Chat from '../models/Chat.model';
import Message from '../models/Message.model';
import User from '../models/User.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { wsService } from '../server';

// Функция для преобразования чата в нужный формат
const formatChat = (chat: any): any => {
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
      const messageObj = systemMessage.toObject();
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
    const messageObj = systemMessage.toObject();
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
          avatar: messageObj.senderId.avatar,
          status: messageObj.senderId.status,
          lastSeen: messageObj.senderId.lastSeen
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
    await message.populate('senderId', 'username avatar status lastSeen');

    chat.lastMessage = message._id;
    await chat.save();

    // Преобразуем _id в id для senderId
    const messageObj = message.toObject();
    if (messageObj.senderId && typeof messageObj.senderId === 'object') {
      messageObj.senderId = {
        id: messageObj.senderId._id.toString(),
        username: messageObj.senderId.username,
        avatar: messageObj.senderId.avatar,
        status: messageObj.senderId.status,
        lastSeen: messageObj.senderId.lastSeen
      };
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
    const messageObj = systemMessage.toObject();
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
        wsService.broadcastChatDeleted(id, [req.userId]);
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
    const messageObj = systemMessage.toObject();
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
      wsService.broadcastChatDeleted(chat._id.toString(), [req.userId]);
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
