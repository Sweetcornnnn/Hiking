const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./hiking.db');

db.serialize(() => {
  console.log('Checking species table for image URLs...\n');
  
  db.all('SELECT id, common_name, image_url FROM species LIMIT 10', (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Species with image URLs:');
      rows.forEach(row => {
        console.log(`ID: ${row.id}, Name: ${row.common_name}, Image URL: ${row.image_url || 'NULL'}`);
      });
    }
    
    db.close();
  });
});
