/**
 * PM2 ecosystem config для запуска Backend и Frontend на VPS.
 * Использование:
 *   1. В backend: yarn build
 *   2. В frontend: yarn build
 *   3. pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'shomik-backend',
      cwd: './backend',
      script: 'dist/server.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
    },
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
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
