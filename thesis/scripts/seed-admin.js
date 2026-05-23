/**
 * Creates or updates the default admin account:
 *   Email:    admin@gmail.com
 *   Password: admin1234
 *
 * Uses upsert on primary key `id` so the email can be changed from older seeds.
 *
 * Requires .env.local in ProjectL/thesis with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:  node scripts/seed-admin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'admin1234';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

  /** Free `admin@gmail.com` if another row holds it (dev seed id is canonical). */
  const { data: emailHolders } = await supabase
    .from('users')
    .select('id')
    .eq('email', ADMIN_EMAIL);

  for (const holder of emailHolders || []) {
    if (holder.id !== ADMIN_ID) {
      const { error: bumpErr } = await supabase
        .from('users')
        .update({
          email: `archived-${String(holder.id).slice(0, 8)}@seed-replaced.local`,
        })
        .eq('id', holder.id);
      if (bumpErr) {
        console.error('Could not reassign conflicting email:', bumpErr.message);
        process.exit(1);
      }
    }
  }

  const row = {
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    password: hashed,
    name: 'System Administrator',
    role: 'admin',
    unique_id_user: ADMIN_ID,
    phone: null,
    address: null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('users').upsert(row, {
    onConflict: 'id',
  });

  if (error) {
    console.error('Upsert failed:', error.message, error.details, error.hint);
    process.exit(1);
  }

  console.log(
    `OK — admin account ready. Log in with email "${ADMIN_EMAIL}" and password "${ADMIN_PASSWORD}".`
  );
  if (data) console.log(data);
}

main();
