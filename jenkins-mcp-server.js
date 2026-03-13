#!/usr/bin/env node
/**
 * jenkins-mcp-server.js — Jenkins MCP Local Proxy
 * ─────────────────────────────────────────────────
 * Servidor HTTP local que actúa como puente entre el browser app y Jenkins/Git.
 * Las credenciales se guardan aquí (no en el browser).
 *
 * Uso:
 *   node jenkins-mcp-server.js
 *
 * Config (jenkins-mcp.config.json) o variables de entorno:
 *   JENKINS_URL, JENKINS_USER, JENKINS_TOKEN, GIT_BASE, GIT_USER, GIT_PASS, MCP_JENKINS_PORT
 */

const http  = require("http");
const https = require("https");
const url   = require("url");
const fs    = require("fs");
const path  = require("path");

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, "jenkins-mcp.config.json");

function loadConfig() {
  let cfg = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); }
    catch (e) { console.warn("⚠  jenkins-mcp.config.json inválido:", e.message); }
  }
  return {
    jenkinsUrl:    process.env.JENKINS_URL         || cfg.jenkinsUrl    || "https://jenkins.chubbdigital.com",
    jenkinsUser:   process.env.JENKINS_USER        || cfg.jenkinsUser   || "",
    jenkinsToken:  process.env.JENKINS_TOKEN       || cfg.jenkinsToken  || "",
    jenkinsFolder: process.env.JENKINS_FOLDER      || cfg.jenkinsFolder || "",  // carpeta/organización en Jenkins
    jenkinsSuffix: process.env.JENKINS_SUFFIX      || cfg.jenkinsSuffix || "",  // sufijo del job, ej: "_multi"
    jenkinsBranch: process.env.JENKINS_BRANCH      || cfg.jenkinsBranch || "sit", // rama de despliegue, ej: "sit", "dev"
    port:          parseInt(process.env.MCP_JENKINS_PORT || cfg.port   || "3748", 10),
  };
}

// ── HTTP REQUEST HELPER ──────────────────────────────────────────────────────
function makeRequest(targetUrl, authHeader, method) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(targetUrl);
    const isHttps = parsed.protocol === "https:";
    const lib     = isHttps ? https : http;
    const opts    = {
      hostname:           parsed.hostname,
      port:               parsed.port || (isHttps ? 443 : 80),
      path:               parsed.pathname + parsed.search,
      method:             method || "GET",
      rejectUnauthorized: false, // permite certs self-signed en intranet
      headers:            authHeader ? { "Authorization": authHeader } : {},
    };
    const req = lib.request(opts, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout conectando al servidor")); });
    req.end();
  });
}

