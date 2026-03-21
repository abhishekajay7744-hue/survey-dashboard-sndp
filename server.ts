import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Turso / libsql Client Setup ---
const getDbUrl = () => {
  if (process.env.SQLITE_DB_PATH) {
    console.log("Database: Using local SQLite persistent disk at " + process.env.SQLITE_DB_PATH);
    return `file:${process.env.SQLITE_DB_PATH}`;
  }
  if (process.env.TURSO_DATABASE_URL) {
    console.log("Database: Using remote Turso URL from ENV");
    return process.env.TURSO_DATABASE_URL;
  }
  
  // Safe Cloud Fallback for instantly fast starts and permanent data across any platform
  console.log("Database: Using secure Cloud connection (Turso Fallback)");
  return "libsql://webapp-abhi7988.aws-ap-south-1.turso.io";
};

const db = createClient({
  url: getDbUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQwMDQwNDMsImlkIjoiMDE5ZDBhZTAtZmYwMS03YTkxLTg4NzktMWYwZGM1MDE4YWE3IiwicmlkIjoiMWEyYTg0ZjktNDNjYS00MjYxLWE0NDYtMGRlNTgwZmYxM2NlIn0.Km-ET7SPfjaUaJaA5ihzubBkm8nrW2JhMg4Jormz0-T8kmHcC1YRe8laaQTsQin7VIe5lfC9fR8WtlAvMAQzDw",
});

const app = express();
app.use(express.json());

