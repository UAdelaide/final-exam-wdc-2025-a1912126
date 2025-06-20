const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET /api/dogs - fetch all dogs with owner info
router.get('/dogs', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.name AS dog_name, d.size,d.owner_id u.username, AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs.' });
  }
});

module.exports = router;
