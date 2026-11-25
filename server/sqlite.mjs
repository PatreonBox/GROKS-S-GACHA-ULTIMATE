import {readFileSync, readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

export function openGameDatabase(filename) {
 const sqlite=new DatabaseSync(filename);
 try {
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  if(filename!==':memory:')sqlite.exec('PRAGMA journal_mode=WAL;');
  const migrations=new URL('../drizzle/',import.meta.url);
  const filenames=readdirSync(migrations).filter(name=>name.endsWith('.sql')).sort();
  sqlite.exec('BEGIN IMMEDIATE');
  try {
   sqlite.exec('CREATE TABLE IF NOT EXISTS game_schema_migrations (name TEXT PRIMARY KEY)');
   const has=sqlite.prepare('SELECT 1 FROM game_schema_migrations WHERE name=?');
   const record=sqlite.prepare('INSERT INTO game_schema_migrations(name) VALUES(?)');
   for(const name of filenames){
    if(has.get(name))continue;
    sqlite.exec(readFileSync(new URL(name,migrations),'utf8'));
    record.run(name);
   }
   sqlite.exec('COMMIT');
  } catch(error) {sqlite.exec('ROLLBACK');throw error;}
 } catch(error) {sqlite.close();throw error;}

 // The game uses the same prepared queries and atomic writes on D1 and SQLite.
 const DB={
  prepare(sql){return {bind(...args){
   const statement=sqlite.prepare(sql);
   return {run:()=>({meta:statement.run(...args)}),all:()=>({results:statement.all(...args)})};
  }}},
  async batch(queries){
   sqlite.exec('BEGIN IMMEDIATE');
   try{const results=queries.map(query=>query.run());sqlite.exec('COMMIT');return results;}
   catch(error){sqlite.exec('ROLLBACK');throw error;}
  }
 };
 return {DB,sqlite};
}
