import Database from "better-sqlite3";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const path = process.env.DATABASE_PATH ?? "/data/app.db";
  _db = new Database(path, { readonly: true, fileMustExist: false });
  _db.pragma("journal_mode = WAL");
  return _db;
}
