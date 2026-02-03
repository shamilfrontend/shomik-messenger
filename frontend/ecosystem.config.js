module.exports = {
    apps: [{
        name: 'vue-vite-app',
        script: 'node_modules/vite/bin/vite.js',
        args: 'preview --port 3000 --host',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
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
