import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import fs from 'fs';

import { getFrontendOrigin, getMongoUri } from './config/env';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import chatRoutes from './routes/chat.routes';
import uploadRoutes from './routes/upload.routes';
import { uploadsDir } from './utils/upload';

const app = express();

app.use(cors({
  origin: getFrontendOrigin(),
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

const MONGODB_URI = getMongoUri();

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('Попытка подключения к MongoDB...');

let isMongoConnected = false;

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
})
  .then(() => {
    isMongoConnected = true;
    console.log('Подключено к MongoDB:', mongoose.connection.db?.databaseName);
  })
  .catch((error) => {
    isMongoConnected = false;
    console.error('Ошибка подключения к MongoDB:', error.message);
  });

mongoose.connection.on('connected', () => {
  isMongoConnected = true;
});

mongoose.connection.on('error', (error) => {
  isMongoConnected = false;
  console.error('Ошибка MongoDB:', error.message);
});

mongoose.connection.on('disconnected', () => {
  isMongoConnected = false;
  console.warn('MongoDB отключен');
});

mongoose.connection.on('reconnected', () => {
  isMongoConnected = true;
});

app.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }

  const { readyState } = mongoose.connection;

  if (readyState === 0) {
    return res.status(503).json({
      error: 'База данных недоступна',
      message: 'MongoDB не подключен. Убедитесь, что MongoDB запущен.',
      readyState,
    });
  }

  if (readyState === 2 && !isMongoConnected) {
    return next();
  }

  return next();
});

if (fs.existsSync(uploadsDir)) {
  console.log(`Uploads: ${uploadsDir}`);
}

app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    }
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'unavailable',
    mongo: connected ? 'connected' : 'disconnected',
    readyState: mongoose.connection.readyState,
  });
});

export default app;