// Initialize Database Tables
async function initDb() {
  console.log("Initializing database connection...");
  try {
    const tableInfo = await db.execute("PRAGMA table_info(houses)");
    // LibSQL / Turso returns rows as objects where column names are keys.
    const columnNames = tableInfo.rows.map((col: any) => col.name || col[1] || "");
    const hasOldColumn = columnNames.includes("house_name");
    const missingRationCard = columnNames.length > 0 && !columnNames.includes("ration_card_type");

    if (hasOldColumn || (columnNames.length > 0 && missingRationCard)) {
      console.log("Schema mismatch detected, dropping tables for migration...");
      await db.execute("DROP TABLE IF EXISTS members");
      await db.execute("DROP TABLE IF EXISTS houses");
    }
  } catch (e) {
    console.error("Migration check failed or tables don't exist yet:", e);
  }

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS houses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      house_details TEXT,
      area TEXT,
      ration_card_type TEXT,
      phone_numbers TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      house_id INTEGER,
      name TEXT,
      gender TEXT,
      age INTEGER,
      occupation TEXT,
      education TEXT,
      ration_card_type TEXT,
      membership_details TEXT,
      blood_group TEXT,
      phone TEXT,
      other_details TEXT,
      FOREIGN KEY (house_id) REFERENCES houses(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      google_id TEXT UNIQUE,
      email TEXT UNIQUE,
      role TEXT DEFAULT 'admin'
    );

    CREATE INDEX IF NOT EXISTS idx_members_house_id ON members(house_id);
    CREATE INDEX IF NOT EXISTS idx_houses_area ON houses(area);
    CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
    CREATE INDEX IF NOT EXISTS idx_houses_ration ON houses(ration_card_type);
    CREATE INDEX IF NOT EXISTS idx_members_gender ON members(gender);
    CREATE INDEX IF NOT EXISTS idx_members_age ON members(age);
  `);

  // Migration: add phone_numbers column to existing houses table if missing
  try {
    const colCheck = await db.execute("PRAGMA table_info(houses)");
    const cols = colCheck.rows.map((r: any) => r.name || r[1] || "");
    if (!cols.includes("phone_numbers")) {
      await db.execute("ALTER TABLE houses ADD COLUMN phone_numbers TEXT DEFAULT '[]'");
      console.log("Migration: added phone_numbers column to houses.");
    }
  } catch(e) {
    console.error("Migration for phone_numbers failed:", e);
  }

  console.log("Database tables initialized.");
  const adminRes = await db.execute("SELECT * FROM users WHERE username = 'admin'");
  if (adminRes.rows.length === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync("admin123", salt);
    await db.execute({
      sql: "INSERT INTO users (username, password) VALUES (?, ?)",
      args: ["admin", hashedPassword],
    });
    console.log("Default admin account created.");
  }
}

// Middleware for caching
app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/index.html") {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  }
  next();
});

// API Routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE username = ?",
      args: [username],
    });
    const user = result.rows[0] as any;
    if (user && bcrypt.compareSync(password, user.password as string)) {
      res.json({ success: true, user: { id: user.id, username: user.username } });
    } else {
      res.status(401).json({ success: false, error: "Invalid credentials" });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

app.post("/api/change-password", async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  try {
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE username = ?",
      args: [username],
    });
    const user = result.rows[0] as any;
    if (user && bcrypt.compareSync(oldPassword, user.password as string)) {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);
      await db.execute({
        sql: "UPDATE users SET password = ? WHERE username = ?",
        args: [hashedPassword, username],
      });
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "Incorrect current password" });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to update password" });
  }
});

app.get("/api/stats", async (_req, res) => {
  try {
    const [housesRes, membersRes] = await Promise.all([
      db.execute(`
        SELECT 
          COUNT(*) as totalHouses,
          SUM(CASE WHEN ration_card_type = 'APL' THEN 1 ELSE 0 END) as aplCount,
          SUM(CASE WHEN ration_card_type = 'BPL' THEN 1 ELSE 0 END) as bplCount
        FROM houses
      `),
      db.execute(`
        SELECT 
          COUNT(*) as totalMembers,
          SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) as maleCount,
          SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) as femaleCount,
          SUM(CASE WHEN occupation LIKE '%student%' OR education LIKE '%student%' THEN 1 ELSE 0 END) as studentCount,
          SUM(CASE WHEN age < 18 THEN 1 ELSE 0 END) as childrenCount,
          SUM(CASE WHEN age >= 18 AND age < 60 THEN 1 ELSE 0 END) as adultsCount,
          SUM(CASE WHEN age >= 60 THEN 1 ELSE 0 END) as seniorsCount
        FROM members
      `)
    ]);

    const getCol = (resObj: any, colName: string, index: number) => {
      const row = resObj.rows[0];
      if (!row) return 0;
      return Number(row[colName] ?? row[index] ?? 0);
    };

    res.json({
      totalHouses: getCol(housesRes, 'totalHouses', 0),
      totalMembers: getCol(membersRes, 'totalMembers', 0),
      aplCount: getCol(housesRes, 'aplCount', 1),
      bplCount: getCol(housesRes, 'bplCount', 2),
      maleCount: getCol(membersRes, 'maleCount', 1),
      femaleCount: getCol(membersRes, 'femaleCount', 2),
      studentCount: getCol(membersRes, 'studentCount', 3),
      ageGroups: {
        children: getCol(membersRes, 'childrenCount', 4),
        adults: getCol(membersRes, 'adultsCount', 5),
        seniors: getCol(membersRes, 'seniorsCount', 6),
      },
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

app.get("/api/houses", async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 200;
  const offset = parseInt(req.query.offset as string) || 0;
  try {
    const result = await db.execute({
      sql: `SELECT h.*, COUNT(m.id) as member_count, GROUP_CONCAT(m.name) as member_names
            FROM houses h
            LEFT JOIN members m ON h.id = m.house_id
            GROUP BY h.id
            ORDER BY h.created_at DESC
            LIMIT ? OFFSET ?`,
      args: [limit, offset],
    });
    const houses = result.rows.map((h: any) => ({
      id: h.id ?? h[0],
      house_details: h.house_details ?? h[1],
      area: h.area ?? h[2],
      ration_card_type: h.ration_card_type ?? h[3],
      phone_numbers: JSON.parse((h.phone_numbers ?? h[4] ?? '[]') || '[]'),
      created_at: h.created_at ?? h[5],
      members: (h.member_names || "").split(',').filter(Boolean).map((name: string) => ({ name })),
      member_count: Number(h.member_count ?? 0)
    }));
    res.json(houses);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch houses" });
  }
});

app.get("/api/houses/:id/members", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.execute({
      sql: "SELECT * FROM members WHERE house_id = ?",
      args: [id],
    });
    const members = result.rows.map((row: any) => ({
      id: row.id ?? row[0],
      house_id: row.house_id ?? row[1],
      name: row.name ?? row[2],
      gender: row.gender ?? row[3],
      age: Number(row.age ?? row[4] ?? 0),
      occupation: row.occupation ?? row[5],
      education: row.education ?? row[6],
      ration_card_type: row.ration_card_type ?? row[7],
      membership_details: row.membership_details ?? row[8],
      blood_group: row.blood_group ?? row[9],
      phone: row.phone ?? row[10],
      other_details: row.other_details ?? row[11],
    }));
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

app.post("/api/survey", async (req, res) => {
  const { house, members } = req.body;
  if (!house || !members || !Array.isArray(members)) {
    return res.status(400).json({ error: "Invalid survey data" });
  }

  // Use batched execution to send all queries in a single extremely fast network round-trip.
  const statements = [];
  const phoneNumbers = JSON.stringify(
    Array.isArray(house.phone_numbers) ? house.phone_numbers.filter(Boolean) : []
  );
  statements.push({
    sql: "INSERT INTO houses (house_details, area, ration_card_type, phone_numbers) VALUES (?, ?, ?, ?)",
    args: [house.house_details || "", house.area || "", house.ration_card_type || "Other", phoneNumbers],
  });

  for (const member of members) {
    statements.push({
      sql: `INSERT INTO members (house_id, name, gender, age, occupation, education, ration_card_type, membership_details, blood_group, phone, other_details)
            VALUES (last_insert_rowid(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        member.name || "Unknown", 
        member.gender || "Male", 
        Number(member.age) || 0, 
        member.occupation || "", 
        member.education || "", 
        member.ration_card_type || house.ration_card_type || "Other", 
        member.membership_details || "", 
        member.blood_group || "", 
        member.phone || "", 
        member.other_details || ""
      ],
    });
  }

  try {
    const results = await db.batch(statements, "write");
    const houseId = results[0].lastInsertRowid;
    res.json({ success: true, id: houseId?.toString() });
  } catch (error: any) {
    console.error("Survey submission failure:", error);
    res.status(500).json({ error: "Database failure: " + (error.message || "Unknown error") });
  }
});

