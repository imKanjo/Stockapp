const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Подключаемся к базе данных
const dbPath = path.resolve(__dirname, '../database/warehouse.db');
const db = new sqlite3.Database(dbPath);

// Функция для проверки содержимого всех таблиц
function checkTable(tableName) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
      if (err) {
        console.error(`Ошибка при запросе к таблице ${tableName}:`, err);
        reject(err);
      } else {
        console.log(`\n--- Таблица: ${tableName} (${rows.length} записей) ---`);
        if (rows.length > 0) {
          console.log(rows);
        } else {
          console.log("Таблица пуста");
        }
        resolve(rows);
      }
    });
  });
}

// Основная функция проверки
async function checkDatabase() {
  console.log('Проверка содержимого базы данных...');
  
  try {
    // Сначала проверим структуру таблиц
    console.log('\n--- Структура таблиц ---');
    db.all("SELECT name FROM sqlite_master WHERE type='table';", [], (err, tables) => {
      if (err) {
        console.error('Ошибка получения структуры таблиц:', err);
        return;
      }

      console.log('Найденные таблицы:', tables.map(t => t.name));

      // Затем проверим содержимое каждой таблицы
      const tableNames = ['users', 'zones', 'cells', 'products', 'categories', 'inventory', 'operations'];
      
      tableNames.forEach(tableName => {
        // Проверяем каждую таблицу индивидуально
        db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
          if (!err) {
            console.log(`\n--- Таблица: ${tableName} (${rows.length} записей) ---`);
            if (rows.length > 0 && rows.length <= 5) {  // Показываем первые 5 записей если их немного
              console.table(rows);
            } else if (rows.length > 0) {
              console.log(`Найдено ${rows.length} записей`);
              console.table(rows.slice(0, 2)); // Показываем первые 2 записи в уменьшенном виде
              console.log(`... и еще ${rows.length - 2} записей`);
            } else {
              console.log("Таблица пуста");
            }
          } else {
            console.log(`\n--- Таблица: ${tableName} ---`);
            console.log("Таблица не существует или ошибка доступа:", err.message);
          }
        });
      });
      
      // Закрываем соединение через небольшую задержку, чтобы успели выполниться все запросы
      setTimeout(() => {
        db.close((err) => {
          if (err) {
            console.error('Ошибка при закрытии базы данных:', err);
          } else {
            console.log('\nСоединение с базой данных закрыто');
          }
        });
      }, 2000);
    });
  } catch (err) {
    console.error('Ошибка при проверке базы данных:', err);
    db.close();
  }
}

checkDatabase();