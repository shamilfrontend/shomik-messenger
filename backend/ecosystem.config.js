module.exports = {
    apps: [{
        name: 'vue-vite-app',
        script: 'node_modules/vite/bin/vite.js',
        args: 'preview --port 3000 --host',
        env: {
            PORT: 5001,
            MONGODB_URI: 'mongodb://shomik_user:Prototype123@localhost:27017/shomik-messenger?authSource=shomik-messenger',
            JWT_SECRET: 'shama_ama_messanger007_ahamani',
            JWT_EXPIRES_IN: '7d',
            NODE_ENV: 'development',
            FRONTEND_URL: 'http://155.212.218.104:3000',
        },
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        error_file: './logs/error.log',
        out_file: './logs/out.log',
        log_file: './logs/combined.log',
        time: true
    }]
}
