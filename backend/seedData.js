const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// Используем файл db.js для инициализации базы данных
const dbModule = require('./db');
let db = null;

// Инициализируем базу данных
function initDatabase() {
  return new Promise((resolve, reject) => {
    // Подключаемся к базе данных
    const dbPath = path.resolve(__dirname, '../database/warehouse.db');
    db = new sqlite3.Database(dbPath);

    // Инициализируем структуру базы данных
    dbModule.init();

    // Небольшая задержка, чтобы структура базы данных была создана
    setTimeout(resolve, 1000);
  });
}

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

// Функция для очистки существующих данных
async function clearTables() {
  console.log('Очистка существующих данных...');
  
  await runQuery('DELETE FROM operations');
  await runQuery('DELETE FROM inventory');
  await runQuery('DELETE FROM cells');
  await runQuery('DELETE FROM zones');
  await runQuery('DELETE FROM products');
  await runQuery('DELETE FROM users');
  
  console.log('Существующие данные удалены');
}

// Функция для добавления тестовых пользователей
async function seedUsers() {
  console.log('Добавление тестовых пользователей...');
  
  const users = [
    { login: 'admin', password: 'admin123', full_name: 'Администратор Системы', role: 'admin' },
    { login: 'manager1', password: 'pass456', full_name: 'Иван Петров', role: 'manager' },
    { login: 'manager2', password: 'pass456', full_name: 'Мария Смирнова', role: 'manager' },
    { login: 'worker1', password: 'pass789', full_name: 'Алексей Кузнецов', role: 'worker' },
    { login: 'worker2', password: 'pass789', full_name: 'Елена Волкова', role: 'worker' },
    { login: 'worker3', password: 'pass789', full_name: 'Дмитрий Орлов', role: 'worker' }
  ];
  
  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await runQuery(
      'INSERT INTO users (login, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [user.login, hashedPassword, user.full_name, user.role]
    );
  }
  
  console.log('Тестовые пользователи добавлены');
}

// Функция для добавления тестовых зон
async function seedZones() {
  console.log('Добавление тестовых зон...');
  
  const zones = [
    { name: 'Зона A', description: 'Основная зона хранения продукции' },
    { name: 'Зона B', description: 'Холодильные камеры' },
    { name: 'Зона C', description: 'Оборудование и инструменты' },
    { name: 'Зона D', description: 'Временное хранение' },
    { name: 'Зона E', description: 'Зона отгрузки' }
  ];
  
  for (const zone of zones) {
    await runQuery(
      'INSERT INTO zones (name, description) VALUES (?, ?)',
      [zone.name, zone.description]
    );
  }
  
  console.log('Тестовые зоны добавлены');
}

// Функция для добавления тестовых ячеек
async function seedCells() {
  console.log('Добавление тестовых ячеек...');
  
  // Получаем ID зон
  const zones = await allQuery('SELECT id FROM zones');
  
  for (const zone of zones) {
    // Создаем ячейки для каждой зоны (например, 5 рядов по 10 ячеек в каждом)
    for (let row = 1; row <= 5; row++) {
      for (let cellNum = 1; cellNum <= 10; cellNum++) {
        const capacity = Math.floor(Math.random() * 80) + 20; // Емкость от 20 до 100
        await runQuery(
          'INSERT INTO cells (zone_id, row_number, cell_number, capacity) VALUES (?, ?, ?, ?)',
          [zone.id, row, cellNum, capacity]
        );
      }
    }
  }
  
  console.log('Тестовые ячейки добавлены');
}

// Функция для добавления тестовых категорий
async function seedCategories() {
  console.log('Добавление тестовых категорий...');

  const categories = [
    { name: 'Электроника', description: 'Электронные устройства и компоненты' },
    { name: 'Аксессуары', description: 'Аксессуары для электроники' },
    { name: 'Канцелярия', description: 'Канцелярские товары' },
    { name: 'Бытовая техника', description: 'Бытовые приборы' },
    { name: 'Продукты питания', description: 'Продовольственные товары' },
    { name: 'Инструменты', description: 'Строительные и хозяйственные инструменты' }
  ];

  for (const category of categories) {
    await runQuery(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [category.name, category.description]
    );
  }

  console.log('Тестовые категории добавлены');
}

