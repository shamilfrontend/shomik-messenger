import { Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.model';
import { generateToken } from '../utils/jwt';
import { validateEmail, validateUsername, validatePassword } from '../utils/validators';
import { AuthRequest } from '../middleware/auth.middleware';

export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Все поля обязательны' });
      return;
    }

    if (!validateEmail(email)) {
      res.status(400).json({ error: 'Некорректный email' });
      return;
    }

    if (!validateUsername(username)) {
      res.status(400).json({ error: 'Username должен содержать 3-20 символов (буквы, цифры, _)' });
      return;
    }

    if (!validatePassword(password)) {
      res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
      return;
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      res.status(400).json({ error: 'Пользователь с таким email или username уже существует' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      email,
      password: hashedPassword,
      status: 'offline'
    });

    await user.save();

    const token = generateToken({
      userId: user._id.toString(),
      username: user.username
    });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username и пароль обязательны' });
      return;
    }

    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });

    if (!user) {
      res.status(401).json({ error: 'Неверный username или пароль' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Неверный username или пароль' });
      return;
    }

    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();

    const token = generateToken({
      userId: user._id.toString(),
      username: user.username
    });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    res.json({
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      avatar: user.avatar || '',
      status: user.status,
      lastSeen: user.lastSeen,
      contacts: user.contacts
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
