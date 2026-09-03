#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SQLITE_DB_PATH = "C:/Users/zolin/OneDrive/Dokumen/Hiking/SakaSaLikod/hiking.db";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const db = new sqlite3.Database(SQLITE_DB_PATH);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM users ORDER BY id ASC', (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function getExistingAuthUsers() {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    throw new Error(`Failed to list Supabase auth users: ${error.message}`);
  }

  return data.users;
}

async function ensureProfileExists(userId, email, fullName, contactNumber, isAdmin, createdAt) {
  const { data: existingProfile, error: selectError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (selectError && selectError.code !== 'PGRST116') {
    throw new Error(`Profile lookup failed: ${selectError.message}`);
  }

  if (existingProfile) {
    return;
  }

  const { error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      email,
      full_name: fullName,
      contact_number: contactNumber || null,
      is_admin: Boolean(isAdmin),
      created_at: createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (insertError) {
    throw new Error(`Profile insert failed for ${email}: ${insertError.message}`);
  }
}

async function migrateUsers() {
  console.log('🚀 Reading SQLite users...');

  const users = await getUsers();
  console.log(`📦 Found ${users.length} SQLite users`);

  const authUsers = await getExistingAuthUsers();
  const existingEmails = new Set(
    authUsers
      .map(u => u.email && u.email.toLowerCase())
      .filter(Boolean)
  );

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const email = String(user.email || '').trim().toLowerCase();

    if (!email) {
      console.log(`⚠️ Skipping row with missing email (id=${user.id})`);
      failed++;
      continue;
    }

    try {
      let authUser = authUsers.find(u => u.email && u.email.toLowerCase() === email);

      if (!authUser) {
        const tempPassword = 'Temp' + Math.random().toString(36).slice(-8) + '!';

        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: user.name || null,
            contact_number: user.contact_number || null,
          },
        });

        if (error) {
          console.error(`❌ Failed to create Auth user for ${email}: ${error.message}`);
          failed++;
          continue;
        }

        if (!data?.user) {
          console.error(`❌ No user returned for ${email}`);
          failed++;
          continue;
        }

        authUser = data.user;
      } else {
        console.log(`⏭️ Auth user already exists: ${email}`);
      }

      await ensureProfileExists(
        authUser.id,
        email,
        user.name || null,
        user.contact_number || null,
        user.is_admin === 1 || user.is_admin === true,
        user.created_at || new Date().toISOString()
      );

      console.log(`✅ Migrated: ${email}`);
      migrated++;
    } catch (err) {
      console.error(`❌ Error for ${email}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n==============================');
  console.log('MIGRATION SUMMARY');
  console.log('==============================');
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total SQLite users: ${users.length}`);
  console.log('==============================');

  db.close();
}

migrateUsers()
  .catch(err => {
    console.error('❌ Migration crashed:', err);
    db.close();
    process.exit(1);
  });