app.get("/api/export", async (_req, res) => {
  try {
    const [housesRes, membersRes] = await Promise.all([
      db.execute("SELECT * FROM houses ORDER BY created_at DESC"),
      db.execute("SELECT * FROM members")
    ]);
    
    // Group members by house ID efficiently
    const membersByHouse = new Map<number, any[]>();
    for (const row of membersRes.rows) {
      const houseId = Number(row.house_id ?? row[1] ?? 0);
      const member = {
        id: row.id ?? row[0],
        name: row.name ?? row[2],
        gender: row.gender ?? row[3],
        age: Number(row.age ?? row[4] ?? 0),
        occupation: row.occupation ?? row[5],
        education: row.education ?? row[6],
        ration_card_type: row.ration_card_type ?? row[7],
        membership_details: row.membership_details ?? row[8],
        blood_group: row.blood_group ?? row[9],
        phone: row.phone ?? row[10],
        other_details: row.other_details ?? row[11],
      };
      if (!membersByHouse.has(houseId)) membersByHouse.set(houseId, []);
      membersByHouse.get(houseId)!.push(member);
    }

    const housesWithMembers = housesRes.rows.map((h: any) => {
      const id = Number(h.id ?? h[0] ?? 0);
      return {
        id,
        house_details: h.house_details ?? h[1],
        area: h.area ?? h[2],
        ration_card_type: h.ration_card_type ?? h[3],
        created_at: h.created_at ?? h[4],
        members: membersByHouse.get(id) || []
      };
    });

    res.json(housesWithMembers);
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
});

app.get("/api/suggestions", async (_req, res) => {
  try {
    const [areas, occupations, educations, memberships, blood_groups, names, other_details] = await Promise.all([
      db.execute("SELECT area FROM houses WHERE area != '' GROUP BY area LIMIT 50"),
      db.execute("SELECT occupation FROM members WHERE occupation != '' GROUP BY occupation LIMIT 50"),
      db.execute("SELECT education FROM members WHERE education != '' GROUP BY education LIMIT 50"),
      db.execute("SELECT membership_details FROM members WHERE membership_details != '' GROUP BY membership_details LIMIT 50"),
      db.execute("SELECT blood_group FROM members WHERE blood_group != '' GROUP BY blood_group LIMIT 50"),
      db.execute("SELECT name FROM members WHERE name != '' GROUP BY name LIMIT 50"),
      db.execute("SELECT other_details FROM members WHERE other_details != '' GROUP BY other_details LIMIT 50"),
    ]);
    const getRows = (res: any, key: string) => res.rows.map((r: any) => r[key] ?? r[0]);
    res.json({
      areas: getRows(areas, "area"),
      occupations: getRows(occupations, "occupation"),
      educations: getRows(educations, "education"),
      memberships: getRows(memberships, "membership_details"),
      blood_groups: getRows(blood_groups, "blood_group"),
      names: getRows(names, "name"),
      other_details: getRows(other_details, "other_details"),
    });
  } catch (err) {
    res.status(500).json({ error: "Suggestions failed" });
  }
});

app.put("/api/houses/:id", async (req, res) => {
  const { id } = req.params;
  const { house_details, area, ration_card_type, phone_numbers } = req.body;
  try {
    const phones = JSON.stringify(Array.isArray(phone_numbers) ? phone_numbers.filter(Boolean) : []);
    await db.execute({ 
      sql: "UPDATE houses SET house_details = ?, area = ?, ration_card_type = ?, phone_numbers = ? WHERE id = ?", 
      args: [house_details, area, ration_card_type, phones, id] 
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Update house failed" });
  }
});

app.delete("/api/houses/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute({ sql: "DELETE FROM members WHERE house_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM houses WHERE id = ?", args: [id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete house failed" });
  }
});

