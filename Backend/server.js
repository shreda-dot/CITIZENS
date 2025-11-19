require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

console.log(">>> SERVER FILE LOADED");

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.error("FATAL: JWT_SECRET is not set. Exiting.");
  process.exit(1);
}

app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // serve uploaded images

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool
  .connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch((err) => console.error("PostgreSQL connection error:", err));

// ===========================
// 🔥 SSE REALTIME STREAM
// ===========================
let sseClients = [];

function broadcastIncident(incident) {
  const data = `data: ${JSON.stringify(incident)}\n\n`;
  sseClients.forEach((res) => res.write(data));
}

// SSE endpoint
app.get("/api/incidents/stream", (req, res) => {
  console.log("SSE client connected");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  sseClients.push(res);

  const interval = setInterval(() => res.write("data: ping\n\n"), 20000);

  req.on("close", () => {
    console.log("SSE client disconnected");
    clearInterval(interval);
    sseClients = sseClients.filter((c) => c !== res);
  });
});

// ===========================
// AUTH ROUTES
// ===========================

// REGISTER
app.post("/auth/register", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: "Email and password are required" });

    const normalizedEmail = String(email).trim().toLowerCase();

    try {
        // case-insensitive check
        const existingUser = await pool.query(
            "SELECT 1 FROM users WHERE lower(email) = $1 LIMIT 1",
            [normalizedEmail]
        );
        if (existingUser.rows.length > 0) {
            // Inform frontend that email exists so it can keep signup button in default state / not proceed
            res.setHeader("X-Email-Exists", "true");
            return res.status(409).json({ exists: true, message: "Email already exists" });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        const newUser = await pool.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
            [normalizedEmail, hashedPassword]
        );

        const token = jwt.sign(
            { id: newUser.rows[0].id, email: newUser.rows[0].email },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.status(201).json({ exists: false, token, message: "Registered" });
    } catch (err) {
        // handle unique constraint race (in case of concurrent requests)
        if (err && err.code === "23505") {
            res.setHeader("X-Email-Exists", "true");
            return res.status(409).json({ exists: true, message: "Email already exists" });
        }

        console.error("REGISTER ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// LOGIN
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const userQuery = await pool.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);
    const user = userQuery.rows[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.status(200).json({ token, message: "Welcome back" });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// HOME PAGE
app.get("/home", (req, res) => {
  const message = req.query.message || "";

  const rawCookies = req.headers.cookie || "";
  const cookies = rawCookies.split(";").reduce((acc, cookie) => {
    const [k, v] = cookie.split("=").map((s) => s && s.trim());
    if (k && v) acc[k] = decodeURIComponent(v);
    return acc;
  }, {});

  let userInfo = null;
  if (cookies.token) {
    try {
      userInfo = jwt.verify(cookies.token, JWT_SECRET);
    } catch {}
  }

  res.send(`
    <!doctype html>
    <html>
      <head><meta charset="utf-8"><title>Home</title></head>
      <body>
        <h1>${message || "Home"}</h1>
        ${userInfo ? `<p>Welcome back, ${userInfo.email}!</p>` : "<p>You are not signed in.</p>"}
      </body>
    </html>
  `);
});

// PROTECTED
app.get("/protected", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ message: "Protected data", user: decoded });
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
});

// ===========================
// INCIDENTS
// ===========================

// Multer storage
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// CREATE INCIDENT
app.post("/api/incidents", upload.array("images", 5), async (req, res) => {
  try {
    const isMultipart = req.files && req.files.length > 0;
    let data = isMultipart ? req.body : req.body;
    data.images = isMultipart ? req.files.map((f) => "/uploads/" + f.filename) : [];

    const { userId, type, title, description, location, latitude, longitude } = data;
    if (!type) return res.status(400).json({ message: "Type required" });

    // Fix: convert JS array to Postgres array literal
    let pgImages = "{}";
    if (data.images.length > 0) {
      pgImages = `{${data.images.map((img) => `"${img}"`).join(",")}}`;
    }

    const incidentQuery = await pool.query(
      `
      INSERT INTO incidents 
      ( type, title, description, location, latitude, longitude, images)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING 
        id, 
        // user_id AS "userId", 
        type, 
        title, 
        description, 
        location, 
        latitude, 
        longitude, 
        images,
        created_at AS "createdAt"
      `,
      [type, title || "", description || "", location || "", latitude || null, longitude || null, pgImages]
    );

    const inc = incidentQuery.rows[0];

    if (inc.userId) {
      const userQuery = await pool.query("SELECT email FROM users WHERE id=$1 LIMIT 1", [
        inc.userId,
      ]);
      inc.userName = userQuery.rows[0]?.email || null;
    }

    // SSE broadcast
    broadcastIncident(inc);

    res.status(201).json(inc);
  } catch (err) {
    console.error("INCIDENT CREATE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET INCIDENTS
app.get("/api/incidents", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        user_id AS "userId",
        type, 
        title, 
        description, 
        location, 
        latitude, 
        longitude, 
        images,
        created_at AS "createdAt"
      FROM incidents
      ORDER BY created_at DESC
    `);

    const incidents = result.rows.map((row) => ({
      ...row,
      images: row.images || [],
    }));

    res.json(incidents);
  } catch (err) {
    console.error("INCIDENT GET ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===========================
// START SERVER
// ===========================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
