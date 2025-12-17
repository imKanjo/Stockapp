const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Подключаемся к базе данных
const dbPath = path.resolve(__dirname, '../database/warehouse.db');
const db = new sqlite3.Database(dbPath);

// Функция для выполнения SQL запросов
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

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

// Функция для миграции данных
async function migrateCategories() {
  console.log('Начинаем миграцию данных категорий...');
  
  try {
    // Получаем все уникальные категории из старой таблицы продуктов
    const oldProducts = await allQuery('SELECT id, name, sku, category, unit FROM products');
    
    // Создаем массив уникальных категорий
    const uniqueCategories = [...new Set(oldProducts.map(p => p.category).filter(c => c && c.trim() !== ''))];
    
    console.log(`Найдено ${uniqueCategories.length} уникальных категорий для переноса`);
    
    // Создаем категории в новой таблице
    for (const categoryName of uniqueCategories) {
      if (categoryName) {
        try {
          await runQuery('INSERT OR IGNORE INTO categories (name) VALUES (?)', [categoryName]);
          console.log(`Добавлена категория: ${categoryName}`);
        } catch (err) {
          console.error(`Ошибка при добавлении категории ${categoryName}:`, err);
        }
      }
    }
    
    // Обновляем продукты, привязывая их к новым категориям
    for (const product of oldProducts) {
      if (product.category) {
        // Находим ID категории по имени
        const categoryResult = await allQuery('SELECT id FROM categories WHERE name = ?', [product.category]);
        if (categoryResult && categoryResult.length > 0) {
          const categoryId = categoryResult[0].id;
          
          // Обновляем продукт, устанавливая category_id
          await runQuery('UPDATE products SET category_id = ? WHERE id = ?', [categoryId, product.id]);
          console.log(`Продукт ${product.name} привязан к категории ID: ${categoryId}`);
        }
      }
    }
    
    // Удаляем старое поле category (на самом деле мы просто оставим его пустым, так как структура уже изменена)
    console.log('Миграция завершена успешно!');
  } catch (err) {
    console.error('Ошибка при миграции:', err);
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

migrateCategories();