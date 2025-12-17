const http = require('http');

function testAPI(endpoint) {
  return new Promise((resolve, reject) => {
    const request = http.get('http://localhost:4000' + endpoint, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
  });
}

async function checkAPIData() {
  console.log('Проверяем API...');
  
  try {
    // Проверяем продукты
    console.log('\n--- Продукты ---');
    const products = await testAPI('/api/products');
    console.log(products);
    
    // Проверяем операции
    console.log('\n--- Операции ---');
    const operations = await testAPI('/api/operations');
    console.log(operations);
    
    // Проверяем инвентарь
    console.log('\n--- Инвентарь ---');
    const inventory = await testAPI('/api/inventory');
    console.log(inventory);
    
  } catch (error) {
    console.error('Ошибка при обращении к API:', error.message);
  }
}

checkAPIData();