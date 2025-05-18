// db.js
const Database = require('better-sqlite3');
const db = new Database('mydatabase.db');

// Create table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    firstname TEXT NOT NULL,
    lastname TEXT NOT NULL,
    label TEXT NOT NULL,
    mansab TEXT NOT NULL,
    faceEncoding TEXT NOT NULL,
    imagePath TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`).run();

db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    userId TEXT,
    timestamp TEXT,
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );
`);


module.exports = db;
