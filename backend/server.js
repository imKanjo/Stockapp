const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 4000;

const path = require('path');

// Middleware for JSON parsing and handling CORS
app.use(cors({
  origin: '*', // In production, specify your frontend domain instead of '*'
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Middleware for authentication (verifying that user is logged in)
async function authenticateUser(req, res, next) {
  // For this implementation, we'll check the user_id in the request
  // In a production app, this would verify a JWT token or session
  const userId = req.body.user_id || req.query.user_id || req.headers['user-id'];

  if (!userId) {
    // Some endpoints should be accessible without authentication (e.g., login, register)
    const publicEndpoints = [
      '/api/users/login',
      '/api/users/register',
      '/api/users',
      '/api/zones',
      '/api/cells',
      '/api/products',
      '/api/inventory',
      '/api/operations'
    ];

    if (publicEndpoints.includes(req.path) && req.method === 'GET') {
      next(); // Allow public read access
    } else {
      return res.status(401).json({ error: 'Требуется аутентификация' });
    }
  } else {
    try {
      const user = await db.get('SELECT id, role, full_name FROM users WHERE id = ?', [userId]);
      if (!user) {
        return res.status(401).json({ error: 'Пользователь не найден' });
      }

      // Add user info to request for later use
      req.user = user;

      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

// Middleware to check user role access
function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Требуется аутентификация' });
    }

    const userRole = req.user.role;

    // Admin can access everything
    if (userRole === 'admin') {
      return next();
    }

    // Check specific role requirements
    if (requiredRole === 'admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен. Требуется роль администратора.' });
    } else if (requiredRole === 'manager' && userRole !== 'manager') {
      // Workers can't access manager-level features
      if (userRole !== 'manager' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Доступ запрещен. Требуется роль менеджера или администратора.' });
      }
    }

    next();
  };
}

// Initialize database at startup
db.init();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Warehouse Management API is running!' });
});

// API Routes - Full CRUD for all entities

