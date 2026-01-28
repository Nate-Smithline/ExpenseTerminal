/**
 * Standalone script to verify your Supabase connection.
 * Loads env from .env.local then .env (from apps/backend).
 *
 * Run from repo root:  pnpm --filter @ledgerterminal/backend test:supabase
 * Or from apps/backend: pnpm test:supabase
 */

import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '../.env.local') });
config({ path: path.join(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing env: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log('Testing Supabase connection...');
  const { data, error } = await supabase.from('_connection_test').select('*').limit(1);
  if (error) {
    if (error.code === '42P01') {
      console.log('OK – Connected to Supabase (table _connection_test does not exist; that is fine).');
    } else {
      console.error('Supabase error:', error.message);
      process.exit(1);
    }
  } else {
    console.log('OK – Connected to Supabase. Data:', data);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