// Функция для добавления тестовых продуктов
async function seedProducts() {
  console.log('Добавление тестовых продуктов...');

  // Получаем ID категорий для привязки
  const categoryMap = {};
  const categoryRows = await allQuery('SELECT id, name FROM categories');
  categoryRows.forEach(cat => {
    categoryMap[cat.name] = cat.id;
  });

  const products = [
    { name: 'Ноутбук Dell Inspiron', sku: 'DELL-INS-15', category_name: 'Электроника', unit: 'шт' },
    { name: 'Мышь беспроводная Logitech', sku: 'LOG-MOUSE-WIRELESS', category_name: 'Аксессуары', unit: 'шт' },
    { name: 'Клавиатура механическая', sku: 'KEY-MECH-GB', category_name: 'Аксессуары', unit: 'шт' },
    { name: 'Монитор 27 дюймов', sku: 'MON-27-SAM', category_name: 'Электроника', unit: 'шт' },
    { name: 'Ручка шариковая синяя', sku: 'PEN-BLUE-100', category_name: 'Канцелярия', unit: 'шт' },
    { name: 'Бумага А4 белая', sku: 'PAPER-A4-WHITE', category_name: 'Канцелярия', unit: 'пачка' },
    { name: 'Кофемашина автоматическая', sku: 'COFFEE-AUTO-ESP', category_name: 'Бытовая техника', unit: 'шт' },
    { name: 'Чай черный крупнолистовой', sku: 'TEA-BLK-LRG', category_name: 'Продукты питания', unit: 'упаковка' },
    { name: 'Гвозди строительные', sku: 'NAIL-CONSTR-50MM', category_name: 'Инструменты', unit: 'кг' },
    { name: 'Шурупы саморезы', sku: 'SCREW-DRIVER-TYPE', category_name: 'Инструменты', unit: 'шт' }
  ];

  for (const product of products) {
    const categoryId = categoryMap[product.category_name];
    await runQuery(
      'INSERT INTO products (name, sku, category_id, unit) VALUES (?, ?, ?, ?)',
      [product.name, product.sku, categoryId, product.unit]
    );
  }

  console.log('Тестовые продукты добавлены');
}

// Функция для добавления тестового инвентаря
async function seedInventory() {
  console.log('Добавление тестового инвентаря...');

  // Получаем все доступные ячейки и продукты
  const cells = await allQuery('SELECT id FROM cells');
  const products = await allQuery('SELECT id FROM products');

  // Добавляем инвентарь в случайные ячейки (примерно 70% ячеек будут заняты)
  const occupiedCells = Math.floor(cells.length * 0.7);

  for (let i = 0; i < occupiedCells; i++) {
    const randomCell = cells[Math.floor(Math.random() * cells.length)];
    const randomProduct = products[Math.floor(Math.random() * products.length)];

    // Определяем случайное количество товара (от 5 до 50 единиц)
    const quantity = Math.floor(Math.random() * 46) + 5;

    try {
      // Пробуем добавить запись в инвентарь
      await runQuery(
        'INSERT INTO inventory (cell_id, product_id, quantity) VALUES (?, ?, ?)',
        [randomCell.id, randomProduct.id, quantity]
      );
    } catch (err) {
      // Если возникает ошибка из-за уникальности (ячейка-продукт уже занята), пропускаем
      if (err.errno !== 19) { // SQLITE_CONSTRAINT
        console.error('Ошибка при добавлении инвентаря:', err);
      }
      continue;
    }
  }

  console.log('Тестовый инвентарь добавлен');
}

