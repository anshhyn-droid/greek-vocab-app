// 자동 생성: npm run build:api (원본은 server/). 직접 고치지 마세요.

// server/http.ts
var HttpError = class extends Error {
  status;
  constructor(status, code) {
    super(code);
    this.status = status;
  }
};
var bad = (code) => new HttpError(400, code);
function json(data, status = 200, headers) {
  const h = new Headers(headers);
  h.set("content-type", "application/json; charset=utf-8");
  h.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: h });
}
function redirect(to, cookies = []) {
  const h = new Headers({ location: to, "cache-control": "no-store" });
  cookies.forEach((c) => h.append("set-cookie", c));
  return new Response(null, { status: 302, headers: h });
}
function readCookies(req) {
  const out2 = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out2[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out2;
}
var secure = () => process.env.NODE_ENV === "production" || !!process.env.VERCEL;
function cookie(name, value, maxAgeSec, httpOnly = true) {
  return [`${name}=${encodeURIComponent(value)}`, "Path=/", `Max-Age=${maxAgeSec}`, "SameSite=Lax", httpOnly && "HttpOnly", secure() && "Secure"].filter(Boolean).join("; ");
}
var clearCookie = (name) => cookie(name, "", 0);
var appOrigin = (req) => process.env.APP_URL || new URL(req.url).origin;
async function body(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// server/routes/auth.ts
import crypto3 from "node:crypto";

// server/db.ts
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
var plain = (rs) => rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
function wrap(exec) {
  return {
    get: async (sql, ...args) => plain(await exec(sql, args))[0],
    all: async (sql, ...args) => plain(await exec(sql, args)),
    run: (sql, ...args) => exec(sql, args)
  };
}
var client = null;
var ready = null;
function open() {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  return createClient({ url: "file:" + path.join(process.cwd(), "data", "local.sqlite") });
}
async function getDb() {
  client ??= open();
  const c = client;
  ready ??= c.executeMultiple(fs.readFileSync(path.join(process.cwd(), "db", "schema.turso.sql"), "utf8")).catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return {
    ...wrap((sql, args) => c.execute({ sql, args })),
    // 한 번에: 중간에 실패하면 모두 되돌림
    async tx(fn) {
      const t = await c.transaction("write");
      try {
        const out2 = await fn(wrap((sql, args) => t.execute({ sql, args })));
        await t.commit();
        return out2;
      } finally {
        t.close();
      }
    }
  };
}

// server/google.ts
import crypto from "node:crypto";
var PENDING_COOKIE = "gk_signup";
var PENDING_SEC = 600;
var ISSUERS = ["accounts.google.com", "https://accounts.google.com"];
var b64url = (buf) => Buffer.from(buf).toString("base64url");
function newPkce() {
  const verifier = b64url(crypto.randomBytes(32));
  return { verifier, challenge: b64url(crypto.createHash("sha256").update(verifier).digest()) };
}
var jwks = { keys: [], until: 0 };
async function googleKeys(force = false) {
  if (!force && Date.now() < jwks.until) return jwks.keys;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!res.ok) throw new Error("jwks " + res.status);
  const age = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") || "")?.[1]) || 3600;
  jwks = { keys: (await res.json()).keys, until: Date.now() + age * 1e3 };
  return jwks.keys;
}
async function verifyIdToken(idToken) {
  const [h, p, sig] = String(idToken || "").split(".");
  if (!h || !p || !sig) throw new Error("id_token shape");
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  if (header.alg !== "RS256") throw new Error("id_token alg");
  let jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await googleKeys(true)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("id_token kid");
  const ok = crypto.verify("RSA-SHA256", Buffer.from(h + "." + p), crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(sig, "base64url"));
  if (!ok) throw new Error("id_token signature");
  const c = JSON.parse(Buffer.from(p, "base64url").toString());
  if (c.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error("id_token aud");
  if (!ISSUERS.includes(c.iss)) throw new Error("id_token iss");
  if (!(c.exp > Date.now() / 1e3)) throw new Error("id_token exp");
  if (!c.sub || !c.email || c.email_verified === false) throw new Error("id_token claims");
  return c;
}
var key = () => crypto.createHash("sha256").update("gk-signup:" + (process.env.SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || "")).digest();
function sealPending({ sub, email, name }) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify({ sub, email, name, exp: Date.now() + PENDING_SEC * 1e3 })), c.final()]);
  return b64url(Buffer.concat([iv, c.getAuthTag(), data]));
}
function openPending(value) {
  try {
    const raw = Buffer.from(String(value || ""), "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const v = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString());
    return v.exp > Date.now() ? v : null;
  } catch {
    return null;
  }
}

// server/session.ts
import crypto2 from "node:crypto";
var SESSION_COOKIE = "gk_session";
var CSRF_COOKIE = "gk_csrf";
var IDLE_MS = 24 * 3600 * 1e3;
var ABSOLUTE_MS = 30 * 24 * 3600 * 1e3;
var TOUCH_MS = 60 * 1e3;
var REAUTH_MS = 60 * 60 * 1e3;
var CONSENT_VERSION = "2026-10-18";
var CONSENT_TYPES = ["age", "terms", "privacy"];
var hash = (t) => crypto2.createHash("sha256").update(t).digest("hex");
var csrfFor = (t) => crypto2.createHash("sha256").update("csrf:" + t).digest("base64url");
var iso = (ms) => new Date(ms).toISOString();
async function createSession(userId, db) {
  db ??= await getDb();
  const token = crypto2.randomBytes(32).toString("base64url");
  const now = Date.now();
  await db.run(
    "INSERT INTO auth_sessions (id, user_id, created_at, last_seen_at, idle_expires_at, absolute_expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    hash(token),
    userId,
    iso(now),
    iso(now),
    iso(now + IDLE_MS),
    iso(now + ABSOLUTE_MS)
  );
  const age = ABSOLUTE_MS / 1e3;
  return [cookie(SESSION_COOKIE, token, age), cookie(CSRF_COOKIE, csrfFor(token), age, false)];
}
async function endSession(req, reason) {
  const t = readCookies(req)[SESSION_COOKIE];
  if (t) await (await getDb()).run("UPDATE auth_sessions SET ended_at = ?, end_reason = ? WHERE id = ? AND ended_at IS NULL", iso(Date.now()), reason, hash(t));
}
var clearSession = () => [clearCookie(SESSION_COOKIE), clearCookie(CSRF_COOKIE)];
async function hasConsent(userId, db) {
  const r = await db.get(
    `SELECT COUNT(*) n FROM user_consents WHERE user_id = ? AND version = ? AND agreed = 1 AND type IN (${CONSENT_TYPES.map(() => "?").join(",")})`,
    userId,
    CONSENT_VERSION,
    ...CONSENT_TYPES
  );
  return r?.n === CONSENT_TYPES.length;
}
async function getSession(req) {
  const token = readCookies(req)[SESSION_COOKIE];
  if (!token) return { user: null, reason: null };
  const db = await getDb();
  const row = await db.get(
    `SELECT u.id, u.email, u.display_name, s.created_at s_created, s.idle_expires_at s_idle, s.absolute_expires_at s_abs, s.last_seen_at s_seen, s.ended_at s_ended
     FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    hash(token)
  );
  if (!row || row.s_ended) return { user: null, reason: null };
  const now = Date.now();
  const idleAt = Date.parse(row.s_idle);
  if (Date.parse(row.s_abs) <= now || idleAt <= now) {
    const reason = idleAt <= now ? "idle" : "expired";
    await db.run("UPDATE auth_sessions SET ended_at = ?, end_reason = ? WHERE id = ?", iso(now), reason === "idle" ? "idle" : "absolute", hash(token));
    if (reason === "idle") await logAccess(req, "idle_logout", row.id, db);
    return { user: null, reason };
  }
  let idleExpiresAt = idleAt;
  if (now - Date.parse(row.s_seen) > TOUCH_MS) {
    idleExpiresAt = now + IDLE_MS;
    await db.run("UPDATE auth_sessions SET last_seen_at = ?, idle_expires_at = ? WHERE id = ?", iso(now), iso(idleExpiresAt), hash(token));
  }
  return {
    user: { id: row.id, email: row.email, display_name: row.display_name },
    consented: await hasConsent(row.id, db),
    loginAt: Date.parse(row.s_created),
    idleExpiresAt: Math.min(idleExpiresAt, Date.parse(row.s_abs))
  };
}
function sameOrigin(req) {
  const origin = req.headers.get("origin");
  return !!origin && (origin === appOrigin(req) || origin === new URL(req.url).origin);
}
function checkCsrf(req) {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origin = req.headers.get("origin");
  if (origin && origin !== appOrigin(req) && origin !== new URL(req.url).origin) return false;
  const token = readCookies(req)[SESSION_COOKIE];
  if (!token) return !!origin;
  const sent = req.headers.get("x-csrf-token") || "";
  const want = csrfFor(token);
  return sent.length === want.length && crypto2.timingSafeEqual(Buffer.from(sent), Buffer.from(want));
}
async function requireUser(req) {
  if (!checkCsrf(req)) throw new HttpError(403, "csrf");
  const s = await getSession(req);
  if (!s.user) throw new HttpError(401, s.reason || "unauthorized");
  if (!s.consented) throw new HttpError(403, "consent");
  return s;
}
function requireRecentLogin(s) {
  if (Date.now() - s.loginAt > REAUTH_MS) throw new HttpError(403, "reauth");
}
function maskIp(ip) {
  if (!ip) return "unknown";
  if (ip.includes(".")) return ip.split(".").slice(0, 2).join(".") + ".*.*";
  return ip.split(":").slice(0, 3).join(":") + ":*";
}
function clientOf(ua) {
  if (!ua) return null;
  const b = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  const o = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  return b + " / " + o;
}
async function logAccess(req, event, userId, db) {
  db ??= await getDb();
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  await db.run("INSERT INTO access_logs (user_id, event, ip_masked, client) VALUES (?, ?, ?, ?)", userId, event, maskIp(ip), clientOf(req.headers.get("user-agent")));
}
async function purgeOldLogs() {
  await (await getDb()).run("DELETE FROM access_logs WHERE at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-90 days')");
}

// server/routes/auth.ts
var STATE = "gk_oauth_state";
var PKCE = "gk_oauth_pkce";
var callbackUrl = (req) => appOrigin(req) + "/api/auth/callback/google";
var same = (a, b) => !!a && !!b && a.length === b.length && crypto3.timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function googleStart(req) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return redirect("/?error=config");
  const state = crypto3.randomBytes(16).toString("base64url");
  const pkce = newPkce();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    prompt: "select_account"
  }).toString();
  return redirect(url.toString(), [cookie(STATE, state, 600), cookie(PKCE, pkce.verifier, 600)]);
}
async function googleCallback(req) {
  const c = readCookies(req);
  const q = new URL(req.url).searchParams;
  const done = (to, extra = []) => redirect(to, [clearCookie(STATE), clearCookie(PKCE), ...extra]);
  if (!q.get("code") || !c[PKCE] || !same(q.get("state"), c[STATE])) return done("/?error=login");
  let info;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: q.get("code"),
        code_verifier: c[PKCE],
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl(req),
        grant_type: "authorization_code"
      })
    });
    if (!res.ok) return done("/?error=login");
    info = await verifyIdToken((await res.json()).id_token);
  } catch (e) {
    console.error(e);
    return done("/?error=login");
  }
  const db = await getDb();
  const u = await db.get("SELECT id FROM users WHERE google_sub = ?", info.sub);
  if (!u) return done("/", [cookie(PENDING_COOKIE, sealPending(info), PENDING_SEC)]);
  await db.run("UPDATE users SET email = ?, last_login_at = ? WHERE id = ?", info.email, (/* @__PURE__ */ new Date()).toISOString(), u.id);
  await logAccess(req, "login", u.id, db);
  await purgeOldLogs();
  return done("/", await createSession(u.id, db));
}
async function saveConsents(db, userId) {
  const at = (/* @__PURE__ */ new Date()).toISOString();
  for (const t of CONSENT_TYPES) {
    await db.run("INSERT OR REPLACE INTO user_consents (user_id, type, version, agreed, agreed_at) VALUES (?, ?, ?, 1, ?)", userId, t, CONSENT_VERSION, at);
  }
}
var CONTROL = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069\\ufeff]", "g");
var cleanName = (v) => [...String(v ?? "").replace(CONTROL, "").trim()].slice(0, 20).join("").trim();
async function consent(req) {
  const s = await getSession(req);
  if (s.user ? !checkCsrf(req) : !sameOrigin(req)) throw new HttpError(403, "csrf");
  const b = await body(req);
  if (!CONSENT_TYPES.every((t) => b[t] === true)) throw new HttpError(400, "consent_required");
  const db = await getDb();
  if (s.user) {
    await db.tx((tx) => saveConsents(tx, s.user.id));
    return json({ ok: true });
  }
  const p = openPending(readCookies(req)[PENDING_COOKIE]);
  if (!p) throw new HttpError(401, "expired");
  const tz = typeof b.timezone === "string" && /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(b.timezone) ? b.timezone : "Asia/Seoul";
  const userId = await db.tx(async (tx) => {
    const found = await tx.get("SELECT id FROM users WHERE google_sub = ?", p.sub);
    const id = found?.id ?? crypto3.randomUUID();
    if (!found) {
      await tx.run("INSERT INTO users (id, google_sub, email, display_name) VALUES (?, ?, ?, ?)", id, p.sub, p.email, cleanName(p.name) || cleanName(p.email.split("@")[0]) || "\uD559\uC2B5\uC790");
      await tx.run("INSERT INTO user_settings (user_id, font_size, timezone) VALUES (?, ?, ?)", id, "m", tz);
      await tx.run("INSERT INTO user_goals (user_id) VALUES (?)", id);
      await tx.run("INSERT INTO user_stats (user_id) VALUES (?)", id);
    }
    await saveConsents(tx, id);
    return id;
  });
  await logAccess(req, "login", userId, db);
  const h = new Headers();
  [...await createSession(userId, db), clearCookie(PENDING_COOKIE)].forEach((c) => h.append("set-cookie", c));
  return json({ ok: true }, 200, h);
}
async function consentCancel(req) {
  const s = await getSession(req);
  if (s.user ? !checkCsrf(req) : !sameOrigin(req)) throw new HttpError(403, "csrf");
  await endSession(req, "logout");
  const h = new Headers();
  [clearCookie(PENDING_COOKIE), ...clearSession()].forEach((c) => h.append("set-cookie", c));
  return json({ ok: true }, 200, h);
}
async function logout(req) {
  const s = await getSession(req);
  if (s.user ? !checkCsrf(req) : !sameOrigin(req)) throw new HttpError(403, "csrf");
  const idle = (await body(req)).reason === "idle";
  await endSession(req, idle ? "idle" : "logout");
  if (s.user) await logAccess(req, idle ? "idle_logout" : "logout", s.user.id);
  const h = new Headers();
  clearSession().forEach((c) => h.append("set-cookie", c));
  return json({ ok: true }, 200, h);
}
async function me(req) {
  const s = await getSession(req);
  if (!s.user) {
    if (openPending(readCookies(req)[PENDING_COOKIE])) return json({ status: "needsConsent" });
    return json({ status: "signedOut", reason: s.reason });
  }
  const ss = s;
  if (!ss.consented || !await hasConsent(ss.user.id, await getDb())) return json({ status: "needsConsent" });
  const fs3 = await (await getDb()).get("SELECT font_size FROM user_settings WHERE user_id = ?", ss.user.id);
  return json({ status: "ready", profile: ss.user, idleExpiresAt: ss.idleExpiresAt, fontSize: fs3?.font_size || "m" });
}

// server/user.ts
async function timezoneOf(db, userId) {
  return (await db.get("SELECT timezone FROM user_settings WHERE user_id = ?", userId))?.timezone || "Asia/Seoul";
}
function localDate(tz, at = /* @__PURE__ */ new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}
var STUDY_TYPES = ["word", "gram", "sent"];

// server/routes/home.ts
async function home(req) {
  const { user } = await requireUser(req);
  const db = await getDb();
  const today = localDate(await timezoneOf(db, user.id));
  const [goals, act, progress, runs] = await Promise.all([
    db.get("SELECT goal_word, goal_gram, goal_sent FROM user_goals WHERE user_id = ?", user.id),
    db.get("SELECT word_done, gram_done, sent_done FROM daily_activity WHERE user_id = ? AND date = ?", user.id, today),
    db.all("SELECT lesson_id, type, status FROM lesson_progress WHERE user_id = ?", user.id),
    // 이어서 할 학습(7일 보관). 만료된 것은 빼고 최근 것부터
    db.all(
      `SELECT lesson_ids, type, passed_count, item_total, updated_at FROM study_runs
       WHERE user_id = ? AND kind = 'study' AND status = 'in_progress' AND (expires_at IS NULL OR expires_at > ?) ORDER BY updated_at DESC`,
      user.id,
      (/* @__PURE__ */ new Date()).toISOString()
    )
  ]);
  const prog = {};
  for (const p of progress) (prog[p.lesson_id] ||= {})[p.type] = p.status;
  return json({
    today,
    goal: { word: goals?.goal_word ?? 8, gram: goals?.goal_gram ?? 4, sent: goals?.goal_sent ?? 8 },
    done: { word: act?.word_done ?? 0, gram: act?.gram_done ?? 0, sent: act?.sent_done ?? 0 },
    progress: prog,
    runs: runs.map((r) => ({ lesson: Number(r.lesson_ids), type: r.type, at: r.passed_count, of: r.item_total, updatedAt: r.updated_at }))
  });
}
async function setGoals(req) {
  const { user } = await requireUser(req);
  const b = await body(req);
  const v = (k) => {
    const n = Number(b[k]);
    if (!Number.isInteger(n) || n < 0 || n > 50) throw bad("goal");
    return n;
  };
  const [w, g, s] = [v("word"), v("gram"), v("sent")];
  await (await getDb()).run(
    "INSERT INTO user_goals (user_id, goal_word, goal_gram, goal_sent, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET goal_word = excluded.goal_word, goal_gram = excluded.goal_gram, goal_sent = excluded.goal_sent, updated_at = excluded.updated_at",
    user.id,
    w,
    g,
    s,
    (/* @__PURE__ */ new Date()).toISOString()
  );
  return json({ word: w, gram: g, sent: s });
}
async function clearLesson(req) {
  const { user } = await requireUser(req);
  const n = Number(new URL(req.url).searchParams.get("lesson"));
  if (!Number.isInteger(n) || n < 1 || n > 26) throw bad("lesson");
  const db = await getDb();
  await db.tx(async (tx) => {
    await tx.run(`DELETE FROM lesson_progress WHERE user_id = ? AND lesson_id = ? AND type IN (${STUDY_TYPES.map(() => "?").join(",")})`, user.id, n, ...STUDY_TYPES);
    await tx.run("UPDATE study_runs SET status = 'abandoned', ended_at = ? WHERE user_id = ? AND kind = 'study' AND status = 'in_progress' AND lesson_ids = ?", (/* @__PURE__ */ new Date()).toISOString(), user.id, String(n));
  });
  return json({ ok: true });
}

// server/routes/me.ts
var maskEmail = (e) => {
  const [local, domain] = String(e || "").split("@");
  return domain ? local.slice(0, 2) + "*".repeat(Math.max(1, local.length - 2)) + "@" + domain : "";
};
async function summary(req) {
  const { user } = await requireUser(req);
  const db = await getDb();
  const tz = await timezoneOf(db, user.id);
  const today = localDate(tz);
  const days = Array.from({ length: 7 }, (_, i) => localDate(tz, new Date(Date.now() - (6 - i) * 864e5)));
  const [stats, settings, week, progress] = await Promise.all([
    db.get("SELECT xp_total, study_days FROM user_stats WHERE user_id = ?", user.id),
    db.get("SELECT font_size FROM user_settings WHERE user_id = ?", user.id),
    db.all("SELECT date, xp_earned FROM daily_activity WHERE user_id = ? AND date >= ?", user.id, days[0]),
    db.all("SELECT lesson_id, type, status FROM lesson_progress WHERE user_id = ?", user.id)
  ]);
  const xpBy = Object.fromEntries(week.map((w) => [w.date, w.xp_earned]));
  return json({
    name: user.display_name,
    email: maskEmail(user.email),
    fontSize: settings?.font_size || "m",
    xp: stats?.xp_total ?? 0,
    studyDays: stats?.study_days ?? 0,
    today,
    week: days.map((d) => ({ date: d, xp: xpBy[d] || 0 })),
    progress: progress.map((p) => ({ lesson: p.lesson_id, type: p.type, status: p.status }))
  });
}
async function setSettings(req) {
  const { user } = await requireUser(req);
  const b = await body(req);
  if (!["m", "l", "xl"].includes(String(b.fontSize))) throw bad("fontSize");
  await (await getDb()).run("UPDATE user_settings SET font_size = ?, updated_at = ? WHERE user_id = ?", b.fontSize, (/* @__PURE__ */ new Date()).toISOString(), user.id);
  return json({ fontSize: b.fontSize });
}
async function resetRecords(req) {
  const s = await requireUser(req);
  requireRecentLogin(s);
  const db = await getDb();
  await db.tx(async (tx) => {
    for (const t of ["answer_log", "study_runs", "wrong_notes", "bookmarks", "lesson_progress", "daily_activity"]) await tx.run(`DELETE FROM ${t} WHERE user_id = ?`, s.user.id);
    await tx.run("UPDATE user_stats SET xp_total = 0, streak_current = 0, streak_best = 0, study_days = 0, last_study_date = NULL WHERE user_id = ?", s.user.id);
  });
  await logAccess(req, "reset", s.user.id, db);
  return json({ ok: true });
}
async function withdraw(req) {
  const s = await requireUser(req);
  if ((await body(req)).confirm !== true) throw bad("confirm");
  requireRecentLogin(s);
  const db = await getDb();
  await db.tx(async (tx) => {
    for (const t of ["answer_log", "study_runs", "wrong_notes", "bookmarks", "lesson_progress", "daily_activity", "user_stats", "user_goals", "user_settings", "user_consents", "auth_sessions"]) await tx.run(`DELETE FROM ${t} WHERE user_id = ?`, s.user.id);
    await tx.run("UPDATE access_logs SET user_id = NULL WHERE user_id = ?", s.user.id);
    await tx.run("DELETE FROM users WHERE id = ?", s.user.id);
    await logAccess(req, "withdraw", null, tx);
  });
  const h = new Headers();
  clearSession().forEach((c) => h.append("set-cookie", c));
  return json({ ok: true }, 200, h);
}

// server/routes/runs.ts
import crypto4 from "node:crypto";

// server/content.ts
import fs2 from "node:fs";
import path2 from "node:path";
var cache = /* @__PURE__ */ new Map();
function lessonFile(n) {
  if (!cache.has(n)) {
    const p = path2.join(process.cwd(), "public", "data", `l${String(n).padStart(2, "0")}.json`);
    cache.set(n, fs2.existsSync(p) ? JSON.parse(fs2.readFileSync(p, "utf8")) : null);
  }
  return cache.get(n);
}
var READY = [3, 4, 5, 6, 7, 8];
function lessonOfItem(type, id) {
  for (const n of READY) {
    const f = lessonFile(n);
    if (!f) continue;
    const hit = type === "word" ? f.words.some((w) => w.id === id) : type === "gram" ? f.grammarLearning.some((g) => g.id === id) || f.grammarQuestions.some((g) => g.id === id) : type === "sent" ? f.sentences.some((s) => s.id === id) : type === "concept" ? id.startsWith("L" + String(n).padStart(2, "0") + "-") : false;
    if (hit) return n;
  }
  return null;
}
function grade(type, id, answer) {
  const n = lessonOfItem(type, id);
  if (n == null) return false;
  const f = lessonFile(n);
  if (type === "word") return f.words.find((w) => w.id === id)?.meaning === answer;
  if (type === "gram") {
    const g = f.grammarLearning.find((x) => x.id === id) || f.grammarQuestions.find((x) => x.id === id);
    return !!g && g.options[g.answer] === answer;
  }
  if (type === "sent") return answer === "ok" || answer === "knew";
  return false;
}
function contentVersion(lessons) {
  return lessons.map((n) => {
    try {
      const st = fs2.statSync(path2.join(process.cwd(), "public", "data", `l${String(n).padStart(2, "0")}.json`));
      return `${n}:${st.size}`;
    } catch {
      return `${n}:0`;
    }
  }).join(",");
}

// server/reward.ts
var WEIGHT = { word: 1, gram: 1, sent: 3, mix: 1, flash: 1 };
function computeReward(type, itemCount, firstTry, sessionNo, reviewHits) {
  const accuracy = itemCount ? Math.round(firstTry / itemCount * 100) : 0;
  const bonus = accuracy >= 90 ? 10 : 0;
  const base = type === "sent" ? itemCount * 6 + bonus : 10 + itemCount * (WEIGHT[type] ?? 1) + bonus;
  const multiplier = sessionNo <= 1 ? 1 : sessionNo === 2 ? 0.75 : 0.5;
  const after = multiplier === 1 ? base : Math.max(1, Math.round(base * multiplier));
  const reviewBonus = reviewHits * 2;
  return { total: after + reviewBonus, base, bonus, accuracy, multiplier, reviewBonus };
}

// server/routes/runs.ts
var KEEP_MS = 7 * 864e5;
var STUDY_TYPES2 = ["word", "gram", "sent"];
var TEST_TYPES = ["mix", "flash"];
var ITEM_TYPES = ["word", "gram", "sent"];
var out = (r) => ({
  id: r.id,
  kind: r.kind,
  type: r.type,
  lessons: r.lesson_ids.split(",").map(Number),
  status: r.status,
  queue: JSON.parse(r.queue),
  itemTotal: r.item_total,
  passed: r.passed_count,
  firstTry: r.first_try_correct,
  extra: r.extra_state ? publicExtra(JSON.parse(r.extra_state)) : null,
  elapsedMs: r.elapsed_ms,
  rev: r.rev
});
var publicExtra = (e) => {
  const { _srv, ...rest } = e;
  void _srv;
  return rest;
};
var iso2 = (ms = Date.now()) => new Date(ms).toISOString();
var baseId = (id) => id.split("#")[0];
async function getRun(db, userId, id) {
  const r = await db.get("SELECT * FROM study_runs WHERE id = ? AND user_id = ?", id, userId);
  if (!r) throw new HttpError(404, "run");
  return r;
}
async function startRun(req) {
  const { user } = await requireUser(req);
  const b = await body(req);
  const kind = b.kind;
  if (kind !== "study" && kind !== "test") throw bad("kind");
  if (!(kind === "study" ? STUDY_TYPES2 : TEST_TYPES).includes(b.type)) throw bad("type");
  const lessons = (Array.isArray(b.lessons) ? b.lessons : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 26);
  if (!lessons.length || kind === "study" && lessons.length !== 1) throw bad("lessons");
  const db = await getDb();
  const lessonKey = lessons.join(",");
  const now = Date.now();
  await db.run("UPDATE study_runs SET status = 'abandoned', ended_at = ? WHERE user_id = ? AND status = 'in_progress' AND expires_at IS NOT NULL AND expires_at <= ?", iso2(now), user.id, iso2(now));
  if (kind === "test") await db.run("UPDATE study_runs SET status = 'abandoned', ended_at = ? WHERE user_id = ? AND kind = 'test' AND status = 'in_progress'", iso2(now), user.id);
  if (kind === "study") {
    const cur = await db.get("SELECT * FROM study_runs WHERE user_id = ? AND kind = 'study' AND type = ? AND lesson_ids = ? AND status = 'in_progress' ORDER BY updated_at DESC LIMIT 1", user.id, b.type, lessonKey);
    if (cur && !b.restart && cur.content_version === contentVersion(lessons)) return json({ run: out(cur), resumed: true });
    if (cur) await db.run("UPDATE study_runs SET status = 'abandoned', ended_at = ? WHERE id = ?", iso2(now), cur.id);
  }
  const queue = Array.isArray(b.queue) ? b.queue.map(String).slice(0, 2e3) : [];
  if (!queue.length) throw bad("queue");
  const itemType = kind === "study" ? b.type : null;
  for (const q of new Set(queue.map(baseId))) {
    const [t, id2] = itemType ? [itemType, q] : q.split(":");
    if (!ITEM_TYPES.includes(t) || lessonOfItem(t, id2) == null) throw bad("item");
  }
  const id = crypto4.randomUUID();
  const total = Math.max(1, Math.min(2e3, Number(b.itemTotal) || queue.length));
  await db.run(
    `INSERT INTO study_runs (id, user_id, kind, type, lesson_ids, test_options, content_version, status, queue, item_total, extra_state, started_at, updated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    kind,
    b.type,
    lessonKey,
    b.options ? JSON.stringify(b.options) : null,
    contentVersion(lessons),
    JSON.stringify(queue),
    total,
    b.extra ? JSON.stringify(b.extra) : null,
    iso2(now),
    iso2(now),
    kind === "study" ? iso2(now + KEEP_MS) : null
  );
  if (kind === "study") {
    await db.run(
      "INSERT INTO lesson_progress (user_id, lesson_id, type, status) VALUES (?, ?, ?, 'in_progress') ON CONFLICT(user_id, lesson_id, type) DO UPDATE SET status = CASE WHEN lesson_progress.status = 'done' THEN 'done' ELSE 'in_progress' END",
      user.id,
      lessons[0],
      b.type
    );
  }
  return json({ run: out(await getRun(db, user.id, id)), resumed: false });
}
async function saveRun(req, runId) {
  const { user } = await requireUser(req);
  const b = await body(req);
  const db = await getDb();
  const result = await db.tx(async (tx) => {
    const r = await getRun(tx, user.id, runId);
    if (r.status !== "in_progress") throw new HttpError(409, "ended");
    if (Number(b.rev) !== r.rev) return { conflict: out(r) };
    const srv = (r.extra_state ? JSON.parse(r.extra_state)._srv : null) || { reviewHits: 0, firstTry: 0, seen: [] };
    const tz = await timezoneOf(tx, user.id);
    const today = localDate(tz);
    const goalAdd = { word: 0, gram: 0, sent: 0 };
    const toast = [];
    for (const a of (Array.isArray(b.answers) ? b.answers : []).slice(0, 200)) {
      const seq = Number(a.seq);
      if (!Number.isInteger(seq) || !ITEM_TYPES.includes(a.type) || typeof a.id !== "string") continue;
      const bid = baseId(a.id);
      const lesson = lessonOfItem(a.type, bid);
      if (lesson == null) continue;
      const correct = grade(a.type, bid, String(a.answer ?? ""));
      const key2 = a.type + ":" + a.id;
      const firstOfItem = !srv.seen.includes(key2);
      const ins = await tx.run(
        "INSERT OR IGNORE INTO answer_log (run_id, seq, user_id, item_type, item_id, answer, correct, first_try, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        runId,
        seq,
        user.id,
        a.type,
        a.id,
        String(a.answer ?? "").slice(0, 300),
        correct ? 1 : 0,
        firstOfItem ? 1 : 0,
        a.answeredAt || iso2()
      );
      if (!ins.rowsAffected) continue;
      if (firstOfItem) {
        srv.seen.push(key2);
        if (correct) srv.firstTry++;
        const baseKey = a.type + ":" + bid;
        if (!srv.seen.includes("note:" + baseKey)) {
          srv.seen.push("note:" + baseKey);
          const n = await tx.get("SELECT ok_streak, last_run_id FROM wrong_notes WHERE user_id = ? AND item_type = ? AND item_id = ?", user.id, a.type, bid);
          if (!correct) {
            toast.push(a.id);
            await tx.run(
              `INSERT INTO wrong_notes (user_id, item_type, item_id, lesson_id, wrong_count, ok_streak, last_run_id, last_wrong_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)
               ON CONFLICT(user_id, item_type, item_id) DO UPDATE SET wrong_count = wrong_count + 1, ok_streak = 0, last_run_id = excluded.last_run_id, last_wrong_at = excluded.last_wrong_at`,
              user.id,
              a.type,
              bid,
              lesson,
              runId,
              iso2()
            );
          } else if (n && n.last_run_id !== runId) {
            srv.reviewHits++;
            if (n.ok_streak + 1 >= 2) await tx.run("DELETE FROM wrong_notes WHERE user_id = ? AND item_type = ? AND item_id = ?", user.id, a.type, bid);
            else await tx.run("UPDATE wrong_notes SET ok_streak = ok_streak + 1, last_run_id = ? WHERE user_id = ? AND item_type = ? AND item_id = ?", runId, user.id, a.type, bid);
          }
        }
      }
      if (r.kind === "study" ? a.passed && correct : firstOfItem && correct) goalAdd[a.type]++;
    }
    if (goalAdd.word + goalAdd.gram + goalAdd.sent) {
      await tx.run(
        `INSERT INTO daily_activity (user_id, date, word_done, gram_done, sent_done) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET word_done = word_done + excluded.word_done, gram_done = gram_done + excluded.gram_done, sent_done = sent_done + excluded.sent_done`,
        user.id,
        today,
        goalAdd.word,
        goalAdd.gram,
        goalAdd.sent
      );
    }
    const extra = { ...b.extra && typeof b.extra === "object" ? b.extra : {}, _srv: srv };
    const queue = Array.isArray(b.queue) ? b.queue.map(String).slice(0, 2e3) : JSON.parse(r.queue);
    await tx.run(
      "UPDATE study_runs SET queue = ?, passed_count = ?, first_try_correct = ?, extra_state = ?, elapsed_ms = ?, rev = rev + 1, updated_at = ?, expires_at = CASE WHEN kind = ? THEN ? ELSE NULL END WHERE id = ?",
      JSON.stringify(queue),
      Math.max(0, Math.min(r.item_total, Number(b.passed) || 0)),
      srv.firstTry,
      JSON.stringify(extra),
      Math.max(r.elapsed_ms, Math.min(6 * 36e5, Number(b.elapsedMs) || 0)),
      iso2(),
      "study",
      iso2(Date.now() + KEEP_MS),
      runId
    );
    return { rev: r.rev + 1, wrongNoted: toast };
  });
  if ("conflict" in result) return json({ error: "conflict", run: result.conflict }, 409);
  return json(result);
}
async function finishRun(req, runId) {
  const { user } = await requireUser(req);
  const b = await body(req);
  const db = await getDb();
  const res = await db.tx(async (tx) => {
    const r = await getRun(tx, user.id, runId);
    if (r.status === "done") throw new HttpError(409, "ended");
    if (r.status !== "in_progress") throw new HttpError(409, "ended");
    const srv = (r.extra_state ? JSON.parse(r.extra_state)._srv : null) || { reviewHits: 0, firstTry: 0 };
    const tz = await timezoneOf(tx, user.id);
    const today = localDate(tz);
    const nowIso = iso2();
    const recent = await tx.all("SELECT ended_at FROM study_runs WHERE user_id = ? AND type = ? AND status = 'done' AND ended_at >= ?", user.id, r.type, iso2(Date.now() - 2 * 864e5));
    const sessionNo = recent.filter((x) => localDate(tz, new Date(x.ended_at)) === today).length + 1;
    const firstTry = Math.min(srv.firstTry, r.item_total);
    const reward = computeReward(r.type, r.item_total, firstTry, sessionNo, srv.reviewHits);
    const elapsed = Math.max(r.elapsed_ms, Math.min(6 * 36e5, Number(b.elapsedMs) || 0));
    await tx.run("UPDATE study_runs SET status = 'done', ended_at = ?, updated_at = ?, xp_earned = ?, elapsed_ms = ?, passed_count = item_total, first_try_correct = ?, expires_at = NULL WHERE id = ?", nowIso, nowIso, reward.total, elapsed, firstTry, runId);
    if (r.kind === "study") {
      await tx.run(
        `INSERT INTO lesson_progress (user_id, lesson_id, type, status, completed_at, completed_count) VALUES (?, ?, ?, 'done', ?, 1)
         ON CONFLICT(user_id, lesson_id, type) DO UPDATE SET status = 'done', completed_at = COALESCE(lesson_progress.completed_at, excluded.completed_at), completed_count = lesson_progress.completed_count + 1`,
        user.id,
        Number(r.lesson_ids),
        r.type,
        nowIso
      );
    }
    await tx.run(
      `INSERT INTO daily_activity (user_id, date, xp_earned, study_ms, test_items) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET xp_earned = xp_earned + excluded.xp_earned, study_ms = study_ms + excluded.study_ms, test_items = test_items + excluded.test_items`,
      user.id,
      today,
      reward.total,
      elapsed,
      r.kind === "test" ? r.item_total : 0
    );
    const st = await tx.get("SELECT * FROM user_stats WHERE user_id = ?", user.id) || { xp_total: 0, streak_current: 0, streak_best: 0, study_days: 0, last_study_date: null };
    const yesterday = localDate(tz, new Date(Date.now() - 864e5));
    const newDay = st.last_study_date !== today;
    const streak = newDay ? st.last_study_date === yesterday ? st.streak_current + 1 : 1 : st.streak_current;
    await tx.run(
      `INSERT INTO user_stats (user_id, xp_total, streak_current, streak_best, study_days, last_study_date) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET xp_total = excluded.xp_total, streak_current = excluded.streak_current, streak_best = excluded.streak_best, study_days = excluded.study_days, last_study_date = excluded.last_study_date`,
      user.id,
      st.xp_total + reward.total,
      streak,
      Math.max(st.streak_best, streak),
      st.study_days + (newDay ? 1 : 0),
      today
    );
    return { reward, itemTotal: r.item_total, firstTry, elapsedMs: elapsed, xpBefore: st.xp_total, xpAfter: st.xp_total + reward.total };
  });
  return json(res);
}
async function abandonRun(req, runId) {
  const { user } = await requireUser(req);
  const db = await getDb();
  await db.run("UPDATE study_runs SET status = 'abandoned', ended_at = ? WHERE id = ? AND user_id = ? AND status = 'in_progress' AND kind = 'test'", iso2(), runId, user.id);
  return json({ ok: true });
}
var BM_TYPES = ["word", "gram", "sent", "concept"];
async function listBookmarks(req) {
  const { user } = await requireUser(req);
  const rows = await (await getDb()).all("SELECT item_type, item_id, lesson_id, created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC", user.id);
  return json(rows.map((r) => ({ type: r.item_type, id: r.item_id, lesson: r.lesson_id, at: r.created_at })));
}
async function toggleBookmark(req) {
  const { user } = await requireUser(req);
  const b = await body(req);
  if (!BM_TYPES.includes(b.type) || typeof b.id !== "string") throw bad("item");
  const lesson = lessonOfItem(b.type, b.id);
  if (lesson == null) throw bad("item");
  const db = await getDb();
  const on = await db.get("SELECT 1 FROM bookmarks WHERE user_id = ? AND item_type = ? AND item_id = ?", user.id, b.type, b.id);
  if (on) await db.run("DELETE FROM bookmarks WHERE user_id = ? AND item_type = ? AND item_id = ?", user.id, b.type, b.id);
  else await db.run("INSERT INTO bookmarks (user_id, item_type, item_id, lesson_id) VALUES (?, ?, ?, ?)", user.id, b.type, b.id, lesson);
  return json({ type: b.type, id: b.id, on: !on });
}
async function listNotes(req) {
  const { user } = await requireUser(req);
  const rows = await (await getDb()).all(
    "SELECT item_type, item_id, lesson_id, wrong_count, ok_streak FROM wrong_notes WHERE user_id = ? ORDER BY wrong_count DESC, last_wrong_at DESC",
    user.id
  );
  return json(rows.map((r) => ({ type: r.item_type, id: r.item_id, lesson: r.lesson_id, wrong: r.wrong_count, ok: r.ok_streak })));
}

// server/router.ts
var ROUTES = {
  "GET /api/auth/google": googleStart,
  "GET /api/auth/callback/google": googleCallback,
  "POST /api/auth/consent": consent,
  "DELETE /api/auth/consent": consentCancel,
  "POST /api/auth/logout": logout,
  "GET /api/me": me,
  "GET /api/home": home,
  "PATCH /api/goals": setGoals,
  "DELETE /api/progress": clearLesson,
  "POST /api/runs": startRun,
  "GET /api/bookmarks": listBookmarks,
  "POST /api/bookmarks": toggleBookmark,
  "GET /api/notes": listNotes,
  "GET /api/me/summary": summary,
  "PATCH /api/settings": setSettings,
  "POST /api/me/reset": resetRecords,
  "POST /api/me/withdraw": withdraw
};
async function route(req) {
  const url = new URL(req.url);
  const path3 = url.searchParams.get("__path") != null ? "/api/" + url.searchParams.get("__path") : url.pathname;
  const p = path3.replace(/\/$/, "");
  const run = /^\/api\/runs\/([0-9a-f-]{36})(?:\/(finish|abandon))?$/.exec(p);
  const h = run ? req.method === "PUT" && !run[2] ? (r) => saveRun(r, run[1]) : req.method === "POST" && run[2] === "finish" ? (r) => finishRun(r, run[1]) : req.method === "POST" && run[2] === "abandon" ? (r) => abandonRun(r, run[1]) : void 0 : ROUTES[`${req.method} ${p}`];
  if (!h) return json({ error: "not_found" }, 404);
  try {
    return await h(req);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
}

// server/vercel.ts
var GET = route;
var POST = route;
var PATCH = route;
var PUT = route;
var DELETE = route;
export {
  DELETE,
  GET,
  PATCH,
  POST,
  PUT
};
