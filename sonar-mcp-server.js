#!/usr/bin/env node
/**
 * sonar-mcp-server.js — SonarQube MCP Local Proxy
 * ─────────────────────────────────────────────────
 * Servidor HTTP local que actúa como puente entre el browser app y SonarQube.
 * El token de autenticación se guarda aquí (no en el browser).
 *
 * Uso:
 *   node sonar-mcp-server.js
 *
 * Config (sonar-mcp.config.json) o variables de entorno:
 *   SONAR_URL, SONAR_TOKEN, SONAR_PROJECT_KEY, MCP_PORT
 */

const http  = require("http");
const https = require("https");
const url   = require("url");
const fs    = require("fs");
const path  = require("path");

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, "sonar-mcp.config.json");

function loadConfig() {
  let cfg = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); }
    catch (e) { console.warn("⚠  sonar-mcp.config.json inválido:", e.message); }
  }
  return {
    sonarUrl:   process.env.SONAR_URL          || cfg.sonarUrl   || "https://sonar.chubb.com",
    sonarToken: process.env.SONAR_TOKEN        || cfg.sonarToken || "",
    projectKey: process.env.SONAR_PROJECT_KEY  || cfg.projectKey || "",
    port:       parseInt(process.env.MCP_PORT  || cfg.port       || "3747", 10),
  };
}

// ── SONARQUBE FETCH ──────────────────────────────────────────────────────────
function sonarRequest(baseUrl, apiPath, token) {
  return new Promise((resolve, reject) => {
    const target  = new URL(apiPath, baseUrl.replace(/\/$/, "") + "/");
    const isHttps = target.protocol === "https:";
    const lib     = isHttps ? https : http;
    const opts    = {
      hostname:          target.hostname,
      port:              target.port || (isHttps ? 443 : 80),
      path:              target.pathname + target.search,
      method:            "GET",
      rejectUnauthorized: false, // permite certs self-signed en intranet
      headers:           token
        ? { "Authorization": "Basic " + Buffer.from(token + ":").toString("base64") }
        : {},
    };
    const req = lib.request(opts, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`SonarQube HTTP ${res.statusCode} — ${raw.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error("Respuesta no JSON de SonarQube")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout conectando a SonarQube")); });
    req.end();
  });
}

async function fetchSonarData(sonarUrl, token, projectKey, branch) {
  const pk = encodeURIComponent(projectKey);
  const br = encodeURIComponent(branch);
  const METRICS = [
    "security_rating","vulnerabilities",
    "reliability_rating","bugs",
    "sqale_rating","code_smells",
    "coverage","duplicated_lines_density",
    "security_hotspots","security_hotspots_reviewed",
    "ncloc",
  ].join(",");

  const [qgJson, metricsJson] = await Promise.all([
    sonarRequest(sonarUrl, `/api/qualitygates/project_status?projectKey=${pk}&branch=${br}`, token),
    sonarRequest(sonarUrl, `/api/measures/component?component=${pk}&branch=${br}&metricKeys=${METRICS}`, token),
  ]);

  const qg = qgJson.projectStatus?.status === "OK" ? "Passed" : "Failed";
  const mv = {};
  (metricsJson.component?.measures || []).forEach(m => { mv[m.metric] = m.value; });

  const letter  = r => ({ 1:"A", 2:"B", 3:"C", 4:"D", 5:"E" }[parseInt(r)] || "");
  const pct     = v => v ? parseFloat(v).toFixed(1) + "%" : "";
  const loc     = v => { if (!v) return ""; const n = parseInt(v); return n >= 1000 ? Math.round(n/1000)+"k" : String(n); };
  const hotsPct = parseFloat(mv.security_hotspots_reviewed || "0");

  return {
    qg,
    secIssues:    mv.vulnerabilities || "",
    secRating:    letter(mv.security_rating),
    relIssues:    mv.bugs || "",
    relRating:    letter(mv.reliability_rating),
    maintIssues:  mv.code_smells || "",
    maintRating:  letter(mv.sqale_rating),
    coverage:     pct(mv.coverage),
    duplications: pct(mv.duplicated_lines_density),
    hotspots:     mv.security_hotspots || "",
    hotspotsStatus: hotsPct >= 100 ? "Reviewed" : (mv.security_hotspots ? "Failed" : ""),
    loc:          loc(mv.ncloc),
  };
}

// ── HTTP SERVER ──────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

function json(res, code, body) {
  res.writeHead(code, CORS);
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const cfg    = loadConfig();           // recarga en cada request = config live
  const parsed = url.parse(req.url, true);
  const { pathname, query } = parsed;

  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }

  // ── GET /health ────────────────────────────────────────────────────────────
  if (pathname === "/health") {
    return json(res, 200, {
      status:     "ok",
      sonarUrl:   cfg.sonarUrl,
      projectKey: cfg.projectKey,
      hasToken:   !!cfg.sonarToken,
      port:       cfg.port,
    });
  }

  // ── GET /api/sonar-data?branch=...&projectKey=... ─────────────────────────
  if (pathname === "/api/sonar-data") {
    const projectKey = query.projectKey || cfg.projectKey;
    const branch     = query.branch     || "";
    if (!projectKey) return json(res, 400, { ok: false, error: "Falta projectKey (configúralo en sonar-mcp.config.json)" });
    if (!cfg.sonarToken) return json(res, 401, { ok: false, error: "Sin token SonarQube — configura sonarToken en sonar-mcp.config.json" });
    try {
      const data = await fetchSonarData(cfg.sonarUrl, cfg.sonarToken, projectKey, branch);
      return json(res, 200, { ok: true, data });
    } catch (err) {
      console.error("  ✗ SonarQube:", err.message);
      return json(res, 502, { ok: false, error: err.message });
    }
  }

  json(res, 404, { error: "Endpoint no encontrado" });
});

// ── START ────────────────────────────────────────────────────────────────────
const cfg = loadConfig();
server.listen(cfg.port, "127.0.0.1", () => {
  console.log(`\n✓ SonarQube MCP Server  →  http://127.0.0.1:${cfg.port}`);
  console.log(`  SonarQube : ${cfg.sonarUrl}`);
  console.log(`  Proyecto  : ${cfg.projectKey || "(configura projectKey en sonar-mcp.config.json)"}`);
  console.log(`  Token     : ${cfg.sonarToken ? "✓ configurado" : "✗ falta — edita sonar-mcp.config.json"}`);
  console.log(`\n  Endpoints disponibles:`);
  console.log(`    GET /health`);
  console.log(`    GET /api/sonar-data?branch=CNEV-374`);
  console.log(`    GET /api/sonar-data?branch=CNEV-374&projectKey=OTRO-PROYECTO`);
  console.log(`\n  Mantén este proceso corriendo mientras usas el Analyzer.\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n✗ Puerto ${cfg.port} ocupado. Cambia "port" en sonar-mcp.config.json\n`);
  } else {
    console.error("✗ Error del servidor:", err.message);
  }
  process.exit(1);
});

process.on("SIGINT",  () => { console.log("\n⏹  MCP Server detenido."); process.exit(0); });
process.on("SIGTERM", () => { console.log("\n⏹  MCP Server detenido."); process.exit(0); });
