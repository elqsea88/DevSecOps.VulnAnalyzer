#!/usr/bin/env node
/**
 * claude-mcp-server.js — Claude AI MCP Local Proxy
 * ──────────────────────────────────────────────────
 * Usa el CLI de Claude instalado (`claude`) en lugar de la API directa.
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
 *   CLAUDE_MODEL, MCP_CLAUDE_PORT, MCP_CLAUDE_TIMEOUT_MS,
 *   MCP_REPO_PATH, MCP_GIT_TOKEN
 *
 * Lectura de código fuente — prioridad:
 *   1. Disco local  (repositoryPath en config)
 *   2. GitHub API   (gitToken + repositoryUrl del reporte)
 *   3. Snippet del browser (codeSnippet enviado por la app)
 *
 * Endpoints:
 *   GET  /health                → estado del servidor
 *   POST /api/recommend         → recomendación técnica por vulnerabilidad
 *   POST /api/enhance-vuln      → enriquecer contenido DG/DT (Fase 2)
 *   POST /api/enhance-field     → campo individual de Diseño General
 */

const http   = require("http");
const https  = require("https");
const url    = require("url");
const fs     = require("fs");
const path   = require("path");
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
    model:          process.env.CLAUDE_MODEL          || cfg.model          || "claude-opus-4-6",
    port:           parseInt(process.env.MCP_CLAUDE_PORT || cfg.port        || "3749", 10),
    timeoutMs:      parseInt(process.env.MCP_CLAUDE_TIMEOUT_MS || cfg.timeoutMs || "90000", 10),
    repositoryPath: process.env.MCP_REPO_PATH  || cfg.repositoryPath || "",
    contextLines:   parseInt(cfg.contextLines  || "30", 10),
    gitToken:          process.env.MCP_GIT_TOKEN  || cfg.gitToken          || "",
    gitApiBase:        cfg.gitApiBase             || "https://api.github.com",
    claudePath:        process.env.CLAUDE_PATH    || cfg.claudePath        || "claude",
    // Para redes corporativas con proxy SSL (ej. chubb-claude):
    // Apunta al ca-bundle.pem generado por el instalador corporativo.
    // Si se configura, reemplaza el NODE_TLS_REJECT_UNAUTHORIZED=0 inseguro.
    nodeExtraCaCerts:  process.env.NODE_EXTRA_CA_CERTS || cfg.nodeExtraCaCerts || "",
  };
}

// ── SOURCE FILE READER ───────────────────────────────────────────────────────
/**
 * Intenta resolver `filePath` relativo al `repositoryPath` configurado.
 * Prueba progresivamente más segmentos del path (maneja distintas raíces de repo).
 * Devuelve { found, path, snippet, allLines, targetLine } o { found: false, reason }.
 */
function readSourceSnippet(repositoryPath, filePath, lineNum, contextLines = 30) {
  if (!repositoryPath) return { found: false, reason: "repositoryPath no configurado" };
  if (!filePath)       return { found: false, reason: "filePath vacío" };

  const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
  const ln    = parseInt(lineNum) || 0;

  // Prueba skip=0 (path completo) hasta skip=4 (sólo nombre de archivo)
  for (let skip = 0; skip <= Math.min(parts.length - 1, 4); skip++) {
    const rel      = parts.slice(skip).join(path.sep);
    const fullPath = path.join(repositoryPath, rel);
    if (fs.existsSync(fullPath)) {
      try {
        const raw   = fs.readFileSync(fullPath, "utf8");
        const lines = raw.split("\n");
        const start = ln ? Math.max(0, ln - contextLines - 1) : 0;
        const end   = ln ? Math.min(lines.length, ln + contextLines) : Math.min(60, lines.length);
        const snippet = lines
          .slice(start, end)
          .map((l, i) => {
            const n      = start + i + 1;
            const marker = ln && n === ln ? "►" : " ";
            return `${marker}${String(n).padStart(5)}: ${l}`;
          })
          .join("\n");
        return {
          found:      true,
          resolvedPath: fullPath,
          totalLines: lines.length,
          targetLine: ln || null,
          snippet,
        };
      } catch (e) {
        return { found: false, reason: `Error leyendo archivo: ${e.message}` };
      }
    }
  }
  return { found: false, reason: `Archivo no encontrado bajo: ${repositoryPath}` };
}

