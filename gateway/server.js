import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "5mb" }));

const BASE = process.env.OPENVOICE_BASE_URL || "http://localhost:8786";
const REF_DIR = process.env.REF_DIR || "/refs";
const OUT_DIR = process.env.OUT_DIR || "/outs";
const PORT = Number(process.env.PORT) || 3001;
const BASIC_USER = process.env.BASIC_AUTH_USER;
const BASIC_PASS = process.env.BASIC_AUTH_PASS;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Basic auth gate if credentials are configured.
if (BASIC_USER) {
  app.use((req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.replace(/^Basic\s+/i, "");
    const [user, pass] = Buffer.from(token, "base64").toString().split(":");

    if (user === BASIC_USER && pass === BASIC_PASS) return next();

    res.setHeader("WWW-Authenticate", 'Basic realm="OpenVoice Studio"');
    return res.status(401).json({ error: "Unauthorized" });
  });
}

app.get("/healthz", (req, res) => {
  res.json({ ok: true, base: BASE });
});

function stripApiPrefix(url, prefix) {
  return url.startsWith(prefix) ? url.slice(prefix.length) : url;
}

async function forward(req, res, targetPath, options = {}) {
  try {
    const url = `${BASE}${targetPath}`;
    const init = {
      method: req.method,
      headers: { ...req.headers },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req,
      ...options,
    };

    delete init.headers.host;

    const upstream = await fetch(url, init);
    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      if (key === "transfer-encoding") return;
      res.setHeader(key, value);
    });

    if (!upstream.body) {
      res.end();
      return;
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await upstream.json().catch(() => null);
      res.json(data ?? {});
      return;
    }

    upstream.body.pipe(res);
  } catch (err) {
    console.error("Proxy error", err);
    res.status(502).json({ error: "Upstream request failed", detail: err.message });
  }
}

app.post("/api/upload_audio", (req, res) => {
  return forward(req, res, "/upload_audio/");
});

app.post("/api/change_voice*", (req, res) => {
  const suffix = stripApiPrefix(req.url, "/api/change_voice");
  return forward(req, res, `/change_voice${suffix}`);
});

app.get("/api/base_tts*", (req, res) => {
  const suffix = stripApiPrefix(req.url, "/api/base_tts");
  return forward(req, res, `/base_tts${suffix}`);
});

app.get("/api/synthesize_speech*", (req, res) => {
  const suffix = stripApiPrefix(req.url, "/api/synthesize_speech");
  return forward(req, res, `/synthesize_speech${suffix}`);
});

function listDirectory(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .map((entry) => {
        const full = path.join(dir, entry.name);
        const stats = fs.statSync(full);
        return {
          name: entry.name,
          size: stats.size,
          mtimeMs: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch (err) {
    throw new Error(`Failed to read ${dir}: ${err.message}`);
  }
}

app.get("/api/refs", (req, res) => {
  try {
    res.json(listDirectory(REF_DIR));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/outs", (req, res) => {
  try {
    res.json(listDirectory(OUT_DIR));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function safeResolve(root, fileName) {
  const resolved = path.resolve(root, fileName);
  if (!resolved.startsWith(path.resolve(root))) {
    throw new Error("Invalid path");
  }
  return resolved;
}

app.get("/api/refs/:file", (req, res) => {
  try {
    const filePath = safeResolve(REF_DIR, req.params.file);
    res.sendFile(filePath);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get("/api/outs/:file", (req, res) => {
  try {
    const filePath = safeResolve(OUT_DIR, req.params.file);
    res.sendFile(filePath);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Gateway listening on port ${PORT} → ${BASE}`);
});
