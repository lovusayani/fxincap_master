import { getConnection, query } from "../lib/database.js";

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  countryCode: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt?: string | null;
  emailVerified?: boolean;
  deletionAssessment?: UserDeletionAssessment;
}

export interface UserDeletionAssessment {
  canDelete: boolean;
  reason: string | null;
  tradeCount: number;
  walletAccountCount: number;
  nonZeroWalletAccounts: number;
  totalWalletBalance: number;
  emailVerified: boolean;
}

export interface UserListOptions {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

const USER_COLUMNS = "id, email, first_name, last_name, phone, country_code, status, created_at, updated_at, email_verified";

export async function fetchUsers(options: UserListOptions = {}): Promise<AdminUser[]> {
  const { search, status } = options;
  const limit = sanitizeLimit(options.limit);
  const offset = sanitizeOffset(options.offset);

  const where: string[] = [];
  const values: any[] = [];

  if (search) {
    const like = `%${search}%`;
    where.push("(email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)");
    values.push(like, like, like, like);
  }

  if (status) {
    where.push("status = ?");
    values.push(status);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `SELECT ${USER_COLUMNS} FROM users ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const results = await query(sql, values);
  if (!Array.isArray(results)) return [];

  return results.map(mapRowToAdminUser);
}

export async function fetchUserById(userId: string): Promise<AdminUser | null> {
  const results = await query(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );

  if (!Array.isArray(results) || results.length === 0) return null;
  const user = mapRowToAdminUser(results[0]);
  user.deletionAssessment = await getUserDeletionAssessment(userId, user.emailVerified === true);
  return user;
}

export async function getUserDeletionAssessment(userId: string, emailVerified = false): Promise<UserDeletionAssessment> {
  const [tradeRows, walletRows] = await Promise.all([
    query("SELECT COUNT(*) AS total FROM trades WHERE user_id = ?", [userId]) as Promise<any[]>,
    query(
      `SELECT
         COUNT(*) AS account_count,
         COALESCE(SUM(CASE WHEN COALESCE(balance, 0) <> 0 OR COALESCE(equity, 0) <> 0 OR COALESCE(margin_free, 0) <> 0 OR COALESCE(available_balance, 0) <> 0 THEN 1 ELSE 0 END), 0) AS non_zero_wallet_accounts,
         COALESCE(SUM(COALESCE(balance, 0)), 0) AS total_wallet_balance
       FROM user_accounts
       WHERE user_id = ? AND trading_mode = 'real'`,
      [userId]
    ) as Promise<any[]>,
  ]);

  const tradeCount = Number(tradeRows?.[0]?.total || 0);
  const walletAccountCount = Number(walletRows?.[0]?.account_count || 0);
  const nonZeroWalletAccounts = Number(walletRows?.[0]?.non_zero_wallet_accounts || 0);
  const totalWalletBalance = Number(walletRows?.[0]?.total_wallet_balance || 0);

  let reason: string | null = null;
  if (tradeCount > 0) {
    reason = "This user already has trade history.";
  } else if (nonZeroWalletAccounts > 0) {
    reason = "This user has a real wallet account with non-zero balance.";
  }

  return {
    canDelete: reason === null,
    reason,
    tradeCount,
    walletAccountCount,
    nonZeroWalletAccounts,
    totalWalletBalance,
    emailVerified,
  };
}

const TABLE_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdentifier(value: string) {
  if (!TABLE_NAME_REGEX.test(value)) {
    throw new Error(`Invalid table name: ${value}`);
  }
  return `"${value}"`;
}

function extractTableNames(rows: any[], excluded: string[] = []) {
  const skip = new Set(excluded.map((value) => value.toLowerCase()));
  return rows
    .map((row) => String(row.table_name || row.TABLE_NAME || "").trim())
    .filter((tableName) => tableName && !skip.has(tableName.toLowerCase()));
}

export async function deleteUserIfEligible(userId: string) {
  const connection = await getConnection();
  try {
    const userRows = await connection.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1 LIMIT 1`, [userId]);
    if (userRows.rowCount === 0) {
      throw new Error("User not found");
    }

    const user = mapRowToAdminUser(userRows.rows[0]);
    const assessment = await getUserDeletionAssessment(userId, user.emailVerified === true);
    if (!assessment.canDelete) {
      return { success: false, user, assessment, deleted: {} as Record<string, number> };
    }

    await connection.query('BEGIN');

    const accountRows = await connection.query("SELECT id FROM user_accounts WHERE user_id = $1", [userId]);
    const accountIds = accountRows.rows.map((row: any) => String(row.id));
    const deleted: Record<string, number> = {};

    if (accountIds.length > 0) {
      const accountTablesRaw = await connection.query(
        `SELECT DISTINCT table_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name = 'account_id'`
      );
      const accountTables = extractTableNames(accountTablesRaw.rows as any[], ["user_accounts"]);

      for (const tableName of accountTables) {
        const result = await connection.query(
          `DELETE FROM ${quoteIdentifier(tableName)} WHERE account_id = ANY($1::uuid[])`,
          [accountIds]
        );
        if (result.rowCount > 0) {
          deleted[tableName] = result.rowCount;
        }
      }
    }

    const userTablesRaw = await connection.query(
      `SELECT DISTINCT table_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'user_id'`
    );
    const userTables = extractTableNames(userTablesRaw.rows as any[], ["users"]);

    for (const tableName of userTables) {
      const result = await connection.query(
        `DELETE FROM ${quoteIdentifier(tableName)} WHERE user_id = $1`,
        [userId]
      );
      if (result.rowCount > 0) {
        deleted[tableName] = (deleted[tableName] || 0) + result.rowCount;
      }
    }

    const deleteResult = await connection.query("DELETE FROM users WHERE id = $1", [userId]);
    if (deleteResult.rowCount > 0) {
      deleted.users = deleteResult.rowCount;
    }

    await connection.query('COMMIT');
    return { success: true, user, assessment, deleted };
  } catch (error) {
    try {
      await connection.query('ROLLBACK');
    } catch {
      // noop
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function countUsers(options: Omit<UserListOptions, "limit" | "offset"> = {}): Promise<number> {
  const { search, status } = options;

  const where: string[] = [];
  const values: any[] = [];

  if (search) {
    const like = `%${search}%`;
    where.push("(email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)");
    values.push(like, like, like, like);
  }

  if (status) {
    where.push("status = ?");
    values.push(status);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `SELECT COUNT(*) AS total FROM users ${whereClause}`;
  const results: any = await query(sql, values);
  if (!Array.isArray(results) || results.length === 0) return 0;
  return Number(results[0].total || 0);
}

function mapRowToAdminUser(row: any): AdminUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    phone: row.phone || null,
    countryCode: row.country_code || null,
    status: row.status || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    emailVerified: row.email_verified === true,
  };
}

function sanitizeLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return 50;
  return Math.min(Math.max(1, limit), 100);
}

function sanitizeOffset(offset?: number) {
  if (!offset || Number.isNaN(offset) || offset < 0) return 0;
  return offset;
}

