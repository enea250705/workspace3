import MemoryStore from 'memorystore';
import session from 'express-session';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';

/**
 * Creates a memory store for sessions
 * @returns {MemoryStore.MemoryStore} A memory store instance
 */
export function createMemoryStore() {
  const MemorySessionStore = MemoryStore(session);
  return new MemorySessionStore({
    checkPeriod: 86400000 // 24 hours in milliseconds
  });
}

/**
 * Creates a PostgreSQL session store
 * @param {object} options Connection options
 * @returns {connectPgSimple.PGStore} A PostgreSQL store instance
 */
export function createPgStore(options: { connectionString?: string } = {}) {
  const PgStore = connectPgSimple(session);
  
  return new PgStore({
    pool: new pg.Pool({
      connectionString: options.connectionString || process.env.DATABASE_URL
    }),
    tableName: 'sessions'
  });
} 