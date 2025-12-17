// Простой скрипт для запуска сервера
console.log('Запуск сервера...');

// Подключаем и запускаем сервер напрямую
const app = require('./backend/server.js');

const PORT = 4000;

const server = app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Откройте в браузере: http://localhost:${PORT}/login.html`);
  console.log('Для остановки сервера нажмите Ctrl+C');
});

// Обработка сигналов для корректного завершения
process.on('SIGINT', () => {
  console.log('\nЗавершение работы сервера...');
  server.close(() => {
    console.log('Сервер остановлен.');
    process.exit(0);
  });
});