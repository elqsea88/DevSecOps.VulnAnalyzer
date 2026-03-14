#!/usr/bin/env node
/**
 * claude-mcp-server.js — Claude AI MCP Local Proxy
 * ──────────────────────────────────────────────────
 * Usa el CLI de Claude instalado (`claude -p`) en lugar de la API directa.
 * No requiere API key — aprovecha la autenticación existente de Claude Code
 * almacenada en ~/.claude/.credentials.json (cuenta Pro/Team).
 *
 * Uso:
 *   node claude-mcp-server.js
 *   npm run claude-mcp
 *
 * ⚠ IMPORTANTE: ejecutar desde una terminal normal (cmd/PowerShell),
 *   NO desde el IDE de Claude Code (el CLI detecta la variable CLAUDECODE
 *   y bloquea la ejecución anidada).
 *
 * Config (claude-mcp.config.json) o variables de entorno:
 *   CLAUDE_MODEL, MCP_CLAUDE_PORT, MCP_CLAUDE_TIMEOUT_MS
 *
 * Endpoints:
 *   GET  /health                → estado del servidor
 *   POST /api/recommend         → recomendación técnica por vulnerabilidad
 *   POST /api/enhance-vuln      → enriquecer contenido DG/DT (Fase 2)
 */

const http  = require("http");
const url   = require("url");
const fs    = require("fs");
const path  = require("path");
const { spawn } = require("child_process");

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, "claude-mcp.config.json");

function loadConfig() {
  let cfg = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); }
    catch (e) { console.warn("⚠  claude-mcp.config.json inválido:", e.message); }
  }
  return {
    model:     process.env.CLAUDE_MODEL          || cfg.model     || "claude-opus-4-6",
    port:      parseInt(process.env.MCP_CLAUDE_PORT || cfg.port   || "3749", 10),
    timeoutMs: parseInt(process.env.MCP_CLAUDE_TIMEOUT_MS || cfg.timeoutMs || "90000", 10),
  };
}

