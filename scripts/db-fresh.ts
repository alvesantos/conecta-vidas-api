import { db } from "../src/database/knex";

async function fresh() {
  const result = await db.raw(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  `);
  
  for (const row of result.rows) {
    await db.raw(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE`);
  }

  console.log("✅ Todas as tabelas removidas");
  await db.destroy();
}

fresh();
