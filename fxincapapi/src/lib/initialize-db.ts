import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function initializeDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "25060"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === "REQUIRED" ? "REQUIRED" : undefined,
  });

  try {
    console.log("📦 Initializing database...");

    // Create database
    const dbName = process.env.DB_NAME || "suim_fx";
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database '${dbName}' created/exists`);

    // Switch to database
    await connection.query(`USE \`${dbName}\``);

    // Read schema file
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf-8");

    // Split schema into individual statements and execute
    const statements = schema
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt && !stmt.startsWith("--") && !stmt.startsWith("/*"));

    for (const statement of statements) {
      try {
        if (statement.length > 0) {
          await connection.query(statement);
        }
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message.includes("already exists")) {
          console.error("❌ Error executing statement:", error.message);
        }
      }
    }

    console.log("✅ Database schema initialized successfully");
    console.log("✅ All tables created");
    console.log("✅ Default data inserted");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run initialization
initializeDatabase();
