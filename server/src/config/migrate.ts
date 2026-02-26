import { pool } from './database';
import { readdir } from 'fs/promises';
import { join } from 'path';

async function migrate() {
  const client = await pool.connect();

  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get already applied migrations
    const applied = await client.query('SELECT name FROM _migrations ORDER BY id');
    const appliedNames = new Set(applied.rows.map((r: any) => r.name));

    // Read migration files
    const migrationsDir = join(import.meta.dir, '..', '..', 'migrations');
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      if (appliedNames.has(file)) {
        console.log(`  Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`  Applying ${file}...`);
      const sql = await Bun.file(join(migrationsDir, file)).text();

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  Applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  Failed to apply ${file}:`, err);
        throw err;
      }
    }

    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
