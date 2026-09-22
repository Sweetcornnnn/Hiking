#!/usr/bin/env node

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SQLITE_DB_PATH = process.env.WILDTRACK_SQLITE_DB_PATH || path.resolve(__dirname, '../../SakaSaLikod/hiking.db');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const db = new sqlite3.Database(SQLITE_DB_PATH);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
});

const closeDatabase = () => new Promise((resolve) => db.close(() => resolve()));

const loadAuthUsers = async () => {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list Supabase Auth users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < perPage) return users;
    page += 1;
  }
};

const insertRows = async (table, rows, onConflict) => {
  if (rows.length === 0) return;

  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict });

  if (error) throw new Error(`Failed to write ${table}: ${error.message}`);
};

const migrate = async () => {
  console.log(`SQLite source: ${SQLITE_DB_PATH}`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  const [species, mountainSpecies, biodiversity, discoveries, legacyUsers] = await Promise.all([
    all('SELECT * FROM species ORDER BY id'),
    all('SELECT * FROM mountain_species ORDER BY id'),
    all('SELECT * FROM mountain_biodiversity ORDER BY id'),
    all('SELECT * FROM discoveries ORDER BY id'),
    all('SELECT id, email FROM users ORDER BY id'),
  ]);

  const authUsers = await loadAuthUsers();
  const authByEmail = new Map(
    authUsers
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user])
  );
  const userIdMap = new Map();
  const missingUsers = [];

  for (const legacyUser of legacyUsers) {
    const authUser = authByEmail.get(String(legacyUser.email).toLowerCase());
    if (authUser) userIdMap.set(legacyUser.id, authUser.id);
    else missingUsers.push({ id: legacyUser.id, email: legacyUser.email });
  }

  const speciesRows = species.map((row) => ({
    id: row.id,
    scientific_name: row.scientific_name,
    common_name: row.common_name,
    category: row.category,
    conservation_status: row.conservation_status,
    gbif_id: row.gbif_id,
    inaturalist_id: row.inaturalist_id,
    image_url: row.image_url,
    description: row.description,
    habitat: row.habitat,
    fun_facts: row.fun_facts,
    created_at: row.created_at,
  }));

  const biodiversityRows = biodiversity.map((row) => ({
    id: row.id,
    name: row.name,
    curated_species_count: row.curated_species_count,
    description: row.description,
    endemic_species_count: row.endemic_species_count || 0,
    key_species: typeof row.key_species === 'string' ? JSON.parse(row.key_species || '[]') : (row.key_species || []),
    ecosystem: row.ecosystem,
    conservation_status: row.conservation_status,
  }));

  const discoveryRows = discoveries
    .filter((row) => userIdMap.has(row.user_id))
    .map((row) => ({
      id: row.id,
      user_id: userIdMap.get(row.user_id),
      species_id: row.species_id,
      mountain_id: row.mountain_id,
      discovered_at: row.discovered_at,
      latitude: row.latitude,
      longitude: row.longitude,
      notes: row.notes,
    }));

  console.log(`Species: ${speciesRows.length}`);
  console.log(`Mountain links: ${mountainSpecies.length}`);
  console.log(`Biodiversity records: ${biodiversityRows.length}`);
  console.log(`Discoveries: ${discoveries.length} (${discoveryRows.length} mapped)`);
  console.log(`Legacy users: ${legacyUsers.length} (${userIdMap.size} mapped)`);

  if (missingUsers.length > 0) {
    console.warn(`Unmapped users: ${missingUsers.map((user) => `${user.id}:${user.email}`).join(', ')}`);
  }

  if (!APPLY) {
    console.log('Dry run complete. Apply the schema first, then rerun with --apply to write data.');
    return;
  }

  if (missingUsers.length > 0) {
    throw new Error('Refusing to apply while legacy users are unmapped. Resolve the user mapping first.');
  }

  await insertRows('wildtrack_species', speciesRows, 'id');
  await insertRows('wildtrack_mountain_species', mountainSpecies.map((row) => ({
    id: row.id,
    mountain_id: row.mountain_id,
    species_id: row.species_id,
    is_endemic: Boolean(row.is_endemic),
    created_at: row.created_at,
  })), 'mountain_id,species_id');
  await insertRows('wildtrack_mountain_biodiversity', biodiversityRows, 'id');
  await insertRows('wildtrack_discoveries', discoveryRows, 'id');

  console.log('WildTrack migration completed successfully.');
};

migrate()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
