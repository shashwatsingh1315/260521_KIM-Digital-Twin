// Vercel serverless function — persists / loads the factory config in Neon Postgres.
// GET  /api/config        → returns saved config JSON (or null if none yet)
// POST /api/config        → upserts the config; body must be application/json
import { neon } from '@neondatabase/serverless';

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS factory_configs (
    id          TEXT        PRIMARY KEY,
    config      JSONB       NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  )
`;

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  await sql.unsafe(INIT_SQL);

  if (req.method === 'GET') {
    const rows = await sql`SELECT config FROM factory_configs WHERE id = 'default'`;
    return res.json(rows.length ? rows[0].config : null);
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    await sql`
      INSERT INTO factory_configs (id, config, updated_at)
      VALUES ('default', ${JSON.stringify(body)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
        SET config     = EXCLUDED.config,
            updated_at = NOW()
    `;
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