// ── REMOTE GIT READER (GitHub / GitLab / Azure DevOps via REST API) ──────────
/**
 * Parsea una URL de repositorio y extrae {provider, owner, repo, ref, filePath}.
 * Soporta:
 *   GitHub  : https://github.com/owner/repo  o  /blob/branch/path
 *   GitLab  : https://gitlab.com/owner/repo
 *   Azure   : https://dev.azure.com/org/project/_git/repo
 */
function parseRepoUrl(repoUrl, filePath) {
  if (!repoUrl) return null;
  try {
    const u    = new URL(repoUrl.replace(/\.git$/, ""));
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.replace(/^\//, "").split("/");

    // GitHub & GitHub Enterprise
    if (host === "github.com" || host.endsWith(".ghe.com")) {
      const blobIdx    = parts.indexOf("blob");
      let ref          = "HEAD";
      let embeddedFile = null;
      if (blobIdx !== -1 && parts.length > blobIdx + 1) {
        ref          = parts[blobIdx + 1];
        embeddedFile = parts.slice(blobIdx + 2).join("/") || null;
      }
      return {
        provider: "github",
        apiBase:  "https://api.github.com",
        owner:    parts[0],
        repo:     parts[1],
        ref,
        filePath: filePath || embeddedFile,
      };
    }

    // GitLab.com o self-hosted
    if (host === "gitlab.com" || host.includes("gitlab")) {
      const blobIdx = parts.indexOf("-");
      const repoIdx = blobIdx > 0 ? blobIdx - 1 : parts.length - 1;
      let ref = "HEAD";
      let embeddedFile = null;
      if (blobIdx !== -1 && parts[blobIdx + 1] === "blob" && parts.length > blobIdx + 2) {
        ref          = parts[blobIdx + 2];
        embeddedFile = parts.slice(blobIdx + 3).join("/") || null;
      }
      return {
        provider: "gitlab",
        apiBase:  `${u.protocol}//${u.host}`,
        owner:    parts.slice(0, repoIdx).join("/"),
        repo:     parts[repoIdx],
        ref,
        filePath: filePath || embeddedFile,
      };
    }

    // Azure DevOps
    if (host === "dev.azure.com" || host.endsWith(".visualstudio.com")) {
      const gitIdx = parts.indexOf("_git");
      if (gitIdx !== -1) {
        return {
          provider: "azure",
          apiBase:  `${u.protocol}//${u.host}`,
          org:      parts[0],
          project:  parts[1],
          repo:     parts[gitIdx + 1],
          ref:      "HEAD",
          filePath,
        };
      }
    }
  } catch (_) { /* URL inválida */ }
  return null;
}

/** GET HTTPS simple — devuelve { status, body } */
function httpsGet(reqUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(reqUrl);
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path:     parsedUrl.pathname + parsedUrl.search,
        method:   "GET",
        headers:  { "User-Agent": "DevSecOps-VulnAnalyzer/1.0", ...headers },
      },
      (res) => {
        let data = "";
        res.on("data", chunk => { data += chunk; });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, body: data });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 300)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(new Error("Timeout al leer archivo remoto")); });
    req.end();
  });
}

/**
 * Lee un archivo de un repositorio remoto vía API REST.
 * Soporta GitHub, GitLab y Azure DevOps.
 * Devuelve { found, snippet, resolvedPath, totalLines, targetLine }
 * o         { found: false, reason }.
 */
