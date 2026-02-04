const path = require('path');

let dotenv;

try {
  // Пробуем загрузить из корня проекта
  dotenv = require('dotenv');
} catch (e) {
  // Если не найден, пробуем из backend
  dotenv = require('./backend/node_modules/dotenv');
}

dotenv.config({ path: path.resolve(__dirname, '.env') });

// Логируем загруженные переменные для отладки
console.log('=== PM2 Config: Загруженные переменные ===');
console.log('DEV_MONGODB_URI:', process.env.DEV_MONGODB_URI || 'не установлен');
console.log('PROD_MONGODB_URI:', process.env.PROD_MONGODB_URI ? process.env.PROD_MONGODB_URI.replace(/:[^:@]+@/, ':****@') : 'не установлен');

module.exports = {
  apps: [
    // Production Backend
    {
      name: 'shomik-backend',
      cwd: './backend',
      script: 'dist/server.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PROD_PORT || 5001,
        MONGODB_URI: process.env.PROD_MONGODB_URI,
        JWT_SECRET: process.env.PROD_JWT_SECRET,
        JWT_EXPIRES_IN: process.env.PROD_JWT_EXPIRES_IN || '7d',
        FRONTEND_URL: process.env.PROD_FRONTEND_URL,
      },
    },

    // Development Backend
    {
      name: 'shomik-backend-dev',
      cwd: './backend',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'watch src/server.ts',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: ['src'],
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'dist', 'logs'],
      max_memory_restart: '500M',
      env_dev: {
        NODE_ENV: 'development',
        PORT: process.env.DEV_PORT || 5001,
        MONGODB_URI: process.env.DEV_MONGODB_URI,
        JWT_SECRET: process.env.DEV_JWT_SECRET,
        JWT_EXPIRES_IN: process.env.DEV_JWT_EXPIRES_IN || '7d',
        FRONTEND_URL: process.env.DEV_FRONTEND_URL,
      },
    },

    // Production Frontend
    {
      name: 'shomik-frontend',
      cwd: './frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env_production: {
        NODE_ENV: 'production',
        VITE_API_URL: process.env.PROD_VITE_API_URL,
        VITE_WS_URL: process.env.PROD_VITE_WS_URL,
      },
    },

    // Development Frontend
    {
      name: 'shomik-frontend-dev',
      cwd: './frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: '--host 0.0.0.0',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: ['src'],
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'dist'],
      max_memory_restart: '200M',
      env_dev: {
        NODE_ENV: 'development',
        VITE_API_URL: process.env.DEV_VITE_API_URL,
        VITE_WS_URL: process.env.DEV_VITE_WS_URL,
      },
    },
  ],
};
