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
// In production: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in environment
// In development: uses a local SQLite file
const db = createClient(
  process.env.TURSO_DATABASE_URL
    ? {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : {
        url: "file:survey.db",
      }
);

// Initialize Database Tables
async function initDb() {
  // Schema migration: check columns
  try {
    const tableInfo = await db.execute("PRAGMA table_info(houses)");
    const columnNames = tableInfo.rows.map((col: any) => col[1]);
    const hasOldColumn = columnNames.includes("house_name");
    const missingRationCard = !columnNames.includes("ration_card_type");

    if (hasOldColumn || missingRationCard) {
      console.log("Schema mismatch detected, dropping tables for migration...");
      await db.execute("DROP TABLE IF EXISTS members");
      await db.execute("DROP TABLE IF EXISTS houses");
    }
  } catch (e) {
    // Table might not exist yet, that's fine
  }

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS houses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      house_details TEXT,
      area TEXT,
      ration_card_type TEXT,
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
  `);

  // Create default admin if not exists
  const adminRes = await db.execute(
    "SELECT * FROM users WHERE username = 'admin'"
  );
  if (adminRes.rows.length === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync("admin123", salt);
    await db.execute({
      sql: "INSERT INTO users (username, password) VALUES (?, ?)",
      args: ["admin", hashedPassword],
    });
  }
}

async function startServer() {
  await initDb();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Disable cache for index.html
  app.use((req, res, next) => {
    if (req.path === "/" || req.path === "/index.html") {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth Routes
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
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
  });

  app.post("/api/change-password", async (req, res) => {
    const { username, oldPassword, newPassword } = req.body;
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
  });

  // Stats
  app.get("/api/stats", async (_req, res) => {
    const [totalHouses, totalMembers, aplCount, bplCount, maleCount, femaleCount, studentCount, childrenCount, adultsCount, seniorsCount] =
      await Promise.all([
        db.execute("SELECT COUNT(*) as count FROM houses"),
        db.execute("SELECT COUNT(*) as count FROM members"),
        db.execute("SELECT COUNT(*) as count FROM houses WHERE ration_card_type = 'APL'"),
        db.execute("SELECT COUNT(*) as count FROM houses WHERE ration_card_type = 'BPL'"),
        db.execute("SELECT COUNT(*) as count FROM members WHERE gender = 'Male'"),
        db.execute("SELECT COUNT(*) as count FROM members WHERE gender = 'Female'"),
        db.execute("SELECT COUNT(*) as count FROM members WHERE occupation LIKE '%student%' OR education LIKE '%student%'"),
        db.execute("SELECT COUNT(*) as count FROM members WHERE age < 18"),
        db.execute("SELECT COUNT(*) as count FROM members WHERE age >= 18 AND age < 60"),
        db.execute("SELECT COUNT(*) as count FROM members WHERE age >= 60"),
      ]);

    res.json({
      totalHouses: Number(totalHouses.rows[0][0]),
      totalMembers: Number(totalMembers.rows[0][0]),
      aplCount: Number(aplCount.rows[0][0]),
      bplCount: Number(bplCount.rows[0][0]),
      maleCount: Number(maleCount.rows[0][0]),
      femaleCount: Number(femaleCount.rows[0][0]),
      studentCount: Number(studentCount.rows[0][0]),
      ageGroups: {
        children: Number(childrenCount.rows[0][0]),
        adults: Number(adultsCount.rows[0][0]),
        seniors: Number(seniorsCount.rows[0][0]),
      },
    });
  });

  app.get("/api/houses", async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 200;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await db.execute({
      sql: `SELECT h.*, COUNT(m.id) as member_count
            FROM houses h
            LEFT JOIN members m ON h.id = m.house_id
            GROUP BY h.id
            ORDER BY h.created_at DESC
            LIMIT ? OFFSET ?`,
      args: [limit, offset],
    });
    const houses = result.rows.map((h: any) => ({
      id: h[0] ?? h.id,
      house_details: h[1] ?? h.house_details,
      area: h[2] ?? h.area,
      ration_card_type: h[3] ?? h.ration_card_type,
      created_at: h[4] ?? h.created_at,
      members: new Array(Number(h[5] ?? h.member_count ?? 0)),
    }));
    res.json(houses);
  });

  app.get("/api/houses/:id/members", async (req, res) => {
    const { id } = req.params;
    const result = await db.execute({
      sql: "SELECT * FROM members WHERE house_id = ?",
      args: [id],
    });
    const members = result.rows.map((row: any) => ({
      id: row.id ?? row[0],
      house_id: row.house_id ?? row[1],
      name: row.name ?? row[2],
      gender: row.gender ?? row[3],
      age: row.age ?? row[4],
      occupation: row.occupation ?? row[5],
      education: row.education ?? row[6],
      ration_card_type: row.ration_card_type ?? row[7],
      membership_details: row.membership_details ?? row[8],
      blood_group: row.blood_group ?? row[9],
      phone: row.phone ?? row[10],
      other_details: row.other_details ?? row[11],
    }));
    res.json(members);
  });

  app.post("/api/survey", async (req, res) => {
    const { house, members } = req.body;
    try {
      const houseRes = await db.execute({
        sql: "INSERT INTO houses (house_details, area, ration_card_type) VALUES (?, ?, ?)",
        args: [house.house_details, house.area, house.ration_card_type],
      });
      const houseId = houseRes.lastInsertRowid;
      for (const member of members) {
        await db.execute({
          sql: `INSERT INTO members (house_id, name, gender, age, occupation, education, ration_card_type, membership_details, blood_group, phone, other_details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [houseId, member.name, member.gender, member.age, member.occupation, member.education, member.ration_card_type || "", member.membership_details || "", member.blood_group || "", member.phone, member.other_details || ""],
        });
      }
      res.json({ success: true, id: houseId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save survey data" });
    }
  });

  app.get("/api/export", async (_req, res) => {
    const housesRes = await db.execute("SELECT * FROM houses ORDER BY created_at DESC");
    const houses = housesRes.rows.map((h: any) => ({
      id: h.id ?? h[0],
      house_details: h.house_details ?? h[1],
      area: h.area ?? h[2],
      ration_card_type: h.ration_card_type ?? h[3],
      created_at: h.created_at ?? h[4],
    }));
    const housesWithMembers = await Promise.all(
      houses.map(async (house: any) => {
        const membersRes = await db.execute({ sql: "SELECT * FROM members WHERE house_id = ?", args: [house.id] });
        const members = membersRes.rows.map((row: any) => ({
          id: row.id ?? row[0],
          name: row.name ?? row[2],
          gender: row.gender ?? row[3],
          age: row.age ?? row[4],
          occupation: row.occupation ?? row[5],
          education: row.education ?? row[6],
          ration_card_type: row.ration_card_type ?? row[7],
          membership_details: row.membership_details ?? row[8],
          blood_group: row.blood_group ?? row[9],
          phone: row.phone ?? row[10],
          other_details: row.other_details ?? row[11],
        }));
        return { ...house, members };
      })
    );
    res.json(housesWithMembers);
  });

  app.get("/api/suggestions", async (_req, res) => {
    const [areas, occupations, educations, memberships, blood_groups, names, other_details] = await Promise.all([
      db.execute("SELECT area FROM houses WHERE area IS NOT NULL AND area != '' GROUP BY area ORDER BY MAX(id) DESC LIMIT 50"),
      db.execute("SELECT occupation FROM members WHERE occupation IS NOT NULL AND occupation != '' GROUP BY occupation ORDER BY MAX(id) DESC LIMIT 50"),
      db.execute("SELECT education FROM members WHERE education IS NOT NULL AND education != '' GROUP BY education ORDER BY MAX(id) DESC LIMIT 50"),
      db.execute("SELECT membership_details FROM members WHERE membership_details IS NOT NULL AND membership_details != '' GROUP BY membership_details ORDER BY MAX(id) DESC LIMIT 50"),
      db.execute("SELECT blood_group FROM members WHERE blood_group IS NOT NULL AND blood_group != '' GROUP BY blood_group ORDER BY MAX(id) DESC LIMIT 50"),
      db.execute("SELECT name FROM members WHERE name IS NOT NULL AND name != '' GROUP BY name ORDER BY MAX(id) DESC LIMIT 50"),
      db.execute("SELECT other_details FROM members WHERE other_details IS NOT NULL AND other_details != '' GROUP BY other_details ORDER BY MAX(id) DESC LIMIT 50"),
    ]);
    res.json({
      areas: areas.rows.map((r: any) => r.area ?? r[0]),
      occupations: occupations.rows.map((r: any) => r.occupation ?? r[0]),
      educations: educations.rows.map((r: any) => r.education ?? r[0]),
      memberships: memberships.rows.map((r: any) => r.membership_details ?? r[0]),
      blood_groups: blood_groups.rows.map((r: any) => r.blood_group ?? r[0]),
      names: names.rows.map((r: any) => r.name ?? r[0]),
      other_details: other_details.rows.map((r: any) => r.other_details ?? r[0]),
    });
  });

  app.put("/api/houses/:id", async (req, res) => {
    const { id } = req.params;
    const { house_details, area, ration_card_type } = req.body;
    try {
      await db.execute({ sql: "UPDATE houses SET house_details = ?, area = ?, ration_card_type = ? WHERE id = ?", args: [house_details, area, ration_card_type, id] });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update house" });
    }
  });

  app.delete("/api/houses/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await db.execute({ sql: "DELETE FROM members WHERE house_id = ?", args: [id] });
      await db.execute({ sql: "DELETE FROM houses WHERE id = ?", args: [id] });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete house" });
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
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to add member" });
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
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update member" });
    }
  });

  app.delete("/api/members/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await db.execute({ sql: "DELETE FROM members WHERE id = ?", args: [id] });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete member" });
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
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to clear data" });
    }
  });

  app.post("/api/seed-data", async (_req, res) => {
    try {
      const existing = await db.execute("SELECT COUNT(*) as count FROM houses");
      if (Number(existing.rows[0][0]) > 0) {
        return res.json({ success: false, message: "Data already exists. Clear data first before seeding." });
      }
      // Insert sample data
      const houseRes = await db.execute({
        sql: "INSERT INTO houses (house_details, area, ration_card_type) VALUES (?, ?, ?)",
        args: ["Manakattu House, Ambedkar Road, Near Govt. School, Alappuzha - 688001", "Alappuzha North", "APL"],
      });
      await db.execute({
        sql: `INSERT INTO members (house_id, name, gender, age, occupation, education, ration_card_type, membership_details, blood_group, phone, other_details)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [houseRes.lastInsertRowid, "Rajan Pillai", "Male", 54, "Government Employee", "B.Sc", "APL", "Life Member", "B+", "9446123001", "Block Panchayat Member"],
      });
      res.json({ success: true, message: "Sample data seeded successfully!" });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "Failed to seed data" });
    }
  });

  app.get("/api/download-project", (_req, res) => {
    try {
      const zip = new AdmZip();
      const rootDir = __dirname;
      const files = fs.readdirSync(rootDir);
      files.forEach((file) => {
        const filePath = path.join(rootDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          if (!["node_modules", "dist", ".git", ".next", ".cache"].includes(file)) {
            zip.addLocalFolder(filePath, file);
          }
        } else {
          if (!["project.zip", "survey.db", "survey.db-journal"].includes(file)) {
            zip.addLocalFile(filePath);
          }
        }
      });
      const buffer = zip.toBuffer();
      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=sndp-survey-project.zip",
        "Content-Length": buffer.length,
      });
      res.send(buffer);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ error: "Failed to generate project zip" });
    }
  });

  // Vite middleware for development
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
