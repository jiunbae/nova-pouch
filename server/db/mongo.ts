import { Db, MongoClient } from 'mongodb';
import { config } from '../config';
import { createIndexes } from '../models/record';

let mongoClient: MongoClient | null = null;
let database: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (database) return database;

  mongoClient = new MongoClient(config.mongoUri, {
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 10_000,
  });
  await mongoClient.connect();
  database = mongoClient.db(config.mongoDbName);
  await createIndexes(database);

  return database;
}

export function getDb(): Db {
  if (!database) {
    throw new Error('MongoDB is not connected. Call connectMongo() first.');
  }
  return database;
}

export async function closeMongo(): Promise<void> {
  if (!mongoClient) return;
  await mongoClient.close();
  mongoClient = null;
  database = null;
}
