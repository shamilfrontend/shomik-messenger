import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import chatRoutes from './routes/chat.routes';
import uploadRoutes from './routes/upload.routes';

dotenv.config();

const app = express();

// Настройка CORS - максимально простая для разработки
app.use(cors({
  origin: true, // Разрешаем все origin в режиме разработки
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://Admin:Prototype123@localhost:27017/shomik-messenger';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Подключено к MongoDB');
  })
  .catch((error) => {
    console.error('Ошибка подключения к MongoDB:', error);
  });

// Определяем путь к папке uploads относительно корня проекта
// При запуске через tsx используем process.cwd() для получения корня проекта
const uploadsPath = path.resolve(process.cwd(), 'uploads');

console.log('Uploads path:', uploadsPath);
console.log('Current working directory:', process.cwd());

// Проверяем существование папки uploads
if (!fs.existsSync(uploadsPath)) {
  console.warn('Папка uploads не найдена:', uploadsPath);
  // Создаем папку, если её нет
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log('Папка uploads создана');
} else {
  const files = fs.readdirSync(uploadsPath);
  console.log(`Найдено файлов в uploads: ${files.length}`);
}

app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    // Устанавливаем правильные заголовки для изображений
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    }
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
