import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import OpenAI from "openai";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let dbPath = "survey.db";
if ((process.env.NODE_ENV === "production" || process.env.K_SERVICE) && process.platform !== "win32") {
  dbPath = "/tmp/survey.db";
}

let db;
try {
  db = new Database(dbPath);
} catch (err) {
  console.warn(`Failed to open ${dbPath}, falling back to /tmp/survey.db`);
  dbPath = "/tmp/survey.db";
  db = new Database(dbPath);
}

// Initialize Database
try {
  const tableInfo = db.prepare("PRAGMA table_info(houses)").all() as any[];
  const hasOldColumn = tableInfo.some(col => col.name === 'house_name');
  if (hasOldColumn) {
    console.log("Old schema detected, dropping houses table...");
    db.exec("DROP TABLE IF EXISTS members"); // Drop members first due to FK
    db.exec("DROP TABLE IF EXISTS houses");
  }
} catch (e) {
  // Table might not exist yet
}

db.exec(`
  CREATE TABLE IF NOT EXISTS houses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_details TEXT,
    area TEXT,
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
    role TEXT DEFAULT 'admin'
  );
`);

// Create default admin if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('admin123', salt);
  db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run('admin', hashedPassword);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;

    if (user && bcrypt.compareSync(password, user.password)) {
      res.json({ success: true, user: { id: user.id, username: user.username } });
    } else {
      res.status(401).json({ success: false, error: "Invalid credentials" });
    }
  });

  app.post("/api/change-password", (req, res) => {
    const { username, oldPassword, newPassword } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;

    if (user && bcrypt.compareSync(oldPassword, user.password)) {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);
      db.prepare("UPDATE users SET password = ? WHERE username = ?").run(hashedPassword, username);
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "Incorrect current password" });
    }
  });

  // API Routes
  app.get("/api/stats", (req, res) => {
    const totalHouses = db.prepare("SELECT COUNT(*) as count FROM houses").get() as { count: number };
    const totalMembers = db.prepare("SELECT COUNT(*) as count FROM members").get() as { count: number };

    res.json({
      totalHouses: totalHouses.count,
      totalMembers: totalMembers.count
    });
  });

  app.get("/api/houses", (req, res) => {
    const houses = db.prepare("SELECT * FROM houses ORDER BY created_at DESC").all();
    const housesWithMembers = houses.map((house: any) => {
      const members = db.prepare("SELECT * FROM members WHERE house_id = ?").all(house.id);
      return { ...house, members };
    });
    res.json(housesWithMembers);
  });

  app.post("/api/survey", (req, res) => {
    const { house, members } = req.body;

    const transaction = db.transaction(() => {
      const houseInsert = db.prepare(`
        INSERT INTO houses (house_details, area)
        VALUES (?, ?)
      `).run(house.house_details, house.area);

      const houseId = houseInsert.lastInsertRowid;

      const memberInsert = db.prepare(`
        INSERT INTO members (house_id, name, gender, age, occupation, education, ration_card_type, membership_details, blood_group, phone, other_details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const member of members) {
        memberInsert.run(
          houseId,
          member.name,
          member.gender,
          member.age,
          member.occupation,
          member.education,
          member.ration_card_type || '',
          member.membership_details || '',
          member.blood_group || '',
          member.phone,
          member.other_details || ''
        );
      }

      return houseId;
    });

    try {
      const id = transaction();
      res.json({ success: true, id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save survey data" });
    }
  });



  // House & Member Management Routes
  app.put("/api/houses/:id", (req, res) => {
    const { id } = req.params;
    const { house_details, area } = req.body;
    try {
      db.prepare("UPDATE houses SET house_details = ?, area = ? WHERE id = ?").run(house_details, area, id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update house" });
    }
  });

  app.delete("/api/houses/:id", (req, res) => {
    const { id } = req.params;
    try {
      const transaction = db.transaction(() => {
        db.prepare("DELETE FROM members WHERE house_id = ?").run(id);
        db.prepare("DELETE FROM houses WHERE id = ?").run(id);
      });
      transaction();
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete house" });
    }
  });

  app.put("/api/members/:id", (req, res) => {
    const { id } = req.params;
    const m = req.body;
    try {
      db.prepare(`
        UPDATE members 
        SET name = ?, gender = ?, age = ?, occupation = ?, education = ?, 
            ration_card_type = ?, membership_details = ?, blood_group = ?, 
            phone = ?, other_details = ?
        WHERE id = ?
      `).run(
        m.name, m.gender, m.age, m.occupation, m.education,
        m.ration_card_type, m.membership_details, m.blood_group,
        m.phone, m.other_details, id
      );
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update member" });
    }
  });

  app.delete("/api/members/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM members WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete member" });
    }
  });

  app.post("/api/clear-data", (req, res) => {
    const { username, password } = req.body;
    try {
      const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ success: false, error: "Invalid password. Access denied." });
      }

      db.prepare("DELETE FROM members").run();
      db.prepare("DELETE FROM houses").run();
      res.json({ success: true, message: "All data cleared successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to clear data" });
    }
  });

  // Seed fake data endpoint
  app.post("/api/seed-data", (req, res) => {
    try {
      const existingHouses = db.prepare("SELECT COUNT(*) as count FROM houses").get() as { count: number };
      if (existingHouses.count > 0) {
        return res.json({ success: false, message: "Data already exists. Clear data first before seeding." });
      }

      const seedTransaction = db.transaction(() => {
        // --- Houses & Members ---
        const housesData = [
          {
            house_details: "Manakattu House, Ambedkar Road, Near Govt. School, Alappuzha - 688001",
            area: "Alappuzha North",
            members: [
              { name: "Rajan Pillai", gender: "Male", age: 54, occupation: "Government Employee", education: "B.Sc", ration_card_type: "Non-Priority", membership_details: "Life Member", blood_group: "B+", phone: "9446123001", other_details: "Block Panchayat Member" },
              { name: "Suma Rajan", gender: "Female", age: 48, occupation: "Teacher", education: "B.Ed", ration_card_type: "Non-Priority", membership_details: "General Member", blood_group: "O+", phone: "9446123002", other_details: "" },
              { name: "Arjun Rajan", gender: "Male", age: 24, occupation: "Software Engineer", education: "B.Tech", ration_card_type: "Non-Priority", membership_details: "Youth Wing", blood_group: "B+", phone: "9446123003", other_details: "" },
              { name: "Anjali Rajan", gender: "Female", age: 19, occupation: "Student", education: "12th Standard", ration_card_type: "Non-Priority", membership_details: "Youth Wing", blood_group: "A+", phone: "9446123004", other_details: "" }
            ]
          },
          {
            house_details: "Thekkethil House, Church Road, Kuttanad, Alappuzha - 688504",
            area: "Kuttanad",
            members: [
              { name: "Shaji Kumar", gender: "Male", age: 62, occupation: "Farmer", education: "SSLC", ration_card_type: "BPL", membership_details: "Life Member", blood_group: "O+", phone: "9447234001", other_details: "Ward Councillor" },
              { name: "Leela Shaji", gender: "Female", age: 58, occupation: "Homemaker", education: "7th Standard", ration_card_type: "BPL", membership_details: "General Member", blood_group: "AB+", phone: "9447234002", other_details: "" },
              { name: "Binu Shaji", gender: "Male", age: 35, occupation: "Driver", education: "SSLC", ration_card_type: "APL", membership_details: "General Member", blood_group: "O-", phone: "9447234003", other_details: "" }
            ]
          },
          {
            house_details: "Nandanam, Temple Road, Cherthala, Alappuzha - 688524",
            area: "Cherthala",
            members: [
              { name: "Dr. Suresh Menon", gender: "Male", age: 47, occupation: "Doctor", education: "MBBS, MD", ration_card_type: "Non-Priority", membership_details: "Life Member", blood_group: "A-", phone: "9495345001", other_details: "Medical Board Member" },
              { name: "Priya Menon", gender: "Female", age: 43, occupation: "Nurse", education: "B.Sc Nursing", ration_card_type: "Non-Priority", membership_details: "General Member", blood_group: "A+", phone: "9495345002", other_details: "" },
              { name: "Nived Menon", gender: "Male", age: 17, occupation: "Student", education: "12th Standard", ration_card_type: "Non-Priority", membership_details: "Junior Member", blood_group: "A-", phone: "9495345003", other_details: "School Captain" },
              { name: "Sreelakshmi Menon", gender: "Female", age: 72, occupation: "Retired", education: "BA", ration_card_type: "Non-Priority", membership_details: "Life Member", blood_group: "B-", phone: "", other_details: "Founder Member" }
            ]
          },
          {
            house_details: "Puthiyaveettil House, Govt Hospital Road, Harippad - 690514",
            area: "Harippad",
            members: [
              { name: "Mohanan Nair", gender: "Male", age: 50, occupation: "Business", education: "BCom", ration_card_type: "APL", membership_details: "General Member", blood_group: "B+", phone: "9447456001", other_details: "SNDP Branch Secretary" },
              { name: "Sheeja Mohanan", gender: "Female", age: 46, occupation: "Tailoring", education: "10th Standard", ration_card_type: "APL", membership_details: "Mahila Wing", blood_group: "O+", phone: "9447456002", other_details: "" },
              { name: "Vishnu Mohanan", gender: "Male", age: 22, occupation: "Mechanic", education: "ITI", ration_card_type: "APL", membership_details: "Youth Wing", blood_group: "B+", phone: "9447456003", other_details: "" }
            ]
          },
          {
            house_details: "Kizhakkethil, Bus Stand Junction, Kayamkulam - 690502",
            area: "Kayamkulam",
            members: [
              { name: "Bijulal T.P", gender: "Male", age: 38, occupation: "Electrician", education: "ITI", ration_card_type: "APL", membership_details: "General Member", blood_group: "O+", phone: "9447567001", other_details: "" },
              { name: "Deepa Biju", gender: "Female", age: 35, occupation: "Anganwadi Teacher", education: "PDC", ration_card_type: "APL", membership_details: "Mahila Wing", blood_group: "A+", phone: "9447567002", other_details: "" },
              { name: "Amala Biju", gender: "Female", age: 10, occupation: "Student", education: "5th Standard", ration_card_type: "APL", membership_details: "Junior Member", blood_group: "O+", phone: "", other_details: "" }
            ]
          },
          {
            house_details: "Sreekrishna Sadanam, Near KSRTC Depot, Mavelikkara - 690101",
            area: "Mavelikkara",
            members: [
              { name: "Adv. Rajendran K", gender: "Male", age: 56, occupation: "Advocate", education: "LLB", ration_card_type: "Non-Priority", membership_details: "Life Member", blood_group: "AB-", phone: "9447678001", other_details: "District Committee Member" },
              { name: "Sindhu Rajendran", gender: "Female", age: 52, occupation: "Teacher", education: "MA, B.Ed", ration_card_type: "Non-Priority", membership_details: "Life Member", blood_group: "B+", phone: "9447678002", other_details: "" },
              { name: "Rahul Raj", gender: "Male", age: 28, occupation: "Bank Employee", education: "MBA", ration_card_type: "Non-Priority", membership_details: "Youth Wing", blood_group: "AB-", phone: "9447678003", other_details: "" },
              { name: "Reshma Raj", gender: "Female", age: 25, occupation: "Chartered Accountant", education: "CA", ration_card_type: "Non-Priority", membership_details: "Youth Wing", blood_group: "O+", phone: "9447678004", other_details: "" }
            ]
          },
          {
            house_details: "Thankamani House, Chambakkulam, Near Boat Jetty, Alappuzha - 688503",
            area: "Chambakkulam",
            members: [
              { name: "George Thomas", gender: "Male", age: 45, occupation: "Fisherman", education: "8th Standard", ration_card_type: "BPL", membership_details: "General Member", blood_group: "O-", phone: "9446789001", other_details: "" },
              { name: "Mariyamma George", gender: "Female", age: 41, occupation: "Homemaker", education: "8th Standard", ration_card_type: "BPL", membership_details: "General Member", blood_group: "B+", phone: "9446789002", other_details: "" },
              { name: "Joby George", gender: "Male", age: 20, occupation: "Daily Wage", education: "SSLC", ration_card_type: "BPL", membership_details: "Youth Wing", blood_group: "O-", phone: "9446789003", other_details: "" }
            ]
          },
          {
            house_details: "Valiyaparambil, NH 66, Near Junction, Thiruvalla - 689101",
            area: "Thiruvalla",
            members: [
              { name: "Prof. Satheesh Kumar", gender: "Male", age: 60, occupation: "Professor", education: "M.Sc, PhD", ration_card_type: "Non-Priority", membership_details: "Life Member", blood_group: "A+", phone: "9446890001", other_details: "University Academic Council Member" },
              { name: "Ambika Satheesh", gender: "Female", age: 55, occupation: "Retired Teacher", education: "MA", ration_card_type: "Non-Priority", membership_details: "Life Member", blood_group: "O+", phone: "9446890002", other_details: "" },
              { name: "Arun Satheesh", gender: "Male", age: 30, occupation: "Journalist", education: "MJMC", ration_card_type: "Non-Priority", membership_details: "Youth Wing", blood_group: "A+", phone: "9446890003", other_details: "" }
            ]
          }
        ];

        const memberInsertStmt = db.prepare(`
          INSERT INTO members (house_id, name, gender, age, occupation, education, ration_card_type, membership_details, blood_group, phone, other_details)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const h of housesData) {
          const houseResult = db.prepare(`INSERT INTO houses (house_details, area) VALUES (?, ?)`).run(h.house_details, h.area);
          const houseId = houseResult.lastInsertRowid;
          for (const m of h.members) {
            memberInsertStmt.run(houseId, m.name, m.gender, m.age, m.occupation, m.education, m.ration_card_type, m.membership_details, m.blood_group, m.phone, m.other_details);
          }
        }
      });

      seedTransaction();
      res.json({ success: true, message: "Fake data seeded successfully!" });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "Failed to seed data" });
    }
  });

  app.get("/api/download-project", (req, res) => {
    try {
      const zip = new AdmZip();
      const rootDir = __dirname;

      const files = fs.readdirSync(rootDir);

      files.forEach(file => {
        const filePath = path.join(rootDir, file);
        const stats = fs.statSync(filePath);

        // Exclude large or unnecessary directories
        if (stats.isDirectory()) {
          if (!['node_modules', 'dist', '.git', '.next', '.cache'].includes(file)) {
            zip.addLocalFolder(filePath, file);
          }
        } else {
          // Exclude the zip file itself and other artifacts
          if (!['project.zip', 'survey.db', 'survey.db-journal'].includes(file)) {
            zip.addLocalFile(filePath);
          }
        }
      });

      const buffer = zip.toBuffer();

      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=sndp-survey-project.zip',
        'Content-Length': buffer.length
      });

      res.send(buffer);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ error: "Failed to generate project zip" });
    }
  });



  // Vite middleware for development
  const isProd = process.env.NODE_ENV === "production" || !!process.env.K_SERVICE;
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
