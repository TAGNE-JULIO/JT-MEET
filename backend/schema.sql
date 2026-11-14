-- JT-Meet Database Schema

CREATE DATABASE IF NOT EXISTS jt_meet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jt_meet;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255) DEFAULT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Meetings Table
CREATE TABLE IF NOT EXISTS meetings (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE, -- ex: "abc-defg-hij"
    title VARCHAR(150) NOT NULL,
    description TEXT DEFAULT NULL,
    host_id VARCHAR(36) NOT NULL,
    status ENUM('scheduled', 'active', 'ended') DEFAULT 'scheduled',
    scheduled_start TIMESTAMP NULL,
    started_at TIMESTAMP NULL,
    ended_at TIMESTAMP NULL,
    max_participants INT DEFAULT 50,
    is_locked BOOLEAN DEFAULT FALSE,
    settings JSON DEFAULT NULL, -- ex: { "allowChat": true, "allowScreenShare": true }
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Meeting Participants History / Log
CREATE TABLE IF NOT EXISTS meeting_participants (
    id VARCHAR(36) PRIMARY KEY,
    meeting_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NULL, -- NULL if guest
    guest_name VARCHAR(100) NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    role ENUM('host', 'cohost', 'participant') DEFAULT 'participant',
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

-- 4. Meeting Recordings (Full Videos)
CREATE TABLE IF NOT EXISTS recordings (
    id VARCHAR(36) PRIMARY KEY,
    meeting_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(150) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT DEFAULT 0,
    duration INT DEFAULT 0, -- in seconds
    mime_type VARCHAR(50) DEFAULT 'video/webm',
    status ENUM('uploading', 'processing', 'ready', 'failed') DEFAULT 'ready',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Meeting Clips (Exported Snippets & Highlights)
CREATE TABLE IF NOT EXISTS meeting_clips (
    id VARCHAR(36) PRIMARY KEY,
    recording_id VARCHAR(36) NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT DEFAULT NULL,
    start_time INT NOT NULL, -- in seconds
    end_time INT NOT NULL,   -- in seconds
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT DEFAULT 0,
    duration INT DEFAULT 0, -- end_time - start_time
    share_token VARCHAR(64) UNIQUE NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    password_hash VARCHAR(255) DEFAULT NULL,
    expires_at TIMESTAMP NULL,
    views_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Meeting Messages (Persistent Chat log)
CREATE TABLE IF NOT EXISTS meeting_messages (
    id VARCHAR(36) PRIMARY KEY,
    meeting_id VARCHAR(36) NOT NULL,
    sender_id VARCHAR(36) NULL,
    sender_name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);