// ── CLAUDE CLI CALL ──────────────────────────────────────────────────────────
function askClaude(prompt, model, timeoutMs) {
  return new Promise((resolve, reject) => {
    const args = [
      "-p", prompt,
      "--model", model || "claude-opus-4-6",
      "--output-format", "text",
      "--no-session-persistence",
    ];

    // Limpiar CLAUDECODE para permitir ejecución anidada si fuera necesario
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE;

    const proc = spawn("claude", args, { env });
    let out = "";
    let err = "";

    proc.stdout.on("data", d => out += d.toString());
    proc.stderr.on("data", d => err += d.toString());

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Timeout (${timeoutMs}ms) — el proceso claude no respondió`));
    }, timeoutMs || 90000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(out.trim());
      } else {
        const errMsg = err.trim() || `claude salió con código ${code}`;
        reject(new Error(errMsg));
      }
    });

    proc.on("error", e => {
      clearTimeout(timer);
      if (e.code === "ENOENT") {
        reject(new Error("Claude CLI no encontrado en PATH. Verifica que 'claude' esté instalado y en el PATH del sistema."));
      } else {
        reject(e);
      }
    });
  });
}

// ── PROMPTS ──────────────────────────────────────────────────────────────────

/** Prompt para recomendación técnica por vulnerabilidad (Fase 4) */
function buildRecommendPrompt(data) {
  const {
    issueId, vulnType, severity, file, line,
    method, description, fix, codeSnippet, projectName,
  } = data;

  return `Eres un experto en seguridad de aplicaciones (AppSec / DevSecOps). Analiza esta vulnerabilidad y proporciona una solución técnica concreta y específica al lenguaje/framework detectado en el código fuente.

## Datos del Issue
- **Proyecto**: ${projectName || "No especificado"}
- **Issue ID**: ${issueId || "No especificado"}
- **Tipo**: ${vulnType || "No especificado"}
- **Severidad**: ${severity || "Alta"}
- **Archivo**: ${file || "No especificado"}
- **Línea reportada**: ${line || "No disponible"}
- **Método de detección**: ${method || "SAST"}

## Descripción del Reporte
${description || "No disponible"}

## Recomendación del Reporte
${fix || "No disponible"}

## Código Fuente (contexto alrededor de la línea reportada)
\`\`\`
${codeSnippet || "No disponible — repositorio local no cargado"}
\`\`\`

Responde con estas secciones exactas en español:

## Análisis del Problema
[Qué está mal y por qué es una vulnerabilidad explotable. Sé técnico y específico.]

## Código Corregido
\`\`\`
[Código corregido específico al lenguaje/framework detectado en el snippet.]
\`\`\`

## Por Qué Mitiga la Vulnerabilidad
[Explicación técnica de cómo la corrección elimina el riesgo. Menciona el vector de ataque bloqueado.]

## Nivel de Confianza: [Alto/Medio/Bajo]
[Justificación breve basada en la disponibilidad de código y contexto]

## Observaciones
[Discrepancias entre el reporte y el código actual, consideraciones de regresión, o pasos adicionales recomendados]`;
}

/** Prompt para enriquecer contenido DG/DT (Fase 2) */
function buildEnhancePrompt(data) {
  const { type, count, fileCount, projectName, mode } = data;
  if (mode === "dt") {
    return `Eres un experto en seguridad de aplicaciones (DevSecOps). Para la vulnerabilidad "${type}" detectada en el proyecto "${projectName}" (${count} issue(s) en ${fileCount} archivo(s)), genera contenido para una Historia de Usuario de seguridad en español.\n\nResponde ÚNICAMENTE con un JSON válido con estas claves (sin markdown, sin explicaciones):\n{\n  "situacionEsperada": "cómo debe funcionar el sistema correctamente después de la corrección",\n  "reglaNegocio": "regla de negocio asociada a esta corrección de seguridad",\n  "depsTecnicas": "dependencias técnicas a actualizar o agregar (una por línea)",\n  "propuestaGeneral": "propuesta general de solución en una o dos oraciones"\n}`;
  }
  return `Eres un experto en seguridad de aplicaciones (DevSecOps). Para la vulnerabilidad "${type}" detectada en el proyecto "${projectName}" (${count} issue(s) en ${fileCount} archivo(s)), genera contenido técnico profesional en español para un documento de Diseño General de Seguridad.\n\nResponde ÚNICAMENTE con un JSON válido con estas 4 claves (sin markdown, sin explicaciones):\n{\n  "impactos": "descripción de impactos con bullets •",\n  "owasp": "clasificación OWASP Top 10 2021 y detalles de cumplimiento",\n  "proceso": "descripción del proceso actual y deficiencias identificadas",\n  "solucion": "pasos numerados de remediación específicos"\n}`;
}

/** Prompt específico por campo del Diseño General */
function buildFieldPrompt(data) {
  const { type, count, fileCount, projectName, field, currentValue } = data;
  const context = `Vulnerabilidad: "${type}" | Proyecto: "${projectName}" | Issues detectados: ${count} | Archivos afectados: ${fileCount}`;
  const current = currentValue ? `\n\nContenido actual (mejora o complementa si es útil):\n${currentValue}` : "";

  const prompts = {
    impactos: `Eres un experto AppSec/DevSecOps. ${context}${current}

Escribe el apartado "Impactos de la Vulnerabilidad" para un Diseño General de Seguridad empresarial en español.
Incluye: consecuencias técnicas (confidencialidad, integridad, disponibilidad), impacto en el negocio, riesgos de datos y cumplimiento normativo.
Formato: bullets con •, máximo 6 puntos concretos y profesionales. Solo el contenido, sin título ni introducción.`,

    owasp: `Eres un experto AppSec/DevSecOps. ${context}${current}

Escribe el apartado "Impactos Asociados a OWASP" para un Diseño General de Seguridad empresarial en español.
Incluye: categoría OWASP Top 10 2021 aplicable (con ID ej. A03:2021), descripción del riesgo según OWASP, cómo se manifiesta en este tipo de aplicación, y referencias a controles CWE/CVSS si aplica.
Formato: bullets con •, preciso y técnico. Solo el contenido, sin título ni introducción.`,

    proceso: `Eres un experto AppSec/DevSecOps. ${context}${current}

Escribe el apartado "Proceso Actual" para un Diseño General de Seguridad empresarial en español.
Describe el estado actual del código/proceso que introduce esta vulnerabilidad: qué hace el sistema actualmente, qué prácticas inseguras existen, qué controles faltan, y cuáles son los puntos de entrada explotables.
Formato: bullets con •, orientado al diagnóstico técnico. Solo el contenido, sin título ni introducción.`,

    solucion: `Eres un experto AppSec/DevSecOps. ${context}${current}

Escribe el apartado "Propuesta de Solución" para un Diseño General de Seguridad empresarial en español.
Incluye: pasos numerados de remediación específicos al tipo de vulnerabilidad, librerías/frameworks/patrones de código recomendados, configuraciones de seguridad necesarias, y criterios de validación para confirmar la corrección.
Formato: pasos numerados (1. 2. 3.), técnico y accionable. Solo el contenido, sin título ni introducción.`,
  };

  return prompts[field] || prompts["impactos"];
}

// ── HTTP HELPERS ─────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

function jsonRes(res, code, body) {
  res.writeHead(code, CORS);
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => raw += c);
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch { reject(new Error("JSON inválido en el cuerpo de la solicitud")); }
    });
    req.on("error", reject);
  });
}