async function readFromGit(repoUrl, filePath, lineNum, gitToken, contextLines = 30) {
  const info = parseRepoUrl(repoUrl, filePath);
  if (!info || !info.filePath) {
    return { found: false, reason: `No se pudo parsear la URL del repositorio: ${repoUrl}` };
  }

  const ln      = parseInt(lineNum) || 0;
  const bearer  = gitToken ? { Authorization: `Bearer ${gitToken}` } : {};

  let rawContent;
  try {
    if (info.provider === "github") {
      // Accept: application/vnd.github.v3.raw  → devuelve el contenido crudo directamente
      const apiUrl = `${info.apiBase}/repos/${info.owner}/${info.repo}/contents/${info.filePath}?ref=${info.ref}`;
      console.log(`  [git] GitHub API: GET ${apiUrl}`);
      const { body } = await httpsGet(apiUrl, {
        ...bearer,
        Accept: "application/vnd.github.v3.raw",
      });
      rawContent = body;

    } else if (info.provider === "gitlab") {
      const encodedPath = encodeURIComponent(info.filePath);
      const encodedNs   = encodeURIComponent(`${info.owner}/${info.repo}`);
      const apiUrl = `${info.apiBase}/api/v4/projects/${encodedNs}/repository/files/${encodedPath}/raw?ref=${info.ref}`;
      console.log(`  [git] GitLab API: GET ${apiUrl}`);
      const glHeaders = gitToken ? { "PRIVATE-TOKEN": gitToken } : {};
      const { body } = await httpsGet(apiUrl, glHeaders);
      rawContent = body;

    } else if (info.provider === "azure") {
      const apiUrl = `${info.apiBase}/${info.org}/${info.project}/_apis/git/repositories/${info.repo}/items?path=${encodeURIComponent("/" + info.filePath)}&api-version=7.1`;
      console.log(`  [git] Azure DevOps API: GET ${apiUrl}`);
      const azHeaders = gitToken
        ? { Authorization: `Basic ${Buffer.from(`:${gitToken}`).toString("base64")}` }
        : {};
      const { body } = await httpsGet(apiUrl, azHeaders);
      rawContent = body;

    } else {
      return { found: false, reason: `Proveedor git no reconocido para: ${repoUrl}` };
    }
  } catch (err) {
    return { found: false, reason: `Error API ${info.provider}: ${err.message}` };
  }

  // Construir snippet con la línea vulnerable marcada con ►
  const lines   = rawContent.split("\n");
  const start   = ln ? Math.max(0, ln - contextLines - 1) : 0;
  const end     = ln ? Math.min(lines.length, ln + contextLines) : Math.min(60, lines.length);
  const snippet = lines
    .slice(start, end)
    .map((l, i) => {
      const n      = start + i + 1;
      const marker = ln && n === ln ? "►" : " ";
      return `${marker}${String(n).padStart(5)}: ${l}`;
    })
    .join("\n");

  return {
    found:        true,
    resolvedPath: `${info.provider}:${info.owner || info.org}/${info.repo}/${info.filePath}@${info.ref}`,
    totalLines:   lines.length,
    targetLine:   ln || null,
    snippet,
  };
}

