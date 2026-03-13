/**
 * build.js — DevSecOps Vulnerability Analyzer
 * ─────────────────────────────────────────────
 * Concatenates all src/ files in the correct dependency order
 * and writes the final standalone HTML to dist/DevSecOps_VulnAnalyzer.html
 *
 * Usage:
 *   node build.js            → build once
 *   node build.js --watch    → rebuild on any src/ file change
 */

const fs   = require("fs");
const path = require("path");

// ── OUTPUT ──────────────────────────────────────────────────────────────────
const OUT_DIR  = path.join(__dirname, "dist");
const OUT_FILE = path.join(OUT_DIR, "DevSecOps_VulnAnalyzer.html");

// ── SOURCE FILES IN CONCATENATION ORDER ─────────────────────────────────────
// Order matters: each file can use symbols defined by files listed before it.
const SOURCE_FILES = [
  // 1. Constants & utilities (no dependencies)
  "src/utils/constants.js",
  "src/utils/helpers.js",

  // 2. Data: Knowledge Base, Aliases, Sources
  "src/data/vuln-kb.js",
  "src/data/vuln-aliases.js",    // includes getKB resolver
  "src/data/sources-display.js", // includes getSourcesDisplay

  // 3. Styles (depends on SEV from constants)
  "src/styles/theme.js",

  // 4. Phase feature components (depend on styles + data)
  "src/features/importacion/ImportacionPhase.jsx",
  "src/features/diagnostico/DiagnosticoPhase.jsx",
  "src/features/documentos/DocumentosPhase.jsx",
  "src/features/generic/GenericPhase.jsx",

  // 5. Main App (depends on everything above)
  "src/App.jsx",
];

// ── BUILD ────────────────────────────────────────────────────────────────────
function build() {
  const startTime = Date.now();

  // Read template
  const templatePath = path.join(__dirname, "src/index.html.template");
  const template = fs.readFileSync(templatePath, "utf8");

  // Embed Excel templates as base64 (avoids fetch CORS issues with file://)
  const EXCEL_ASSETS = [
    { varName: "PIPELINE_DASHBOARD_B64", file: "dist/docs/Pipeline_Dashboard_Aplicativos.xlsx" },
  ];
  const excelInlines = EXCEL_ASSETS.map(({ varName, file }) => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`  ⚠  Excel asset missing: ${file}`);
      return `const ${varName} = null;`;
    }
    const b64 = fs.readFileSync(fullPath).toString("base64");
    return `const ${varName} = "${b64}";`;
  }).join("\n");

  // Concatenate all source files
  const bundle = SOURCE_FILES.map(relPath => {
    const fullPath = path.join(__dirname, relPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`  ⚠  Missing: ${relPath}`);
      return `/* MISSING: ${relPath} */`;
    }
    const content = fs.readFileSync(fullPath, "utf8");
    const separator = `\n// ${"─".repeat(66)}\n// ${relPath}\n// ${"─".repeat(66)}\n`;
    return separator + content;
  }).join("\n\n");

  // Inject bundle + embedded assets into template
  const html = template.replace("{{BUNDLE}}", excelInlines + "\n\n" + bundle);

  // Write output
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, html, "utf8");

  const elapsed = Date.now() - startTime;
  const size    = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(`✓ Built  dist/DevSecOps_VulnAnalyzer.html  (${size} KB)  in ${elapsed}ms`);
  console.log(`  Files:  ${SOURCE_FILES.length} source files concatenated`);
}

// ── WATCH MODE ───────────────────────────────────────────────────────────────
function watch() {
  build();
  console.log("\n👁  Watching src/ for changes… (Ctrl+C to stop)\n");

  let debounce = null;
  const srcDir = path.join(__dirname, "src");

  fs.watch(srcDir, { recursive: true }, (event, filename) => {
    if (!filename) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log(`\n↻  Changed: ${filename}`);
      try {
        build();
      } catch (err) {
        console.error("✗ Build error:", err.message);
      }
    }, 120);
  });
}

// ── ENTRY ────────────────────────────────────────────────────────────────────
const isWatch = process.argv.includes("--watch");
try {
  if (isWatch) {
    watch();
  } else {
    build();
  }
} catch (err) {
  console.error("✗ Build failed:", err.message);
  process.exit(1);
}
