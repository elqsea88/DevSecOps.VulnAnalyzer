// ── EjecucionPhase ─────────────────────────────────────────────────────────────
// Fase 4: Ejecución y Validación
// Funcionalidades:
//   1. Carga y análisis de PDF de vulnerabilidades (PDF.js)
//   2. Búsqueda de Issue IDs (GUIDs) dentro del PDF
//   3. Extracción estructurada de contexto por issue
//   4. Acceso a repositorio local (File System Access API - Chrome/Edge)
//   5. Visualización de código fuente alrededor de la línea reportada
//   6. Recomendaciones técnicas via Claude API
//   7. Exportación enriquecida (Excel + JSON)

function EjecucionPhase({
  cfg, issues,
  claudeMcpUrl, claudeMcpStatus, checkClaudeMcpStatus,
  TODAY, completePhase, showToast,
  card, infoBox, warnBox, btnP, btnS, codeBox,
  dlAll,
}) {
  const { useState, useEffect, useRef, useCallback } = React;

  // ── State ──────────────────────────────────────────────────────────────────
  const [pdfText,    setPdfText]    = useState("");
  const [pdfName,    setPdfName]    = useState("");
  const [pdfPages,   setPdfPages]   = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [analyzed,   setAnalyzed]   = useState(false);
  const [matches,    setMatches]    = useState({});      // { [issueId]: matchResult }
  const [repoHandle, setRepoHandle] = useState(null);    // FileSystemDirectoryHandle
  const [codeCache,  setCodeCache]  = useState({});      // { [filePath]: { lines[], raw } }
  const [loadingCode,setLoadingCode]= useState({});      // { [filePath]: bool }
  const [recs,       setRecs]       = useState({});      // { [issueId]: string }
  const [loadingRec, setLoadingRec] = useState({});      // { [issueId]: bool }
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab,  setActiveTab]  = useState("pdf");
  const [analyzing,  setAnalyzing]  = useState(false);
  const pdfInputRef = useRef();

  // ── PDF.js worker setup ────────────────────────────────────────────────────
  useEffect(() => {
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedIssue = issues.find(i => i.id === selectedId) || null;
  const selectedMatch = selectedId ? (matches[selectedId] || null) : null;
  const totalFound    = Object.values(matches).filter(m => m.found).length;
  const totalRecs     = Object.keys(recs).length;
  const totalCode     = Object.keys(codeCache).length;
  const SEV_COLOR     = { Critical:"#FF3D71", High:"#FF9F43", Medium:"#FFC107", Low:"#28A745" };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const tabBtn = (t) => ({
    padding: "7px 18px", borderRadius: 6, border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 700,
    background: activeTab === t ? "#00D4FF" : "#0D1828",
    color:      activeTab === t ? "#060B14" : "#4A6080",
    transition: "all 0.15s",
  });

  const secTitle = (icon, label, color = "#00D4FF") => (
    <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 1.5,
      marginBottom: 14, textTransform: "uppercase", fontFamily: "monospace" }}>
      {icon} {label}
    </div>
  );

  // ── Parse PDF context around a found GUID ─────────────────────────────────
  const parsePdfContext = (ctx, issue) => {
    const ex = (patterns) => {
      for (const p of patterns) {
        const m = ctx.match(p);
        if (m && m[1]) return m[1].trim().substring(0, 300);
      }
      return null;
    };
    return {
      file: ex([
        /(?:File|Archivo|Path|Ruta|Location|Source)\s*[:\-]\s*([^\n\r]{4,200})/i,
        /(?:file|path)\s*=\s*"?([^"\n]{4,200})"?/i,
      ]) || issue.filePath,
      line: ex([
        /(?:Line|Línea|Linea|línea|Row)\s*[:\-]?\s*(\d+)/i,
        /\bline\b\s+(\d+)/i,
      ]),
      severity: ex([
        /(?:Severity|Severidad|Priority|Prioridad|Risk)\s*[:\-]\s*(\w+)/i,
        /\b(Critical|Critica|Crítica|High|Alta|Medium|Media|Low|Baja)\b/i,
      ]) || issue.severity,
      vulnType: ex([
        /(?:Issue Type|Vulnerability Type|Type|Tipo|Category|Categoría)\s*[:\-]\s*([^\n\r]{4,150})/i,
        /(?:Vulnerability|Vulnerabilidad)\s*[:\-]\s*([^\n\r]{4,150})/i,
      ]) || issue.issueType,
      description: ex([
        /(?:Description|Descripción|Descripcion|Summary|Resumen|Detail)\s*[:\-]\s*([^\n\r]{4,300})/i,
        /(?:Abstract|Overview)\s*[:\-]\s*([^\n\r]{4,300})/i,
      ]) || issue.description,
      fix: ex([
        /(?:Recommendation|Recomendación|Fix|Solution|Solución|Mitigation|Remediation)\s*[:\-]\s*([^\n\r]{4,300})/i,
        /(?:How to Fix|Cómo corregir|Corrección)\s*[:\-]\s*([^\n\r]{4,300})/i,
      ]),
    };
  };

  // ── Load PDF ──────────────────────────────────────────────────────────────
  const handlePdfFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Solo se aceptan archivos PDF", "warn"); return;
    }
    if (!window.pdfjsLib) {
      showToast("PDF.js no disponible — actualiza la app (npm run build)", "warn"); return;
    }
    setPdfLoading(true);
    setPdfName(file.name);
    setMatches({});
    setAnalyzed(false);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      setPdfPages(pdf.numPages);
      let fullText = "";
      for (let p = 1; p <= pdf.numPages; p++) {
        const page    = await pdf.getPage(p);
        const content = await page.getTextContent();
        // Join items; add space between chunks to prevent GUID splitting
        const pageText = content.items.map(it => it.str).join(" ");
        fullText += pageText + `\n\n===PAGE${p}===\n\n`;
      }
      setPdfText(fullText);
      showToast(`PDF cargado: ${pdf.numPages} páginas ✓`);
    } catch (err) {
      showToast("Error leyendo PDF: " + err.message, "warn");
      setPdfName("");
    } finally {
      setPdfLoading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  // ── Analyze PDF for all issues ────────────────────────────────────────────
  const analyzePdf = () => {
    if (!pdfText) { showToast("Carga un PDF primero", "warn"); return; }
    setAnalyzing(true);
    const newMatches = {};
    const realIssues = issues.filter(i => i.id && !i.id.startsWith("ISSUE-"));

    realIssues.forEach(issue => {
      const id  = issue.id;
      // Exact match
      const idx = pdfText.indexOf(id);
      if (idx !== -1) {
        const start = Math.max(0, idx - 2000);
        const end   = Math.min(pdfText.length, idx + 2000);
        const ctx   = pdfText.substring(start, end);
        newMatches[id] = { found: true, context: ctx, ...parsePdfContext(ctx, issue) };
        return;
      }
      // Try without dashes (some PDFs strip hyphens from GUIDs)
      const flat     = id.replace(/-/g, "");
      const textFlat = pdfText.replace(/-/g, "");
      if (flat.length >= 8 && textFlat.includes(flat)) {
        newMatches[id] = {
          found: true, partial: true,
          context: "(GUID encontrado con formato alternativo — sin guiones)",
          file: issue.filePath, line: null,
          severity: issue.severity, vulnType: issue.issueType,
          description: issue.description, fix: null,
        };
        return;
      }
      newMatches[id] = { found: false };
    });

    // Issues with auto-generated IDs
    issues.filter(i => !i.id || i.id.startsWith("ISSUE-")).forEach(issue => {
      newMatches[issue.id] = { found: false, noGuid: true };
    });

    setMatches(newMatches);
    setAnalyzed(true);
    setAnalyzing(false);
    const found = Object.values(newMatches).filter(m => m.found).length;
    showToast(`Análisis completo: ${found} de ${issues.length} issues encontrados en PDF`);
  };

  // ── Pick local repository ─────────────────────────────────────────────────
  const pickRepo = async () => {
    if (!window.showDirectoryPicker) {
      showToast("File System Access API no disponible — usa Chrome o Edge", "warn");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      setRepoHandle(handle);
      showToast(`Repositorio seleccionado: ${handle.name} ✓`);
    } catch (e) {
      if (e.name !== "AbortError") showToast("Error al seleccionar carpeta", "warn");
    }
  };

  // ── Navigate directory handle by path parts ───────────────────────────────
  const navigatePath = async (rootHandle, pathParts) => {
    let cur = rootHandle;
    for (let i = 0; i < pathParts.length - 1; i++) {
      try { cur = await cur.getDirectoryHandle(pathParts[i]); }
      catch { return null; }
    }
    try {
      const fh   = await cur.getFileHandle(pathParts[pathParts.length - 1]);
      const file = await fh.getFile();
      return await file.text();
    } catch { return null; }
  };

  // ── Read file from repo (tries multiple path prefixes) ────────────────────
  const readRepoFile = async (filePath) => {
    if (!repoHandle) { showToast("Selecciona el repositorio primero", "warn"); return; }
    if (!filePath)   { showToast("Sin ruta de archivo para este issue", "warn"); return; }
    if (codeCache[filePath]) { showToast("Archivo ya cargado ✓"); return; }

    setLoadingCode(p => ({ ...p, [filePath]: true }));
    try {
      const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
      let text = null;
      // Try progressively shorter path prefixes (handles different repo root depths)
      for (let skip = 0; skip <= Math.min(parts.length - 1, 4) && !text; skip++) {
        text = await navigatePath(repoHandle, parts.slice(skip));
      }
      if (text === null) {
        showToast(`No encontrado: ${parts[parts.length - 1]}`, "warn");
        return;
      }
      const lines = text.split("\n");
      setCodeCache(p => ({ ...p, [filePath]: { lines, raw: text } }));
      showToast(`Código cargado: ${parts[parts.length - 1]} (${lines.length} líneas) ✓`);
    } finally {
      setLoadingCode(p => ({ ...p, [filePath]: false }));
    }
  };

  // ── Get code context (±N lines around target line) ────────────────────────
  const getCodeContext = (filePath, lineNum, ctx = 22) => {
    const cached = codeCache[filePath];
    if (!cached) return null;
    const ln    = parseInt(lineNum) || 0;
    const start = ln ? Math.max(0, ln - ctx - 1) : 0;
    const end   = ln ? Math.min(cached.lines.length, ln + ctx) : Math.min(40, cached.lines.length);
    return {
      lines:      cached.lines.slice(start, end).map((l, i) => ({ n: start + i + 1, l })),
      targetLine: ln || null,
    };
  };

  // ── Generate recommendation via Claude MCP ───────────────────────────────
  const generateRec = async (issue) => {
    if (!claudeMcpUrl) { showToast("Claude MCP URL no configurada", "warn"); return; }
    const m       = matches[issue.id] || {};
    const fp      = m.file || issue.filePath;
    const codeCtx = getCodeContext(fp, m.line);
    const snippet = codeCtx
      ? codeCtx.lines.map(r => `${String(r.n).padStart(4)}: ${r.l}`).join("\n")
      : "No disponible — carga el repositorio local para obtener código";

    setLoadingRec(p => ({ ...p, [issue.id]: true }));
    try {
      const base = (claudeMcpUrl || "").replace(/\/$/, "");
      const res  = await fetch(`${base}/api/recommend`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          issueId:     issue.id,
          vulnType:    m.vulnType    || issue.issueType,
          severity:    m.severity   || issue.severity,
          file:        fp,
          line:        m.line,
          method:      issue.method,
          description: m.description || issue.description,
          fix:         m.fix,
          codeSnippet: snippet,
          projectName: cfg.projectName,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRecs(p => ({ ...p, [issue.id]: data.recommendation }));
      showToast("Recomendación IA generada ✓");
    } catch (err) {
      showToast("Error MCP Claude: " + err.message, "warn");
    } finally {
      setLoadingRec(p => ({ ...p, [issue.id]: false }));
    }
  };

  // ── Export: Excel enriquecido ─────────────────────────────────────────────
  const exportExcel = () => {
    const rows = issues.map(issue => {
      const m   = matches[issue.id] || {};
      const rec = recs[issue.id]    || "";
      const fp  = m.file || issue.filePath;
      return {
        "Issue Id":           issue.id,
        "Tipo Vulnerabilidad":m.vulnType    || issue.issueType,
        "Severidad":          m.severity    || issue.severity,
        "Archivo":            fp,
        "Línea Reportada":    m.line        || "",
        "PDF Encontrado":     m.found       ? "Sí" : (m.noGuid ? "Sin GUID" : "No"),
        "Descripción PDF":    m.description || issue.description,
        "Recomendación PDF":  m.fix         || "",
        "Código Disponible":  codeCache[fp] ? "Sí" : "No",
        "Recomendación IA":   rec,
        "Repo":               issue.repo,
        "Release":            issue.release,
        "Método":             issue.method,
        "Horas Est.":         issue.hrs,
      };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Análisis Enriquecido");
    XLSX.writeFile(wb, `ANALISIS_ENRIQUECIDO_${cfg.projectName}_${TODAY}.xlsx`);
    showToast("Excel enriquecido exportado ✓");
  };

  // ── Export: JSON ──────────────────────────────────────────────────────────
  const exportJson = () => {
    const data = issues.map(issue => ({
      ...issue,
      pdfMatch:      matches[issue.id]  || null,
      codeAvailable: !!(codeCache[issue.filePath] || codeCache[matches[issue.id]?.file]),
      recommendation:recs[issue.id]     || null,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `ANALISIS_ENRIQUECIDO_${cfg.projectName}_${TODAY}.json`;
    a.click();
    showToast("JSON exportado ✓");
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
        marginBottom:24, paddingBottom:18, borderBottom:"1px solid #1A2840" }}>
        <div>
          <div style={{ fontSize:10, color:"#00D4FF", letterSpacing:2,
            fontFamily:"monospace", marginBottom:4 }}>FASE 4 — EJECUCIÓN</div>
          <div style={{ fontSize:24, fontWeight:800, color:"#E0EDFF" }}>Ejecución y Validación</div>
          <div style={{ fontSize:11, color:"#4A6080", marginTop:4 }}>
            {issues.length} issues cargados
            {pdfName    && ` · PDF: ${pdfName} (${pdfPages} págs.)`}
            {analyzed   && ` · ${totalFound}/${issues.length} encontrados`}
            {repoHandle && ` · Repo: ${repoHandle.name}`}
            {totalRecs  > 0 && ` · ${totalRecs} recomendaciones IA`}
          </div>
        </div>
        <button style={btnP} onClick={() => completePhase(4)}>Completar Fase 4 →</button>
      </div>

      {/* Stats bar (solo después del análisis) */}
      {analyzed && (
        <div style={{ display:"flex", gap:10, marginBottom:20 }}>
          {[
            { label:"Issues",        value:issues.length, color:"#4A6080" },
            { label:"En PDF",        value:totalFound,    color:"#00D4FF" },
            { label:"Sin coincid.",  value:issues.length - totalFound, color:"#FF9F43" },
            { label:"Con código",    value:totalCode,     color:"#00E676" },
            { label:"Con IA",        value:totalRecs,     color:"#A78BFA" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background:"#0A1020", border:"1px solid #1A2840",
              borderRadius:8, padding:"10px 14px", flex:1, textAlign:"center" }}>
              <div style={{ fontSize:20, fontWeight:800, color }}>{value}</div>
              <div style={{ fontSize:10, color:"#4A6080", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {[
          ["pdf",     "📄 Análisis PDF"],
          ["repo",    "📁 Repositorio"],
          ["results", "📊 Resultados & Exportar"],
        ].map(([t, label]) => (
          <button key={t} style={tabBtn(t)} onClick={() => setActiveTab(t)}>{label}</button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: PDF                                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "pdf" && (
        <div>
          {/* Upload card */}
          <div style={card()}>
            {secTitle("📄", "Reporte PDF de Vulnerabilidades")}
            <div style={infoBox}>
              Carga el PDF generado por tu herramienta SAST/DAST (Fortify, Checkmarx, Veracode, SonarQube, etc.).
              La app buscará cada <strong style={{ color:"#00D4FF" }}>Issue Id</strong> (GUID) del Excel dentro del
              PDF y extraerá tipo, archivo, línea, descripción y recomendación.
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <label style={{ ...btnS, cursor:"pointer" }}>
                {pdfLoading
                  ? <><span className="spin">⟳</span> Cargando…</>
                  : <>{pdfName ? "⬆ Cambiar PDF" : "⬆ Cargar PDF"}</>}
                <input ref={pdfInputRef} type="file" accept=".pdf"
                  onChange={handlePdfFile} style={{ display:"none" }} />
              </label>
              {pdfText && (
                <button style={btnP} onClick={analyzePdf} disabled={analyzing}>
                  {analyzing
                    ? <><span className="spin">⟳</span> Analizando…</>
                    : `🔍 Analizar ${issues.length} Issues`}
                </button>
              )}
              {pdfName && (
                <span style={{ fontSize:11, color:"#4A6080", fontFamily:"monospace" }}>
                  {pdfName} · {pdfPages} páginas · {Math.round(pdfText.length / 1024)} KB texto
                </span>
              )}
            </div>
            {!window.pdfjsLib && (
              <div style={{ ...warnBox, marginTop:12, marginBottom:0 }}>
                ⚠ PDF.js no detectado. Ejecuta <code>npm run build</code> para actualizar la app.
              </div>
            )}
          </div>

          {/* Results table */}
          {analyzed && (
            <div style={card()}>
              {secTitle("📋", `Issues en PDF — ${totalFound} / ${issues.length} encontrados`)}
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr style={{ borderBottom:"2px solid #1A2840" }}>
                      {["Issue ID","Tipo","Archivo","Línea","Severidad","PDF","Código","IA"].map(h => (
                        <th key={h} style={{ padding:"7px 10px", textAlign:"left",
                          color:"#3A5070", fontWeight:700, fontSize:10,
                          letterSpacing:1, fontFamily:"monospace" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map(issue => {
                      const m          = matches[issue.id] || {};
                      const isSelected = selectedId === issue.id;
                      const fp         = m.file || issue.filePath;
                      const hasCode    = !!(codeCache[fp]);
                      const hasRec     = !!recs[issue.id];
                      const sev        = m.severity || issue.severity;
                      return (
                        <tr key={issue.id}
                          onClick={() => setSelectedId(isSelected ? null : issue.id)}
                          style={{ borderBottom:"1px solid #0D1828", cursor:"pointer",
                            background: isSelected ? "#0D1E33" : "transparent",
                            transition:"background 0.1s" }}>
                          <td style={{ padding:"7px 10px", fontFamily:"monospace",
                            color:"#5A7A9A", fontSize:10 }}>
                            {issue.id?.substring(0, 8)}…
                          </td>
                          <td style={{ padding:"7px 10px", color:"#D0DCF0",
                            maxWidth:180, overflow:"hidden",
                            textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {m.vulnType || issue.issueType}
                          </td>
                          <td style={{ padding:"7px 10px", fontFamily:"monospace",
                            color:"#5A7A9A", maxWidth:150, overflow:"hidden",
                            textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                            title={fp}>
                            {(fp || "").split("/").pop()}
                          </td>
                          <td style={{ padding:"7px 10px", fontFamily:"monospace",
                            color:"#5A7A9A" }}>{m.line || "—"}</td>
                          <td style={{ padding:"7px 10px" }}>
                            <span style={{ padding:"2px 7px", borderRadius:4,
                              background:(SEV_COLOR[sev]||"#5A7A9A")+"22",
                              color: SEV_COLOR[sev] || "#5A7A9A",
                              fontSize:10, fontWeight:700 }}>{sev}</span>
                          </td>
                          <td style={{ padding:"7px 10px", textAlign:"center" }}>
                            {m.found ? "✅" : m.noGuid ? "⬜" : "❌"}
                          </td>
                          <td style={{ padding:"7px 10px", textAlign:"center" }}>
                            {hasCode ? "✅" : "—"}
                          </td>
                          <td style={{ padding:"7px 10px", textAlign:"center" }}>
                            {hasRec ? "✅" : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize:10, color:"#2A4060", marginTop:10 }}>
                ✅ Encontrado · ❌ No encontrado · ⬜ Sin GUID real · Haz clic en una fila para ver detalle
              </div>
            </div>
          )}

          {/* Detail panel for selected issue */}
          {selectedIssue && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:4 }}>

              {/* Left: Issue info + PDF context */}
              <div style={card()}>
                {secTitle("🔍", "Detalle del Issue")}
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr",
                  gap:"5px 12px", fontSize:11, marginBottom:12 }}>
                  {[
                    ["Issue ID",   selectedIssue.id],
                    ["Tipo",       selectedMatch?.vulnType   || selectedIssue.issueType],
                    ["Severidad",  selectedMatch?.severity   || selectedIssue.severity],
                    ["Archivo",    selectedMatch?.file       || selectedIssue.filePath],
                    ["Línea",      selectedMatch?.line       || "No disponible"],
                    ["Detección",  selectedIssue.method],
                    ["Horas est.", (selectedIssue.hrs || 0) + " hrs"],
                  ].map(([k, v]) => (
                    <React.Fragment key={k}>
                      <span style={{ color:"#4A6080", fontWeight:600, fontSize:10 }}>{k}:</span>
                      <span style={{ color:"#D0DCF0", wordBreak:"break-all",
                        fontFamily: k==="Issue ID"||k==="Archivo" ? "monospace" : "inherit",
                        fontSize:   k==="Issue ID" ? 10 : 11 }}>{v}</span>
                    </React.Fragment>
                  ))}
                </div>

                {selectedMatch?.description && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, color:"#4A6080", letterSpacing:1,
                      marginBottom:4, fontFamily:"monospace" }}>DESCRIPCIÓN (PDF):</div>
                    <div style={{ background:"#060B14", border:"1px solid #1A2840",
                      borderRadius:6, padding:"8px 12px", fontSize:11,
                      color:"#D0DCF0", lineHeight:1.6 }}>
                      {selectedMatch.description}
                    </div>
                  </div>
                )}

                {selectedMatch?.fix && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, color:"#4A6080", letterSpacing:1,
                      marginBottom:4, fontFamily:"monospace" }}>RECOMENDACIÓN (PDF):</div>
                    <div style={{ background:"#001A0D", border:"1px solid #00E67622",
                      borderRadius:6, padding:"8px 12px", fontSize:11,
                      color:"#00E676", lineHeight:1.6 }}>
                      {selectedMatch.fix}
                    </div>
                  </div>
                )}

                {selectedMatch?.context && (
                  <div>
                    <div style={{ fontSize:10, color:"#4A6080", letterSpacing:1,
                      marginBottom:4, fontFamily:"monospace" }}>CONTEXTO PDF (fragmento):</div>
                    <div style={{ ...codeBox, fontSize:10, maxHeight:140, color:"#4A6080" }}>
                      {selectedMatch.context.substring(0, 900)}…
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Code context + Claude */}
              <div style={card()}>
                {secTitle("💻", "Código & Recomendación IA", "#A78BFA")}

                {/* Code section */}
                {repoHandle ? (
                  <div style={{ marginBottom:12 }}>
                    <button
                      style={{ ...btnS, fontSize:11 }}
                      onClick={() => readRepoFile(selectedMatch?.file || selectedIssue.filePath)}
                      disabled={loadingCode[selectedMatch?.file || selectedIssue.filePath]}>
                      {loadingCode[selectedMatch?.file || selectedIssue.filePath]
                        ? <><span className="spin">⟳</span> Leyendo…</>
                        : "📂 Leer Código Fuente"}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize:11, color:"#4A6080", marginBottom:10 }}>
                    → Ve a la pestaña <strong style={{ color:"#00D4FF" }}>Repositorio</strong> y
                    selecciona la carpeta del repo para leer el código fuente.
                  </div>
                )}

                {/* Code display */}
                {(() => {
                  const fp  = selectedMatch?.file || selectedIssue.filePath;
                  const ctx = getCodeContext(fp, selectedMatch?.line);
                  if (!ctx) return null;
                  return (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:10, color:"#4A6080", letterSpacing:1,
                        marginBottom:4, fontFamily:"monospace" }}>
                        {(fp || "").split("/").pop()}
                        {selectedMatch?.line ? ` — línea ${selectedMatch.line}` : ""}
                      </div>
                      <div style={{ background:"#030810", border:"1px solid #1A2840",
                        borderRadius:6, padding:"8px", fontSize:10, fontFamily:"monospace",
                        lineHeight:1.6, maxHeight:200, overflowY:"auto" }}>
                        {ctx.lines.map(({ n, l }) => (
                          <div key={n} style={{ display:"flex", gap:8,
                            background: n === ctx.targetLine ? "#0D2200" : "transparent" }}>
                            <span style={{ color:"#2A4060", minWidth:32,
                              userSelect:"none", textAlign:"right" }}>{n}</span>
                            <span style={{ color: n === ctx.targetLine ? "#00E676" : "#8AACCC",
                              whiteSpace:"pre" }}>{l}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* MCP status */}
                <div style={{ display:"flex", alignItems:"center", gap:8,
                  marginBottom:8, fontSize:11 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", flexShrink:0,
                    background: claudeMcpStatus==="ok" ? "#00E676"
                      : claudeMcpStatus==="checking" ? "#FFB800" : "#2A4060",
                    boxShadow: claudeMcpStatus==="ok" ? "0 0 6px #00E676"
                      : claudeMcpStatus==="checking" ? "0 0 6px #FFB800" : "none",
                    display:"inline-block" }} />
                  <span style={{ color:"#4A6080" }}>
                    Claude MCP {claudeMcpStatus==="ok" ? "conectado"
                      : claudeMcpStatus==="checking" ? "verificando…" : "desconectado"}
                  </span>
                  <button style={{ ...btnS, padding:"2px 10px", fontSize:10 }}
                    onClick={() => checkClaudeMcpStatus()}>
                    {claudeMcpStatus==="checking" ? <span className="spin">⟳</span> : "Check"}
                  </button>
                </div>
                <button
                  style={{ ...btnP, width:"100%", marginBottom:10,
                    background: loadingRec[selectedIssue.id] ? "#1A2840" : "#7C3AED",
                    color:"#fff" }}
                  onClick={() => generateRec(selectedIssue)}
                  disabled={loadingRec[selectedIssue.id] || claudeMcpStatus !== "ok"}>
                  {loadingRec[selectedIssue.id]
                    ? <><span className="spin">⟳</span> Generando recomendación…</>
                    : "🤖 Generar Recomendación IA"}
                </button>

                {recs[selectedIssue.id] && (
                  <div style={{ background:"#060B14", border:"1px solid #7C3AED44",
                    borderRadius:6, padding:"10px 12px", fontSize:11, color:"#D0DCF0",
                    lineHeight:1.7, maxHeight:320, overflowY:"auto", whiteSpace:"pre-wrap" }}>
                    {recs[selectedIssue.id]}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: REPOSITORIO                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "repo" && (
        <div>
          {/* Opción A — Local */}
          <div style={card()}>
            {secTitle("📁", "Opción A — Repositorio Local (recomendada)")}
            <div style={infoBox}>
              Selecciona la carpeta donde clonaste el repositorio. La app leerá los archivos
              afectados <strong style={{ color:"#00D4FF" }}>directamente en tu equipo</strong>,
              sin subir nada a internet. Requiere <strong>Chrome</strong> o <strong>Edge</strong>
              (File System Access API).
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <button style={btnP} onClick={pickRepo}>📂 Seleccionar Repositorio Local</button>
              {repoHandle && (
                <span style={{ fontSize:12, color:"#00E676", fontFamily:"monospace" }}>
                  ✓ {repoHandle.name}
                </span>
              )}
            </div>
            {!window.showDirectoryPicker && (
              <div style={{ ...warnBox, marginBottom:0 }}>
                ⚠ File System Access API no disponible en este navegador. Usa Chrome o Edge.
              </div>
            )}
          </div>

          {/* File list */}
          {repoHandle && (() => {
            const uniquePaths = [...new Set(
              issues.map(i => i.filePath).filter(Boolean)
            )];
            return (
              <div style={card()}>
                {secTitle("📄", `Archivos Afectados — ${uniquePaths.length} únicos`)}
                {uniquePaths.map(fp => {
                  const cached  = codeCache[fp];
                  const loading = loadingCode[fp];
                  const fname   = fp.split("/").pop();
                  return (
                    <div key={fp} style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"center", padding:"8px 0",
                      borderBottom:"1px solid #0D1828" }}>
                      <div>
                        <span style={{ fontFamily:"monospace", color:"#8AACCC", fontSize:11 }}>
                          {fname}
                        </span>
                        <span style={{ marginLeft:8, color:"#2A4060",
                          fontSize:10, fontFamily:"monospace" }}>
                          {fp}
                        </span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        {cached && (
                          <span style={{ color:"#00E676", fontSize:11 }}>
                            ✓ {cached.lines.length} líneas
                          </span>
                        )}
                        <button
                          style={{ ...btnS, fontSize:10, padding:"4px 12px" }}
                          onClick={() => readRepoFile(fp)}
                          disabled={loading || !!cached}>
                          {loading ? <span className="spin">⟳</span> : cached ? "Cargado" : "Leer"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop:14 }}>
                  <button style={btnP} onClick={async () => {
                    for (const fp of uniquePaths) {
                      if (!codeCache[fp]) await readRepoFile(fp);
                    }
                    showToast("Todos los archivos procesados ✓");
                  }}>
                    📥 Leer Todos los Archivos
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Opción B — Git Remoto */}
          <div style={card()}>
            {secTitle("🌐", "Opción B — Git Remoto (no disponible en modo standalone)", "#4A6080")}
            <div style={{ fontSize:12, color:"#4A6080", lineHeight:1.7 }}>
              La integración directa con GitHub / GitLab / Azure DevOps requiere un servidor proxy
              para manejar restricciones CORS del navegador. Esta funcionalidad no está disponible
              en la versión standalone (single-file HTML).<br/><br/>
              <strong style={{ color:"#D0DCF0" }}>Alternativa recomendada:</strong> clonar el
              repositorio localmente con <code style={{ color:"#00D4FF" }}>git clone</code> y usar
              la Opción A.
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: RESULTADOS & EXPORTAR                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "results" && (
        <div>
          {/* Summary */}
          <div style={card()}>
            {secTitle("📊", "Resumen del Análisis")}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:20 }}>
              {[
                { label:"Issues analizados",   value:issues.length },
                { label:"Encontrados en PDF",   value:totalFound },
                { label:"Sin coincidencia",     value:issues.length - totalFound },
                { label:"Con código fuente",    value:totalCode },
                { label:"Recomendaciones IA",   value:totalRecs },
                { label:"Cobertura PDF",        value:issues.length
                  ? Math.round(totalFound / issues.length * 100) + "%"
                  : "0%" },
              ].map(({ label, value }) => (
                <div key={label} style={{ background:"#060B14", border:"1px solid #1A2840",
                  borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:"#00D4FF" }}>{value}</div>
                  <div style={{ fontSize:10, color:"#4A6080", marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button style={btnP} onClick={exportExcel}>⬇ Exportar Excel Enriquecido</button>
              <button style={btnS} onClick={exportJson}>⬇ Exportar JSON</button>
              <button style={{ ...btnP, background:"transparent",
                border:"1px solid #1A2840", color:"#4A6080" }} onClick={dlAll}>
                ⬇ Re-descargar Documentos Fase 2
              </button>
            </div>
          </div>

          {/* Per-issue results */}
          {issues.length > 0 && (
            <div style={card()}>
              {secTitle("📋", "Resultados por Issue")}
              {issues.map(issue => {
                const m   = matches[issue.id] || {};
                const rec = recs[issue.id];
                const fp  = m.file || issue.filePath;
                return (
                  <div key={issue.id} style={{ borderBottom:"1px solid #0D1828",
                    padding:"12px 0" }}>
                    <div style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"flex-start", gap:8 }}>
                      <div style={{ minWidth:0 }}>
                        <span style={{ fontFamily:"monospace", color:"#5A7A9A", fontSize:10 }}>
                          {issue.id?.substring(0, 16)}…
                        </span>
                        <span style={{ marginLeft:10, fontSize:12,
                          color:"#D0DCF0", fontWeight:600 }}>
                          {m.vulnType || issue.issueType}
                        </span>
                      </div>
                      <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                        {m.found && (
                          <span style={{ padding:"2px 7px", background:"#00D4FF22",
                            color:"#00D4FF", borderRadius:4, fontSize:10 }}>PDF ✓</span>
                        )}
                        {codeCache[fp] && (
                          <span style={{ padding:"2px 7px", background:"#00E67622",
                            color:"#00E676", borderRadius:4, fontSize:10 }}>Código ✓</span>
                        )}
                        {rec && (
                          <span style={{ padding:"2px 7px", background:"#7C3AED22",
                            color:"#A78BFA", borderRadius:4, fontSize:10 }}>IA ✓</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:"#4A6080",
                      marginTop:4, fontFamily:"monospace" }}>
                      {fp} {m.line ? `· Línea ${m.line}` : ""}
                    </div>
                    {rec && (
                      <div style={{ marginTop:8, background:"#060B14",
                        border:"1px solid #7C3AED44", borderRadius:6,
                        padding:"8px 12px", fontSize:11, color:"#D0DCF0",
                        lineHeight:1.6, maxHeight:100, overflowY:"auto",
                        whiteSpace:"pre-wrap" }}>
                        {rec.substring(0, 350)}{rec.length > 350 ? "…" : ""}
                      </div>
                    )}
                    {!analyzed && !rec && (
                      <div style={{ fontSize:11, color:"#2A4060", marginTop:4 }}>
                        → Analiza el PDF y genera recomendación IA para ver resultados
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {issues.length === 0 && (
            <div style={infoBox}>
              No hay issues cargados. Importa el Excel en Fase 0 primero.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
