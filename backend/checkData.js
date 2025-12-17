const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Подключаемся к базе данных
const dbPath = path.resolve(__dirname, '../database/warehouse.db');
const db = new sqlite3.Database(dbPath);

// Функция для выполнения SQL запросов
function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Основная функция для проверки данных
async function checkData() {
  try {
    console.log('Проверяем данные в базе...');
    
    // Проверяем пользователей
    const users = await allQuery('SELECT * FROM users');
    console.log('Пользователи:', users);
    
    // Проверяем зоны
    const zones = await allQuery('SELECT * FROM zones');
    console.log('Зоны:', zones);
    
    // Проверяем ячейки
    const cells = await allQuery('SELECT * FROM cells');
    console.log('Ячейки (первые 5):', cells.slice(0, 5));
    
    // Проверяем продукты
    const products = await allQuery('SELECT * FROM products');
    console.log('Продукты:', products);
    
  } catch (err) {
    console.error('Ошибка при проверке данных:', err);
  } finally {
    // Закрываем соединение с базой данных
    db.close((err) => {
      if (err) {
        console.error('Ошибка при закрытии базы данных:', err);
      } else {
        console.log('Соединение с базой данных закрыто');
      }
    });
  }
}

checkData();