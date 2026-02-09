const fs = require('fs');
const path = require('path');
const https = require('https');
import http from 'http';

import app from './app';
import WebSocketService from './services/websocket.service';

const PORT = process.env.PORT || 5001;

const server = http.createServer(app);

const wsService = new WebSocketService(server);

// Экспортируем wsService для использования в контроллерах
export {wsService};

const SERVER_IP = '155.212.218.104'; // замените на ваш IP
const CERT_PATH = '/root'; // замените на путь, где лежат сертификаты
const VUE_DIST_PATH = path.join(__dirname, 'dist'); // путь к сборке Vue
const PORT_HTTPS = 443;
const PORT_HTTP = 80;

const keyPath = path.join(CERT_PATH, `${SERVER_IP}-key.pem`);
const certPath = path.join(CERT_PATH, `${SERVER_IP}.pem`);

console.log('Проверка файлов сертификатов:');
console.log('Ключ:', keyPath);
console.log('Сертификат:', certPath);

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
	console.error('ОШИБКА: Не найдены файлы сертификатов!');
	console.log('Выполните команды:');
	console.log(`1. cd ${CERT_PATH}`);
	console.log(`2. mkcert ${SERVER_IP}`);
	process.exit(1);
}

// Опции HTTPS
const httpsOptions = {
	key: fs.readFileSync(keyPath),
	cert: fs.readFileSync(certPath),
	// Дополнительные настройки безопасности
	minVersion: 'TLSv1.2',
	ciphers: [
		'ECDHE-RSA-AES128-GCM-SHA256',
		'ECDHE-ECDSA-AES128-GCM-SHA256',
		'ECDHE-RSA-AES256-GCM-SHA384',
		'ECDHE-ECDSA-AES256-GCM-SHA384'
	].join(':'),
	honorCipherOrder: true
};

// Запускаем HTTPS сервер
https.createServer(httpsOptions, app)
	.listen(PORT_HTTPS, '0.0.0.0', () => {
		console.log('========================================');
		console.log('✅ HTTPS сервер запущен!');
		console.log(`📍 Адрес: https://${SERVER_IP}`);
		console.log(`📁 Папка с Vue: ${VUE_DIST_PATH}`);
		console.log(`🔑 Сертификаты: ${CERT_PATH}`);
		console.log('========================================');
	})
	.on('error', (err) => {
		if (err.code === 'EACCES') {
			console.error(`ОШИБКА: Нет прав на использование порта ${PORT_HTTPS}`);
			console.log('Запустите с sudo или используйте порт выше 1024');
		} else if (err.code === 'EADDRINUSE') {
			console.error(`ОШИБКА: Порт ${PORT_HTTPS} уже занят`);
			console.log('Закройте другие серверы или измените порт');
		} else {
			console.error('ОШИБКА запуска сервера:', err.message);
		}
	});

server.listen(PORT, () => {
	console.log(`Сервер запущен на порту ${PORT}`);
});

export default server;