// ── CLAUDE CLI CALL ──────────────────────────────────────────────────────────
function askClaude(prompt, model, timeoutMs, claudePath = "claude", nodeExtraCaCerts = "") {
  return new Promise((resolve, reject) => {
    // El CLI de Claude usa nombres cortos: "sonnet", "opus", "haiku"
    const cliModel = (model || "sonnet")
      .replace(/^claude-opus-4.*/i,   "opus")
      .replace(/^claude-sonnet-4.*/i, "sonnet")
      .replace(/^claude-haiku-4.*/i,  "haiku");

    // Prompt por stdin: evita límites de longitud de arg en Windows y
    // caracteres especiales que rompen el parsing del shell
    const args = ["--print", "--model", cliModel, "--output-format", "text"];

    // Limpiar TODAS las variables de sesión Claude Code para evitar que
    // el CLI detecte ejecución recursiva y se bloquee silenciosamente
    const env = { ...process.env };
    const claudeCodeVars = Object.keys(env).filter(k =>
      /^CLAUDE_?CODE/i.test(k) || k === "CLAUDECODE"
    );
    claudeCodeVars.forEach(k => { delete env[k]; });
    if (claudeCodeVars.length) {
      console.log(`  [askClaude] vars limpiadas: ${claudeCodeVars.join(", ")}`);
    }
    // SSL corporativo: preferir certificado explícito; fallback a bypass inseguro
    if (nodeExtraCaCerts && fs.existsSync(nodeExtraCaCerts)) {
      env.NODE_EXTRA_CA_CERTS = nodeExtraCaCerts;
      delete env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    const proc = spawn(claudePath, args, { env, stdio: ["pipe", "pipe", "pipe"], shell: claudePath.endsWith(".cmd") });

    // Enviar el prompt por stdin y cerrarlo para que el CLI sepa que terminó
    proc.stdin.write(prompt, "utf8");
    proc.stdin.end();

    let out = "";
    let err = "";

    proc.stdout.on("data", d => out += d.toString());
    proc.stderr.on("data", d => { const s = d.toString(); err += s; if (s.trim()) console.warn("  [claude stderr]", s.trim()); });

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
    status, fixGroupId, dateCreated, lastUpdated,
    method, description, fix, codeSnippet, projectName,
    cwe, repositoryUrl,
  } = data;

  const hasDiskCode = !!data._srcFromDisk;
  const hasBrowserCode = !hasDiskCode && !!codeSnippet;
  const hasCode = hasDiskCode || hasBrowserCode;

  // ── PASO 1: instrucción de acceso al código ────────────────────────────────
  let paso1;
  if (hasDiskCode) {
    paso1 = `### PASO 1 — Código fuente (leído automáticamente del repositorio local)

El código fuente real del archivo \`${file}\` fue obtenido directamente desde el disco.
La línea vulnerable (${line}) está marcada con ►.

\`\`\`
${codeSnippet}
\`\`\``;
  } else if (hasBrowserCode) {
    paso1 = `### PASO 1 — Código fuente (proporcionado por el navegador)

El código fuente del archivo \`${file}\` fue cargado manualmente. La línea reportada es ${line || "desconocida"}.

\`\`\`
${codeSnippet}
\`\`\`

> ℹ Para lectura automática desde disco, configura \`repositoryPath\` en claude-mcp.config.json`;
  } else {
    paso1 = `### PASO 1 — Código fuente (no disponible)

> ⚠ No se pudo obtener el código fuente. El repositorio local no está configurado (\`repositoryPath\` vacío en claude-mcp.config.json) y el navegador no proporcionó ningún fragmento.
>
> **Repository URL del reporte:** ${repositoryUrl || "No especificada"}
>
> Si tienes acceso al repositorio remoto, el archivo a revisar es:
> \`${file || "No especificado"}\` — línea **${line || "N/A"}**
>
> Basa tu análisis en el tipo de vulnerabilidad (CWE-${cwe || "?"}) y el contexto disponible en la descripción del reporte. Indica explícitamente que el análisis es teórico por falta de código fuente.`;
  }

  return `Eres un experto en seguridad de aplicaciones (AppSec). Se te proporciona un reporte de vulnerabilidad SAST. Tu tarea es analizar el código fuente y generar una solución definitiva con un diff aplicable.

## DATOS DEL REPORTE DE VULNERABILIDAD

- **Proyecto**: ${projectName || "No especificado"}
- **Issue ID**: ${issueId || "No especificado"}
- **Tipo de Vulnerabilidad**: ${vulnType || "No especificado"}
- **Severity**: ${severity || "No especificada"}
- **Status**: ${status || "No especificado"}
- **Fix Group ID**: ${fixGroupId || "No especificado"}
- **Location**: ${file || "No especificado"}${line ? `:${line}` : ""}
- **Line**: ${line || "No disponible"}
- **Source File**: ${file || "No especificado"}
- **Date Created**: ${dateCreated || "No disponible"}
- **Last Updated**: ${lastUpdated || "No disponible"}
- **CWE**: ${cwe ? `CWE-${cwe}` : "No disponible"}
- **Repository URL**: ${repositoryUrl || "No disponible"}
- **Método de detección**: ${method || "SAST"}

## Descripción del Reporte
${description || "No disponible"}

## Recomendación del Reporte
${fix || "No disponible"}

---

${paso1}

---

### PASO 2 — Analizar la vulnerabilidad

Con base en el código ${hasCode ? "leído" : "descrito en el reporte"}:
1. Identifica el patrón vulnerable exacto en la línea ${line || "reportada"}
2. Explica por qué ese código es vulnerable según **CWE-${cwe || "?"}**
3. Describe el vector de ataque específico para este caso
4. Evalúa el impacto real dado el contexto del archivo

### PASO 3 — Generar la solución definitiva

Proporciona las siguientes secciones exactas:

## Confirmación del Hallazgo
[Confirma si el código en la línea ${line || "indicada"} coincide con la vulnerabilidad reportada. Si hay discrepancia, explícala.]

## Análisis de la Vulnerabilidad
[Patrón vulnerable identificado, vector de ataque concreto, impacto según CWE-${cwe || "?"}. Sé técnico y específico al código real.]

## Solución — Explicación
[Qué cambio se debe hacer y por qué elimina la vulnerabilidad. Menciona el vector de ataque bloqueado y las buenas prácticas del lenguaje/framework usado.]

## Solución — Diff Aplicable
\`\`\`diff
--- a/${file || "archivo"}
+++ b/${file || "archivo"}
@@ -${line || "N"},N +${line || "N"},M @@
 [líneas de contexto sin cambio]
-[línea(s) vulnerable(s) a eliminar]
+[línea(s) corregida(s) a agregar]
 [líneas de contexto sin cambio]
\`\`\`

## Verificación
- [ ] Elimina completamente el vector de ataque CWE-${cwe || "?"}
- [ ] No rompe la funcionalidad existente
- [ ] Sigue las buenas prácticas del lenguaje/framework usado en el archivo
- [ ] No introduce nuevas vulnerabilidades

## Nivel de Confianza: [Alto/Medio/Bajo]
[Justificación: ${hasDiskCode ? "Alto — código real leído del disco" : hasBrowserCode ? "Medio — código proporcionado por el navegador" : "Bajo — sin acceso al código fuente, análisis teórico"}]

## Observaciones
[Discrepancias entre el reporte y el código actual, consideraciones de regresión, pasos adicionales o configuraciones de WAF/linting recomendadas]

---
**RESTRICCIONES**: ${hasCode ? "El diff debe ser directamente aplicable con `git apply` sin modificaciones manuales. No inventes código fuera del contexto leído." : "Indica explícitamente que el diff es estimado por falta de acceso al código fuente."} Responde en el mismo idioma que los comentarios del archivo fuente.`;
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
      status:         "ok",
      authMethod:     "claude-cli",
      model:          cfg.model,
      port:           cfg.port,
      timeoutMs:      cfg.timeoutMs,
      repositoryPath: cfg.repositoryPath || null,
      gitToken:       cfg.gitToken ? "configurado" : null,
    });
  }

  // ── POST /api/recommend ──────────────────────────────────────────────────────
  if (req.method === "POST" && pathname === "/api/recommend") {
    let body;
    try { body = await readBody(req); }
    catch (e) { return jsonRes(res, 400, { ok: false, error: e.message }); }

    // ── Resolución del código fuente: disco → git remoto → snippet del browser ──
    let srcTag = "browser";

    // Prioridad 1: disco local
    const diskResult = readSourceSnippet(cfg.repositoryPath, body.file, body.line, cfg.contextLines);
    if (diskResult.found) {
      console.log(`  [src] disco ✓ ${diskResult.resolvedPath} (${diskResult.totalLines} L, L${diskResult.targetLine})`);
      body   = { ...body, codeSnippet: diskResult.snippet, _srcFromDisk: true, _srcTag: "disco" };
      srcTag = "disco";
    } else {
      if (cfg.repositoryPath) console.log(`  [src] disco ✗ ${diskResult.reason}`);

      // Prioridad 2: git remoto (usa repositoryUrl del reporte + gitToken de config)
      if (body.repositoryUrl) {
        console.log(`  [src] git remoto → ${body.repositoryUrl}`);
        const gitResult = await readFromGit(body.repositoryUrl, body.file, body.line, cfg.gitToken, cfg.contextLines);
        if (gitResult.found) {
          console.log(`  [src] git ✓ ${gitResult.resolvedPath} (${gitResult.totalLines} L, L${gitResult.targetLine})`);
          body   = { ...body, codeSnippet: gitResult.snippet, _srcFromDisk: false, _srcTag: "git" };
          srcTag = "git";
        } else {
          console.log(`  [src] git ✗ ${gitResult.reason}`);
        }
      }
    }
    if (srcTag === "browser" && body.codeSnippet)  console.log(`  [src] snippet del browser`);
    if (srcTag === "browser" && !body.codeSnippet) console.log(`  [src] sin código — análisis teórico`);

    const prompt = buildRecommendPrompt(body);
    console.log(`  → /api/recommend | issue: ${(body.issueId||"").substring(0,8)}… | tipo: ${body.vulnType || "N/A"} | src: ${srcTag}`);

    try {
      const text = await askClaude(prompt, cfg.model, cfg.timeoutMs, cfg.claudePath, cfg.nodeExtraCaCerts);
      console.log(`  ✓ Recomendación generada (${text.length} chars)`);
      return jsonRes(res, 200, { ok: true, recommendation: text, srcTag });
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
      const text = await askClaude(prompt, cfg.model, cfg.timeoutMs, cfg.claudePath, cfg.nodeExtraCaCerts);
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
      const text = await askClaude(prompt, cfg.model, cfg.timeoutMs, cfg.claudePath, cfg.nodeExtraCaCerts);
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
  console.log(`  CLI     : ${cfg.claudePath}`);
  if (cfg.nodeExtraCaCerts) {
    const certOk = fs.existsSync(cfg.nodeExtraCaCerts);
    console.log(`  SSL     : NODE_EXTRA_CA_CERTS → ${cfg.nodeExtraCaCerts} ${certOk ? "✓" : "⚠ ARCHIVO NO ENCONTRADO"}`);
  } else {
    console.log(`  SSL     : NODE_TLS_REJECT_UNAUTHORIZED=0 (bypass — configura "nodeExtraCaCerts" para mejor seguridad)`);
  }
  console.log(`  Auth    : Claude CLI (~/.claude/.credentials.json)`);
  console.log(`  Modelo  : ${cfg.model}`);
  console.log(`  Timeout : ${cfg.timeoutMs}ms`);
  // Código fuente: disco local
  if (cfg.repositoryPath) {
    const repoExists = fs.existsSync(cfg.repositoryPath);
    console.log(`  Repo    : ${cfg.repositoryPath} ${repoExists ? "✓" : "⚠ RUTA NO ENCONTRADA"}`);
    console.log(`  Contexto: ±${cfg.contextLines} líneas alrededor de la línea reportada`);
  } else {
    console.log(`  Repo    : — disco no configurado (agrega "repositoryPath" en claude-mcp.config.json)`);
  }
  // Código fuente: git remoto
  if (cfg.gitToken) {
    console.log(`  Git API : token configurado ✓ (GitHub / GitLab / Azure DevOps)`);
  } else {
    console.log(`  Git API : — sin token (agrega "gitToken" para repos privados; repos públicos no lo necesitan)`);
  }
  console.log(`\n  Prioridad lectura de código: disco → git remoto → snippet del browser`);
  console.log(`\n  Endpoints disponibles:`);
  console.log(`    GET  /health`);
  console.log(`    POST /api/recommend       → recomendación técnica con análisis de código real`);
  console.log(`    POST /api/enhance-vuln    → enriquecer contenido DG/DT`);
  console.log(`    POST /api/enhance-field   → campo individual de Diseño General`);
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