app.post("/api/houses/:id/members", async (req, res) => {
  const { id } = req.params;
  const m = req.body;
  try {
    await db.execute({
      sql: `INSERT INTO members (house_id, name, gender, age, occupation, education, ration_card_type, membership_details, blood_group, phone, other_details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, m.name, m.gender, m.age, m.occupation, m.education, m.ration_card_type || "", m.membership_details, m.blood_group, m.phone, m.other_details],
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Add member failed" });
  }
});

app.put("/api/members/:id", async (req, res) => {
  const { id } = req.params;
  const m = req.body;
  try {
    await db.execute({
      sql: `UPDATE members SET name = ?, gender = ?, age = ?, occupation = ?, education = ?,
            ration_card_type = ?, membership_details = ?, blood_group = ?, phone = ?, other_details = ?
            WHERE id = ?`,
      args: [m.name, m.gender, m.age, m.occupation, m.education, m.ration_card_type, m.membership_details, m.blood_group, m.phone, m.other_details, id],
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Update member failed" });
  }
});

app.delete("/api/members/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute({ sql: "DELETE FROM members WHERE id = ?", args: [id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete member failed" });
  }
});

app.post("/api/clear-data", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.execute({ sql: "SELECT * FROM users WHERE username = ?", args: [username] });
    const user = result.rows[0] as any;
    if (!user || !bcrypt.compareSync(password, user.password as string)) {
      return res.status(401).json({ success: false, error: "Invalid password. Access denied." });
    }
    await db.execute("DELETE FROM members");
    await db.execute("DELETE FROM houses");
    res.json({ success: true, message: "All data cleared successfully" });
  } catch (err) {
    res.status(500).json({ error: "Clear failed" });
  }
});

app.post("/api/seed-data", async (_req, res) => {
  try {
    const existing = await db.execute("SELECT COUNT(*) as count FROM houses");
    const count = Number(existing.rows[0]?.count ?? existing.rows[0]?.[0] ?? 0);
    if (count > 0) {
      return res.json({ success: false, message: "Data already exists." });
    }
    const houseRes = await db.execute({
      sql: "INSERT INTO houses (house_details, area, ration_card_type) VALUES (?, ?, ?)",
      args: ["Sample Manakattu House, Alappuzha", "Alappuzha North", "APL"],
    });
    await db.execute({
      sql: `INSERT INTO members (house_id, name, gender, age, occupation, education, ration_card_type, membership_details, blood_group, phone, other_details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [houseRes.lastInsertRowid, "Rajan Pillai", "Male", 54, "Employee", "B.Sc", "APL", "Life Member", "B+", "9446123001", "Councillor"],
    });
    res.json({ success: true, message: "Sample data seeded!" });
  } catch (err) {
    res.status(500).json({ error: "Seed failed" });
  }
});

// Bulk Import from file (CSV/JSON/XLS parsed by frontend)
app.post("/api/import", async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: "No records provided." });
  }

  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const statements: any[] = [];
    try {
      const phoneNumbers = JSON.stringify(
        Array.isArray(record.phone_numbers) ? record.phone_numbers.filter(Boolean) :
        record.phone ? [record.phone] : []
      );
      statements.push({
        sql: "INSERT INTO houses (house_details, area, ration_card_type, phone_numbers) VALUES (?, ?, ?, ?)",
        args: [record.house_details || record.address || "", record.area || "", record.ration_card_type || "Other", phoneNumbers],
      });

      const members = Array.isArray(record.members) ? record.members : [];
      for (const m of members) {
        statements.push({
          sql: `INSERT INTO members (house_id, name, gender, age, occupation, education, ration_card_type, membership_details, blood_group, phone, other_details)
                VALUES (last_insert_rowid(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [m.name || "", m.gender || "Male", Number(m.age) || 0, m.occupation || "", m.education || "", m.ration_card_type || record.ration_card_type || "Other", m.membership_details || "", m.blood_group || "", m.phone || "", m.other_details || ""],
        });
      }

      if (statements.length > 0) {
        await db.batch(statements, "write");
        imported++;
      }
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e.message}`);
    }
  }

  res.json({ success: true, imported, errors, total: records.length });
});

// Assets & SPA fallback
const isProd = process.env.NODE_ENV === "production" || !!process.env.K_SERVICE || !!process.env.VERCEL;
if (!isProd) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// Function to start server (only if not running as serverless function)
export const start = async (port: number) => {
  await initDb();
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
  });
};

// Auto-start if not running as a Vercel serverless function
const isVercel = !!process.env.VERCEL;
if (!isVercel) {
  const PORT = Number(process.env.PORT) || 3000;
  start(PORT).catch(console.error);
}

// For Vercel / serverless
export default app;
export { initDb, db };