// Функция для добавления тестовых операций работника
async function seedWorkerOperations() {
  console.log('Добавление тестовых операций работника...');

  // Получаем всех работников, продукты и ячейки
  const workers = await allQuery('SELECT id FROM users WHERE role = "worker"');
  const products = await allQuery('SELECT id FROM products');
  const cells = await allQuery('SELECT id FROM cells');

  // Создаем операции приема товаров (PUT) от работников
  for (let i = 0; i < 45; i++) { // 45 операций приема
    const randomWorker = workers[Math.floor(Math.random() * workers.length)];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const randomCell = cells[Math.floor(Math.random() * cells.length)];

    const quantity = Math.floor(Math.random() * 15) + 1; // от 1 до 15 единиц

    // Создаем операцию приема товара
    await runQuery(
      'INSERT INTO operations (type, product_id, cell_id, quantity, user_id) VALUES (?, ?, ?, ?, ?)',
      ['PUT', randomProduct.id, randomCell.id, quantity, randomWorker.id]
    );

    // Обновляем инвентарь
    try {
      await runQuery(
        'INSERT INTO inventory (cell_id, product_id, quantity) VALUES (?, ?, ?) ON CONFLICT(cell_id, product_id) DO UPDATE SET quantity = quantity + ?',
        [randomCell.id, randomProduct.id, quantity, quantity]
      );
    } catch (err) {
      // Если возникает ошибка, возможно, используем упрощенную версию для SQLite
      const existingInventory = await allQuery(
        'SELECT quantity FROM inventory WHERE cell_id = ? AND product_id = ?',
        [randomCell.id, randomProduct.id]
      );

      if (existingInventory.length > 0) {
        await runQuery(
          'UPDATE inventory SET quantity = quantity + ? WHERE cell_id = ? AND product_id = ?',
          [quantity, randomCell.id, randomProduct.id]
        );
      } else {
        await runQuery(
          'INSERT INTO inventory (cell_id, product_id, quantity) VALUES (?, ?, ?)',
          [randomCell.id, randomProduct.id, quantity]
        );
      }
    }
  }

  // Создаем операции отгрузки (TAKE) от работников
  for (let i = 0; i < 30; i++) { // 30 операций отгрузки
    // Выбираем случайный элемент из инвентаря с количеством > 0
    const inventoryList = await allQuery('SELECT * FROM inventory WHERE quantity > 0');

    if (inventoryList.length > 0) {
      const randomInventory = inventoryList[Math.floor(Math.random() * inventoryList.length)];
      const randomWorker = workers[Math.floor(Math.random() * workers.length)];

      // Определяем количество для отгрузки
      const maxQuantity = Math.min(10, randomInventory.quantity); // максимум 10 или все что есть
      const quantity = Math.floor(Math.random() * maxQuantity) + 1;

      // Создаем операцию отгрузки
      await runQuery(
        'INSERT INTO operations (type, product_id, cell_id, quantity, user_id) VALUES (?, ?, ?, ?, ?)',
        ['TAKE', randomInventory.product_id, randomInventory.cell_id, quantity, randomWorker.id]
      );

      // Обновляем количество в инвентаре
      const newQuantity = randomInventory.quantity - quantity;
      if (newQuantity <= 0) {
        await runQuery('DELETE FROM inventory WHERE cell_id = ? AND product_id = ?', [randomInventory.cell_id, randomInventory.product_id]);
      } else {
        await runQuery('UPDATE inventory SET quantity = ? WHERE cell_id = ? AND product_id = ?', [newQuantity, randomInventory.cell_id, randomInventory.product_id]);
      }
    }
  }

  // Создаем операции перемещения (MOVE) от работников
  for (let i = 0; i < 25; i++) { // 25 операций перемещения
    // Выбираем случайный элемент из инвентаря с количеством > 0
    const inventoryList = await allQuery('SELECT * FROM inventory WHERE quantity > 0');

    if (inventoryList.length > 1) { // Нужно хотя бы 2 разных элемента инвентаря для перемещения
      const randomInventory = inventoryList[Math.floor(Math.random() * inventoryList.length)];
      const randomWorker = workers[Math.floor(Math.random() * workers.length)];

      // Выбираем другую случайную ячейку для перемещения
      const otherCells = await allQuery('SELECT id FROM cells WHERE id != ?', [randomInventory.cell_id]);
      if (otherCells.length > 0) {
        const targetCell = otherCells[Math.floor(Math.random() * otherCells.length)];

        // Определяем количество для перемещения
        const maxQuantity = Math.min(8, randomInventory.quantity); // максимум 8
        const quantity = Math.floor(Math.random() * maxQuantity) + 1;

        // Создаем операцию перемещения
        await runQuery(
          'INSERT INTO operations (type, product_id, cell_id, quantity, user_id) VALUES (?, ?, ?, ?, ?)',
          ['MOVE', randomInventory.product_id, targetCell.id, quantity, randomWorker.id]
        );

        // Обновляем инвентарь - уменьшаем в старой ячейке и добавляем в новой
        const remainingQuantity = randomInventory.quantity - quantity;
        if (remainingQuantity <= 0) {
          await runQuery('DELETE FROM inventory WHERE cell_id = ? AND product_id = ?', [randomInventory.cell_id, randomInventory.product_id]);
        } else {
          await runQuery('UPDATE inventory SET quantity = ? WHERE cell_id = ? AND product_id = ?', [remainingQuantity, randomInventory.cell_id, randomInventory.product_id]);
        }

        // Добавляем количество в новую ячейку
        const existingTargetInventory = await allQuery(
          'SELECT quantity FROM inventory WHERE cell_id = ? AND product_id = ?',
          [targetCell.id, randomInventory.product_id]
        );

        if (existingTargetInventory.length > 0) {
          await runQuery(
            'UPDATE inventory SET quantity = quantity + ? WHERE cell_id = ? AND product_id = ?',
            [quantity, targetCell.id, randomInventory.product_id]
          );
        } else {
          await runQuery(
            'INSERT INTO inventory (cell_id, product_id, quantity) VALUES (?, ?, ?)',
            [targetCell.id, randomInventory.product_id, quantity]
          );
        }
      }
    }
  }

  console.log('Тестовые операции работника добавлены');
}

