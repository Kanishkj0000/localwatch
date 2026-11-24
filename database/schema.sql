-- LocalWatch Production Database Schema with PostGIS Support
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'Citizen',
    avatar VARCHAR(50) DEFAULT '👤',
    reputation_score INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Issues Table
CREATE TABLE IF NOT EXISTS issues (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'Active', -- 'Active', 'Resolved'
    location GEOMETRY(Point, 4326) NOT NULL, -- (Longitude, Latitude) WGS84
    address VARCHAR(255),
    photo_url TEXT, -- Base64 Data URI or URL (enforced under 1MB)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Confirmations Table (Self-correcting community confirmations)
CREATE TABLE IF NOT EXISTS confirmations (
    id SERIAL PRIMARY KEY,
    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(issue_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_issues_location ON issues USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_issues_user_id ON issues (user_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues (status);
CREATE INDEX IF NOT EXISTS idx_confirmations_issue ON confirmations (issue_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_user ON confirmations (user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
