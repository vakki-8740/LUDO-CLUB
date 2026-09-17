<?php
// =====================================================
// DATABASE - SQLite connection + table setup
// =====================================================

function db_get() {
    static $db = null;
    if ($db === null) {
        $dbPath = __DIR__ . '/ludo.db';
        $db = new SQLite3($dbPath);
        $db->busyTimeout(5000);
        $db->exec('PRAGMA journal_mode = WAL');
        $db->exec('PRAGMA foreign_keys = ON');
        db_init($db);
    }
    return $db;
}

function db_init($db) {
    $db->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            mobile TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            balance INTEGER DEFAULT 0,
            total_deposit INTEGER DEFAULT 0,
            total_withdraw INTEGER DEFAULT 0,
            total_win INTEGER DEFAULT 0,
            referral_code TEXT UNIQUE,
            referred_by TEXT DEFAULT '',
            referral_commission INTEGER DEFAULT 0,
            kyc_status TEXT DEFAULT 'none',
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT UNIQUE NOT NULL,
            user_uid TEXT NOT NULL,
            user_name TEXT DEFAULT '',
            type TEXT NOT NULL,
            amount INTEGER NOT NULL DEFAULT 0,
            status TEXT DEFAULT 'Pending',
            utr TEXT DEFAULT '',
            method TEXT DEFAULT '',
            date TEXT DEFAULT '',
            time TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_uid) REFERENCES users(uid)
        )
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS bets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            creator_id TEXT NOT NULL,
            creator_name TEXT DEFAULT '',
            joiner_id TEXT DEFAULT '',
            joiner_name TEXT DEFAULT '',
            amount INTEGER DEFAULT 0,
            status TEXT DEFAULT 'waiting',
            room_code TEXT DEFAULT '',
            winner_id TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (creator_id) REFERENCES users(uid)
        )
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS kyc_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_uid TEXT NOT NULL,
            user_name TEXT DEFAULT '',
            email TEXT DEFAULT '',
            mobile TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_uid) REFERENCES users(uid)
        )
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT DEFAULT ''
        )
    ");
}
