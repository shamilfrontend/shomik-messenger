import { Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { validateEmail, validateUsername, validatePassword } from '../utils/validators';
import { getWebSocketService } from '../services/wsRegistry';
import { escapeRegex, sanitizeFileUrl } from '../utils/sanitize';
import { serializeUser } from '../serializers/user.serializer';
import { sendInternalError } from '../utils/errors';

export const searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Параметр query обязателен' });
      return;
    }

    const safeQuery = escapeRegex(query);

    const users = await User.find({
      $or: [
        { username: { $regex: safeQuery, $options: 'i' } },
        { email: { $regex: safeQuery, $options: 'i' } },
      ],
      _id: { $ne: req.userId },
    })
      .select('username avatar status lastSeen')
      .limit(20);

    res.json(users.map((user) => serializeUser(user, { includeEmail: false })).filter(Boolean));
  } catch (error) {
    sendInternalError(res, error);
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    res.json(serializeUser(user, { includeEmail: false }));
  } catch (error) {
    sendInternalError(res, error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      username, email, avatar, params,
    } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    // Валидация username
    if (username !== undefined) {
      if (!validateUsername(username)) {
        res.status(400).json({ error: 'Username должен содержать 3-20 символов (буквы, цифры, _)' });
        return;
      }

      // Проверяем, не занят ли username другим пользователем
      const existingUser = await User.findOne({
        username,
        _id: { $ne: req.userId },
      });
      if (existingUser) {
        res.status(400).json({ error: 'Username уже занят' });
        return;
      }

      user.username = username;
    }

    // Валидация email
    if (email !== undefined) {
      if (!validateEmail(email)) {
        res.status(400).json({ error: 'Некорректный email' });
        return;
      }

      // Проверяем, не занят ли email другим пользователем
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.userId },
      });
      if (existingUser) {
        res.status(400).json({ error: 'Email уже занят' });
        return;
      }

      user.email = email;
    }

    // Обновление аватара
    if (avatar !== undefined) {
      user.avatar = sanitizeFileUrl(avatar);
    }

    // Обновление параметров настроек
    if (params !== undefined) {
      if (!user.params) {
        user.params = {};
      }
      if (params.messageTextSize !== undefined) {
        if (params.messageTextSize >= 12 && params.messageTextSize <= 20) {
          user.params.messageTextSize = params.messageTextSize;
        }
      }
      if (params.theme !== undefined) {
        user.params.theme = params.theme;
      }
      if (params.tasks !== undefined) {
        user.params.tasks = params.tasks === true;
      }
      if (params.mutedChats !== undefined && Array.isArray(params.mutedChats)) {
        user.params.mutedChats = params.mutedChats.filter((id: unknown) => typeof id === 'string');
      }
    }

    await user.save();

    const updatedUser = {
      ...serializeUser(user, { includeEmail: true }),
      params: user.params || {},
    };

    getWebSocketService()?.broadcastUserUpdated(updatedUser);

    res.json(updatedUser);
  } catch (error) {
    sendInternalError(res, error);
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Текущий и новый пароль обязательны' });
      return;
    }

    if (!validatePassword(newPassword)) {
      res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
      return;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    // Проверяем текущий пароль
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Неверный текущий пароль' });
      return;
    }

    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    res.json({ message: 'Пароль успешно изменен' });
  } catch (error) {
    sendInternalError(res, error);
  }
};
