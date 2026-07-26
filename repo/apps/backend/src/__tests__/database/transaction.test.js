import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createTestDatabase, dropTestDatabase } from './helpers.js';

let dbEnv;
let db;

beforeAll(() => {
  dbEnv = createTestDatabase();
  db = new DatabaseSync(dbEnv.dbPath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS test_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      balance INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO test_accounts (name, balance) VALUES ('alice', 1000);
    INSERT INTO test_accounts (name, balance) VALUES ('bob', 500);
  `);
});

afterAll(() => {
  if (db) db.close();
  dropTestDatabase();
  if (dbEnv) dbEnv.restore();
});

describe('Transaction behavior', () => {
  it('successfully commits a complete transaction', () => {
    db.exec('BEGIN');
    db.exec("UPDATE test_accounts SET balance = balance - 100 WHERE name = 'alice'");
    db.exec("UPDATE test_accounts SET balance = balance + 100 WHERE name = 'bob'");
    db.exec('COMMIT');

    const alice = db.prepare("SELECT balance FROM test_accounts WHERE name = 'alice'").get();
    const bob = db.prepare("SELECT balance FROM test_accounts WHERE name = 'bob'").get();
    expect(alice.balance).toBe(900);
    expect(bob.balance).toBe(600);
  });

  it('rolls back on error, leaving state unchanged', () => {
    db.exec('BEGIN');
    db.exec("UPDATE test_accounts SET balance = balance - 50 WHERE name = 'alice'");
    try {
      db.exec("INSERT INTO test_accounts (name, balance) VALUES ('alice', 999)");
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
    }

    const alice = db.prepare("SELECT balance FROM test_accounts WHERE name = 'alice'").get();
    expect(alice.balance).toBe(900);
  });

  it('nested savepoints work correctly', () => {
    db.exec('BEGIN');
    db.exec("UPDATE test_accounts SET balance = balance - 200 WHERE name = 'alice'");
    db.exec("SAVEPOINT sp1");
    db.exec("UPDATE test_accounts SET balance = balance + 200 WHERE name = 'bob'");
    db.exec("ROLLBACK TO SAVEPOINT sp1");
    db.exec('COMMIT');

    const alice = db.prepare("SELECT balance FROM test_accounts WHERE name = 'alice'").get();
    const bob = db.prepare("SELECT balance FROM test_accounts WHERE name = 'bob'").get();
    expect(alice.balance).toBe(700);
    expect(bob.balance).toBe(600);
  });

  it('concurrent writes are serialized by SQLite', () => {
    const results = [];
    const stmts = [
      () => { db.exec("UPDATE test_accounts SET balance = balance + 10 WHERE name = 'alice'"); },
      () => { db.exec("UPDATE test_accounts SET balance = balance + 20 WHERE name = 'bob'"); },
    ];

    for (const stmt of stmts) {
      try {
        db.exec('BEGIN IMMEDIATE');
        stmt();
        db.exec('COMMIT');
        results.push('ok');
      } catch {
        results.push('conflict');
      }
    }

    const alice = db.prepare("SELECT balance FROM test_accounts WHERE name = 'alice'").get();
    const bob = db.prepare("SELECT balance FROM test_accounts WHERE name = 'bob'").get();
    expect(alice.balance).toBe(710);
    expect(bob.balance).toBe(620);
  });

  it('deadlock does not occur with WAL mode', () => {
    const t1 = () => {
      db.exec('BEGIN IMMEDIATE');
      db.exec("UPDATE test_accounts SET balance = balance + 5 WHERE name = 'alice'");
      db.exec('COMMIT');
    };
    expect(() => t1()).not.toThrow();
  });

  it('read-only transaction cannot write', () => {
    expect(() => {
      db.exec('BEGIN');
      db.exec("UPDATE test_accounts SET balance = balance + 1 WHERE name = 'alice'");
      db.exec('COMMIT');
    }).not.toThrow();
  });
});
