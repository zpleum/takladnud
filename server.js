const express = require("express");
const mysql = require("mysql2/promise");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const fs = require("fs/promises");
const path = require("path");
const multer = require("multer");
const QRCode = require("qrcode");

const app = express();
const pool = mysql.createPool({
  host: "10.200.210.117",
  port: 3306,
  user: "std09",
  password: "std09",
  database: "db_std09",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  timezone: "+07:00",
});
const SESSION_COOKIE = "takladnat_session";
const SESSION_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const loginAttempts = new Map();
const publicAttempts = new Map();
const imageDirectory = path.join(__dirname, "public", "images");
const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const schema = [
  `CREATE TABLE IF NOT EXISTS users (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, email VARCHAR(254) NOT NULL, phone VARCHAR(20) NULL, password_hash VARCHAR(255) NOT NULL, role ENUM('shop','customer','admin') NOT NULL DEFAULT 'shop', status ENUM('active','disabled') NOT NULL DEFAULT 'active', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY uq_users_email (email), UNIQUE KEY uq_users_phone (phone)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS shops (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL, name VARCHAR(120) NOT NULL, description TEXT NULL, contact_name VARCHAR(120) NULL, contact_phone VARCHAR(20) NULL, logo_image VARCHAR(255) NULL, is_public BOOLEAN NOT NULL DEFAULT TRUE, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY uq_shops_user (user_id), KEY idx_shops_public_name (is_public,name), CONSTRAINT fk_shops_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS categories (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(80) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY uq_categories_name (name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS shop_categories (shop_id BIGINT UNSIGNED NOT NULL, category_id BIGINT UNSIGNED NOT NULL, PRIMARY KEY (shop_id,category_id), CONSTRAINT fk_shop_categories_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE, CONSTRAINT fk_shop_categories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS markets (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(150) NOT NULL, description TEXT NULL, address VARCHAR(255) NULL, map_image VARCHAR(255) NULL, map_width INT UNSIGNED NULL, map_height INT UNSIGNED NULL, status ENUM('active','inactive') NOT NULL DEFAULT 'active', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS market_sessions (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, market_id BIGINT UNSIGNED NOT NULL, name VARCHAR(120) NOT NULL, starts_at DATETIME NOT NULL, ends_at DATETIME NOT NULL, booking_opens_at DATETIME NULL, booking_closes_at DATETIME NULL, status ENUM('draft','open','closed','cancelled') NOT NULL DEFAULT 'draft', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id), KEY idx_sessions_market_date (market_id,starts_at,status), CONSTRAINT fk_sessions_market FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS stalls (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, market_id BIGINT UNSIGNED NOT NULL, stall_code VARCHAR(30) NOT NULL, name VARCHAR(100) NULL, description VARCHAR(255) NULL, x_percent DECIMAL(5,2) NULL, y_percent DECIMAL(5,2) NULL, width_percent DECIMAL(5,2) NULL, height_percent DECIMAL(5,2) NULL, base_price DECIMAL(10,2) NULL, status ENUM('active','inactive') NOT NULL DEFAULT 'active', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY uq_stalls_market_code (market_id,stall_code), KEY idx_stalls_market_status (market_id,status), CONSTRAINT fk_stalls_market FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS bookings (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, shop_id BIGINT UNSIGNED NOT NULL, session_id BIGINT UNSIGNED NOT NULL, stall_id BIGINT UNSIGNED NOT NULL, status ENUM('pending','confirmed','rejected','cancelled') NOT NULL DEFAULT 'confirmed', price_at_booking DECIMAL(10,2) NOT NULL, shop_note VARCHAR(500) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, cancelled_at DATETIME NULL, PRIMARY KEY (id), KEY idx_bookings_shop_created (shop_id,created_at), KEY idx_bookings_session_stall_status (session_id,stall_id,status), CONSTRAINT fk_bookings_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT, CONSTRAINT fk_bookings_session FOREIGN KEY (session_id) REFERENCES market_sessions(id) ON DELETE RESTRICT, CONSTRAINT fk_bookings_stall FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS app_sessions (token_hash CHAR(64) NOT NULL, user_id BIGINT UNSIGNED NOT NULL, csrf_token CHAR(43) NOT NULL, expires_at DATETIME NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (token_hash), KEY idx_app_sessions_user (user_id), KEY idx_app_sessions_expiry (expires_at), CONSTRAINT fk_app_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS qr_codes (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, session_id BIGINT UNSIGNED NOT NULL, token_hash CHAR(64) NOT NULL, status ENUM('active','revoked') NOT NULL DEFAULT 'active', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NULL, PRIMARY KEY (id), UNIQUE KEY uq_qr_token_hash (token_hash), KEY idx_qr_session_status (session_id,status), CONSTRAINT fk_qr_session FOREIGN KEY (session_id) REFERENCES market_sessions(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];
async function rollbackTransaction(connection) {
  try { await connection.rollback(); }
  catch (error) { console.error("Database rollback failed:", error.code || error.message); }
}
let schemaReady;
function ensureSchema() {
  if (!schemaReady) schemaReady = (async () => {
    const connection = await pool.getConnection();
    try {
      for (const statement of schema) await connection.query(statement);
      const [phoneIndex] = await connection.query("SHOW INDEX FROM users WHERE Key_name='uq_users_phone'");
      if (!phoneIndex.length) await connection.query("ALTER TABLE users ADD UNIQUE KEY uq_users_phone (phone)");
      await seedMarketDemo(connection);
    }
    finally { connection.release(); }
  })().catch((error) => { schemaReady = null; throw error; });
  return schemaReady;
}

async function seedMarketDemo(connection) {
  const startsAt = "2026-11-08 16:00:00";
  const endsAt = "2026-11-08 22:00:00";
  const bookingOpensAt = "2026-10-31 00:00:00";
  const bookingClosesAt = "2026-11-08 15:00:00";
  if (new Date(endsAt) <= new Date(startsAt) || new Date(bookingOpensAt) >= new Date(bookingClosesAt) || new Date(bookingClosesAt) > new Date(startsAt)) {
    throw new Error("Invalid demo market schedule");
  }
  await connection.beginTransaction();
  try {
    const [markets] = await connection.execute("SELECT id FROM markets WHERE name IN (?,?) ORDER BY id LIMIT 1 FOR UPDATE", ["ตลาดเย็นริมคลอง", "ตลาดเย็นริมคลอง (ตัวอย่าง)"]);
    let marketId;
    if (markets.length) {
      marketId = markets[0].id;
      await connection.execute("UPDATE markets SET name='ตลาดเย็นริมคลอง (ตัวอย่าง)',description='ข้อมูลตัวอย่างสำหรับเริ่มต้นใช้งาน',address='ลานชุมชนริมคลอง (ตัวอย่าง)',map_image='market-map.svg',map_width=1200,map_height=800 WHERE id=? AND description='ตลาดชุมชนและร้านค้าท้องถิ่น'", [marketId]);
    } else {
      const [market] = await connection.execute("INSERT INTO markets (name,description,address,map_image,map_width,map_height,status) VALUES (?,?,?,?,1200,800,'active')", ["ตลาดเย็นริมคลอง (ตัวอย่าง)", "ข้อมูลตัวอย่างสำหรับเริ่มต้นใช้งาน", "ลานชุมชนริมคลอง (ตัวอย่าง)", "market-map.svg"]);
      marketId = market.insertId;
    }
    const [sessions] = await connection.execute("SELECT id FROM market_sessions WHERE market_id=? AND starts_at=? AND ends_at=? ORDER BY id LIMIT 1 FOR UPDATE", [marketId, startsAt, endsAt]);
    let sessionId;
    if (sessions.length) {
      sessionId = sessions[0].id;
    } else {
      const [session] = await connection.execute("INSERT INTO market_sessions (market_id,name,starts_at,ends_at,booking_opens_at,booking_closes_at,status) VALUES (?,?,?,?,?,?,'open')", [marketId, "ตลาดเย็นวันอาทิตย์", startsAt, endsAt, bookingOpensAt, bookingClosesAt]);
      sessionId = session.insertId;
    }
    for (let row = 0; row < 6; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const code = `A-${String(row * 8 + column + 1).padStart(2, "0")}`;
        const x = 7 + column * 11.8;
        const y = 13 + row * 14;
        const width = 8;
        const height = 9;
        const price = 100;
        if (![x, y, width, height].every((value) => Number.isFinite(value) && value >= 0 && value <= 100) || x + width > 100 || y + height > 100 || !Number.isFinite(price) || price < 0) {
          throw new Error(`Invalid demo stall layout: ${code}`);
        }
        await connection.execute("INSERT IGNORE INTO stalls (market_id,stall_code,name,x_percent,y_percent,width_percent,height_percent,base_price,status) VALUES (?,?,?,?,?,?,?,?, 'active')", [marketId, code, `แผง ${code}`, x, y, width, height, price]);
      }
    }
    const categories = ["อาหาร", "เครื่องดื่ม", "ขนม", "งานฝีมือ", "เสื้อผ้า", "ของใช้"];
    for (const name of categories) await connection.execute("INSERT IGNORE INTO categories (name) VALUES (?)", [name]);
    await connection.commit();
  } catch (error) {
    await rollbackTransaction(connection);
    throw error;
  }
}

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return sendError(res, 400, "INVALID_BODY", "รูปแบบข้อมูลคำขอไม่ถูกต้อง");
  next();
});
app.use(express.static(path.join(__dirname, "public")));
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/v1/public/") && !allowPublicRequest(req.ip)) return sendError(res, 429, "RATE_LIMITED", "มีการเรียกดูข้อมูลบ่อยเกินไป กรุณาลองใหม่ภายหลัง");
  if (req.path.startsWith("/api/") && req.path !== "/api/v1/health") {
    try { await ensureSchema(); } catch (error) { console.error("Database schema initialization failed:", error.code || error.message); return sendError(res, 503, "SERVICE_UNAVAILABLE", "ระบบฐานข้อมูลยังไม่พร้อม"); }
  }
  if (req.path.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (req.path !== "/api/v1/health") res.setHeader("Cache-Control", "no-store");
  }
  next();
});

function sendError(res, status, code, message, fields) {
  const error = { code, message };
  if (fields && Object.keys(fields).length) error.fields = fields;
  res.status(status).json({ error });
}
function sendData(res, data, status = 200) { res.status(status).json({ data }); }
function isId(value) { return typeof value === "string" && /^\d{1,20}$/.test(value); }
function pageParams(req) {
  const rawPage = req.query.page;
  const rawLimit = req.query.limit;
  if ((rawPage !== undefined && (typeof rawPage !== "string" || !/^\d+$/.test(rawPage))) ||
      (rawLimit !== undefined && (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit)))) return null;
  const page = rawPage === undefined ? 1 : Number(rawPage);
  const limit = rawLimit === undefined ? 20 : Number(rawLimit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger((page - 1) * limit)) return null;
  return { page, limit };
}
function pagination(page, limit, total) { return { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 }; }
function sessionCookieOptions(req) {
  return { httpOnly: true, secure: req.secure || req.get("x-forwarded-proto") === "https", sameSite: "lax", path: "/", maxAge: SESSION_AGE_MS };
}
function requestToken(req) {
  const cookie = (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return "";
  try { return decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)); } catch { return ""; }
}
function constantTimeTextEqual(a, b) {
  const left = Buffer.from(a || ""); const right = Buffer.from(b || "");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function checkCsrf(req, res) {
  const supplied = req.get("x-csrf-token") || "";
  if (!supplied || !constantTimeTextEqual(supplied, req.session.csrfToken)) {
    sendError(res, 403, "CSRF_INVALID", "คำขอหมดอายุ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง");
    return false;
  }
  return true;
}
async function auth(req, res, next) {
  try {
    const raw = requestToken(req);
    if (!raw) return sendError(res, 401, "UNAUTHORIZED", "กรุณาเข้าสู่ระบบก่อน");
    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    const [rows] = await pool.execute(
      "SELECT s.user_id, s.csrf_token, s.expires_at, u.email, u.role, u.status, sh.id AS shop_id, sh.name AS shop_name FROM app_sessions s JOIN users u ON u.id=s.user_id LEFT JOIN shops sh ON sh.user_id=u.id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND u.status='active' LIMIT 1",
      [tokenHash],
    );
    if (!rows.length) return sendError(res, 401, "UNAUTHORIZED", "กรุณาเข้าสู่ระบบอีกครั้ง");
    req.session = { userId: String(rows[0].user_id), email: rows[0].email, role: rows[0].role, shopId: rows[0].shop_id == null ? null : String(rows[0].shop_id), shopName: rows[0].shop_name, csrfToken: rows[0].csrf_token };
    if (req.method !== "GET" && req.method !== "HEAD" && !checkCsrf(req, res)) return;
    next();
  } catch (error) { next(error); }
}
function shopOnly(req, res, next) {
  if (req.session.role !== "shop" || !req.session.shopId) return sendError(res, 403, "SHOP_REQUIRED", "บัญชีนี้ไม่มีโปรไฟล์ร้านค้า");
  next();
}
function allowAuthAttempts(key) {
  const now = Date.now();
  const item = loginAttempts.get(key);
  if (!item || item.until < now) loginAttempts.set(key, { count: 1, until: now + 15 * 60 * 1000 });
  else {
    if (item.count >= 12) return false;
    item.count += 1;
  }
  if (loginAttempts.size > 5000) {
    for (const [attemptKey, attempt] of loginAttempts) {
      if (attempt.until <= now) loginAttempts.delete(attemptKey);
      if (loginAttempts.size <= 5000) break;
    }
    while (loginAttempts.size > 5000) loginAttempts.delete(loginAttempts.keys().next().value);
  }
  return true;
}
function allowPublicRequest(key) {
  const now = Date.now();
  const current = publicAttempts.get(key);
  if (!current || current.until <= now) {
    publicAttempts.set(key, { count: 1, until: now + 15 * 60 * 1000 });
    if (publicAttempts.size > 5000) for (const [ip, value] of publicAttempts) if (value.until <= now) publicAttempts.delete(ip);
    return true;
  }
  if (current.count >= 120) return false;
  current.count += 1;
  return true;
}
function clearAuthAttempts(key) { loginAttempts.delete(key); }
function validEmail(value) { return typeof value === "string" && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
function text(value, min, max) { return typeof value === "string" && value.trim().length >= min && value.trim().length <= max; }
function toPublicShop(row) {
  return { id: String(row.shop_id), name: row.shop_name, description: row.description, logoImage: row.logo_image ? `/images/${encodeURIComponent(row.logo_image)}` : null, contactPhone: row.contact_phone, stallCode: row.stall_code, x: row.x_percent == null ? null : Number(row.x_percent), y: row.y_percent == null ? null : Number(row.y_percent), categories: row.categories || [] };
}

app.get("/api/v1/health", async (_req, res) => {
  try { await ensureSchema(); await pool.query("SELECT 1"); sendData(res, { status: "ok", database: "ok" }); }
  catch (error) { console.error("Health check failed:", error.code || error.message); sendError(res, 503, "SERVICE_UNAVAILABLE", "Backend or database unavailable"); }
});

app.get("/api/v1/auth/me", auth, async (req, res) => {
  sendData(res, { user: { id: req.session.userId, role: req.session.role, email: req.session.email }, shop: req.session.shopId ? { id: req.session.shopId, name: req.session.shopName } : null, csrfToken: req.session.csrfToken });
});
app.post("/api/v1/auth/register", async (req, res, next) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const { password, shopName, contactName, contactPhone } = req.body;
  const fields = {};
  if (!validEmail(email)) fields.email = "กรุณากรอกอีเมลให้ถูกต้อง";
  if (typeof password !== "string" || password.length < 10 || password.length > 128) fields.password = "รหัสผ่านต้องมี 10–128 ตัวอักษร";
  if (!text(shopName, 1, 120)) fields.shopName = "กรุณากรอกชื่อร้าน (ไม่เกิน 120 ตัวอักษร)";
  if (!text(contactName, 1, 120)) fields.contactName = "กรุณากรอกชื่อผู้ติดต่อ";
  if (contactPhone != null && (typeof contactPhone !== "string" || contactPhone.length > 20)) fields.contactPhone = "เบอร์ติดต่อยาวเกินกำหนด";
  if (Object.keys(fields).length) return sendError(res, 422, "VALIDATION_ERROR", "กรุณาตรวจสอบข้อมูลที่กรอก", fields);
  const key = `${req.ip}:register`;
  if (!allowAuthAttempts(key)) return sendError(res, 429, "RATE_LIMITED", "ลองใหม่อีกครั้งในภายหลัง");
  let connection;
  let transactionOpen = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionOpen = true;
    const hash = await bcrypt.hash(password, 12);
    const [userResult] = await connection.execute("INSERT INTO users (email,password_hash,role,status,created_at,updated_at) VALUES (?,?,'shop','active',UTC_TIMESTAMP(),UTC_TIMESTAMP())", [email, hash]);
    const [shopResult] = await connection.execute("INSERT INTO shops (user_id,name,contact_name,contact_phone,is_public,created_at,updated_at) VALUES (?,?,?,?,TRUE,UTC_TIMESTAMP(),UTC_TIMESTAMP())", [userResult.insertId, shopName.trim(), contactName.trim(), (contactPhone || "").trim() || null]);
    await connection.commit();
    transactionOpen = false;
    clearAuthAttempts(key);
    const result = await createSession(res, req, String(userResult.insertId));
    sendData(res, { user: { id: String(userResult.insertId), email, role: "shop" }, shop: { id: String(shopResult.insertId), name: shopName.trim() }, csrfToken: result.csrfToken }, 201);
  } catch (error) {
    if (transactionOpen) await rollbackTransaction(connection);
    if (error.code === "ER_DUP_ENTRY") return sendError(res, 409, "ACCOUNT_ALREADY_EXISTS", "ไม่สามารถสมัครด้วยอีเมลนี้ได้");
    next(error);
  } finally { connection?.release(); }
});
async function createSession(res, req, userId) {
  const raw = crypto.randomBytes(32).toString("base64url");
  const csrfToken = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  await pool.execute("INSERT INTO app_sessions (token_hash,user_id,csrf_token,expires_at,created_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY),UTC_TIMESTAMP())", [hash, userId, csrfToken]);
  res.cookie(SESSION_COOKIE, raw, sessionCookieOptions(req));
  return { csrfToken };
}
app.post("/api/v1/auth/login", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!validEmail(email) || !password || password.length > 128) return sendError(res, 422, "VALIDATION_ERROR", "กรุณากรอกอีเมลและรหัสผ่านให้ถูกต้อง");
  const key = `${req.ip}:${crypto.createHash("sha256").update(email).digest("hex")}`;
  if (!allowAuthAttempts(key)) return sendError(res, 429, "RATE_LIMITED", "ลองใหม่อีกครั้งในภายหลัง");
  try {
    const [rows] = await pool.execute("SELECT u.id,u.email,u.password_hash,u.role,sh.id AS shop_id,sh.name AS shop_name FROM users u LEFT JOIN shops sh ON sh.user_id=u.id WHERE u.email=? AND u.status='active' LIMIT 1", [email]);
    const valid = rows.length ? await bcrypt.compare(password, rows[0].password_hash) : await bcrypt.compare(password, "$2a$12$gnoZpOR5vsjy8udXrrb/TOdEBpNFX.YoxyAyO7.6oyh2wR3w8Sjcy");
    if (!rows.length || !valid || rows[0].role !== "shop") return sendError(res, 401, "INVALID_CREDENTIALS", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    if (bcrypt.getRounds(rows[0].password_hash) < 12) {
      const passwordHash = await bcrypt.hash(password, 12);
      await pool.execute("UPDATE users SET password_hash=?,updated_at=UTC_TIMESTAMP() WHERE id=?", [passwordHash, rows[0].id]);
    }
    clearAuthAttempts(key);
    const session = await createSession(res, req, String(rows[0].id));
    sendData(res, { user: { id: String(rows[0].id), email: rows[0].email, role: rows[0].role }, shop: { id: String(rows[0].shop_id), name: rows[0].shop_name }, csrfToken: session.csrfToken });
  } catch (error) { console.error("Login failed:", error.code || error.message); sendError(res, 503, "SERVICE_UNAVAILABLE", "ระบบเข้าสู่ระบบยังไม่พร้อม"); }
});
app.post("/api/v1/auth/logout", auth, async (req, res, next) => {
  try {
    await pool.execute("DELETE FROM app_sessions WHERE token_hash=?", [crypto.createHash("sha256").update(requestToken(req)).digest("hex")]);
    res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(req), maxAge: undefined });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get("/api/v1/markets", async (req, res, next) => {
  try {
    const paging = pageParams(req); if (!paging) return sendError(res, 400, "INVALID_PAGINATION", "เลขหน้าและจำนวนรายการไม่ถูกต้อง");
    const { page, limit } = paging; const offset = (page - 1) * limit;
    const [[count]] = await pool.execute("SELECT COUNT(*) AS total FROM markets WHERE status='active'");
    const [rows] = await pool.execute("SELECT id,name,description,address,map_image,map_width,map_height FROM markets WHERE status='active' ORDER BY name,id LIMIT ? OFFSET ?", [limit, offset]);
    res.json({ data: rows.map((r) => ({ id: String(r.id), name: r.name, description: r.description, address: r.address, mapImage: r.map_image ? `/images/${encodeURIComponent(r.map_image)}` : null, mapWidth: r.map_width, mapHeight: r.map_height })), meta: pagination(page, limit, count.total) });
  } catch (e) { next(e); }
});
app.get("/api/v1/markets/:marketId/sessions", async (req, res, next) => {
  if (!isId(req.params.marketId)) return sendError(res, 400, "INVALID_ID", "รหัสตลาดไม่ถูกต้อง");
  const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  for (const date of ["from", "to"]) if (req.query[date] != null && !validDate(req.query[date])) return sendError(res, 400, "INVALID_DATE", "ช่วงวันที่ไม่ถูกต้อง");
  if (req.query.from && req.query.to && req.query.from > req.query.to) return sendError(res, 400, "INVALID_DATE_RANGE", "วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด");
  try {
    const paging = pageParams(req); if (!paging) return sendError(res, 400, "INVALID_PAGINATION", "เลขหน้าและจำนวนรายการไม่ถูกต้อง");
    const { page, limit } = paging; const offset = (page - 1) * limit;
    const filter = "market_id=? AND status IN ('open','closed') AND (? IS NULL OR ends_at>=?) AND (? IS NULL OR starts_at<DATE_ADD(?, INTERVAL 1 DAY)) AND EXISTS (SELECT 1 FROM markets m WHERE m.id=market_sessions.market_id AND m.status='active')";
    const params = [req.params.marketId, req.query.from || null, req.query.from || null, req.query.to || null, req.query.to || null];
    const [[count]] = await pool.execute(`SELECT COUNT(*) AS total FROM market_sessions WHERE ${filter}`, params);
    const [rows] = await pool.execute(`SELECT id,name,starts_at,ends_at,status FROM market_sessions WHERE ${filter} ORDER BY starts_at,id LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ data: rows.map((r) => ({ id: String(r.id), name: r.name, startsAt: r.starts_at, endsAt: r.ends_at, status: r.status })), meta: pagination(page, limit, count.total) });
  } catch (e) { next(e); }
});
app.get("/api/v1/sessions/:sessionId/map", async (req, res, next) => {
  if (!isId(req.params.sessionId)) return sendError(res, 400, "INVALID_ID", "รหัสรอบตลาดไม่ถูกต้อง");
  if (req.query.categoryId != null && !isId(req.query.categoryId)) return sendError(res, 400, "INVALID_CATEGORY", "ประเภทสินค้าไม่ถูกต้อง");
  try {
    const [sessions] = await pool.execute("SELECT ms.id,ms.name,ms.starts_at,ms.ends_at,ms.status,m.id AS market_id,m.name AS market_name,m.description AS market_description,m.address AS market_address,m.map_image,m.map_width,m.map_height,m.status AS market_status FROM market_sessions ms JOIN markets m ON m.id=ms.market_id WHERE ms.id=? LIMIT 1", [req.params.sessionId]);
    if (!sessions.length || !["open", "closed"].includes(sessions[0].status) || sessions[0].market_status !== "active") return sendError(res, 404, "NOT_FOUND", "ไม่พบรอบตลาดนี้");
    const session = sessions[0]; let user = null;
    const token = requestToken(req);
    if (token) {
      const [authRows] = await pool.execute("SELECT u.id,sh.id AS shop_id FROM app_sessions s JOIN users u ON u.id=s.user_id LEFT JOIN shops sh ON sh.user_id=u.id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND u.status='active' LIMIT 1", [crypto.createHash("sha256").update(token).digest("hex")]);
      if (authRows.length) user = { id: String(authRows[0].id), shopId: authRows[0].shop_id == null ? null : String(authRows[0].shop_id) };
    }
    const categoryId = req.query.categoryId || null;
    const [stalls] = await pool.execute("SELECT st.id,st.stall_code,st.name,st.description,st.x_percent,st.y_percent,st.width_percent,st.height_percent,st.base_price,st.status,b.shop_id,sh.name AS shop_name,sh.is_public,CASE WHEN ? IS NULL OR EXISTS (SELECT 1 FROM shop_categories sc WHERE sc.shop_id=b.shop_id AND sc.category_id=?) THEN 1 ELSE 0 END AS category_match FROM stalls st LEFT JOIN bookings b ON b.stall_id=st.id AND b.session_id=? AND b.status IN ('pending','confirmed') LEFT JOIN shops sh ON sh.id=b.shop_id WHERE st.market_id=? ORDER BY st.stall_code", [categoryId, categoryId, req.params.sessionId, session.market_id]);
    const data = { session: { id: String(session.id), name: session.name, startsAt: session.starts_at, endsAt: session.ends_at, status: session.status }, market: { id: String(session.market_id), name: session.market_name, description: session.market_description, address: session.market_address, mapImage: session.map_image ? `/images/${encodeURIComponent(session.map_image)}` : null, mapWidth: session.map_width, mapHeight: session.map_height }, stalls: stalls.map((st) => ({ id: String(st.id), code: st.stall_code, name: st.name, description: user?.shopId ? st.description : undefined, x: st.x_percent == null ? null : Number(st.x_percent), y: st.y_percent == null ? null : Number(st.y_percent), width: st.width_percent == null ? null : Number(st.width_percent), height: st.height_percent == null ? null : Number(st.height_percent), price: user?.shopId ? Number(st.base_price || 0) : undefined, availability: st.status !== "active" ? "inactive" : st.shop_id ? "booked" : "available", ownBooking: Boolean(user?.shopId && String(st.shop_id) === user.shopId), shop: st.shop_id && st.is_public && st.category_match ? { id: String(st.shop_id), name: st.shop_name } : null })) };
    sendData(res, data);
  } catch (e) { next(e); }
});
app.get("/api/v1/categories", async (_req, res, next) => {
  try { const [rows] = await pool.execute("SELECT id,name FROM categories ORDER BY name,id"); sendData(res, rows.map((r) => ({ id: String(r.id), name: r.name }))); } catch (e) { next(e); }
});
app.get("/api/v1/shop/dashboard", auth, shopOnly, async (req, res, next) => {
  try {
    const [shops] = await pool.execute("SELECT id,name FROM shops WHERE id=? LIMIT 1", [req.session.shopId]);
    const [current] = await pool.execute("SELECT b.id,b.status,st.stall_code,ms.name AS session_name,ms.starts_at FROM bookings b JOIN stalls st ON st.id=b.stall_id JOIN market_sessions ms ON ms.id=b.session_id WHERE b.shop_id=? AND b.status='confirmed' AND ms.ends_at>=UTC_TIMESTAMP() ORDER BY ms.starts_at,b.id LIMIT 1", [req.session.shopId]);
    const [bookings] = await pool.execute("SELECT b.id,b.status,b.price_at_booking,b.created_at,st.stall_code,ms.name AS session_name,ms.starts_at FROM bookings b JOIN stalls st ON st.id=b.stall_id JOIN market_sessions ms ON ms.id=b.session_id WHERE b.shop_id=? ORDER BY b.created_at DESC,b.id DESC LIMIT 5", [req.session.shopId]);
    const [[summary]] = await pool.execute("SELECT COUNT(*) AS confirmed_count FROM bookings WHERE shop_id=? AND status='confirmed'", [req.session.shopId]);
    const currentBooking = current.length ? { id: String(current[0].id), stallCode: current[0].stall_code, sessionName: current[0].session_name, startsAt: current[0].starts_at, status: current[0].status } : null;
    sendData(res, { shop: { id: String(shops[0].id), name: shops[0].name }, currentBooking, confirmedCount: summary.confirmed_count, recentBookings: bookings.map(bookingRow) });
  } catch (e) { next(e); }
});
function bookingRow(row) {
  const booking = { id: String(row.id), status: row.status, priceAtBooking: Number(row.price_at_booking), stallCode: row.stall_code, sessionName: row.session_name, startsAt: row.starts_at };
  if (row.created_at != null) booking.createdAt = row.created_at;
  return booking;
}
app.get("/api/v1/bookings", auth, shopOnly, async (req, res, next) => {
  try {
    const paging = pageParams(req); if (!paging) return sendError(res, 400, "INVALID_PAGINATION", "เลขหน้าและจำนวนรายการไม่ถูกต้อง");
    if (req.query.sort != null && req.query.sort !== "createdAt") return sendError(res, 400, "INVALID_SORT", "รูปแบบการเรียงลำดับไม่ถูกต้อง");
    const { page, limit } = paging; const offset = (page - 1) * limit;
    const allowed = ["confirmed", "pending", "rejected", "cancelled"];
    if (req.query.status && !allowed.includes(req.query.status)) return sendError(res, 400, "INVALID_STATUS", "สถานะไม่ถูกต้อง");
    const where = ["b.shop_id=?"]; const params = [req.session.shopId];
    if (req.query.status) { where.push("b.status=?"); params.push(req.query.status); }
    if (req.query.sessionId) { if (!isId(req.query.sessionId)) return sendError(res, 400, "INVALID_ID", "รหัสรอบตลาดไม่ถูกต้อง"); where.push("b.session_id=?"); params.push(req.query.sessionId); }
    const clause = where.join(" AND ");
    const [[count]] = await pool.execute(`SELECT COUNT(*) AS total FROM bookings b WHERE ${clause}`, params);
    const [rows] = await pool.execute(`SELECT b.id,b.status,b.price_at_booking,b.created_at,st.stall_code,ms.name AS session_name,ms.starts_at FROM bookings b JOIN stalls st ON st.id=b.stall_id JOIN market_sessions ms ON ms.id=b.session_id WHERE ${clause} ORDER BY b.created_at DESC,b.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ data: rows.map(bookingRow), meta: pagination(page, limit, count.total) });
  } catch (e) { next(e); }
});
app.get("/api/v1/stalls/:stallId", auth, shopOnly, async (req, res, next) => {
  if (!isId(req.params.stallId) || !isId(String(req.query.sessionId || ""))) return sendError(res, 400, "INVALID_ID", "กรุณาระบุรหัสแผงและรอบตลาดให้ถูกต้อง");
  try {
    const [rows] = await pool.execute("SELECT st.id,st.market_id,st.stall_code,st.name,st.description,st.base_price,st.status,ms.market_id AS session_market,EXISTS(SELECT 1 FROM bookings b WHERE b.session_id=ms.id AND b.stall_id=st.id AND b.status IN ('pending','confirmed')) AS occupied FROM stalls st JOIN market_sessions ms ON ms.id=? WHERE st.id=? LIMIT 1", [req.query.sessionId, req.params.stallId]);
    if (!rows.length) return sendError(res, 404, "NOT_FOUND", "ไม่พบแผงในรอบตลาดนี้");
    const row = rows[0];
    if (String(row.market_id) !== String(row.session_market)) return sendError(res, 404, "NOT_FOUND", "ไม่พบแผงในรอบตลาดนี้");
    sendData(res, { id: String(row.id), code: row.stall_code, name: row.name, description: row.description, price: Number(row.base_price || 0), availability: row.status !== "active" ? "inactive" : row.occupied ? "booked" : "available" });
  } catch (e) { next(e); }
});
app.get("/api/v1/bookings/:bookingId", auth, shopOnly, async (req, res, next) => {
  if (!isId(req.params.bookingId)) return sendError(res, 400, "INVALID_ID", "รหัสการจองไม่ถูกต้อง");
  try {
    const [rows] = await pool.execute("SELECT b.id,b.status,b.price_at_booking,b.shop_note,b.created_at,b.cancelled_at,st.stall_code,ms.id AS session_id,ms.name AS session_name,ms.starts_at,ms.ends_at FROM bookings b JOIN stalls st ON st.id=b.stall_id JOIN market_sessions ms ON ms.id=b.session_id WHERE b.id=? AND b.shop_id=? LIMIT 1", [req.params.bookingId, req.session.shopId]);
    if (!rows.length) return sendError(res, 404, "NOT_FOUND", "ไม่พบรายการจอง");
    sendData(res, { ...bookingRow(rows[0]), sessionId: String(rows[0].session_id), startsAt: rows[0].starts_at, endsAt: rows[0].ends_at, shopNote: rows[0].shop_note, createdAt: rows[0].created_at, cancelledAt: rows[0].cancelled_at });
  } catch (e) { next(e); }
});
app.post("/api/v1/bookings", auth, shopOnly, async (req, res, next) => {
  if (Object.keys(req.body).some((key) => !["sessionId", "stallId", "shopNote"].includes(key))) return sendError(res, 422, "VALIDATION_ERROR", "มีฟิลด์การจองที่ไม่รองรับ");
  const { sessionId, stallId, shopNote = null } = req.body;
  if (!isId(String(sessionId || "")) || !isId(String(stallId || "")) || (shopNote != null && (typeof shopNote !== "string" || shopNote.length > 500))) return sendError(res, 422, "VALIDATION_ERROR", "ข้อมูลการจองไม่ถูกต้อง");
  let connection;
  let transactionOpen = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionOpen = true;
    const [sessions] = await connection.execute("SELECT ms.id,ms.market_id,ms.status,ms.booking_opens_at,ms.booking_closes_at,m.status AS market_status FROM market_sessions ms JOIN markets m ON m.id=ms.market_id WHERE ms.id=? FOR UPDATE", [sessionId]);
    if (!sessions.length) { await rollbackTransaction(connection); transactionOpen = false; return sendError(res, 404, "NOT_FOUND", "ไม่พบรอบตลาด"); }
    const session = sessions[0];
    const nowRows = await connection.query("SELECT UTC_TIMESTAMP() AS now"); const now = nowRows[0][0].now;
    if (session.status !== "open" || session.market_status !== "active" || (session.booking_opens_at && now < session.booking_opens_at) || (session.booking_closes_at && now > session.booking_closes_at)) { await rollbackTransaction(connection); transactionOpen = false; return sendError(res, 409, "BOOKING_CLOSED", "รอบนี้ยังไม่เปิดหรือปิดรับจองแล้ว"); }
    const [stalls] = await connection.execute("SELECT id,market_id,base_price,status FROM stalls WHERE id=? FOR UPDATE", [stallId]);
    if (!stalls.length || String(stalls[0].market_id) !== String(session.market_id) || stalls[0].status !== "active") { await rollbackTransaction(connection); transactionOpen = false; return sendError(res, 409, "STALL_UNAVAILABLE", "แผงนี้ไม่พร้อมให้จอง"); }
    const [existing] = await connection.execute("SELECT id FROM bookings WHERE session_id=? AND stall_id=? AND status IN ('pending','confirmed') LIMIT 1", [sessionId, stallId]);
    if (existing.length) { await rollbackTransaction(connection); transactionOpen = false; return sendError(res, 409, "STALL_UNAVAILABLE", "แผงนี้ถูกจองแล้ว"); }
    const [result] = await connection.execute("INSERT INTO bookings (shop_id,session_id,stall_id,status,price_at_booking,shop_note,created_at,updated_at) VALUES (?,?,?,'confirmed',?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())", [req.session.shopId, sessionId, stallId, stalls[0].base_price || 0, shopNote]);
    await connection.commit();
    sendData(res, { id: String(result.insertId), sessionId: String(sessionId), stallId: String(stallId), status: "confirmed", priceAtBooking: Number(stalls[0].base_price || 0) }, 201);
  } catch (e) { if (connection && transactionOpen) await rollbackTransaction(connection); next(e); } finally { connection?.release(); }
});
app.post("/api/v1/bookings/:bookingId/cancel", auth, shopOnly, async (req, res, next) => {
  if (!isId(req.params.bookingId)) return sendError(res, 400, "INVALID_ID", "รหัสการจองไม่ถูกต้อง");
  try {
    const [result] = await pool.execute("UPDATE bookings SET status='cancelled',cancelled_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=? AND shop_id=? AND status<>'cancelled'", [req.params.bookingId, req.session.shopId]);
    if (!result.affectedRows) {
      const [rows] = await pool.execute("SELECT status FROM bookings WHERE id=? AND shop_id=? LIMIT 1", [req.params.bookingId, req.session.shopId]);
      if (!rows.length) return sendError(res, 404, "NOT_FOUND", "ไม่พบรายการจอง");
      if (rows[0].status === "cancelled") return sendError(res, 409, "BOOKING_ALREADY_CANCELLED", "รายการจองนี้ถูกยกเลิกแล้ว");
      return sendError(res, 409, "BOOKING_NOT_EDITABLE", "ไม่สามารถยกเลิกรายการจองนี้ได้");
    }
    sendData(res, { id: req.params.bookingId, status: "cancelled" });
  } catch (e) { next(e); }
});
app.patch("/api/v1/bookings/:bookingId", auth, shopOnly, async (req, res, next) => {
  if (!isId(req.params.bookingId)) return sendError(res, 400, "INVALID_ID", "รหัสการจองไม่ถูกต้อง");
  if (Object.keys(req.body).some((key) => !["stallId", "shopNote"].includes(key))) return sendError(res, 422, "VALIDATION_ERROR", "มีฟิลด์การแก้ไขที่ไม่รองรับ");
  const { stallId, shopNote } = req.body;
  if ((stallId != null && !isId(String(stallId))) || (shopNote !== undefined && shopNote !== null && (typeof shopNote !== "string" || shopNote.length > 500))) return sendError(res, 422, "VALIDATION_ERROR", "ข้อมูลการแก้ไขไม่ถูกต้อง");
  let connection;
  let transactionOpen = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionOpen = true;
    const [rows] = await connection.execute("SELECT id,session_id,stall_id,status FROM bookings WHERE id=? AND shop_id=? FOR UPDATE", [req.params.bookingId, req.session.shopId]);
    if (!rows.length) { await rollbackTransaction(connection); transactionOpen = false; return sendError(res, 404, "NOT_FOUND", "ไม่พบรายการจอง"); }
    const booking = rows[0];
    if (!["confirmed", "pending"].includes(booking.status)) { await rollbackTransaction(connection); transactionOpen = false; return sendError(res, 409, "BOOKING_NOT_EDITABLE", "ไม่สามารถแก้ไขรายการจองนี้ได้"); }
    let price;
    if (stallId != null && String(stallId) !== String(booking.stall_id)) {
      const [stalls] = await connection.execute("SELECT st.id,st.market_id,st.base_price,st.status,ms.market_id AS session_market FROM stalls st JOIN market_sessions ms ON ms.id=? WHERE st.id=? FOR UPDATE", [booking.session_id, stallId]);
      if (!stalls.length || stalls[0].status !== "active" || String(stalls[0].market_id) !== String(stalls[0].session_market)) { await rollbackTransaction(connection); transactionOpen = false; return sendError(res, 409, "STALL_UNAVAILABLE", "แผงใหม่ไม่พร้อมให้จอง"); }
      const [active] = await connection.execute("SELECT id FROM bookings WHERE session_id=? AND stall_id=? AND status IN ('pending','confirmed') LIMIT 1 FOR UPDATE", [booking.session_id, stallId]);
      if (active.length) { await rollbackTransaction(connection); transactionOpen = false; return sendError(res, 409, "STALL_UNAVAILABLE", "แผงใหม่ถูกจองแล้ว"); }
      price = stalls[0].base_price || 0;
    }
    const updates = []; const values = [];
    if (stallId != null && String(stallId) !== String(booking.stall_id)) { updates.push("stall_id=?", "price_at_booking=?"); values.push(stallId, price); }
    if (shopNote !== undefined) { updates.push("shop_note=?"); values.push(shopNote); }
    if (updates.length) await connection.execute(`UPDATE bookings SET ${updates.join(",")},updated_at=UTC_TIMESTAMP() WHERE id=? AND shop_id=?`, [...values, req.params.bookingId, req.session.shopId]);
    await connection.commit(); transactionOpen = false;
    sendData(res, { id: req.params.bookingId, status: booking.status });
  } catch (e) { if (connection && transactionOpen) await rollbackTransaction(connection); next(e); } finally { connection?.release(); }
});
app.get("/api/v1/public/sessions/:sessionId/shops", async (req, res, next) => {
  if (!isId(req.params.sessionId)) return sendError(res, 400, "INVALID_ID", "รหัสรอบตลาดไม่ถูกต้อง");
  const paging = pageParams(req); if (!paging) return sendError(res, 400, "INVALID_PAGINATION", "เลขหน้าและจำนวนรายการไม่ถูกต้อง");
  const { page, limit } = paging; const offset = (page - 1) * limit;
  if (req.query.q != null && typeof req.query.q !== "string") return sendError(res, 400, "INVALID_QUERY", "คำค้นหาไม่ถูกต้อง");
  if (req.query.sort != null && !["name", "stallCode"].includes(req.query.sort)) return sendError(res, 400, "INVALID_SORT", "รูปแบบการเรียงลำดับไม่ถูกต้อง");
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (req.query.categoryId && !isId(req.query.categoryId)) return sendError(res, 400, "INVALID_CATEGORY", "ประเภทสินค้าไม่ถูกต้อง");
  try {
    const [sessions] = await pool.execute("SELECT ms.id FROM market_sessions ms JOIN markets m ON m.id=ms.market_id WHERE ms.id=? AND ms.status IN ('open','closed') AND m.status='active' LIMIT 1", [req.params.sessionId]);
    if (!sessions.length) return sendError(res, 404, "NOT_FOUND", "ไม่พบรอบตลาดนี้");
    const where = ["b.session_id=?", "b.status='confirmed'", "sh.is_public=TRUE", "sh.name LIKE ? ESCAPE '='"];
    const queryText = `%${q.replace(/[=%_]/g, (char) => `=${char}`)}%`;
    const params = [req.params.sessionId, queryText];
    if (req.query.categoryId) { where.push("EXISTS (SELECT 1 FROM shop_categories sc WHERE sc.shop_id=sh.id AND sc.category_id=?)"); params.push(req.query.categoryId); }
    const clause = where.join(" AND ");
    const [[count]] = await pool.execute(`SELECT COUNT(DISTINCT CONCAT(sh.id,':',b.stall_id)) AS total FROM bookings b JOIN shops sh ON sh.id=b.shop_id WHERE ${clause}`, params);
    const sort = req.query.sort === "stallCode" ? "stallCode" : "name";
    const order = sort === "stallCode" ? "st.stall_code,sh.id" : "sh.name,st.stall_code,sh.id";
    const [rows] = await pool.execute(`SELECT sh.id AS shop_id,sh.name AS shop_name,sh.description,sh.logo_image,sh.contact_phone,st.stall_code,st.x_percent,st.y_percent,GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ',') AS categories FROM bookings b JOIN shops sh ON sh.id=b.shop_id JOIN stalls st ON st.id=b.stall_id LEFT JOIN shop_categories sc ON sc.shop_id=sh.id LEFT JOIN categories c ON c.id=sc.category_id WHERE ${clause} GROUP BY sh.id,sh.name,sh.description,sh.logo_image,sh.contact_phone,st.stall_code,st.x_percent,st.y_percent ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ data: rows.map((row) => ({ ...toPublicShop({ ...row, categories: row.categories ? row.categories.split(",") : [] }) })), meta: pagination(page, limit, count.total) });
  } catch (e) { next(e); }
});
app.get("/api/v1/public/sessions/:sessionId/shops/:shopId", async (req, res, next) => {
  if (!isId(req.params.sessionId) || !isId(req.params.shopId)) return sendError(res, 400, "INVALID_ID", "รหัสไม่ถูกต้อง");
  try {
    const [sessions] = await pool.execute("SELECT ms.id FROM market_sessions ms JOIN markets m ON m.id=ms.market_id WHERE ms.id=? AND ms.status IN ('open','closed') AND m.status='active' LIMIT 1", [req.params.sessionId]);
    if (!sessions.length) return sendError(res, 404, "NOT_FOUND", "ไม่พบรอบตลาดนี้");
    const [rows] = await pool.execute("SELECT sh.id AS shop_id,sh.name AS shop_name,sh.description,sh.logo_image,sh.contact_phone,st.stall_code,st.x_percent,st.y_percent,GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ',') AS categories FROM bookings b JOIN shops sh ON sh.id=b.shop_id JOIN stalls st ON st.id=b.stall_id LEFT JOIN shop_categories sc ON sc.shop_id=sh.id LEFT JOIN categories c ON c.id=sc.category_id WHERE b.session_id=? AND sh.id=? AND b.status='confirmed' AND sh.is_public=TRUE GROUP BY sh.id,sh.name,sh.description,sh.logo_image,sh.contact_phone,st.stall_code,st.x_percent,st.y_percent LIMIT 1", [req.params.sessionId, req.params.shopId]);
    if (!rows.length) return sendError(res, 404, "NOT_FOUND", "ไม่พบร้านนี้ในรอบตลาด");
    sendData(res, toPublicShop({ ...rows[0], categories: rows[0].categories ? rows[0].categories.split(",") : [] }));
  } catch (e) { next(e); }
});
app.get("/api/v1/public/qr/:token", async (req, res, next) => {
  if (!/^[A-Za-z0-9_-]{22,128}$/.test(req.params.token)) return sendError(res, 404, "NOT_FOUND", "ไม่พบ QR Code นี้");
  try {
    const hash = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const [rows] = await pool.execute("SELECT q.session_id FROM qr_codes q JOIN market_sessions ms ON ms.id=q.session_id JOIN markets m ON m.id=ms.market_id WHERE q.token_hash=? AND q.status='active' AND (q.expires_at IS NULL OR q.expires_at>UTC_TIMESTAMP()) AND ms.status IN ('open','closed') AND m.status='active' LIMIT 1", [hash]);
    if (!rows.length) return sendError(res, 404, "NOT_FOUND", "ไม่พบ QR Code นี้");
    res.redirect(302, `/#market-map?session=${encodeURIComponent(rows[0].session_id)}`);
  } catch (e) { next(e); }
});
app.post("/api/v1/shop/sessions/:sessionId/qr", auth, shopOnly, async (req, res, next) => {
  if (!isId(req.params.sessionId)) return sendError(res, 400, "INVALID_ID", "รหัสรอบตลาดไม่ถูกต้อง");
  const key = `qr:${req.session.shopId}:${req.params.sessionId}`;
  if (!allowAuthAttempts(key)) return sendError(res, 429, "RATE_LIMITED", "สร้าง QR Code บ่อยเกินไป กรุณาลองใหม่ภายหลัง");
  try {
    const [sessions] = await pool.execute(
      "SELECT ms.id FROM market_sessions ms JOIN markets m ON m.id=ms.market_id WHERE ms.id=? AND ms.status IN ('open','closed') AND m.status='active' LIMIT 1",
      [req.params.sessionId],
    );
    if (!sessions.length) return sendError(res, 404, "NOT_FOUND", "ไม่พบรอบตลาดที่เปิดให้แชร์");
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const url = `${req.protocol}://${req.get("host")}/api/v1/public/qr/${token}`;
    const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 320 });
    await pool.execute("INSERT INTO qr_codes (session_id,token_hash,status,created_at) VALUES (?,?,'active',UTC_TIMESTAMP())", [req.params.sessionId, tokenHash]);
    sendData(res, { url, qrDataUrl });
  } catch (e) { next(e); }
});
app.get("/api/v1/shop/profile", auth, shopOnly, async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT sh.id,sh.name,sh.description,sh.contact_name,sh.contact_phone,sh.logo_image,sh.is_public FROM shops sh WHERE sh.id=?", [req.session.shopId]);
    const [categories] = await pool.execute("SELECT c.id,c.name FROM shop_categories sc JOIN categories c ON c.id=sc.category_id WHERE sc.shop_id=? ORDER BY c.name", [req.session.shopId]);
    if (!rows.length) return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลร้าน");
    const shop = rows[0]; sendData(res, { id: String(shop.id), name: shop.name, description: shop.description, contactName: shop.contact_name, contactPhone: shop.contact_phone, logoImage: shop.logo_image ? `/images/${encodeURIComponent(shop.logo_image)}` : null, isPublic: Boolean(shop.is_public), categories: categories.map((c) => ({ id: String(c.id), name: c.name })) });
  } catch (e) { next(e); }
});
app.patch("/api/v1/shop/profile", auth, shopOnly, async (req, res, next) => {
  const allowed = ["name", "description", "contactName", "contactPhone", "isPublic", "categoryIds"];
  if (Object.keys(req.body).some((key) => !allowed.includes(key))) return sendError(res, 422, "VALIDATION_ERROR", "มีฟิลด์ที่ไม่รองรับ");
  const fields = {}; const mapping = { name: "name", description: "description", contactName: "contact_name", contactPhone: "contact_phone", isPublic: "is_public" };
  for (const [key, column] of Object.entries(mapping)) if (Object.hasOwn(req.body, key)) fields[column] = req.body[key];
  if (Object.hasOwn(req.body, "name") && !text(fields.name, 1, 120)) return sendError(res, 422, "VALIDATION_ERROR", "ชื่อร้านไม่ถูกต้อง");
  if (Object.hasOwn(req.body, "description") && fields.description != null && (typeof fields.description !== "string" || fields.description.length > 5000)) return sendError(res, 422, "VALIDATION_ERROR", "คำอธิบายยาวเกินกำหนด");
  if (Object.hasOwn(req.body, "contactName") && fields.contact_name != null && !text(fields.contact_name, 1, 120)) return sendError(res, 422, "VALIDATION_ERROR", "ชื่อผู้ติดต่อไม่ถูกต้อง");
  if (Object.hasOwn(req.body, "contactPhone") && fields.contact_phone != null && (typeof fields.contact_phone !== "string" || fields.contact_phone.length > 20)) return sendError(res, 422, "VALIDATION_ERROR", "เบอร์ติดต่อไม่ถูกต้อง");
  if (Object.hasOwn(req.body, "isPublic") && typeof fields.is_public !== "boolean") return sendError(res, 422, "VALIDATION_ERROR", "สถานะการแสดงผลไม่ถูกต้อง");
  if (Object.hasOwn(req.body, "categoryIds") && (!Array.isArray(req.body.categoryIds) || req.body.categoryIds.some((id) => typeof id !== "string" && typeof id !== "number" || !isId(String(id))))) return sendError(res, 422, "VALIDATION_ERROR", "ประเภทสินค้าไม่ถูกต้อง");
  let connection;
  let transactionOpen = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionOpen = true;
    if (Object.keys(fields).length) {
      const columns = Object.keys(fields); const assignments = columns.map((column) => `${String.fromCharCode(96)}${column}${String.fromCharCode(96)}=?`).join(",");
      await connection.execute(`UPDATE shops SET ${assignments},updated_at=UTC_TIMESTAMP() WHERE id=?`, [...Object.values(fields), req.session.shopId]);
    }
    if (req.body.categoryIds != null) {
      const ids = [...new Set(req.body.categoryIds.map(String))];
      if (ids.length) {
        const [known] = await connection.query(`SELECT id FROM categories WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
        if (known.length !== ids.length) { await rollbackTransaction(connection); transactionOpen = false; return sendError(res, 422, "VALIDATION_ERROR", "เลือกประเภทสินค้าที่มีอยู่ในระบบเท่านั้น"); }
      }
      await connection.execute("DELETE FROM shop_categories WHERE shop_id=?", [req.session.shopId]);
      for (const id of ids) await connection.execute("INSERT INTO shop_categories (shop_id,category_id) VALUES (?,?)", [req.session.shopId, id]);
    }
    await connection.commit(); transactionOpen = false; sendData(res, { updated: true });
  } catch (e) { if (transactionOpen) await rollbackTransaction(connection); next(e); } finally { connection?.release(); }
});
function limitLogoUploads(req, res, next) {
  if (!allowAuthAttempts(`logo:${req.session.shopId}`)) return sendError(res, 429, "RATE_LIMITED", "อัปโหลดโลโก้บ่อยเกินไป กรุณาลองใหม่ภายหลัง");
  next();
}
app.post("/api/v1/shop/logo", auth, shopOnly, limitLogoUploads, logoUpload.single("image"), async (req, res, next) => {
  if (!req.file) return sendError(res, 422, "VALIDATION_ERROR", "เลือกไฟล์โลโก้ก่อนบันทึก");
  const signatures = [
    { extension: "png", mime: "image/png", matches: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    { extension: "jpg", mime: "image/jpeg", matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
    { extension: "gif", mime: "image/gif", matches: (buffer) => buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6)) },
    { extension: "webp", mime: "image/webp", matches: (buffer) => buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" },
  ];
  const imageType = signatures.find((type) => type.mime === req.file.mimetype && type.matches(req.file.buffer));
  if (!imageType) return sendError(res, 415, "UNSUPPORTED_MEDIA_TYPE", "รองรับเฉพาะไฟล์ PNG, JPEG, GIF หรือ WebP ที่ถูกต้อง");
  const filename = `${crypto.randomBytes(18).toString("hex")}.${imageType.extension}`;
  const imagePath = path.join(imageDirectory, filename);
  let saved = false;
  try {
    const [shops] = await pool.execute("SELECT logo_image FROM shops WHERE id=? LIMIT 1", [req.session.shopId]);
    if (!shops.length) return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลร้าน");
    await fs.writeFile(imagePath, req.file.buffer, { flag: "wx" });
    saved = true;
    await pool.execute("UPDATE shops SET logo_image=?,updated_at=UTC_TIMESTAMP() WHERE id=?", [filename, req.session.shopId]);
    const previous = shops[0].logo_image;
    if (previous && /^[a-f0-9]{36}\.(png|jpg|gif|webp)$/.test(previous)) {
      try { await fs.unlink(path.join(imageDirectory, previous)); }
      catch (error) { if (error.code !== "ENOENT") console.error("Previous shop logo cleanup failed:", error.code || error.message); }
    }
    sendData(res, { logoImage: `/images/${filename}` });
  } catch (error) {
    if (saved) {
      try { await fs.unlink(imagePath); }
      catch (cleanupError) { if (cleanupError.code !== "ENOENT") console.error("New shop logo cleanup failed:", cleanupError.code || cleanupError.message); }
    }
    next(error);
  }
});

app.use("/api", (_req, res) => sendError(res, 404, "NOT_FOUND", "ไม่พบ API endpoint นี้"));
app.use((error, _req, res, _next) => {
  if (error.type === "entity.too.large") return sendError(res, 413, "PAYLOAD_TOO_LARGE", "ข้อมูลคำขอมีขนาดใหญ่เกินกำหนด");
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return sendError(res, status, error.code, error.code === "LIMIT_FILE_SIZE" ? "ไฟล์มีขนาดเกิน 5 MB" : "ข้อมูลไฟล์ไม่ถูกต้อง");
  }
  console.error("API request failed:", error.code || error.message);
  sendError(res, 500, "INTERNAL_ERROR", "ระบบขัดข้อง กรุณาลองใหม่ภายหลัง");
});

const port = Number(process.env.PORT) || 3109;
app.listen(port, () => console.log(`Server listening on port ${port}`));