// Users CRUD
app.post('/api/users', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    console.log('Add user request received:', req.body);
    console.log('Current user:', req.user);

    const { login, password, full_name, role } = req.body;

    // Check if user already exists
    const existingUser = await db.get('SELECT login FROM users WHERE login = ?', [login]);

    if (existingUser) {
      console.log('User already exists:', login);
      return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      'INSERT INTO users (login, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [login, hashedPassword, full_name, role]
    );

    // Return the created user without password hash
    const newUser = await db.get('SELECT id, login, full_name, role FROM users WHERE id = ?', [result.lastID]);
    console.log('New user created:', newUser);
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Read all users
app.get('/api/users', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const users = await db.all('SELECT id, login, full_name, role FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read single user by ID
app.get('/api/users/:id', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.get('SELECT id, login, full_name, role FROM users WHERE id = ?', [id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user
app.put('/api/users/:id', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    console.log('Update user request received for ID:', req.params.id, 'with data:', req.body);
    const { id } = req.params;
    const { login, password, full_name, role } = req.body;

    // Check if user exists
    const existingUser = await db.get('SELECT id FROM users WHERE id = ?', [id]);
    if (!existingUser) {
      console.log('User not found:', id);
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update query based on provided fields
    const updateFields = [];
    const params = [];

    if (login) {
      updateFields.push('login = ?');
      params.push(login);
    }

    if (full_name) {
      updateFields.push('full_name = ?');
      params.push(full_name);
    }

    if (role) {
      updateFields.push('role = ?');
      params.push(role);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = ?');
      params.push(hashedPassword);
    }

    console.log('Update fields:', updateFields, 'Params:', params);

    if (updateFields.length > 0) {
      params.push(id);
      await db.query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        params
      );
      console.log('User updated successfully');
    } else {
      console.log('No fields to update');
    }

    // Return updated user
    const updatedUser = await db.get('SELECT id, login, full_name, role FROM users WHERE id = ?', [id]);
    console.log('Returning updated user:', updatedUser);
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete user
app.delete('/api/users/:id', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await db.get('SELECT id FROM users WHERE id = ?', [id]);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register route
app.post('/api/users/register', async (req, res) => {
  try {
    const { login, password, full_name, role } = req.body;

    // Check if user already exists
    const existingUser = await db.get('SELECT login FROM users WHERE login = ?', [login]);

    if (existingUser) {
      return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
    }

    // Default role to 'worker' if not specified
    // Prevent users from registering as admin during registration
    let userRole = role || 'worker';
    if (userRole === 'admin') {
      userRole = 'worker'; // Force role to worker if admin is attempted during registration
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      'INSERT INTO users (login, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [login, hashedPassword, full_name, userRole]
    );

    // Return the created user without password hash
    const newUser = await db.get('SELECT id, login, full_name, role FROM users WHERE id = ?', [result.lastID]);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login route (not part of standard CRUD but important for auth)
app.post('/api/users/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    const user = await db.get('SELECT * FROM users WHERE login = ?', [login]);

    if (!user) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Zones CRUD
// Create zone
app.post('/api/zones', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await db.query('INSERT INTO zones (name, description) VALUES (?, ?)', [name, description]);
    const zone = await db.get('SELECT * FROM zones WHERE id = ?', [result.lastID]);
    res.status(201).json(zone);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Read all zones
app.get('/api/zones', authenticateUser, async (req, res) => {
  try {
    const zones = await db.all('SELECT * FROM zones');
    res.json(zones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read single zone by ID
app.get('/api/zones/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await db.get('SELECT * FROM zones WHERE id = ?', [id]);

    if (!zone) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    res.json(zone);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update zone
app.put('/api/zones/:id', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const existingZone = await db.get('SELECT id FROM zones WHERE id = ?', [id]);
    if (!existingZone) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    await db.query('UPDATE zones SET name = ?, description = ? WHERE id = ?', [name, description, id]);
    const updatedZone = await db.get('SELECT * FROM zones WHERE id = ?', [id]);
    res.json(updatedZone);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete zone
app.delete('/api/zones/:id', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const existingZone = await db.get('SELECT id FROM zones WHERE id = ?', [id]);
    if (!existingZone) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    await db.query('DELETE FROM zones WHERE id = ?', [id]);
    res.json({ message: 'Zone deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cells CRUD
// Create cell
app.post('/api/cells', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const { zone_id, row_number, cell_number, capacity } = req.body;

    // Validate zone exists
    const zone = await db.get('SELECT id FROM zones WHERE id = ?', [zone_id]);
    if (!zone) {
      return res.status(400).json({ error: 'Зона не существует' });
    }

    const result = await db.query(
      'INSERT INTO cells (zone_id, row_number, cell_number, capacity, current_fill) VALUES (?, ?, ?, ?, 0)',
      [zone_id, row_number, cell_number, capacity]
    );

    const cell = await db.get(`
      SELECT c.*, z.name as zone_name
      FROM cells c
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE c.id = ?
    `, [result.lastID]);

    res.status(201).json(cell);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Read all cells
app.get('/api/cells', authenticateUser, async (req, res) => {
  try {
    const cells = await db.all(`
      SELECT c.*, z.name as zone_name
      FROM cells c
      LEFT JOIN zones z ON c.zone_id = z.id
    `);
    res.json(cells);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read single cell by ID
app.get('/api/cells/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const cell = await db.get(`
      SELECT c.*, z.name as zone_name
      FROM cells c
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE c.id = ?
    `, [id]);

    if (!cell) {
      return res.status(404).json({ error: 'Cell not found' });
    }

    res.json(cell);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update cell
app.put('/api/cells/:id', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { zone_id, row_number, cell_number, capacity } = req.body;

    const existingCell = await db.get('SELECT id FROM cells WHERE id = ?', [id]);
    if (!existingCell) {
      return res.status(404).json({ error: 'Cell not found' });
    }

    // Validate zone exists
    if (zone_id) {
      const zone = await db.get('SELECT id FROM zones WHERE id = ?', [zone_id]);
      if (!zone) {
        return res.status(400).json({ error: 'Зона не существует' });
      }
    }

    await db.query(
      'UPDATE cells SET zone_id = ?, row_number = ?, cell_number = ?, capacity = ? WHERE id = ?',
      [zone_id, row_number, cell_number, capacity, id]
    );

    const updatedCell = await db.get(`
      SELECT c.*, z.name as zone_name
      FROM cells c
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE c.id = ?
    `, [id]);

    res.json(updatedCell);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete cell
app.delete('/api/cells/:id', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const existingCell = await db.get('SELECT id FROM cells WHERE id = ?', [id]);
    if (!existingCell) {
      return res.status(404).json({ error: 'Cell not found' });
    }

    await db.query('DELETE FROM cells WHERE id = ?', [id]);
    res.json({ message: 'Cell deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Products CRUD
// Create product - Workers can create products for receiving goods
app.post('/api/products', authenticateUser, async (req, res) => {
  try {
    const { name, sku, category_id, unit, category } = req.body;

    // If category_id is not provided but category name is, find or create category
    let finalCategoryId = category_id;
    if (!finalCategoryId && category) {
      // Try to find the category by name
      let categoryRecord = await db.get('SELECT id FROM categories WHERE name = ?', [category]);
      if (!categoryRecord) {
        // Create the category if it doesn't exist
        const result = await db.query('INSERT INTO categories (name) VALUES (?)', [category]);
        finalCategoryId = result.lastID;
      } else {
        finalCategoryId = categoryRecord.id;
      }
    }

    const result = await db.query(
      'INSERT INTO products (name, sku, category_id, unit) VALUES (?, ?, ?, ?)',
      [name, sku, finalCategoryId, unit]
    );

    // Get the created product
    const product = await db.get(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [result.lastID]);

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Read all products
app.get('/api/products', authenticateUser, async (req, res) => {
  try {
    const products = await db.all(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read single product by ID
app.get('/api/products/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await db.get(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [id]);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update product
app.put('/api/products/:id', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sku, category_id, unit, category } = req.body;

    const existingProduct = await db.get('SELECT id FROM products WHERE id = ?', [id]);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // If category_id is not provided but category name is, find or create category
    let finalCategoryId = category_id;
    if (category && !category_id) {
      // Try to find the category by name
      let categoryRecord = await db.get('SELECT id FROM categories WHERE name = ?', [category]);
      if (!categoryRecord) {
        // Create the category if it doesn't exist
        const result = await db.query('INSERT INTO categories (name) VALUES (?)', [category]);
        finalCategoryId = result.lastID;
      } else {
        finalCategoryId = categoryRecord.id;
      }
    }

    await db.query(
      'UPDATE products SET name = ?, sku = ?, category_id = ?, unit = ? WHERE id = ?',
      [name, sku, finalCategoryId, unit, id]
    );

    const updatedProduct = await db.get(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [id]);
    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete product
app.delete('/api/products/:id', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const existingProduct = await db.get('SELECT id FROM products WHERE id = ?', [id]);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await db.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Categories CRUD
// Create category - Workers can create categories for new products
app.post('/api/categories', authenticateUser, async (req, res) => {
  try {
    const { name, description } = req.body;

    const result = await db.query(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description]
    );

    const category = await db.get('SELECT * FROM categories WHERE id = ?', [result.lastID]);
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Read all categories - Workers can access categories for product creation
app.get('/api/categories', authenticateUser, async (req, res) => {
  try {
    const categories = await db.all('SELECT * FROM categories ORDER BY name');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read all categories with count of products in each category
app.get('/api/categories/with-products', authenticateUser, async (req, res) => {
  try {
    const categories = await db.all(`
      SELECT
        c.id,
        c.name,
        c.description,
        c.created_at,
        COUNT(p.id) as products_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id, c.name, c.description, c.created_at
      ORDER BY c.name
    `);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read single category by ID
app.get('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await db.get('SELECT * FROM categories WHERE id = ?', [id]);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update category
app.put('/api/categories/:id', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const existingCategory = await db.get('SELECT id FROM categories WHERE id = ?', [id]);
    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await db.query('UPDATE categories SET name = ?, description = ? WHERE id = ?', [name, description, id]);

    const updatedCategory = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json(updatedCategory);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete category
app.delete('/api/categories/:id', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const existingCategory = await db.get('SELECT id FROM categories WHERE id = ?', [id]);
    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await db.query('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inventory CRUD
// Create/update inventory - Workers have full access to inventory operations as part of their core functions
app.post('/api/inventory', authenticateUser, async (req, res) => {
  try {
    const { cell_id, product_id, quantity } = req.body;

    // Validate cell and product exist
    const cell = await db.get('SELECT id FROM cells WHERE id = ?', [cell_id]);
    if (!cell) {
      return res.status(400).json({ error: 'Ячейка не существует' });
    }

    const product = await db.get('SELECT id FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(400).json({ error: 'Товар не существует' });
    }

    // Check if inventory already exists for this cell and product
    const existing = await db.get('SELECT * FROM inventory WHERE cell_id = ? AND product_id = ?', [cell_id, product_id]);

    if (existing) {
      // Update existing inventory
      await db.query(
        'UPDATE inventory SET quantity = quantity + ? WHERE cell_id = ? AND product_id = ?',
        [quantity, cell_id, product_id]
      );
    } else {
      // Insert new inventory record
      await db.query(
        'INSERT INTO inventory (cell_id, product_id, quantity, placed_at) VALUES (?, ?, ?, datetime("now"))',
        [cell_id, product_id, quantity]
      );
    }

    // Update cell fill
    await db.query(
      `UPDATE cells SET current_fill = (
        SELECT COALESCE(SUM(i.quantity), 0)
        FROM inventory i
        WHERE i.cell_id = ?
      ) WHERE id = ?`,
      [cell_id, cell_id]
    );

    // Create operation record
    const userId = req.user.id;
    await db.query(
      'INSERT INTO operations (type, product_id, cell_id, quantity, user_id, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      ['PUT', product_id, cell_id, quantity, userId]
    );

    // Return updated inventory
    const updatedInventory = await db.get(`
      SELECT i.*, p.name as product_name, p.sku, c.row_number, c.cell_number, z.name as zone_name
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      LEFT JOIN cells c ON i.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE i.cell_id = ? AND i.product_id = ?
    `, [cell_id, product_id]);

    res.status(201).json(updatedInventory);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Read all inventory
app.get('/api/inventory', authenticateUser, async (req, res) => {
  try {
    const inventory = await db.all(`
      SELECT i.*, p.name as product_name, p.sku, c.row_number, c.cell_number, z.name as zone_name
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      LEFT JOIN cells c ON i.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
    `);
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read single inventory record by cell and product
app.get('/api/inventory/:cellId/:productId', authenticateUser, async (req, res) => {
  try {
    const { cellId, productId } = req.params;
    const inventory = await db.get(`
      SELECT i.*, p.name as product_name, p.sku, c.row_number, c.cell_number, z.name as zone_name
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      LEFT JOIN cells c ON i.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE i.cell_id = ? AND i.product_id = ?
    `, [cellId, productId]);

    if (!inventory) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }

    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update inventory (adjust quantity) - Workers have access to modify inventory as part of their core functions
app.put('/api/inventory/:cellId/:productId', authenticateUser, async (req, res) => {
  try {
    const { cellId, productId } = req.params;
    const { quantity } = req.body;

    const existingInventory = await db.get('SELECT * FROM inventory WHERE cell_id = ? AND product_id = ?', [cellId, productId]);
    if (!existingInventory) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }

    await db.query('UPDATE inventory SET quantity = ? WHERE cell_id = ? AND product_id = ?', [quantity, cellId, productId]);

    // Update cell fill
    await db.query(
      `UPDATE cells SET current_fill = (
        SELECT COALESCE(SUM(i.quantity), 0)
        FROM inventory i
        WHERE i.cell_id = ?
      ) WHERE id = ?`,
      [cellId, cellId]
    );

    // Create operation record
    const userId = req.user.id;
    await db.query(
      'INSERT INTO operations (type, product_id, cell_id, quantity, user_id, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      ['UPDATE', parseInt(productId), parseInt(cellId), quantity, userId]
    );

    const updatedInventory = await db.get(`
      SELECT i.*, p.name as product_name, p.sku, c.row_number, c.cell_number, z.name as zone_name
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      LEFT JOIN cells c ON i.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE i.cell_id = ? AND i.product_id = ?
    `, [cellId, productId]);

    res.json(updatedInventory);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete inventory record - Workers have access to remove inventory as part of their core functions
app.delete('/api/inventory/:cellId/:productId', authenticateUser, async (req, res) => {
  try {
    const { cellId, productId } = req.params;

    const existingInventory = await db.get('SELECT * FROM inventory WHERE cell_id = ? AND product_id = ?', [cellId, productId]);
    if (!existingInventory) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }

    await db.query('DELETE FROM inventory WHERE cell_id = ? AND product_id = ?', [cellId, productId]);

    // Update cell fill
    await db.query(
      `UPDATE cells SET current_fill = (
        SELECT COALESCE(SUM(i.quantity), 0)
        FROM inventory i
        WHERE i.cell_id = ?
      ) WHERE id = ?`,
      [cellId, cellId]
    );

    // Create operation record
    const userId = req.user.id;
    await db.query(
      'INSERT INTO operations (type, product_id, cell_id, quantity, user_id, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      ['REMOVE', parseInt(productId), parseInt(cellId), existingInventory.quantity, userId]
    );

    res.json({ message: 'Inventory record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Special route for TAKE operation (removing specific quantity from inventory)
app.post('/api/take', authenticateUser, async (req, res) => {
  try {
    const { cell_id, product_id, quantity } = req.body;
    const userId = req.user.id;

    // Validate cell and product exist
    const cell = await db.get('SELECT id FROM cells WHERE id = ?', [cell_id]);
    if (!cell) {
      return res.status(400).json({ error: 'Ячейка не существует' });
    }

    const product = await db.get('SELECT id FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(400).json({ error: 'Товар не существует' });
    }

    // Check current inventory
    const inventory = await db.get('SELECT quantity FROM inventory WHERE cell_id = ? AND product_id = ?', [cell_id, product_id]);
    if (!inventory) {
      return res.status(400).json({ error: 'Товар не найден в указанной ячейке' });
    }

    if (inventory.quantity < quantity) {
      return res.status(400).json({ error: 'Недостаточно товара в ячейке' });
    }

    // Update inventory
    if (inventory.quantity === quantity) {
      await db.query('DELETE FROM inventory WHERE cell_id = ? AND product_id = ?', [cell_id, product_id]);
    } else {
      await db.query('UPDATE inventory SET quantity = quantity - ? WHERE cell_id = ? AND product_id = ?', [quantity, cell_id, product_id]);
    }

    // Update cell fill
    await db.query(
      `UPDATE cells SET current_fill = (
        SELECT COALESCE(SUM(i.quantity), 0)
        FROM inventory i
        WHERE i.cell_id = ?
      ) WHERE id = ?`,
      [cell_id, cell_id]
    );

    // Create operation record
    await db.query(
      'INSERT INTO operations (type, product_id, cell_id, quantity, user_id, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      ['TAKE', product_id, cell_id, quantity, userId]
    );

    res.json({ message: 'Отгрузка успешно выполнена' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Special route for MOVE operation (moving specific quantity from one cell to another)
app.post('/api/move', authenticateUser, async (req, res) => {
  try {
    const { from_cell_id, to_cell_id, product_id, quantity } = req.body;
    const userId = req.user.id;

    // Validate cells and product exist
    const fromCell = await db.get('SELECT id FROM cells WHERE id = ?', [from_cell_id]);
    const toCell = await db.get('SELECT id FROM cells WHERE id = ?', [to_cell_id]);
    const product = await db.get('SELECT id FROM products WHERE id = ?', [product_id]);

    if (!fromCell) {
      return res.status(400).json({ error: 'Исходная ячейка не существует' });
    }
    if (!toCell) {
      return res.status(400).json({ error: 'Целевая ячейка не существует' });
    }
    if (!product) {
      return res.status(400).json({ error: 'Товар не существует' });
    }

    // Check current inventory in source cell
    const fromInventory = await db.get('SELECT quantity FROM inventory WHERE cell_id = ? AND product_id = ?', [from_cell_id, product_id]);
    if (!fromInventory) {
      return res.status(400).json({ error: 'Товар не найден в исходной ячейке' });
    }

    if (fromInventory.quantity < quantity) {
      return res.status(400).json({ error: 'Недостаточно товара в исходной ячейке' });
    }

    // Update inventory in source cell
    if (fromInventory.quantity === quantity) {
      await db.query('DELETE FROM inventory WHERE cell_id = ? AND product_id = ?', [from_cell_id, product_id]);
    } else {
      await db.query('UPDATE inventory SET quantity = quantity - ? WHERE cell_id = ? AND product_id = ?', [quantity, from_cell_id, product_id]);
    }

    // Update inventory in destination cell
    const toInventory = await db.get('SELECT quantity FROM inventory WHERE cell_id = ? AND product_id = ?', [to_cell_id, product_id]);
    if (toInventory) {
      await db.query('UPDATE inventory SET quantity = quantity + ? WHERE cell_id = ? AND product_id = ?', [quantity, to_cell_id, product_id]);
    } else {
      await db.query('INSERT INTO inventory (cell_id, product_id, quantity) VALUES (?, ?, ?)', [to_cell_id, product_id, quantity]);
    }

    // Update cell fills
    await db.query(
      `UPDATE cells SET current_fill = (
        SELECT COALESCE(SUM(i.quantity), 0)
        FROM inventory i
        WHERE i.cell_id = ?
      ) WHERE id = ?`,
      [from_cell_id, from_cell_id]
    );
    await db.query(
      `UPDATE cells SET current_fill = (
        SELECT COALESCE(SUM(i.quantity), 0)
        FROM inventory i
        WHERE i.cell_id = ?
      ) WHERE id = ?`,
      [to_cell_id, to_cell_id]
    );

    // Create operation record
    await db.query(
      'INSERT INTO operations (type, product_id, cell_id, quantity, user_id, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      ['MOVE', product_id, from_cell_id, quantity, userId]
    );

    res.json({ message: 'Перемещение успешно выполнено' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Operations CRUD
// Read all operations
app.get('/api/operations', authenticateUser, requireRole('manager'), async (req, res) => {
  try {
    const operations = await db.all(`
      SELECT o.*, u.full_name as user_name, p.name as product_name, c.row_number, c.cell_number, z.name as zone_name
      FROM operations o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN cells c ON o.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
      ORDER BY o.created_at DESC
    `);
    res.json(operations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read single operation by ID
app.get('/api/operations/:id', authenticateUser, requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const operation = await db.get(`
      SELECT o.*, u.full_name as user_name, p.name as product_name, c.row_number, c.cell_number, z.name as zone_name
      FROM operations o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN cells c ON o.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE o.id = ?
    `, [id]);

    if (!operation) {
      return res.status(404).json({ error: 'Operation not found' });
    }

    res.json(operation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export inventory to CSV
app.get('/api/export/csv', authenticateUser, async (req, res) => {
  try {
    // Query to get inventory with product details and locations
    const inventory = await db.all(`
      SELECT
        p.name as 'Продукт',
        p.sku as 'Артикул',
        i.quantity as 'Общее количество',
        z.name || ' (' || c.row_number || '.' || c.cell_number || ')' as 'Местоположения',
        i.placed_at as 'Последнее обновление'
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      LEFT JOIN cells c ON i.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
      ORDER BY p.name
    `);

    // Create CSV content with proper encoding
    const headers = ['Продукт', 'Артикул', 'Общее количество', 'Местоположения', 'Последнее обновление'];
    const csvContent = headers.join(';') + '\n' +
      inventory.map(item =>
        `"${item['Продукт'] || ''}";"${item['Артикул'] || ''}";${item['Общее количество'] || 0};"${item['Местоположения'] || ''}";"${item['Последнее обновление'] || ''}`
      ).join('\n');

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_export.csv"');

    // Send CSV with UTF-8 BOM to ensure correct encoding in Excel
    const csvWithBOM = '\uFEFF' + csvContent;
    res.send(csvWithBOM);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cells with a specific product
app.get('/api/product/:productId/cells', async (req, res) => {
  try {
    const { productId } = req.params;

    // Query to get all cells containing the specified product
    const cellsWithProduct = await db.all(`
      SELECT
        c.id as cell_id,
        c.zone_id,
        c.row_number,
        c.cell_number,
        c.capacity,
        c.current_fill,
        i.quantity,
        z.name as zone_name
      FROM inventory i
      LEFT JOIN cells c ON i.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE i.product_id = ?
      ORDER BY c.zone_id, c.row_number, c.cell_number
    `, [productId]);

    res.json(cellsWithProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all available cells for a specific product
app.get('/api/product/:productId/available-cells', async (req, res) => {
  try {
    const { productId } = req.params;

    // Get all cells that already contain this product
    const existingCells = await db.all(`
      SELECT c.id, c.zone_id, c.row_number, c.cell_number, c.capacity, c.current_fill, i.quantity, z.name as zone_name
      FROM inventory i
      LEFT JOIN cells c ON i.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE i.product_id = ?
      ORDER BY c.zone_id, c.row_number, c.cell_number
    `, [productId]);

    res.json(existingCells);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all empty cells
app.get('/api/cells/empty', async (req, res) => {
  try {
    const emptyCells = await db.all(`
      SELECT c.*, z.name as zone_name
      FROM cells c
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE c.current_fill = 0
      ORDER BY c.zone_id, c.row_number, c.cell_number
    `);

    res.json(emptyCells);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all products for dropdown selection
app.get('/api/products/dropdown', async (req, res) => {
  try {
    const products = await db.all(`
      SELECT p.id, p.name, p.sku, p.unit, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.name
    `);

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get products with available quantities for take/move operations
app.get('/api/products/with-quantities', async (req, res) => {
  try {
    const products = await db.all(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.unit,
        c.name as category_name,
        COALESCE(SUM(i.quantity), 0) as total_quantity
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      GROUP BY p.id, p.name, p.sku, p.unit, c.name
      HAVING total_quantity > 0
      ORDER BY p.name
    `);

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simplified move operation - move product to another cell
app.post('/api/move/simple', authenticateUser, async (req, res) => {
  try {
    const { product_id, from_cell_id, to_cell_id, quantity } = req.body;
    const userId = req.user.id;

    // Validate cells and product exist
    const fromCell = await db.get('SELECT id, current_fill FROM cells WHERE id = ?', [from_cell_id]);
    const toCell = await db.get('SELECT id, current_fill, capacity FROM cells WHERE id = ?', [to_cell_id]);
    const product = await db.get('SELECT id, name FROM products WHERE id = ?', [product_id]);

    if (!fromCell) {
      return res.status(400).json({ error: 'Исходная ячейка не существует' });
    }
    if (!toCell) {
      return res.status(400).json({ error: 'Целевая ячейка не существует' });
    }
    if (!product) {
      return res.status(400).json({ error: 'Товар не существует' });
    }

    // Check if there is enough space in the target cell
    if (toCell.capacity < (toCell.current_fill + quantity)) {
      return res.status(400).json({ error: 'Целевая ячейка не имеет достаточного места' });
    }

    // Check current inventory in source cell
    const fromInventory = await db.get('SELECT quantity FROM inventory WHERE cell_id = ? AND product_id = ?', [from_cell_id, product_id]);
    if (!fromInventory) {
      return res.status(400).json({ error: 'Товар не найден в исходной ячейке' });
    }

    if (fromInventory.quantity < quantity) {
      return res.status(400).json({ error: 'Недостаточно товара в исходной ячейке' });
    }

    // Update inventory in source cell
    if (fromInventory.quantity === quantity) {
      await db.query('DELETE FROM inventory WHERE cell_id = ? AND product_id = ?', [from_cell_id, product_id]);
    } else {
      await db.query('UPDATE inventory SET quantity = quantity - ? WHERE cell_id = ? AND product_id = ?', [quantity, from_cell_id, product_id]);
    }

    // Update inventory in destination cell
    const toInventory = await db.get('SELECT quantity FROM inventory WHERE cell_id = ? AND product_id = ?', [to_cell_id, product_id]);
    if (toInventory) {
      await db.query('UPDATE inventory SET quantity = quantity + ? WHERE cell_id = ? AND product_id = ?', [quantity, to_cell_id, product_id]);
    } else {
      await db.query('INSERT INTO inventory (cell_id, product_id, quantity) VALUES (?, ?, ?)', [to_cell_id, product_id, quantity]);
    }

    // Update cell fills
    await db.query(
      `UPDATE cells SET current_fill = (
        SELECT COALESCE(SUM(i.quantity), 0)
        FROM inventory i
        WHERE i.cell_id = ?
      ) WHERE id = ?`,
      [from_cell_id, from_cell_id]
    );
    await db.query(
      `UPDATE cells SET current_fill = (
        SELECT COALESCE(SUM(i.quantity), 0)
        FROM inventory i
        WHERE i.cell_id = ?
      ) WHERE id = ?`,
      [to_cell_id, to_cell_id]
    );

    // Create operation record
    await db.query(
      'INSERT INTO operations (type, product_id, cell_id, quantity, user_id, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      ['MOVE', product_id, from_cell_id, quantity, userId]
    );

    res.json({ message: 'Перемещение успешно выполнено' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Simplified take operation - take product from any available cell
app.post('/api/take/simple', authenticateUser, async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const userId = req.user.id;

    // Validate product exists
    const product = await db.get('SELECT id, name FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(400).json({ error: 'Товар не существует' });
    }

    // Find all cells containing the product, ordered by cell_id to ensure consistent behavior
    const cellsWithProduct = await db.all(`
      SELECT i.cell_id, i.quantity, c.current_fill, c.capacity
      FROM inventory i
      LEFT JOIN cells c ON i.cell_id = c.id
      WHERE i.product_id = ?
      ORDER BY i.cell_id
    `, [product_id]);

    if (!cellsWithProduct || cellsWithProduct.length === 0) {
      return res.status(400).json({ error: 'Товар не найден в ячейках' });
    }

    let remainingQuantity = quantity;
    const cellsToProcess = [];

    // Find the cells from which we need to take the products
    for (const cell of cellsWithProduct) {
      if (remainingQuantity <= 0) break;

      const amountToTake = Math.min(cell.quantity, remainingQuantity);
      cellsToProcess.push({
        cell_id: cell.cell_id,
        quantity_to_take: amountToTake,
        initial_quantity: cell.quantity
      });

      remainingQuantity -= amountToTake;
    }

    if (remainingQuantity > 0) {
      return res.status(400).json({ error: `Недостаточно товара. Запрошено: ${quantity}, доступно: ${quantity - remainingQuantity}` });
    }

    // Process each cell to take the product
    for (const cellInfo of cellsToProcess) {
      if (cellInfo.initial_quantity === cellInfo.quantity_to_take) {
        // Remove the entire inventory record if taking all quantity
        await db.query('DELETE FROM inventory WHERE cell_id = ? AND product_id = ?', [cellInfo.cell_id, product_id]);
      } else {
        // Update the inventory record with remaining quantity
        await db.query('UPDATE inventory SET quantity = quantity - ? WHERE cell_id = ? AND product_id = ?',
                      [cellInfo.quantity_to_take, cellInfo.cell_id, product_id]);
      }

      // Update cell fill
      await db.query(
        `UPDATE cells SET current_fill = (
          SELECT COALESCE(SUM(i.quantity), 0)
          FROM inventory i
          WHERE i.cell_id = ?
        ) WHERE id = ?`,
        [cellInfo.cell_id, cellInfo.cell_id]
      );

      // Create operation record for each cell
      await db.query(
        'INSERT INTO operations (type, product_id, cell_id, quantity, user_id, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
        ['TAKE', product_id, cellInfo.cell_id, cellInfo.quantity_to_take, userId]
      );
    }

    res.json({
      message: `Отгрузка успешно выполнена`,
      cells_processed: cellsToProcess
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get warehouse map (cells status: occupied/partial/empty)
app.get('/api/warehouse/map', authenticateUser, requireRole('manager'), async (req, res) => {
  try {
    // Get all cells with their fill status
    const cells = await db.all(`
      SELECT
        c.id,
        c.zone_id,
        c.row_number,
        c.cell_number,
        c.capacity,
        c.current_fill,
        CASE
          WHEN c.current_fill = 0 THEN 'empty'
          WHEN c.current_fill < c.capacity THEN 'partial'
          WHEN c.current_fill >= c.capacity THEN 'full'
          ELSE 'unknown'
        END as status,
        z.name as zone_name,
        i.quantity,
        p.name as product_name
      FROM cells c
      LEFT JOIN zones z ON c.zone_id = z.id
      LEFT JOIN inventory i ON c.id = i.cell_id
      LEFT JOIN products p ON i.product_id = p.id
      ORDER BY c.zone_id, c.row_number, c.cell_number
    `);

    res.json(cells);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get fill statistics by zones
app.get('/api/zones/statistics', authenticateUser, requireRole('manager'), async (req, res) => {
  try {
    const zoneStats = await db.all(`
      SELECT
        z.id,
        z.name as zone_name,
        z.description,
        COUNT(c.id) as total_cells,
        SUM(CASE WHEN c.current_fill = 0 THEN 1 ELSE 0 END) as empty_cells,
        SUM(CASE WHEN c.current_fill > 0 AND c.current_fill < c.capacity THEN 1 ELSE 0 END) as partially_filled_cells,
        SUM(CASE WHEN c.current_fill >= c.capacity THEN 1 ELSE 0 END) as full_cells,
        SUM(c.current_fill) as total_current_fill,
        SUM(c.capacity) as total_capacity,
        CASE
          WHEN SUM(c.capacity) > 0 THEN ROUND((SUM(c.current_fill) * 100.0) / SUM(c.capacity), 2)
          ELSE 0
        END as fill_percentage
      FROM zones z
      LEFT JOIN cells c ON z.id = c.zone_id
      GROUP BY z.id, z.name, z.description
      ORDER BY z.name
    `);

    res.json(zoneStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get operations history for a period
app.post('/api/operations/history', authenticateUser, requireRole('manager'), async (req, res) => {
  try {
    const { start_date, end_date, type } = req.body;

    let sql = `
      SELECT o.*, u.full_name as user_name, p.name as product_name, p.sku, c.row_number, c.cell_number, z.name as zone_name
      FROM operations o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN cells c ON o.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
    `;

    const params = [];
    let whereClause = [];

    if (start_date) {
      whereClause.push('o.created_at >= ?');
      params.push(start_date);
    }

    if (end_date) {
      whereClause.push('o.created_at <= ?');
      params.push(end_date);
    }

    if (type && ['PUT', 'TAKE', 'MOVE'].includes(type)) {
      whereClause.push('o.type = ?');
      params.push(type);
    }

    if (whereClause.length > 0) {
      sql += ' WHERE ' + whereClause.join(' AND ');
    }

    sql += ' ORDER BY o.created_at DESC';

    const operations = await db.all(sql, params);
    res.json(operations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get inventory report (remaining products)
app.get('/api/reports/inventory', authenticateUser, requireRole('manager'), async (req, res) => {
  try {
    const inventoryReport = await db.all(`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.sku,
        p.unit,
        c.name as category_name,
        SUM(i.quantity) as total_quantity,
        COUNT(i.cell_id) as locations_count,
        GROUP_CONCAT(z.name || ' (' || c.row_number || '.' || c.cell_number || ')', ', ') as locations
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      LEFT JOIN cells c ON i.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
      GROUP BY p.id, p.name, p.sku, p.unit, c.name
      ORDER BY p.name
    `);

    res.json(inventoryReport);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all available cells for a specific product
app.get('/api/product/:productId/available-cells', authenticateUser, async (req, res) => {
  try {
    const { productId } = req.params;

    // Get all cells that already contain this product
    const existingCells = await db.all(`
      SELECT c.id, c.zone_id, c.row_number, c.cell_number, c.capacity, c.current_fill, i.quantity, z.name as zone_name
      FROM inventory i
      LEFT JOIN cells c ON i.cell_id = c.id
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE i.product_id = ?
      ORDER BY c.zone_id, c.row_number, c.cell_number
    `, [productId]);

    res.json(existingCells);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all empty cells
app.get('/api/cells/empty', authenticateUser, async (req, res) => {
  try {
    const emptyCells = await db.all(`
      SELECT c.*, z.name as zone_name
      FROM cells c
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE c.current_fill = 0
      ORDER BY c.zone_id, c.row_number, c.cell_number
    `);

    res.json(emptyCells);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all products for dropdown selection
app.get('/api/products/dropdown', async (req, res) => {
  try {
    const products = await db.all(`
      SELECT p.id, p.name, p.sku, p.unit, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.name
    `);

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get products with available quantities for take/move operations
app.get('/api/products/with-quantities', async (req, res) => {
  try {
    const products = await db.all(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.unit,
        c.name as category_name,
        COALESCE(SUM(i.quantity), 0) as total_quantity
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      GROUP BY p.id, p.name, p.sku, p.unit, c.name
      HAVING total_quantity > 0
      ORDER BY p.name
    `);

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simplified take operation - take product from any available cell
app.post('/api/take/simple', authenticateUser, async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const userId = req.user.id;

    // Validate product exists
    const product = await db.get('SELECT id, name FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(400).json({ error: 'Товар не существует' });
    }

    // Find all cells containing the product, ordered by cell_id to ensure consistent behavior
    const cellsWithProduct = await db.all(`
      SELECT i.cell_id, i.quantity, c.current_fill, c.capacity
      FROM inventory i
      LEFT JOIN cells c ON i.cell_id = c.id
      WHERE i.product_id = ?
      ORDER BY i.cell_id
    `, [product_id]);

    if (!cellsWithProduct || cellsWithProduct.length === 0) {
      return res.status(400).json({ error: 'Товар не найден в ячейках' });
    }

    let remainingQuantity = quantity;
    const cellsToProcess = [];

    // Find the cells from which we need to take the products
    for (const cell of cellsWithProduct) {
      if (remainingQuantity <= 0) break;

      const amountToTake = Math.min(cell.quantity, remainingQuantity);
      cellsToProcess.push({
        cell_id: cell.cell_id,
        quantity_to_take: amountToTake,
        initial_quantity: cell.quantity
      });

      remainingQuantity -= amountToTake;
    }

    if (remainingQuantity > 0) {
      return res.status(400).json({ error: `Недостаточно товара. Запрошено: ${quantity}, доступно: ${quantity - remainingQuantity}` });
    }

    // Process each cell to take the product
    for (const cellInfo of cellsToProcess) {
      if (cellInfo.initial_quantity === cellInfo.quantity_to_take) {
        // Remove the entire inventory record if taking all quantity
        await db.query('DELETE FROM inventory WHERE cell_id = ? AND product_id = ?', [cellInfo.cell_id, product_id]);
      } else {
        // Update the inventory record with remaining quantity
        await db.query('UPDATE inventory SET quantity = quantity - ? WHERE cell_id = ? AND product_id = ?',
                      [cellInfo.quantity_to_take, cellInfo.cell_id, product_id]);
      }

      // Update cell fill
      await db.query(
        `UPDATE cells SET current_fill = (
          SELECT COALESCE(SUM(i.quantity), 0)
          FROM inventory i
          WHERE i.cell_id = ?
        ) WHERE id = ?`,
        [cellInfo.cell_id, cellInfo.cell_id]
      );

      // Create operation record for each cell
      await db.query(
        'INSERT INTO operations (type, product_id, cell_id, quantity, user_id, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
        ['TAKE', product_id, cellInfo.cell_id, cellInfo.quantity_to_take, userId]
      );
    }

    res.json({
      message: `Отгрузка успешно выполнена`,
      cells_processed: cellsToProcess
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const { exec } = require('child_process');

// Export app for testing
module.exports = app;

// Start the server if this file is run directly
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);

    // Automatically open the browser when server starts
    const url = 'http://localhost:' + PORT + '/login.html';
    console.log(`Opening browser at ${url}`);

    // Open browser based on the operating system
    let startCmd;
    if (process.platform === 'darwin') { // macOS
      startCmd = 'open';
    } else if (process.platform === 'win32') { // Windows
      startCmd = 'start';
    } else { // Linux and other Unix-like systems
      startCmd = 'xdg-open';
    }

    exec(`${startCmd} ${url}`, (error) => {
      if (error) {
        console.log('Failed to automatically open browser. Please navigate to ' + url + ' manually.');
      }
    });
  });
}