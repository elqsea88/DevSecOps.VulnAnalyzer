// ── Helpers XML compartidos ───────────────────────────────────────────────────
function _escXml(text) {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Construye párrafos de contenido: una línea → un <w:p>
function _contentParas(text) {
  const lines = (text || "Información no disponible").trim().split("\n");
  return lines.map(line =>
    `<w:p><w:pPr><w:spacing w:before="0" w:after="80"/></w:pPr>` +
    `<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/>` +
    `<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>` +
    `<w:t xml:space="preserve">${_escXml(line)}</w:t></w:r></w:p>`
  ).join("");
}

// Párrafo con estilo inline
function _wPara(text, opts = {}) {
  const { bold=false, sz="22", color="000000", spaceBefore="0", spaceAfter="160",
          borderTop=false, borderBot=false } = opts;
  const rPr = [
    bold ? "<w:b/>" : "",
    `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`,
    color !== "000000" ? `<w:color w:val="${color}"/>` : "",
    `<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>`,
  ].filter(Boolean).join("");
  const borders = [
    borderTop ? `<w:top w:val="single" w:sz="4" w:space="1" w:color="1A3A5C"/>` : "",
    borderBot ? `<w:bottom w:val="single" w:sz="4" w:space="1" w:color="1A3A5C"/>` : "",
  ].filter(Boolean).join("");
  const pPrParts = [
    `<w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}"/>`,
    borders ? `<w:pBdr>${borders}</w:pBdr>` : "",
  ].filter(Boolean).join("");
  return `<w:p><w:pPr>${pPrParts}</w:pPr><w:r><w:rPr>${rPr}</w:rPr>` +
         `<w:t xml:space="preserve">${_escXml(text)}</w:t></w:r></w:p>`;
}

// Reemplaza el párrafo que contiene `marker` (aunque Word haya fragmentado el
// texto en múltiples <w:r>) con `replacement`. Funciona escaneando el texto
// completo de cada <w:p> concatenando todos sus <w:t> internos.
function _replacePlaceholderPara(xml, marker, replacement) {
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (pBlock) => {
    const texts = [];
    pBlock.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, (_, t) => { texts.push(t); });
    return texts.join("").includes(marker) ? replacement : pBlock;
  });
}

