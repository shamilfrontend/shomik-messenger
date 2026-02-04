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

// Загружаем переменные из корневого .env если они не установлены через PM2
// PM2 переменные имеют приоритет над .env файлом
if (!process.env.MONGODB_URI) {
  // Пробуем загрузить из корневого .env
  const rootEnvPath = path.resolve(__dirname, '../../.env');
  dotenv.config({ path: rootEnvPath });
  
  // Если в корневом .env есть префиксы DEV_ или PROD_, используем их
  const envPrefix = process.env.NODE_ENV === 'production' ? 'PROD_' : 'DEV_';
  if (process.env[`${envPrefix}MONGODB_URI`]) {
    process.env.MONGODB_URI = process.env[`${envPrefix}MONGODB_URI`];
    process.env.PORT = process.env.PORT || process.env[`${envPrefix}PORT`];
    process.env.JWT_SECRET = process.env.JWT_SECRET || process.env[`${envPrefix}JWT_SECRET`];
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || process.env[`${envPrefix}JWT_EXPIRES_IN`];
    process.env.FRONTEND_URL = process.env.FRONTEND_URL || process.env[`${envPrefix}FRONTEND_URL`];
  }
}

// Логируем переменные окружения для отладки
console.log('=== Переменные окружения ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@') : 'не установлен');
console.log('Все env переменные с MONGODB:', Object.keys(process.env).filter(k => k.includes('MONGODB')).join(', '));

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

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://shomik_user:Prototype123@localhost:27017/shomik-messenger?authSource=shomik-messenger';

console.log('Попытка подключения к MongoDB...');
console.log('MONGODB_URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Скрываем пароль в логах

// Проверка готовности подключения к MongoDB
let isMongoConnected = false;

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000, // Увеличиваем таймаут до 10 секунд
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
})
  .then(() => {
    isMongoConnected = true;
    console.log('✅ Подключено к MongoDB');
    console.log('База данных:', mongoose.connection.db?.databaseName);
    console.log('Готовность:', mongoose.connection.readyState);
  })
  .catch((error) => {
    isMongoConnected = false;
    console.error('❌ Ошибка подключения к MongoDB:');
    console.error('Сообщение:', error.message);
    console.error('Имя ошибки:', error.name);
    console.error('Код ошибки:', error.code);
    if (error.reason) {
      console.error('Причина:', error.reason);
    }
    console.error('MONGODB_URI (скрыт):', MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
    console.error('Проверьте:');
    console.error('1. Запущен ли MongoDB (mongod или brew services start mongodb-community)');
    console.error('2. Правильный ли username/password в MONGODB_URI');
    console.error('3. Существует ли пользователь shomik_user в базе shomik-messenger');
    console.error('4. Доступен ли MongoDB по адресу:', MONGODB_URI.split('@')[1]?.split('/')[0] || 'localhost:27017');
  });

// Обработчики событий подключения
mongoose.connection.on('connected', () => {
  isMongoConnected = true;
  console.log('✅ MongoDB подключен (событие connected)');
  console.log('База данных:', mongoose.connection.db?.databaseName);
});

mongoose.connection.on('error', (error) => {
  isMongoConnected = false;
  console.error('❌ Ошибка MongoDB (событие error):', error.message);
  console.error('Детали:', error);
});

mongoose.connection.on('disconnected', () => {
  isMongoConnected = false;
  console.warn('⚠️ MongoDB отключен (событие disconnected)');
});

mongoose.connection.on('connecting', () => {
  console.log('🔄 Подключение к MongoDB...');
});

mongoose.connection.on('reconnected', () => {
  isMongoConnected = true;
  console.log('🔄 MongoDB переподключен');
});

// Middleware для проверки подключения к MongoDB
// Пропускаем health check без проверки MongoDB
app.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  
  const readyState = mongoose.connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  
  if (readyState === 0) {
    return res.status(503).json({ 
      error: 'База данных недоступна',
      message: 'MongoDB не подключен. Убедитесь, что MongoDB запущен.',
      readyState: readyState,
      mongoUri: MONGODB_URI.replace(/:[^:@]+@/, ':****@')
    });
  }
  
  // Если идет подключение (readyState === 2), даем немного времени
  if (readyState === 2 && !isMongoConnected) {
    // Можно подождать, но для простоты просто пропускаем
    // В реальном приложении лучше использовать retry логику
  }
  
  next();
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
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'ok',
    mongo: mongoStatus,
    readyState: mongoose.connection.readyState
  });
});

export default app;
