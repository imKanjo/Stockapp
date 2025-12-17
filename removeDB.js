const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'warehouse.db');

// Удаляем файл базы данных
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Старая база данных удалена');
} else {
  console.log('Файл базы данных не найден, создание новой');
}

console.log('Теперь запустите: node backend/seedData.js');