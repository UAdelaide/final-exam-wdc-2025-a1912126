var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mysql = require('mysql2/promise');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var seach
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
let db;

(async () => {
  try {
    // Connect to MySQL and ensure DogWalkService database exists
    const setupConnection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'newpassword'
    });
    await setupConnection.query('CREATE DATABASE IF NOT EXISTS DogWalkService');
    await setupConnection.end();

    // Connect to the DogWalkService database
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'newpassword',
      database: 'DogWalkService'
    });

    // Create tables if they don't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS Users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('owner', 'walker') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS Dogs (
        dog_id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT NOT NULL,
        name VARCHAR(50) NOT NULL,
        size ENUM('small', 'medium', 'large') NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES Users(user_id)
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS WalkRequests (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        dog_id INT NOT NULL,
        requested_time DATETIME NOT NULL,
        duration_minutes INT NOT NULL,
        location VARCHAR(255) NOT NULL,
        status ENUM('open', 'accepted', 'completed', 'cancelled') DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dog_id) REFERENCES Dogs(dog_id)
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS WalkRatings (
        rating_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        walker_id INT NOT NULL,
        owner_id INT NOT NULL,
        rating INT CHECK (rating BETWEEN 1 AND 5),
        comments TEXT,
        rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
        FOREIGN KEY (walker_id) REFERENCES Users(user_id),
        FOREIGN KEY (owner_id) REFERENCES Users(user_id),
        CONSTRAINT unique_rating_per_walk UNIQUE (request_id)
      )
    `);

    // Insert users and dogs (only if no users)
    const [userRows] = await db.execute('SELECT COUNT(*) AS count FROM Users');
    if (userRows[0].count === 0) {
      await db.query(`
        INSERT INTO Users (username, email, password_hash, role) VALUES
        ('alice123', 'alice@example.com', 'hashed123', 'owner'),
        ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
        ('carol123', 'carol@example.com', 'hashed789', 'owner'),
        ('suewalker', 'sue@example.com', 'hashed000', 'walker'),
        ('danowner', 'dan@example.com', 'hashed111', 'owner')
      `);

      await db.query(`
        INSERT INTO Dogs (owner_id, name, size)
        SELECT user_id, 'Max', 'medium' FROM Users WHERE username = 'alice123'
        UNION SELECT user_id, 'Bella', 'small' FROM Users WHERE username = 'carol123'
        UNION SELECT user_id, 'Buddy', 'large' FROM Users WHERE username = 'danowner'
        UNION SELECT user_id, 'Luna', 'small' FROM Users WHERE username = 'alice123'
        UNION SELECT user_id, 'Oscar', 'medium' FROM Users WHERE username = 'carol123'
      `);

      await db.query(`
        INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
        SELECT d.dog_id, '2025-06-10 08:00:00', 30, 'Parklands', 'open'
        FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
        WHERE d.name = 'Max' AND u.username = 'alice123'
      `);
      await db.query(`
        INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
        SELECT d.dog_id, '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'
        FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
        WHERE d.name = 'Bella' AND u.username = 'carol123'
      `);
      await db.query(`
        INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
        SELECT d.dog_id, '2025-06-11 14:00:00', 60, 'Rundle Mall', 'open'
        FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
        WHERE d.name = 'Buddy' AND u.username = 'danowner'
      `);
      await db.query(`
        INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
        SELECT d.dog_id, '2025-06-12 07:15:00', 25, 'UofA', 'completed'
        FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
        WHERE d.name = 'Luna' AND u.username = 'alice123'
      `);
      await db.query(`
        INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
        SELECT d.dog_id, '2025-06-13 18:30:00', 40, 'Glenelg beach', 'cancelled'
        FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
        WHERE d.name = 'Oscar' AND u.username = 'carol123'
      `);
    }
  } catch (err) {
    console.error('Database setup error:', err);
  }
})();

app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs.' });
  }
});

app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT wr.request_id, d.name AS dog_name, wr.requested_time, wr.duration_minutes, wr.location,
             u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch open walk requests.' });
  }
});

app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        u.username AS walker_username,
        COUNT(r.rating_id) AS total_ratings,
        ROUND(AVG(r.rating), 1) AS average_rating,
        (
          SELECT COUNT(*)
          FROM WalkRequests wr
          JOIN WalkRatings rr ON wr.request_id = rr.request_id
          WHERE rr.walker_id = u.user_id AND wr.status = 'completed'
        ) AS completed_walks
      FROM Users u
      LEFT JOIN WalkRatings r ON u.user_id = r.walker_id
      WHERE u.role = 'walker'
      GROUP BY u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walker summaries.' });
  }
});

module.exports = app;