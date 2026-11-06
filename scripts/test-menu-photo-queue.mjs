/** Real PostgreSQL semantics in an isolated WASM database, no network or live
 * credentials. PGlite is installed outside the app's dependency/fingerprint. */
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=process.env.MENU_PHOTO_SQL_TEST_ROOT;
if(!root)throw new Error('Set MENU_PHOTO_SQL_TEST_ROOT to the isolated PGlite installation');
const { PGlite }=createRequire(resolve(root,'package.json'))('@electric-sql/pglite');
const db=new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table public.regional_places (
      id text primary key,name text,address text,category text,lat double precision,lon double precision,
      city text,website text,image text,detail_content jsonb,needs_review boolean not null default false
    );`);
  for(const path of [
    'supabase/migrations/20261027010000_menu_photo_collection.sql',
    'supabase/migrations/20261103010000_menu_photo_throughput.sql',
    'scripts/lib/__tests__/menu-photo-queue.sql',
    'supabase/migrations/20261105010000_menu_photo_bulk.sql',
    'scripts/lib/__tests__/menu-photo-bulk.sql',
  ]) await db.exec(await readFile(new URL('../'+path,import.meta.url),'utf8'));
  console.log('Menu/photo SQL passed: shared budgets, burst expiry, fair lanes, sibling leases, image deduplication and coverage counts');
} finally { await db.close(); }
