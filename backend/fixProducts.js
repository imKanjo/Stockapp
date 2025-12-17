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

// Функция для исправления данных
async function fixProductData() {
  console.log('Исправляем данные продуктов и категорий...');

  try {
    // Получаем все продукты
    const products = await allQuery('SELECT * FROM products');
    
    console.log(`Найдено ${products.length} продуктов для обработки`);
    
    // Для примера, привяжем некоторые продукты к категориям вручную
    for (const product of products) {
      let categoryId = null;
      
      // Простая логика привязки: если в названии продукта есть "Видеокарта", привязываем к "Электроника"
      if (product.name.toLowerCase().includes('видеокарта')) {
        // Ищем категорию "Электроника"
        const category = await allQuery('SELECT id FROM categories WHERE name = ?', ['Электроника']);
        if (category.length > 0) {
          categoryId = category[0].id;
        }
      } else if (product.name.toLowerCase().includes('банан')) {
        // Ищем категорию "Продукты" или создаем новую
        let category = await allQuery('SELECT id FROM categories WHERE name = ?', ['Продукты']);
        if (category.length === 0) {
          // Создаем категорию "Продукты", если её нет
          await runQuery('INSERT INTO categories (name, description) VALUES (?, ?)', ['Продукты', 'Продовольственные товары']);
          category = await allQuery('SELECT id FROM categories WHERE name = ?', ['Продукты']);
        }
        if (category.length > 0) {
          categoryId = category[0].id;
        }
      } else {
        // Привязываем остальные к первой попавшейся категории
        const firstCategory = await allQuery('SELECT id FROM categories LIMIT 1');
        if (firstCategory.length > 0) {
          categoryId = firstCategory[0].id;
        }
      }
      
      // Обновляем продукт, если нашли подходящую категорию
      if (categoryId) {
        await runQuery('UPDATE products SET category_id = ? WHERE id = ?', [categoryId, product.id]);
        console.log(`Продукт "${product.name}" привязан к категории ID: ${categoryId}`);
      } else {
        console.log(`Не удалось найти категорию для продукта "${product.name}"`);
      }
    }
    
    console.log('Обновление завершено!');

    // Проверим результат
    const updatedProducts = await allQuery('SELECT * FROM products');
    console.log('\n--- Обновленные продукты ---');
    console.table(updatedProducts.map(p => ({
      id: p.id,
      name: p.name,
      category_id: p.category_id
    })));

  } catch (err) {
    console.error('Ошибка при обновлении данных:', err);
  } finally {
    // Закрываем соединение
    db.close((err) => {
      if (err) {
        console.error('Ошибка при закрытии базы данных:', err);
      } else {
        console.log('Соединение с базой данных закрыто');
      }
    });
  }
}

fixProductData();