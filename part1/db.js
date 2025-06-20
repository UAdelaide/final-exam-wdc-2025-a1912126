const mysql = require('mysql2/promise');

const db = mysql.createPool({
  socketPath:
  host: '127.0.0.1',
  user: 'root',
  password: 'newpassword',
  database: 'DogWalkService'
});

module.exports = db;