// Функция для добавления начальных тестовых операций
async function seedOperations() {
  console.log('Добавление начальных тестовых операций...');

  // Получаем все необходимые ID
  const users = await allQuery('SELECT id FROM users');
  const products = await allQuery('SELECT id FROM products');
  const cells = await allQuery('SELECT id FROM cells');

  // Добавляем случайные операции (15 начальных операций)
  for (let i = 0; i < 15; i++) {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const randomCell = cells[Math.floor(Math.random() * cells.length)];
    const quantity = Math.floor(Math.random() * 10) + 1;

    // Случайный тип операции
    const types = ['PUT', 'TAKE', 'MOVE'];
    const type = types[Math.floor(Math.random() * types.length)];

    await runQuery(
      'INSERT INTO operations (type, product_id, cell_id, quantity, user_id) VALUES (?, ?, ?, ?, ?)',
      [type, randomProduct.id, randomCell.id, quantity, randomUser.id]
    );
  }

  console.log('Начальные тестовые операции добавлены');
}

// Основная функция для заполнения базы данными
async function seedDatabase() {
  try {
    console.log('Начинаем заполнение базы данных тестовыми данными...');

    // Инициализируем структуру базы данных
    await initDatabase();

    await clearTables();
    await seedUsers();
    await seedZones();
    await seedCells();
    await seedCategories();  // Добавляем категории перед продуктами
    await seedProducts();
    await seedInventory();
    await seedOperations();
    await seedWorkerOperations(); // Добавляем операции работника после основных операций

    console.log('База данных успешно заполнена тестовыми данными!');
  } catch (err) {
    console.error('Ошибка при заполнении базы данных:', err);
  } finally {
    // Закрываем соединение с базой данных
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Ошибка при закрытии базы данных:', err);
        } else {
          console.log('Соединение с базой данных закрыто');
        }
      });
    }
  }
}

// Выполняем заполнение базы данных при запуске скрипта
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;