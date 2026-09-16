import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

// We might not have .env, let's look for SUPABASE_URL in vite.config.ts or env files.
// Let me just write a script to use pg to connect if it's local. Wait, supabase is a docker container, I can connect using postgres://postgres:postgres@localhost:54322/postgres
const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });
  try {
    await client.connect();
    const res = await client.query('SELECT department, count(*) FROM students WHERE department_id IS NULL GROUP BY department');
    console.log("Unmatched departments:", res.rows);
    
    const res2 = await client.query('SELECT name FROM departments');
    console.log("Available departments:", res2.rows);
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
check();