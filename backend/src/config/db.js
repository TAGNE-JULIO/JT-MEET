import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool = null;
let isConnected = false;

// In-memory fallback store if MySQL is not reachable yet
export const memoryStore = {
  users: [],
  meetings: [],
  meeting_participants: [],
  recordings: [],
  meeting_clips: [],
  meeting_messages: []
};

export const initDB = async () => {
  try {
    // 1. Create connection to ensure database exists
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'jt_meet'}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.end();

    // 2. Connect pool to the specific database
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'jt_meet',
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0
    });

    // Test connection
    const [rows] = await pool.query('SELECT 1 + 1 AS test');
    isConnected = true;
    console.log('✅ Connected to MySQL successfully (Database: ' + (process.env.DB_NAME || 'jt_meet') + ')');

    // Run table initialization
    await setupTables();
    return true;
  } catch (error) {
    console.warn('⚠️ MySQL connection failed:', error.message);
    console.warn('💡 Tip: Verify DB_USER and DB_PASSWORD in backend/.env. Using resilient fallback mode for development.');
    isConnected = false;
    return false;
  }
};

const setupTables = async () => {
  if (!pool) return;
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      avatar_url VARCHAR(255) DEFAULT NULL,
      role ENUM('user', 'admin') DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS meetings (
      id VARCHAR(36) PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      title VARCHAR(150) NOT NULL,
      description TEXT DEFAULT NULL,
      host_id VARCHAR(36) NOT NULL,
      status ENUM('scheduled', 'active', 'ended') DEFAULT 'scheduled',
      scheduled_start TIMESTAMP NULL,
      started_at TIMESTAMP NULL,
      ended_at TIMESTAMP NULL,
      max_participants INT DEFAULT 50,
      is_locked BOOLEAN DEFAULT FALSE,
      settings JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS meeting_participants (
      id VARCHAR(36) PRIMARY KEY,
      meeting_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NULL,
      guest_name VARCHAR(100) NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      left_at TIMESTAMP NULL,
      role ENUM('host', 'cohost', 'participant') DEFAULT 'participant'
    )`,
    `CREATE TABLE IF NOT EXISTS recordings (
      id VARCHAR(36) PRIMARY KEY,
      meeting_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      title VARCHAR(150) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      file_size BIGINT DEFAULT 0,
      duration INT DEFAULT 0,
      mime_type VARCHAR(50) DEFAULT 'video/webm',
      status ENUM('uploading', 'processing', 'ready', 'failed') DEFAULT 'ready',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS meeting_clips (
      id VARCHAR(36) PRIMARY KEY,
      recording_id VARCHAR(36) NOT NULL,
      created_by VARCHAR(36) NOT NULL,
      title VARCHAR(150) NOT NULL,
      description TEXT DEFAULT NULL,
      start_time INT NOT NULL,
      end_time INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      file_size BIGINT DEFAULT 0,
      duration INT DEFAULT 0,
      share_token VARCHAR(64) UNIQUE NOT NULL,
      is_public BOOLEAN DEFAULT TRUE,
      password_hash VARCHAR(255) DEFAULT NULL,
      expires_at TIMESTAMP NULL,
      views_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS meeting_messages (
      id VARCHAR(36) PRIMARY KEY,
      meeting_id VARCHAR(36) NOT NULL,
      sender_id VARCHAR(36) NULL,
      sender_name VARCHAR(100) NOT NULL,
      message TEXT NOT NULL,
      is_system BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const q of queries) {
    await pool.query(q);
  }
  console.log('✅ Database tables verified and ready.');
};

export const getDB = () => {
  return { pool, isConnected };
};

export default { initDB, getDB, memoryStore };
