import { MongoClient } from "mongodb";

// One shared connection for the life of the server process, instead of
// connecting fresh on every request.
let client;
let db;

export async function getDb() {
  if (db) return db;

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set — check your .env file");
  }

  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(); // uses the database name already in the connection string
  return db;
}
