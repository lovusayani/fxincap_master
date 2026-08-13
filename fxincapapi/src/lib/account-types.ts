import { query } from "./database.js";

export async function ensureAccountTypesTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS account_types (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        min_deposit DECIMAL(12, 2) DEFAULT 0.00,
        leverage INT DEFAULT 100,
        exposure_limit DECIMAL(15, 2) DEFAULT 0.00,
        is_demo BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error: any) {
    if (!error.message.includes("already exists")) {
      console.error("Error creating account_types table:", error.message);
    }
  }

  try {
    await query(`ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS leverage INT DEFAULT 500`);
  } catch (e: any) {
    console.error("[account-types] leverage column:", e.message);
  }

  try {
    await query(`ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS account_type_id VARCHAR(36) DEFAULT NULL`);
  } catch (e: any) {
    console.error("[account-types] account_type_id column:", e.message);
  }

  try {
    await query(`CREATE INDEX IF NOT EXISTS idx_account_type_id ON user_accounts(account_type_id)`);
  } catch {
    // Index might already exist
  }
}
