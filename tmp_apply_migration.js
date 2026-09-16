const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });
  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '20260916000001_add_address_to_register.sql'), 'utf8');
    await client.query(sql);
    console.log("Migration applied successfully.");
    
    // Also, fix students that have no FK in the database
    // "fix the students that has no fk in the database"
    // To do this, I can run an update:
    const fixSql = `
      UPDATE public.students s
      SET department_id = d.id
      FROM public.departments d
      WHERE LOWER(TRIM(s.department)) = LOWER(TRIM(d.name))
        AND s.department_id IS NULL;
    `;
    const res = await client.query(fixSql);
    console.log(`Fixed ${res.rowCount} students by matching department name.`);
    
    // Check if there are still any left
    const checkSql = `SELECT department, count(*) as count FROM public.students WHERE department_id IS NULL GROUP BY department;`;
    const checkRes = await client.query(checkSql);
    console.log("Remaining unmatched departments:", checkRes.rows);

  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
migrate();