// ── exportAllVulnsInOneDocx ───────────────────────────────────────────────────
// Genera UN ÚNICO .docx con todas las vulnerabilidades detectadas.
// Cada vulnerabilidad tiene su bloque con las 4 secciones etiquetadas.
function exportAllVulnsInOneDocx(stats, docData, cfg, TODAY) {
  if (typeof DISENO_GENERAL_DOCX_B64 === "undefined" || !DISENO_GENERAL_DOCX_B64) {
    alert("Template Word no disponible.\nEjecuta: npm run create-template && npm run build");
    return;
  }
  if (typeof PizZip === "undefined") {
    alert("PizZip no disponible. Verifica la conexión a internet (CDN).");
    return;
  }

  const types = (stats.byType || []);
  if (types.length === 0) { alert("No hay vulnerabilidades cargadas."); return; }

  try {
    // ── Construir bloque XML de una vulnerabilidad ─────────────────────────
    function buildVulnBlock(type, count, ov) {
      const kb    = getKB(type);
      const label = (kb.label && kb.label !== type) ? kb.label : type;
      const issuesTxt = `${count} issue${count !== 1 ? "s" : ""} detectado${count !== 1 ? "s" : ""}`;

      return [
        // Separador superior con nombre de la vulnerabilidad
        _wPara("", { borderTop: true, spaceAfter: "0", spaceBefore: "320" }),
        _wPara(`${label}  —  ${issuesTxt}`, {
          bold: true, sz: "26", color: "1F3864",
          spaceBefore: "0", spaceAfter: "0",
        }),
        _wPara("", { borderBot: true, spaceAfter: "160", spaceBefore: "0" }),

        // Sub-sección: Impactos de la Vulnerabilidad
        _wPara(`Impactos de la Vulnerabilidad: ${label}`, {
          bold: true, sz: "22", color: "2E75B6",
          spaceBefore: "160", spaceAfter: "60",
        }),
        _contentParas(ov.impactos),

        // Sub-sección: Impactos Asociados a OWASP
        _wPara(`Impactos Asociados a OWASP: ${label}`, {
          bold: true, sz: "22", color: "2E75B6",
          spaceBefore: "160", spaceAfter: "60",
        }),
        _contentParas(ov.owasp),

        // Sub-sección: Proceso Actual
        _wPara(`Proceso Actual: ${label}`, {
          bold: true, sz: "22", color: "2E75B6",
          spaceBefore: "160", spaceAfter: "60",
        }),
        _contentParas(ov.proceso),

        // Sub-sección: Propuesta de Solución
        _wPara(`Propuesta de Solución: ${label}`, {
          bold: true, sz: "22", color: "2E75B6",
          spaceBefore: "160", spaceAfter: "60",
        }),
        _contentParas(ov.solucion),
      ].join("");
    }

    // ── Combinar todos los bloques ─────────────────────────────────────────
    const allBlocksXml = types.map(({ type, count }) => {
      const ov = (docData.vulnOv || {})[type] || {};
      return buildVulnBlock(type, count, ov);
    }).join("");

    // ── Cargar template y reemplazar marcadores ────────────────────────────
    const zip = new PizZip(DISENO_GENERAL_DOCX_B64, { base64: true });
    let xml   = zip.files["word/document.xml"].asText();

    xml = xml.replace(/\{PROJECT_NAME\}/g,  () => _escXml(cfg.projectName || ""));
    xml = xml.replace(/\{FECHA\}/g,          () => _escXml(TODAY || ""));
    xml = xml.replace(/\{TOTAL_VULNS\}/g,    () => String(types.length));

    // Reemplazar %%VULNERABILIDADES%% con el XML de todos los bloques
    // (robusto ante la fragmentación de runs que hace Word al guardar)
    xml = _replacePlaceholderPara(xml, "%%VULNERABILIDADES%%", allBlocksXml);

    // ── Generar y descargar ────────────────────────────────────────────────
    zip.file("word/document.xml", xml);
    const buf  = zip.generate({ type: "arraybuffer" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const safeProj = (cfg.projectName || "Proyecto").replace(/[\s/\\:*?"<>|]/g, "_");
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href    = url;
    a.download = `DG_${safeProj}_${TODAY || ""}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error("exportAllVulnsInOneDocx error:", err);
    alert("Error al generar el documento Word:\n" + err.message);
  }
}

// ── exportAllVulnsDTInOneDocx ─────────────────────────────────────────────────
// Genera UN ÚNICO .docx con la tabla de Diseño Técnico para cada vulnerabilidad.
// Tabla de 2 columnas: campo (izquierda) | contenido (derecha).
// Campos: Historia de Usuario, Vulnerabilidad, Proceso Actual, Situación Esperada,
//         Regla de Negocio, Dependencias, Propuesta General, Propuesta de Solución,
//         Repositorios, Alineación.
function exportAllVulnsDTInOneDocx(stats, docData, cfg, repos, TODAY) {
  if (typeof DISENO_TECNICO_DOCX_B64 === "undefined" || !DISENO_TECNICO_DOCX_B64) {
    alert("Template Diseño Técnico no disponible.\nEjecuta: npm run create-template && npm run build");
    return;
  }
  if (typeof PizZip === "undefined") {
    alert("PizZip no disponible. Verifica la conexión a internet (CDN).");
    return;
  }

  const types = (stats.byType || []);
  if (types.length === 0) { alert("No hay vulnerabilidades cargadas."); return; }

  try {
    const LABEL_W   = "2700";
    const CONTENT_W = "6300";
    const HEADER_BG = "0A1828";
    const CONT_BG   = "060B14";

    function tcMar() {
      return `<w:tcMar>` +
        `<w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/>` +
        `<w:bottom w:w="100" w:type="dxa"/><w:right w:w="140" w:type="dxa"/>` +
        `</w:tcMar>`;
    }

    // Párrafos de una celda de contenido (texto multilinea)
    function cellParas(value) {
      const lines = (value || "").split("\n");
      if (lines.every(l => !l.trim())) return `<w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr></w:p>`;
      return lines.map(line =>
        `<w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr>` +
        `<w:r><w:rPr><w:color w:val="C8D8EC"/><w:sz w:val="20"/><w:szCs w:val="20"/>` +
        `<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>` +
        `<w:t xml:space="preserve">${_escXml(line)}</w:t></w:r></w:p>`
      ).join("");
    }

    // Fila de encabezado: dos columnas con fondo oscuro y texto cyan negrita
    function tableHeaderRow(lbl1, lbl2) {
      function hCell(text, width) {
        return `<w:tc>` +
          `<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>` +
          `<w:shd w:val="clear" w:color="auto" w:fill="${HEADER_BG}"/>` +
          tcMar() + `</w:tcPr>` +
          `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>` +
          `<w:r><w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/>` +
          `<w:color w:val="00D4FF"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>` +
          `<w:t xml:space="preserve">${_escXml(text)}</w:t></w:r></w:p></w:tc>`;
      }
      return `<w:tr>` + hCell(lbl1, LABEL_W) + hCell(lbl2, CONTENT_W) + `</w:tr>`;
    }

    // Fila de contenido doble: dos celdas de valor (HU izq. | Alineación der.)
    function tableContentRow(val1, val2) {
      function cCell(value, width) {
        return `<w:tc>` +
          `<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>` +
          `<w:shd w:val="clear" w:color="auto" w:fill="${CONT_BG}"/>` +
          tcMar() + `</w:tcPr>` +
          cellParas(value) + `</w:tc>`;
      }
      return `<w:tr>` + cCell(val1, LABEL_W) + cCell(val2, CONTENT_W) + `</w:tr>`;
    }

    // Fila estándar: label (izq. oscuro) | valor (der.)
    function tableRow(label, value) {
      const labelPara =
        `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>` +
        `<w:r><w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/>` +
        `<w:color w:val="8AACCC"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>` +
        `<w:t xml:space="preserve">${_escXml(label)}</w:t></w:r></w:p>`;

      return (
        `<w:tr>` +
        `<w:tc><w:tcPr><w:tcW w:w="${LABEL_W}" w:type="dxa"/>` +
        `<w:shd w:val="clear" w:color="auto" w:fill="${HEADER_BG}"/>` +
        tcMar() + `</w:tcPr>` + labelPara + `</w:tc>` +
        `<w:tc><w:tcPr><w:tcW w:w="${CONTENT_W}" w:type="dxa"/>` +
        `<w:shd w:val="clear" w:color="auto" w:fill="${CONT_BG}"/>` +
        tcMar() + `</w:tcPr>` + cellParas(value) + `</w:tc>` +
        `</w:tr>`
      );
    }

    // ── Tabla completa para una vulnerabilidad ─────────────────────────────
    function buildDTTable(rows) {
      return (
        `<w:tbl>` +
        `<w:tblPr>` +
        `<w:tblW w:w="9000" w:type="dxa"/>` +
        `<w:tblBorders>` +
        `<w:top    w:val="single" w:sz="4" w:space="0" w:color="1A3A5C"/>` +
        `<w:left   w:val="single" w:sz="4" w:space="0" w:color="1A3A5C"/>` +
        `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="1A3A5C"/>` +
        `<w:right  w:val="single" w:sz="4" w:space="0" w:color="1A3A5C"/>` +
        `<w:insideH w:val="single" w:sz="4" w:space="0" w:color="1A3A5C"/>` +
        `<w:insideV w:val="single" w:sz="4" w:space="0" w:color="1A3A5C"/>` +
        `</w:tblBorders>` +
        `</w:tblPr>` +
        `<w:tblGrid>` +
        `<w:gridCol w:w="2700"/>` +
        `<w:gridCol w:w="6300"/>` +
        `</w:tblGrid>` +
        rows +
        `</w:tbl>` +
        // Párrafo vacío requerido después de una tabla en Word
        `<w:p><w:pPr><w:spacing w:after="240"/></w:pPr></w:p>`
      );
    }

    // ── Bloque completo por vulnerabilidad: título + tabla ─────────────────
    function buildDTVulnBlock(type, count, ov) {
      const kb    = getKB(type);
      const label = (kb.label && kb.label !== type) ? kb.label : type;
      const issuesTxt = `${count} issue${count !== 1 ? "s" : ""} detectado${count !== 1 ? "s" : ""}`;

      const repoUrls = Object.keys(repos || {})
        .map(r => `${(cfg.gitBase || "").replace(/\/$/, "")}/${r}`);
      const solucionWithRepo = [
        ov.solucion || "",
        repoUrls.length > 0 ? "\nRepositorio:\n" + repoUrls.join("\n") : "",
      ].filter(Boolean).join("");

      const rows = [
        tableHeaderRow("Historia de Usuario", "Alineación"),
        tableContentRow(ov.hu || "", ov.alineacion !== undefined ? ov.alineacion : "Chubb"),
        tableRow("Proceso Actual",        ov.proceso            || ""),
        tableRow("Situación Esperada",    ov.situacionEsperada  || ""),
        tableRow("Regla de Negocio",      ov.reglaNegocio       || ""),
        tableRow("Dependencias",          ov.depsTecnicas       || ""),
        tableRow("Propuesta general",     ov.propuestaGeneral   || ""),
        tableRow("Propuesta de solución", solucionWithRepo),
      ].join("");

      return (
        _wPara("", { borderTop: true, spaceAfter: "0", spaceBefore: "320" }) +
        _wPara(`${label}  —  ${issuesTxt}`, {
          bold: true, sz: "26", color: "1F3864",
          spaceBefore: "0", spaceAfter: "0",
        }) +
        _wPara("", { borderBot: true, spaceAfter: "120", spaceBefore: "0" }) +
        buildDTTable(rows)
      );
    }

    // ── Combinar todos los bloques ─────────────────────────────────────────
    const allBlocksXml = types.map(({ type, count }) => {
      const ov = (docData.vulnOv || {})[type] || {};
      return buildDTVulnBlock(type, count, ov);
    }).join("");

    // ── Cargar template y reemplazar marcadores ────────────────────────────
    const zip = new PizZip(DISENO_TECNICO_DOCX_B64, { base64: true });
    let xml   = zip.files["word/document.xml"].asText();

    xml = xml.replace(/\{PROJECT_NAME\}/g, () => _escXml(cfg.projectName || ""));
    xml = xml.replace(/\{FECHA\}/g,         () => _escXml(TODAY || ""));
    xml = xml.replace(/\{TOTAL_VULNS\}/g,   () => String(types.length));

    // Reemplazar %%DT_VULNERABILIDADES%% con el XML de todos los bloques
    // (robusto ante la fragmentación de runs que hace Word al guardar)
    xml = _replacePlaceholderPara(xml, "%%DT_VULNERABILIDADES%%", allBlocksXml);

    // ── Generar y descargar ────────────────────────────────────────────────
    zip.file("word/document.xml", xml);
    const buf  = zip.generate({ type: "arraybuffer" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const safeProj = (cfg.projectName || "Proyecto").replace(/[\s/\\:*?"<>|]/g, "_");
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href    = url;
    a.download = `DT_${safeProj}_${TODAY || ""}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error("exportAllVulnsDTInOneDocx error:", err);
    alert("Error al generar el documento Word DT:\n" + err.message);
  }
}

// ── DocumentosPhase ─────────────────────────────────────────────────────────────────
// Props destructured from App state
function DocumentosPhase({ cfg, issues, cipData, docData, docTab, setDocTab, setVulnF, stats, sonarData, genDG, genDT, genCK, genCIP, dl1, dlAll, completePhase, showSources, setShowSources, getSourcesDisplay, TODAY, card, inp, ta, infoBox, warnBox, codeBox, lbl, btnP, btnS, btnG, sevBadge, claudeKey, setClaudeKey, fetchAI, aiLoading, fetchAI_DT, repos }) {
  return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,paddingBottom:18,borderBottom:"1px solid #1A2840"}}>
                <div>
                  <div style={{fontSize:10,color:"#00D4FF",letterSpacing:2,fontFamily:"monospace",marginBottom:4}}>FASE 2 — DOCUMENTACIÓN</div>
                  <div style={{fontSize:24,fontWeight:800,color:"#E0EDFF"}}>Generación de los 4 Documentos</div>
                  <div style={{fontSize:12,color:"#4A6080",marginTop:4}}>Auto-llenados con datos del reporte. Edita y descarga.</div>
                </div>
                <button style={btnS} onClick={dlAll}>⬇ Descargar 4 Docs</button>
              </div>

              {issues.length===0&&<div style={warnBox}>⚠ Sin datos. Importa el Excel en Fase 0 primero.</div>}
              <div style={infoBox}><strong style={{color:"#00D4FF"}}>Auto-llenado:</strong> Archivos, tipos de vulnerabilidad, repos y estimaciones se extraen directamente de tu Excel.</div>

              {/* Claude API Key — para vulnerabilidades sin KB interna */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 14px",background:"#060B14",border:"1px solid #7C3AED30",borderRadius:8}}>
                <span style={{fontSize:10,color:"#A78BFA",fontFamily:"monospace",whiteSpace:"nowrap"}}>🤖 CLAUDE KEY</span>
                <input type="password" style={{...inp,flex:1,fontSize:11}} value={claudeKey} onChange={e=>setClaudeKey(e.target.value)} placeholder="API Key de Anthropic (para complementar vulnerabilidades sin KB interna)"/>
                <span style={{fontSize:9,color:"#2A4060",fontFamily:"monospace",whiteSpace:"nowrap"}}>Solo local · no se envía</span>
              </div>

              {/* Tabs */}
              <div style={card({padding:0,overflow:"hidden"})}>
                <div style={{display:"flex",borderBottom:"1px solid #1A2840",background:"#060B14"}}>
                  {["📄 Diseño General","📐 Diseño Técnico","✅ Checklist","📦 CIP"].map((t,i)=>(
                    <button key={i} style={{padding:"10px 18px",border:"none",background:docTab===i?"#0F1E35":"transparent",color:docTab===i?"#00D4FF":"#3A5070",cursor:"pointer",fontSize:12,fontWeight:600,borderBottom:docTab===i?"2px solid #00D4FF":"2px solid transparent",transition:"all 0.15s"}} onClick={()=>setDocTab(i)}>{t}</button>
                  ))}
                </div>
                <div style={{padding:20}}>

                  {/* ── DISEÑO GENERAL ── */}
                  {docTab===0&&(
                    <div>
                      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                        <button style={btnG} onClick={()=>dl1("dg")}>⬇ Exportar TXT</button>
                        <button
                          style={{...btnG, color:"#00D4FF", borderColor:"#1A3A5C"}}
                          onClick={()=>exportAllVulnsInOneDocx(stats, docData, cfg, TODAY)}
                          title="Genera un único .docx con todas las vulnerabilidades detectadas"
                        >📄 Exportar Word</button>
                      </div>

                      {/* App description */}
                      <div style={card({background:"#060B14",marginBottom:16})}>
                        <div style={{fontSize:11,fontWeight:700,color:"#00D4FF",letterSpacing:1.5,marginBottom:10,textTransform:"uppercase",fontFamily:"monospace"}}>🏗 Diseño de la Aplicación</div>
                        <label style={lbl}>Descripción del Aplicativo (vacío = auto-generado)</label>
                        <textarea style={{...ta,minHeight:100}} value={docData.appDesc} onChange={e=>setDocData(p=>({...p,appDesc:e.target.value}))} placeholder={`${cfg.projectName} es una aplicación web ASP.NET MVC que gestiona…`}/>
                      </div>

                      {/* Per-vuln sections */}
                      {stats.byType.length===0&&<div style={warnBox}>⚠ Importa el Excel para ver las secciones por vulnerabilidad.</div>}
                      {stats.byType.map(({type,count})=>{
                        const kb=getKB(type), ov=docData.vulnOv[type]||{};
                        const typeFiles=[...new Set(issues.filter(i=>i.issueType===type).map(i=>i.filePath).filter(Boolean))];
                        const typeHrs=issues.filter(i=>i.issueType===type).reduce((a,b)=>a+(parseFloat(b.hrs)||0),0).toFixed(1);
                        return (
                          <div key={type} style={card({background:"#060B14",border:"1px solid #1E3050"})}>
                            {/* Header */}
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <span style={{fontSize:22}}>{kb.icon}</span>
                                <div>
                                  <div style={{fontWeight:700,color:"#E0EDFF",fontSize:13}}>{kb.label !== type ? kb.label : type}</div>
                                  <div style={{fontSize:10,color:"#3A5070",fontFamily:"monospace",marginTop:2}}>{count} issues · {typeFiles.length} archivos únicos · {typeHrs} hrs</div>
                                </div>
                              </div>
                              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                                <span style={sevBadge(issues.find(i=>i.issueType===type)?.severity||"High")}>{SEV[issues.find(i=>i.issueType===type)?.severity]?.label||"ALTA"}</span>
                                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                                  <div style={{display:"flex",gap:6}}>
                                    {kb._isDefault&&(
                                      <button
                                        disabled={!!aiLoading[type]}
                                        onClick={()=>fetchAI(type, count, typeFiles)}
                                        style={{...btnG,fontSize:10,padding:"4px 10px",color:aiLoading[type]?"#A78BFA":"#A78BFA",borderColor:"#7C3AED40",background:aiLoading[type]?"#7C3AED10":"#7C3AED08",opacity:aiLoading[type]?0.6:1,cursor:aiLoading[type]?"not-allowed":"pointer"}}
                                        title="Complementar con IA (Claude) — vulnerabilidad sin KB interna"
                                      >{aiLoading[type]?"⟳ Generando…":"🤖 Consultar IA"}</button>
                                    )}
                                    <button
                                      style={{...btnG,fontSize:10,padding:"4px 10px"}}
                                      onClick={()=>refreshFromKB(type, typeFiles)}
                                      title="Restaurar contenido original desde la base de conocimiento interna"
                                    >↺ Restaurar KB</button>
                                    <button
                                      style={{...btnG,fontSize:10,padding:"4px 10px",color:showSources[type]?"#00D4FF":"#4A6080",borderColor:showSources[type]?"#1A3A5C":"#1A2840"}}
                                      onClick={()=>setShowSources(p=>({...p,[type]:!p[type]}))}
                                    >{showSources[type]?"▲ Ocultar fuentes":"📚 Ver fuentes"}</button>
                                  </div>
                                  <div style={{fontSize:9,color:"#2A4060",fontFamily:"monospace",textAlign:"right"}}>
                                    {kb._isDefault
                                      ? <span style={{color:"#A78BFA"}}>⚠ sin KB interna — usa IA para complementar</span>
                                      : <>base de conocimiento interna · {getSourcesDisplay(type).length} fuentes oficiales</>
                                    }
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Fuentes oficiales — desplegable */}
                            {showSources[type]&&(
                              <div style={{marginBottom:12,padding:"10px 14px",background:"#00D4FF08",border:"1px solid #00D4FF20",borderRadius:7}}>
                                <div style={{fontSize:9,color:"#3A5070",fontFamily:"monospace",letterSpacing:1.5,marginBottom:7}}>FUENTES OFICIALES CONSULTADAS PARA ESTA BASE DE CONOCIMIENTO</div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                                  {getSourcesDisplay(type).map((s,i)=>(
                                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                                      style={{fontSize:10,color:"#00D4FF",background:"#00D4FF10",padding:"3px 9px",borderRadius:4,border:"1px solid #00D4FF30",textDecoration:"none",fontFamily:"monospace"}}>
                                      🔗 {s.label}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 4 fields — always pre-loaded */}
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                              {[
                                {key:"impactos",lbl:"Impactos de la Vulnerabilidad"},
                                {key:"owasp",   lbl:"Impactos Asociados a OWASP"},
                                {key:"proceso", lbl:"Proceso Actual"},
                                {key:"solucion",lbl:"Propuesta de Solución",accent:true},
                              ].map(({key,l2,lbl:fieldLbl,accent})=>(
                                <div key={key}>
                                  <label style={{...lbl,color:accent?"#00D4FF":"#3A5070"}}>{fieldLbl}</label>
                                  <textarea
                                    style={{...ta,minHeight:130,fontSize:11,borderColor:accent?"#1A3A5C":"#1A2840",color:"#D0DCF0"}}
                                    value={ov[key]||""}
                                    onChange={e=>setVulnF(type,key,e.target.value)}
                                  />
                                </div>
                              ))}
                            </div>

                            {/* Files */}
                            <div style={{marginTop:10,padding:"8px 12px",background:"#0A1020",borderRadius:6,border:"1px solid #1A2840"}}>
                              <div style={{fontSize:9,color:"#2A4060",fontFamily:"monospace",marginBottom:5}}>ARCHIVOS IMPACTADOS ({typeFiles.length})</div>
                              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                                {typeFiles.slice(0,8).map((fp,i)=>(
                                  <span key={i} style={{fontSize:10,fontFamily:"monospace",color:"#00D4FF",background:"#060B14",padding:"2px 6px",borderRadius:4,border:"1px solid #1A2840"}}>{fname(fp)}</span>
                                ))}
                                {typeFiles.length>8&&<span style={{fontSize:10,color:"#3A5070"}}>+{typeFiles.length-8} más</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div style={{marginTop:16}}>
                        <div style={{fontSize:10,color:"#3A5070",fontFamily:"monospace",marginBottom:6,letterSpacing:1}}>VISTA PREVIA DEL DOCUMENTO</div>
                        <div style={codeBox}>{genDG()}</div>
                      </div>
                    </div>
                  )}

                  {/* ── DISEÑO TÉCNICO ── */}
                  {docTab===1&&(
                    <div>
                      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                        <button style={btnG} onClick={()=>dl1("dt")}>⬇ Exportar TXT</button>
                        <button
                          style={{...btnG, color:"#00D4FF", borderColor:"#1A3A5C"}}
                          onClick={()=>exportAllVulnsDTInOneDocx(stats, docData, cfg, repos, TODAY)}
                          title="Genera un único .docx con las tablas DT de todas las vulnerabilidades"
                        >📄 Exportar Word</button>
                      </div>
                      {stats.byType.length===0&&<div style={warnBox}>⚠ Importa el Excel para ver las Historias de Usuario.</div>}
                      {stats.byType.map(({type,count})=>{
                        const kb=getKB(type), ov=docData.vulnOv[type]||{};
                        const typeFiles=[...new Set(issues.filter(i=>i.issueType===type).map(i=>i.filePath).filter(Boolean))];
                        const repoUrls=Object.keys(repos||{}).map(r=>`${cfg.gitBase.replace(/\/$/,"")}/${r}`);
                        const hasLittleContent=!ov.situacionEsperada&&!ov.reglaNegocio&&!ov.propuestaGeneral;
                        const rowS={display:"grid",gridTemplateColumns:"180px 1fr",borderBottom:"1px solid #1A2840"};
                        const lblS={padding:"10px 14px",background:"#0A1828",color:"#8AACCC",fontSize:11,fontWeight:700,display:"flex",alignItems:"flex-start",paddingTop:12};
                        const valS={padding:"8px 12px",background:"#060B14"};
                        return (
                          <div key={type} style={{marginBottom:24,border:"1px solid #1E3050",borderRadius:8,overflow:"hidden"}}>
                            {/* Card header */}
                            <div style={{padding:"10px 16px",background:"#0D1F35",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #1A2840"}}>
                              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                                <span style={{fontSize:20}}>{kb.icon}</span>
                                <div>
                                  <div style={{fontWeight:700,color:"#E0EDFF",fontSize:13}}>{kb.label!==type?kb.label:type}</div>
                                  <div style={{fontSize:10,color:"#3A5070",fontFamily:"monospace"}}>{count} issues · {typeFiles.length} archivos</div>
                                </div>
                              </div>
                              {(hasLittleContent||kb._isDefault)&&(
                                <button
                                  disabled={!!aiLoading["dt_"+type]}
                                  onClick={()=>fetchAI_DT(type,count,typeFiles)}
                                  style={{...btnG,fontSize:10,padding:"4px 10px",color:"#A78BFA",borderColor:"#7C3AED40",background:"#7C3AED08",opacity:aiLoading["dt_"+type]?0.6:1,cursor:aiLoading["dt_"+type]?"not-allowed":"pointer"}}
                                >{aiLoading["dt_"+type]?"⟳ Generando…":"🤖 Extender con IA"}</button>
                              )}
                            </div>
                            {/* Table rows */}
                            <div>
                              {/* HU + Alineación */}
                              <div style={rowS}>
                                <div style={lblS}>Historia de Usuario</div>
                                <div style={{...valS,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                                  <input style={{...inp,flex:2,minWidth:180,fontSize:11}} value={ov.hu||""} onChange={e=>setVulnF(type,"hu",e.target.value)} placeholder="VTR329-1343, VTR329-1348"/>
                                  <span style={{color:"#3A5070",fontSize:11,whiteSpace:"nowrap"}}>Alineación:</span>
                                  <input style={{...inp,width:110,fontSize:11}} value={ov.alineacion!==undefined?ov.alineacion:"Chubb"} onChange={e=>setVulnF(type,"alineacion",e.target.value)} placeholder="Chubb"/>
                                </div>
                              </div>
                              {/* Vuln name row */}
                              <div style={rowS}>
                                <div style={{...lblS,color:"#00D4FF"}}>{kb.label!==type?kb.label:type}</div>
                                <div style={{...valS,color:"#8AACCC",fontSize:11,display:"flex",alignItems:"center"}}>{type}</div>
                              </div>
                              {/* Proceso Actual */}
                              <div style={rowS}>
                                <div style={lblS}>Proceso Actual</div>
                                <div style={valS}><textarea style={{...ta,minHeight:80,fontSize:11}} value={ov.proceso||""} onChange={e=>setVulnF(type,"proceso",e.target.value)} placeholder="Proceso actual y deficiencias identificadas…"/></div>
                              </div>
                              {/* Situación Esperada */}
                              <div style={rowS}>
                                <div style={lblS}>Situación Esperada</div>
                                <div style={valS}><textarea style={{...ta,minHeight:80,fontSize:11}} value={ov.situacionEsperada||""} onChange={e=>setVulnF(type,"situacionEsperada",e.target.value)} placeholder="Cómo debe funcionar correctamente el sistema…"/></div>
                              </div>
                              {/* Regla de Negocio */}
                              <div style={rowS}>
                                <div style={lblS}>Regla de Negocio</div>
                                <div style={valS}><textarea style={{...ta,minHeight:70,fontSize:11}} value={ov.reglaNegocio||""} onChange={e=>setVulnF(type,"reglaNegocio",e.target.value)} placeholder="Regla de negocio asociada a esta corrección…"/></div>
                              </div>
                              {/* Dependencias */}
                              <div style={rowS}>
                                <div style={lblS}>Dependencias</div>
                                <div style={valS}><textarea style={{...ta,minHeight:70,fontSize:11}} value={ov.depsTecnicas||""} onChange={e=>setVulnF(type,"depsTecnicas",e.target.value)} placeholder="Dependencias técnicas a actualizar o agregar…"/></div>
                              </div>
                              {/* Propuesta General */}
                              <div style={rowS}>
                                <div style={lblS}>Propuesta general</div>
                                <div style={valS}><textarea style={{...ta,minHeight:80,fontSize:11}} value={ov.propuestaGeneral||""} onChange={e=>setVulnF(type,"propuestaGeneral",e.target.value)} placeholder="Propuesta general de solución…"/></div>
                              </div>
                              {/* Propuesta de Solución + Repositorios */}
                              <div style={{...rowS,borderBottom:"none"}}>
                                <div style={lblS}>Propuesta de solución</div>
                                <div style={valS}>
                                  <textarea style={{...ta,minHeight:100,fontSize:11}} value={ov.solucion||""} onChange={e=>setVulnF(type,"solucion",e.target.value)} placeholder="Pasos detallados de remediación…"/>
                                  {repoUrls.length>0&&(
                                    <div style={{marginTop:8,padding:"8px 10px",background:"#0A1020",borderRadius:6,border:"1px solid #1A2840"}}>
                                      <div style={{fontSize:9,color:"#3A5070",fontFamily:"monospace",marginBottom:5,letterSpacing:1}}>REPOSITORIOS</div>
                                      {repoUrls.map((u,i)=>(
                                        <div key={i}><a href={u} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#00D4FF",fontFamily:"monospace",wordBreak:"break-all"}}>{u}</a></div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div style={{marginTop:16}}>
                        <div style={{fontSize:10,color:"#3A5070",fontFamily:"monospace",marginBottom:6}}>VISTA PREVIA DEL DOCUMENTO</div>
                        <div style={codeBox}>{genDT()}</div>
                      </div>
                    </div>
                  )}

                  {/* ── CHECKLIST ── */}
                  {docTab===2&&(
                    <div>
                      <div style={{display:"flex",gap:8,marginBottom:14}}>
                        <button style={btnG} onClick={()=>dl1("ck")}>⬇ Exportar CSV</button>
                      </div>
                      <div style={infoBox}>31 controles pre-generados: análisis, documentación, aprobación, desarrollo, escaneo, despliegue, post-deploy y OWASP Top 10.</div>
                      <div style={codeBox}>{genCK()}</div>
                    </div>
                  )}

                  {/* ── CIP ── */}
                  {docTab===3&&(
                    <div>
                      <div style={{display:"flex",gap:8,marginBottom:14}}>
                        <button style={btnG} onClick={()=>dl1("cip")}>⬇ Exportar CSV</button>
                      </div>
                      <div style={infoBox}><strong style={{color:"#00D4FF"}}>CIP auto-generado:</strong> {cipData.length} archivos únicos agrupados de {stats.total} issues. Columnas: archivo, tipo, acción, severidad máxima, conteo, horas.</div>
                      <div style={{overflowX:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["#","Archivo","Tipo","Acción","Issues","Hrs","Sev."].map(h=><th key={h} style={{padding:"7px 10px",borderBottom:"1px solid #1A2840",textAlign:"left",fontSize:10,color:"#3A5070",letterSpacing:1,textTransform:"uppercase",fontFamily:"monospace",background:"#0A1020"}}>{h}</th>)}</tr></thead>
                          <tbody>
                            {cipData.map((c,i)=>(
                              <tr key={i}>
                                <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E",color:"#3A5070"}}>{i+1}</td>
                                <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E"}}>
                                  <div style={{fontFamily:"monospace",fontSize:11,color:"#00D4FF"}}>{c.fileName}</div>
                                  <div style={{fontSize:10,color:"#2A4060",maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={c.filePath}>{c.filePath}</div>
                                </td>
                                <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E",color:"#8AACCC",fontSize:11}}>{c.types.split(";")[0]}</td>
                                <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E"}}><span style={methBadge(c.action==="MODIFICAR"?"pipeline":"manual")}>{c.action}</span></td>
                                <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E",textAlign:"center",fontWeight:700,color:"#FF4560"}}>{c.count}</td>
                                <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E",textAlign:"center",color:"#8AACCC"}}>{c.hrs}</td>
                                <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E"}}><span style={sevBadge(c.severity)}>{SEV[c.severity]?.label}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
  );
}