// ── HTTP SERVER ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const cfg     = loadConfig();
  const parsed  = url.parse(req.url, true);
  const { pathname } = parsed;

  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }

  // ── GET /health ─────────────────────────────────────────────────────────────
  if (req.method === "GET" && pathname === "/health") {
    return jsonRes(res, 200, {
      status:     "ok",
      authMethod: "claude-cli",
      model:      cfg.model,
      port:       cfg.port,
      timeoutMs:  cfg.timeoutMs,
    });
  }

  // ── POST /api/recommend ──────────────────────────────────────────────────────
  if (req.method === "POST" && pathname === "/api/recommend") {
    let body;
    try { body = await readBody(req); }
    catch (e) { return jsonRes(res, 400, { ok: false, error: e.message }); }

    const prompt = buildRecommendPrompt(body);
    console.log(`  → /api/recommend | issue: ${(body.issueId||"").substring(0,8)}… | tipo: ${body.vulnType || "N/A"}`);

    try {
      const text = await askClaude(prompt, cfg.model, cfg.timeoutMs);
      console.log(`  ✓ Recomendación generada (${text.length} chars)`);
      return jsonRes(res, 200, { ok: true, recommendation: text });
    } catch (err) {
      console.error("  ✗ Error:", err.message);
      return jsonRes(res, 500, { ok: false, error: err.message });
    }
  }

  // ── POST /api/enhance-vuln ──────────────────────────────────────────────────
  if (req.method === "POST" && pathname === "/api/enhance-vuln") {
    let body;
    try { body = await readBody(req); }
    catch (e) { return jsonRes(res, 400, { ok: false, error: e.message }); }

    const prompt = buildEnhancePrompt(body);
    console.log(`  → /api/enhance-vuln | tipo: ${body.type || "N/A"} | modo: ${body.mode || "dg"}`);

    try {
      const text = await askClaude(prompt, cfg.model, cfg.timeoutMs);
      console.log(`  ✓ Contenido generado (${text.length} chars)`);
      return jsonRes(res, 200, { ok: true, text });
    } catch (err) {
      console.error("  ✗ Error:", err.message);
      return jsonRes(res, 500, { ok: false, error: err.message });
    }
  }

  // ── POST /api/enhance-field ─────────────────────────────────────────────────
  if (req.method === "POST" && pathname === "/api/enhance-field") {
    let body;
    try { body = await readBody(req); }
    catch (e) { return jsonRes(res, 400, { ok: false, error: e.message }); }

    const prompt = buildFieldPrompt(body);
    console.log(`  → /api/enhance-field | tipo: ${body.type || "N/A"} | campo: ${body.field || "N/A"}`);

    try {
      const text = await askClaude(prompt, cfg.model, cfg.timeoutMs);
      console.log(`  ✓ Campo generado (${text.length} chars)`);
      return jsonRes(res, 200, { ok: true, text });
    } catch (err) {
      console.error("  ✗ Error:", err.message);
      return jsonRes(res, 500, { ok: false, error: err.message });
    }
  }

  jsonRes(res, 404, { error: "Endpoint no encontrado" });
});

// ── START ────────────────────────────────────────────────────────────────────
const cfg = loadConfig();
server.listen(cfg.port, "127.0.0.1", () => {
  console.log(`\n✓ Claude MCP Server  →  http://127.0.0.1:${cfg.port}`);
  console.log(`  Auth    : Claude CLI (~/.claude/.credentials.json)`);
  console.log(`  Modelo  : ${cfg.model}`);
  console.log(`  Timeout : ${cfg.timeoutMs}ms`);
  console.log(`\n  Endpoints disponibles:`);
  console.log(`    GET  /health`);
  console.log(`    POST /api/recommend       → recomendación técnica por vulnerabilidad`);
  console.log(`    POST /api/enhance-vuln    → enriquecer contenido DG/DT`);
  console.log(`\n  ⚠ Ejecutar desde terminal normal (cmd/PowerShell), no desde el IDE de Claude Code.\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n✗ Puerto ${cfg.port} ocupado. Cambia "port" en claude-mcp.config.json\n`);
  } else {
    console.error("✗ Error del servidor:", err.message);
  }
  process.exit(1);
});

process.on("SIGINT",  () => { console.log("\n⏹  Claude MCP Server detenido."); process.exit(0); });
process.on("SIGTERM", () => { console.log("\n⏹  Claude MCP Server detenido."); process.exit(0); });
