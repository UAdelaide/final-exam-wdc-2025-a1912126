const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'newpassword',
  database: 'dog_walk_service'
});

module.exports = db;
