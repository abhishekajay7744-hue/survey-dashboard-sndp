import app, { initDb, db } from '../server.js';

// Vercel serverless function entrypoint
// We call initDb() if it hasn't been called, but wait, serverless might call it every time.
// Since initDb() is idempotent (CREATE TABLE IF NOT EXISTS), it's fine.

let isInitialized = false;

export default async function handler(req: any, res: any) {
  if (!isInitialized) {
    console.log("Initializing database connection for serverless invocation...");
    await initDb();
    isInitialized = true;
  }
  
  // Hand off to Express
  return app(req, res);
}
