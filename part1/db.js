const mysql = require('mysql2/promise');

const db = mysql.createPool({
  socketPath:
  host: 'localhost',
  user: 'root',
  password: 'newpassword',
  database: 'DogWalkService'
});

module.exports = db;
