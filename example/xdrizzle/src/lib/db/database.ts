import { Database } from "tauri-plugin-sqlite";
import { drizzle } from "../drizzle";

export async function getDb() {
  return await Database.load("sqlite:xdrizzle.db");
}

export const dbPromise = createInstance();

async function createInstance() {
  const db = await getDb();
  return drizzle(db);
}
