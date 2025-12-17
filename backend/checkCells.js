const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/warehouse.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Проверим ячейки с заполнением
  db.all(`
    SELECT c.*, z.name as zone_name, i.quantity, p.name as product_name, p.sku
    FROM cells c
    LEFT JOIN zones z ON c.zone_id = z.id
    LEFT JOIN inventory i ON c.id = i.cell_id
    LEFT JOIN products p ON i.product_id = p.id
    WHERE c.current_fill > 0
    ORDER BY c.zone_id, c.row_number, c.cell_number
  `, [], (err, rows) => {
    if (err) {
      console.error('Ошибка запроса:', err);
    } else {
      console.log('\nЯчейки с заполнением:');
      console.table(rows);
    }
    
    // Проверим все инвентарные записи
    db.all(`
      SELECT i.*, c.row_number, c.cell_number, z.name as zone_name, p.name as product_name
      FROM inventory i
      LEFT JOIN cells c ON i.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
      LEFT JOIN products p ON i.product_id = p.id
    `, [], (err, invRows) => {
      if (err) {
        console.error('Ошибка запроса инвентаря:', err);
      } else {
        console.log('\nВсе инвентарные записи:');
        console.table(invRows);
      }
      
      // Проверим операции
      db.all(`
        SELECT o.*, u.full_name as user_name, p.name as product_name, c.row_number, c.cell_number, z.name as zone_name
        FROM operations o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN cells c ON o.cell_id = c.id
        LEFT JOIN zones z ON c.zone_id = z.id
        ORDER BY o.created_at DESC
      `, [], (err, opRows) => {
        if (err) {
          console.error('Ошибка запроса операций:', err);
        } else {
          console.log('\nВсе операции:');
          console.table(opRows);
        }
        
        db.close();
      });
    });
  });
});