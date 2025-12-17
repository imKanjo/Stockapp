const request = require('supertest');
const app = require('../server');

describe('Warehouse Management API', () => {
  // Test health check endpoint
  test('GET / should return health check message', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Warehouse Management API is running!');
  });

  // Test 404 handler
  test('GET /nonexistent should return 404', async () => {
    const response = await request(app).get('/nonexistent');
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Route not found');
  });

  // Test users API
  test('POST /api/users should create a new user', async () => {
    const userData = {
      login: 'testuser',
      password: 'testpass',
      full_name: 'Test User',
      role: 'worker'
    };
    
    const response = await request(app)
      .post('/api/users')
      .send(userData);
      
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.login).toBe(userData.login);
  });

  test('GET /api/users should return all users', async () => {
    const response = await request(app).get('/api/users');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  // Test zones API
  test('POST /api/zones should create a new zone', async () => {
    const zoneData = {
      name: 'Test Zone',
      description: 'A test zone'
    };
    
    const response = await request(app)
      .post('/api/zones')
      .send(zoneData);
      
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(zoneData.name);
  });

  test('GET /api/zones should return all zones', async () => {
    const response = await request(app).get('/api/zones');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  // Test products API
  test('POST /api/products should create a new product', async () => {
    const productData = {
      name: 'Test Product',
      sku: 'TP-001',
      category: 'Electronics',
      unit: 'pcs'
    };
    
    const response = await request(app)
      .post('/api/products')
      .send(productData);
      
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(productData.name);
  });

  test('GET /api/products should return all products', async () => {
    const response = await request(app).get('/api/products');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  // Test cells API
  test('GET /api/cells should return all cells', async () => {
    const response = await request(app).get('/api/cells');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  // Test inventory API
  test('GET /api/inventory should return all inventory', async () => {
    const response = await request(app).get('/api/inventory');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  // Test operations API
  test('GET /api/operations should return all operations', async () => {
    const response = await request(app).get('/api/operations');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});