// ── JENKINS DATA FETCH ────────────────────────────────────────────────────────
async function fetchJenkinsData(cfg, repoName) {
  const jenkinsBase = cfg.jenkinsUrl.replace(/\/$/, "");
  // Si jenkinsFolder está configurado, el job vive dentro de una carpeta:
  // /job/{folder}/job/{repoName}/api/json
  const jobName = repoName + (cfg.jenkinsSuffix || "");
  const jobPath = cfg.jenkinsFolder
    ? `/job/${encodeURIComponent(cfg.jenkinsFolder)}/job/${encodeURIComponent(jobName)}`
    : `/job/${encodeURIComponent(jobName)}`;
  // Para Multibranch Pipeline: el job contenedor no tiene lastBuild.
  // Los builds viven en la rama: /job/{folder}/job/{jobName}/job/{branch}/
  const branchPath = cfg.jenkinsBranch
    ? `${jobPath}/job/${encodeURIComponent(cfg.jenkinsBranch)}`
    : jobPath;
  const jobApiUrl = `${jenkinsBase}${branchPath}/api/json?tree=lastBuild[number,result,url,duration,timestamp]`;
  console.log(`  → GET ${jobApiUrl}`);
  const jenkinsAuth = cfg.jenkinsUser
    ? "Basic " + Buffer.from(`${cfg.jenkinsUser}:${cfg.jenkinsToken}`).toString("base64")
    : null;

  const result = {
    jobExists:       false,
    lastBuild:       null,
    lastBuildStatus: null,
    buildUrl:        null,
    lastDCL:         null,   // ej: "DCL-946"
    method:          "manual",
  };

  const jRes = await makeRequest(jobApiUrl, jenkinsAuth);

  console.log(`  ← HTTP ${jRes.status}`);
  if (jRes.status === 200) {
    result.jobExists = true;
    try {
      const data = JSON.parse(jRes.body);
      if (data.lastBuild) {
        const buildNum = data.lastBuild.number;
        result.lastBuild       = "#" + buildNum;
        result.lastBuildStatus = data.lastBuild.result || "IN_PROGRESS";
        result.buildUrl        = data.lastBuild.url || null;

        // ── Extraer DCL del console log del último build ──────────────────
        const consoleUrl = `${jenkinsBase}${branchPath}/${buildNum}/consoleText`;
        console.log(`  → GET ${consoleUrl} (buscando DCL...)`);
        try {
          const logRes = await makeRequest(consoleUrl, jenkinsAuth);
          if (logRes.status === 200) {
            // Busca patrón: "DCL-NNN" o "Created DCL-NNN"
            const match = logRes.body.match(/DCL-(\d+)/);
            if (match) {
              result.lastDCL = "DCL-" + match[1];
              console.log(`  ✓ DCL encontrado: ${result.lastDCL}`);
            }
          }
        } catch { /* no crítico — continúa sin DCL */ }
      }
    } catch { /* parse error — job exists but no build data */ }
  } else if (jRes.status === 404) {
    result.jobExists = false;
  } else {
    throw new Error(`Jenkins HTTP ${jRes.status}`);
  }

  result.method = result.jobExists ? "pipeline" : "manual";
  return result;
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
      status:        "ok",
      jenkinsUrl:    cfg.jenkinsUrl,
      hasToken:      !!(cfg.jenkinsUser && cfg.jenkinsToken),
      port:          cfg.port,
      jenkinsBranch: cfg.jenkinsBranch || "",
    });
  }

  // ── GET /api/jenkins-data?repo=NOMBRE ─────────────────────────────────────
  if (pathname === "/api/jenkins-data") {
    const repoName = query.repo || "";
    if (!repoName) return json(res, 400, { ok: false, error: "Falta parámetro 'repo'" });

    try {
      const data = await fetchJenkinsData(cfg, repoName);
      return json(res, 200, { ok: true, data });
    } catch (err) {
      console.error("  ✗ Jenkins:", err.message);
      return json(res, 502, { ok: false, error: err.message });
    }
  }

  json(res, 404, { error: "Endpoint no encontrado" });
});

// ── START ────────────────────────────────────────────────────────────────────
const cfg = loadConfig();
server.listen(cfg.port, "127.0.0.1", () => {
  console.log(`\n✓ Jenkins MCP Server  →  http://127.0.0.1:${cfg.port}`);
  console.log(`  Jenkins : ${cfg.jenkinsUrl}`);
  console.log(`  Carpeta : ${cfg.jenkinsFolder ? cfg.jenkinsFolder : "(sin carpeta)"}`);
  console.log(`  Sufijo  : ${cfg.jenkinsSuffix ? '"' + cfg.jenkinsSuffix + '"' : "(ninguno)"}`);
  console.log(`  Rama    : ${cfg.jenkinsBranch || "(sin rama)"}`);
  console.log(`  Job URL : ${cfg.jenkinsUrl}/job/${cfg.jenkinsFolder ? cfg.jenkinsFolder + "/job/" : ""}{repoName}${cfg.jenkinsSuffix || ""}${cfg.jenkinsBranch ? "/job/" + cfg.jenkinsBranch : ""}/api/json`);
  console.log(`  Usuario : ${cfg.jenkinsUser ? "✓ " + cfg.jenkinsUser : "✗ falta — edita jenkins-mcp.config.json"}`);
  console.log(`  Token   : ${cfg.jenkinsToken ? "✓ configurado" : "✗ falta — edita jenkins-mcp.config.json"}`);
  console.log(`\n  Endpoints disponibles:`);
  console.log(`    GET /health`);
  console.log(`    GET /api/jenkins-data?repo=NombreRepo`);
  console.log(`\n  Mantén este proceso corriendo mientras usas el Analyzer.\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n✗ Puerto ${cfg.port} ocupado. Cambia "port" en jenkins-mcp.config.json\n`);
  } else {
    console.error("✗ Error del servidor:", err.message);
  }
  process.exit(1);
});

process.on("SIGINT",  () => { console.log("\n⏹  Jenkins MCP Server detenido."); process.exit(0); });
process.on("SIGTERM", () => { console.log("\n⏹  Jenkins MCP Server detenido."); process.exit(0); });
