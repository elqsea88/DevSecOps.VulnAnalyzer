// ── APP COMPONENT ───────────────────────────────────────────────────────────
// Assembles all phases. State, handlers, and generators defined inline.

const { useState, useEffect, useCallback, useMemo, useRef } = React;

function App(){
  const [darkMode,setDarkMode] = useState(true);
  const [phase,setPhase]   = useState(0);
  const [done,setDone]     = useState(new Set());
  const [issues,setIssues] = useState([]);
  const [repos,setRepos]   = useState({});
  const [cfg,setCfg]       = useState({
    jenkinsBase:"https://jenkins.chubbdigital.com/job/mexico-it-chubbnet/job/",
    gitBase:"https://nausp-aapp0001.aceins.com/mexico-it-chubbnet/",
    sonarBase:"https://sonar.chubb.com",
    sonarProjectKey:"NAGH-APM0001304-mexico-it-chubbnet-",
    projectName:"E001VulnerabilityRemediationReg", responsable:"", ticket:"SEC-"+TODAY,
  });
  const [sonarData,setSonarData] = useState({});  // { repoName: { qg, secIssues, secRating, relIssues, relRating, maintIssues, maintRating, coverage, duplications, hotspots, hotspotsStatus, loc, version, branch } }
  const setSonarF = (repo,field,val) => setSonarData(p=>({...p,[repo]:{...(p[repo]||{}), [field]:val}}));
  const setRepoF  = (repo,field,val) => setRepos(p=>({...p,[repo]:{...(p[repo]||{}), [field]:val}}));

  const [dashboardBuffer, setDashboardBuffer] = useState(null); // ArrayBuffer del Excel cargado por usuario
  const [dashboardWbName, setDashboardWbName] = useState("");   // nombre del archivo cargado

  const loadDashboardExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setDashboardBuffer(ev.target.result); // guardar ArrayBuffer sin parsear
      setDashboardWbName(file.name);
      showToast(`Excel cargado: ${file.name} ✓`);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const MCP_DEFAULT = "http://127.0.0.1:3747";
  const [mcpUrl,setMcpUrl]     = useState(MCP_DEFAULT);
  const [mcpStatus,setMcpStatus] = useState(null); // null | "ok" | "error" | "checking"

  const JENKINS_MCP_DEFAULT = "http://127.0.0.1:3748";
  const [jenkinsMcpUrl,setJenkinsMcpUrl]         = useState(JENKINS_MCP_DEFAULT);
  const [jenkinsMcpStatus,setJenkinsMcpStatus]   = useState(null);

  const CLAUDE_MCP_DEFAULT = "http://127.0.0.1:3749";
  const [claudeMcpUrl,setClaudeMcpUrl]           = useState(CLAUDE_MCP_DEFAULT);
  const [claudeMcpStatus,setClaudeMcpStatus]     = useState(null); // null | "ok" | "error" | "checking"
  const [jenkinsBranch,setJenkinsBranch]         = useState(""); // rama por defecto del config del MCP

  const checkMcpStatus = async (baseUrl) => {
    const url = (baseUrl||mcpUrl).replace(/\/$/,"");
    setMcpStatus("checking");
    try {
      const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) });
      const d = await r.json();
      setMcpStatus(d.status === "ok" ? "ok" : "error");
      if (d.status === "ok") showToast("MCP Server conectado ✓");
      else showToast("MCP Server respondió con error","warn");
    } catch {
      setMcpStatus("error");
      showToast("MCP Server no disponible — ejecuta: node sonar-mcp-server.js","warn");
    }
  };

  const checkJenkinsMcpStatus = async (baseUrl) => {
    const url = (baseUrl||jenkinsMcpUrl).replace(/\/$/,"");
    setJenkinsMcpStatus("checking");
    try {
      const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) });
      const d = await r.json();
      setJenkinsMcpStatus(d.status==="ok"?"ok":"error");
      if (d.status==="ok") {
        if (d.jenkinsBranch) setJenkinsBranch(d.jenkinsBranch);
        showToast("Jenkins MCP conectado ✓");
      } else showToast("Jenkins MCP respondió con error","warn");
    } catch {
      setJenkinsMcpStatus("error");
      showToast("Jenkins MCP no disponible — ejecuta: node jenkins-mcp-server.js","warn");
    }
  };

  const checkClaudeMcpStatus = async (baseUrl) => {
    const url = (baseUrl||claudeMcpUrl).replace(/\/$/,"");
    setClaudeMcpStatus("checking");
    try {
      const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) });
      const d = await r.json();
      setClaudeMcpStatus(d.status==="ok"?"ok":"error");
      if (d.status==="ok") {
        showToast(`Claude MCP conectado ✓ (${d.authMethod||"cli"} · ${d.model})`);
      } else showToast("Claude MCP respondió con error","warn");
    } catch {
      setClaudeMcpStatus("error");
      showToast("Claude MCP no disponible — ejecuta: node claude-mcp-server.js","warn");
    }
  };

  const fetchSonar = async (repoName, branch) => {
    const url = mcpUrl.replace(/\/$/,"");
    const br  = branch || cfg.ticket || "";
    setSonarF(repoName,"_fetching",true);
    setSonarF(repoName,"_fetchError",null);
    try {
      const params = new URLSearchParams({ branch: br, projectKey: cfg.sonarProjectKey + (repoName || cfg.projectName) });
      const res = await fetch(`${url}/api/sonar-data?${params}`, { signal: AbortSignal.timeout(20000) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSonarData(p=>({...p,[repoName]:{ ...(p[repoName]||{}), ...json.data, _fetching:false, _fetchError:null }}));
      showToast("SonarQube: datos importados ✓");
    } catch(err) {
      setSonarF(repoName,"_fetching",false);
      setSonarF(repoName,"_fetchError",err.message);
      showToast("Error MCP: "+err.message,"warn");
    }
  };

  const getSonarUrl = (repoName, branch) => {
    const base = cfg.sonarBase.replace(/\/$/,"");
    const key  = cfg.sonarProjectKey + (repoName || cfg.projectName);
    const br   = branch || cfg.ticket || "";
    return `${base}/dashboard?branch=${encodeURIComponent(br)}&id=${encodeURIComponent(key)}&codeScope=overall`;
  };
  // apiKey eliminado — token movido a sonar-mcp-server.js
  const [aiLoading,setAiLoading] = useState({});

  const fetchAI = async (type, count, typeFiles) => {
    if (claudeMcpStatus !== "ok") { showToast("Claude MCP no conectado — inicia el servidor primero","warn"); return; }
    setAiLoading(p=>({...p,[type]:true}));
    try {
      const res = await fetch(`${claudeMcpUrl}/api/enhance-vuln`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ type, count, fileCount: typeFiles.length, projectName: cfg.projectName, mode: "dg" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const jsonMatch = data.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Respuesta sin JSON válido");
      const parsed = JSON.parse(jsonMatch[0]);
      setDocData(p=>({...p, vulnOv:{...p.vulnOv, [type]:{
        ...(p.vulnOv[type]||{}),
        impactos: parsed.impactos||p.vulnOv[type]?.impactos||"",
        owasp:    parsed.owasp   ||p.vulnOv[type]?.owasp||"",
        proceso:  parsed.proceso ||p.vulnOv[type]?.proceso||"",
        solucion: parsed.solucion||p.vulnOv[type]?.solucion||"",
      }}}));
      showToast(`IA: contenido generado para "${type}" ✓`);
    } catch(err) {
      showToast("Error IA: "+err.message,"warn");
    } finally {
      setAiLoading(p=>({...p,[type]:false}));
    }
  };

  const fetchAI_DT = async (type, count, typeFiles) => {
    if (claudeMcpStatus !== "ok") { showToast("Claude MCP no conectado — inicia el servidor primero","warn"); return; }
    setAiLoading(p=>({...p,["dt_"+type]:true}));
    try {
      const res = await fetch(`${claudeMcpUrl}/api/enhance-vuln`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ type, count, fileCount: typeFiles.length, projectName: cfg.projectName, mode: "dt" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const jsonMatch = data.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Respuesta sin JSON válido");
      const parsed = JSON.parse(jsonMatch[0]);
      setDocData(p=>({...p, vulnOv:{...p.vulnOv, [type]:{
        ...(p.vulnOv[type]||{}),
        situacionEsperada: parsed.situacionEsperada||p.vulnOv[type]?.situacionEsperada||"",
        reglaNegocio:      parsed.reglaNegocio     ||p.vulnOv[type]?.reglaNegocio||"",
        depsTecnicas:      parsed.depsTecnicas      ||p.vulnOv[type]?.depsTecnicas||"",
        propuestaGeneral:  parsed.propuestaGeneral  ||p.vulnOv[type]?.propuestaGeneral||"",
      }}}));
      showToast(`IA: Historia de Usuario generada para "${type}" ✓`);
    } catch(err) {
      showToast("Error IA: "+err.message,"warn");
    } finally {
      setAiLoading(p=>({...p,["dt_"+type]:false}));
    }
  };

  const fetchAI_field = async (type, field, count, typeFiles, currentValue) => {
    console.log(`[fetchAI_field] llamado → type="${type}" field="${field}" mcpStatus="${claudeMcpStatus}" mcpUrl="${claudeMcpUrl}"`);
    if (claudeMcpStatus !== "ok") {
      console.warn("[fetchAI_field] MCP no conectado, status:", claudeMcpStatus);
      showToast("Claude MCP no conectado — inicia el servidor primero","warn");
      return;
    }
    const key = `${type}__${field}`;
    setAiLoading(p=>({...p,[key]:true}));
    try {
      const payload = { type, field, count, fileCount: typeFiles.length, projectName: cfg.projectName, currentValue };
      console.log("[fetchAI_field] POST /api/enhance-field →", payload);
      const res = await fetch(`${claudeMcpUrl}/api/enhance-field`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload),
      });
      console.log("[fetchAI_field] HTTP status:", res.status);
      const data = await res.json();
      console.log("[fetchAI_field] respuesta:", data);
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDocData(p=>({...p, vulnOv:{...p.vulnOv, [type]:{...(p.vulnOv[type]||{}), [field]: data.text}}}));
      showToast(`IA: "${field}" generado ✓`);
    } catch(err) {
      console.error("[fetchAI_field] error:", err);
      showToast("Error IA: "+err.message,"warn");
    } finally {
      setAiLoading(p=>({...p,[key]:false}));
    }
  };

  const [docTab,setDocTab] = useState(0);
  const [docData,setDocData]= useState({appDesc:"",vulnOv:{},patron:"",clases:"",deps:""});
  const [toast,setToast]   = useState(null);
  const [showSources,setShowSources] = useState({});
  // Auto-check Claude MCP on mount
  useEffect(() => { checkClaudeMcpStatus(); }, []);

  const fileRef            = useRef();

  const setVulnF = (t,f,v) => setDocData(p=>({...p,vulnOv:{...p.vulnOv,[t]:{...(p.vulnOv[t]||{}),[f]:v}}}));
  const showToast= (msg,type="ok")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3200); };

  // ── AUTO-POPULATE vulnOv from KB when issues are loaded ──────────────────────
  const buildVulnOv = (mapped) => {
    const types = [...new Set(mapped.map(i=>i.issueType).filter(Boolean))];
    const ov = {};
    types.forEach(type => {
      const kb = getKB(type);
      const tf = [...new Set(mapped.filter(i=>i.issueType===type).map(i=>fpath(i.fileUri||"")).filter(Boolean))];
      const deps = kb.depsTecnicas || "";
      ov[type] = {
        impactos:          kb.impactos || "",
        owasp:             kb.owasp || "",
        proceso:           kb.proceso || "",
        solucion:          (kb.solucion||"").replace(/\$\{0\}/g, tf.length),
        hu:                "",
        alineacion:        "Chubb",
        situacionEsperada: kb.situacionEsperada || "",
        reglaNegocio:      kb.reglaNegocio || "",
        depsTecnicas:      deps,
        propuestaGeneral:  kb.propuestaGeneral || "",
      };
    });
    return ov;
  };

  // ── FUENTES OFICIALES POR TIPO DE VULNERABILIDAD ────────────────────────────
  // ── REFRESCAR DESDE BASE DE CONOCIMIENTO INTERNA ────────────────────────────
  const refreshFromKB = (type, typeFiles) => {
    const kb = getKB(type);
    setVulnF(type,"impactos",        kb.impactos || "");
    setVulnF(type,"owasp",           kb.owasp || "");
    setVulnF(type,"proceso",         kb.proceso || "");
    setVulnF(type,"solucion",        (kb.solucion||"").replace(/\$\{0\}/g, typeFiles.length));
    setVulnF(type,"situacionEsperada", kb.situacionEsperada || "");
    setVulnF(type,"reglaNegocio",    kb.reglaNegocio || "");
    setVulnF(type,"depsTecnicas",    kb.depsTecnicas || "");
    setVulnF(type,"propuestaGeneral",kb.propuestaGeneral || "");
    showToast(`✓ Campos restaurados desde base de conocimiento — ${TYPE_MAP[type]||type}`);
  };

  // ── EXCEL PARSE ─────────────────────────────────────────────────────────────
  const handleFile = useCallback(e=>{
    const file=e.target.files[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const wb=XLSX.read(ev.target.result,{type:"binary"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const raw=XLSX.utils.sheet_to_json(ws,{defval:""});
      const mapped=raw.map((r,i)=>({
        id:r["Issue Id"]||r["IssueId"]||`ISSUE-${i}`,
        severity:r["Severity"]||"Medium",
        issueType:r["Issue Type Name"]||r["IssueTypeName"]||"",
        threatClass:r["Threat Class"]||"",
        repo:r["Repo"]||"",
        method:r["Discovery Method"]||"",
        description:r["Description"]||"",
        comment:r["Comentario"]||"",
        fileUri:r["Git Source File Uri"]||"",
        hrs:r["hrs"]||0,
        release:r["Release"]||"",
        filePath:fpath(r["Git Source File Uri"]||""),
        fileName:fname(r["Git Source File Uri"]||""),
      }));
      setIssues(mapped);
      // ✅ Auto-populate all 4 fields from KB immediately
      const vulnOv = buildVulnOv(mapped);
      setDocData(p=>({...p, vulnOv}));
      const byRepo=groupBy(mapped,"repo");
      const rm={};
      Object.keys(byRepo).forEach(r=>{ rm[r]={name:r,issues:byRepo[r],method:"unknown",gitCheckStatus:"unchecked",jenkinsCheckStatus:"unchecked",debtStatus:"unchecked"}; });
      setRepos(rm);
      showToast(`${mapped.length} vulnerabilidades cargadas · campos pre-llenados ✓`);
      setDone(p=>new Set([...p,0]));
    };
    reader.readAsBinaryString(file);
  },[]);

  // ── PIPELINE DUAL CHECK (Jenkins MCP) ───────────────────────────────────────
  const checkRepo = useCallback(async repoName=>{
    const gitUrl=cfg.gitBase.replace(/\/$/,"")+"/"+repoName;
    const jenkinsUrl=cfg.jenkinsBase.replace(/\/$/,"")+"/"+repoName;
    setRepos(p=>({...p,[repoName]:{...p[repoName],gitCheckStatus:"skipped",gitCheckMsg:"No aplica — verificación solo vía Jenkins MCP",jenkinsCheckStatus:"checking",jenkinsCheckMsg:"Verificando job en Jenkins…",debtStatus:"pending",method:"unknown",gitUrl,jenkinsUrl}}));
    try {
      const base=jenkinsMcpUrl.replace(/\/$/,"");
      const res=await fetch(`${base}/api/jenkins-data?repo=${encodeURIComponent(repoName)}`,{signal:AbortSignal.timeout(20000)});
      const j=await res.json();
      if(!j.ok) throw new Error(j.error||`HTTP ${res.status}`);
      const {jobExists,lastBuild,lastBuildStatus,buildUrl,lastDCL,method}=j.data;
      setRepos(p=>({...p,[repoName]:{...p[repoName],
        jenkinsCheckStatus:jobExists?"ok":"error",
        jenkinsCheckMsg:jobExists?`Job activo ✓ — Último build: ${lastBuild} (${lastBuildStatus})${lastDCL?" — "+lastDCL:""}`:"Job ✗ no encontrado en Jenkins",
        hasJF:jobExists,jobOk:jobExists,lastBuild,lastBuildStatus,buildUrl,lastDCL:lastDCL||null,method,debtStatus:"pending",
      }}));
      showToast(`✓ ${repoName} — ${method==="pipeline"?"Pipeline CI/CD":"Manual"}${lastDCL?" | "+lastDCL:""}`);
    } catch(err){
      setRepos(p=>({...p,[repoName]:{...p[repoName],
        gitCheckStatus:"error",gitCheckMsg:`Error Jenkins MCP: ${err.message}`,
        jenkinsCheckStatus:"error",jenkinsCheckMsg:"No se pudo conectar al Jenkins MCP",
        method:"unknown",debtStatus:"pending",
      }}));
      showToast(`✗ ${repoName}: ${err.message}`,"warn");
    }
  },[cfg,jenkinsMcpUrl]);

  const checkAll = () => Object.keys(repos).forEach((r,i) => setTimeout(() => {
    checkRepo(r);
    fetchSonar(r, sonarData[r]?.branch || jenkinsBranch || "");
  }, i * 900));

  // ── EXPORT PIPELINE DASHBOARD ─────────────────────────────────────────────
  // Usa xlsx-populate para preservar 100% estilos, fórmulas y formato del template
  const exportPipelineDashboard = async () => {
    const today = new Date().toISOString().split("T")[0];
    const ratingToNivel   = r => ({A:"Baja",B:"Baja",C:"Media",D:"Alta",E:"Alta"}[r]||"Sin Deuda");
    const ratingToImpacto = r => ({A:"Bajo",B:"Bajo",C:"Medio",D:"Alto",E:"Crítico"}[r]||"Bajo");
    const impactoOrder    = ["Bajo","Medio","Alto","Crítico"];

    try {
      if (typeof XlsxPopulate === "undefined")
        throw new Error("xlsx-populate no disponible — verifica conexión a internet");

      // 1. Obtener buffer: archivo cargado por el usuario o template embebido en base64
      let buffer;
      if (dashboardBuffer) {
        buffer = dashboardBuffer;
      } else {
        if (typeof PIPELINE_DASHBOARD_B64 === "undefined" || !PIPELINE_DASHBOARD_B64)
          throw new Error("Template no embebido — ejecuta npm run build");
        const bStr = atob(PIPELINE_DASHBOARD_B64);
        const bytes = new Uint8Array(bStr.length);
        for (let i = 0; i < bStr.length; i++) bytes[i] = bStr.charCodeAt(i);
        buffer = bytes.buffer;
      }

      // 2. Cargar workbook — xlsx-populate NO toca estilos ni fórmulas al escribir celdas
      const workbook = await XlsxPopulate.fromDataAsync(buffer);

      // Helper: obtener hoja por nombre exacto o coincidencia parcial
      const getSheet = (wb, name) => {
        try { const s = wb.sheet(name); if (s) return s; } catch(_) {}
        return wb.sheets().find(s => s.name().toLowerCase().includes(name.toLowerCase().slice(0,5)));
      };

      // Helper: primera fila vacía en columna colNum (1-indexed) desde startRow
      const firstEmptyRow = (sheet, startRow, colNum) => {
        let r = startRow;
        while (sheet.row(r).cell(colNum).value() != null &&
               sheet.row(r).cell(colNum).value() !== "") r++;
        return r;
      };

      // Helper: mapa { repoName → rowIndex } de filas ya existentes en el Excel.
      // Permite UPSERT: actualizar fila si el repo ya estaba, agregar si es nuevo.
      const buildExistingMap = (sheet, startRow, colNum) => {
        const map = {};
        let r = startRow;
        while (true) {
          const val = sheet.row(r).cell(colNum).value();
          if (val === undefined || val === null || val === "") break;
          map[String(val).trim()] = r;
          r++;
        }
        return map;
      };

      // ── Pestaña Pipeline ──────────────────────────────────────────────────
      const pipeSheet = getSheet(workbook, "Pipeline");
      if (!pipeSheet) throw new Error(`Hoja "Pipeline" no encontrada. Hojas: ${workbook.sheets().map(s=>s.name()).join(", ")}`);

      const existingPipe = buildExistingMap(pipeSheet, 4, 2); // B = col 2
      let nextPipeRow    = firstEmptyRow(pipeSheet, 4, 2);

      const pipeRows = Object.values(repos).map(repo => {
        const sd = sonarData[repo.name] || {};
        const ratings = [sd.secRating,sd.relRating,sd.maintRating].filter(Boolean);
        const worstR  = ratings.sort((a,b)=>"EDCBA".indexOf(a)-"EDCBA".indexOf(b))[0]||"";

        // Si el repo tiene DCL → completado sin deuda
        if (repo.lastDCL) {
          const notas=[
            repo.lastBuild ? `Build: ${repo.lastBuild}` : "",
            repo.lastDCL,
            sd.qg ? `QG: ${sd.qg}` : "",
          ].filter(Boolean).join(" · ");
          return [repo.name, cfg.responsable||"", "Completado", 100,
                  "No", "Sin Deuda", today, today,
                  repo.buildUrl||"", notas];
        }

        const hasDebt = ratings.length > 0;
        let estado="Pendiente", avance=0;
        if (repo.method==="pipeline") {
          if (repo.lastBuildStatus==="SUCCESS")       { estado="Completado";  avance=1;    }
          else if (repo.lastBuildStatus==="FAILURE")  { estado="Bloqueado";   avance=0.5;  }
          else                                        { estado="En Progreso"; avance=0.75; }
        }
        const notas=[
          repo.lastBuild ? `Build: ${repo.lastBuild}` : "",
          sd.qg          ? `QG: ${sd.qg}`             : "",
          sd.hotspots    ? `Hotspots: ${sd.hotspots}` : "",
        ].filter(Boolean).join(" · ");
        return [repo.name, cfg.responsable||"", estado, avance,
                hasDebt?"Sí":"No", ratingToNivel(worstR), today, today,
                repo.buildUrl||"", notas];
      });

      // UPSERT: actualizar fila existente o agregar nueva
      pipeRows.forEach(row => {
        const key = String(row[0]).trim();
        const targetRow = existingPipe[key] ?? nextPipeRow++;
        if (!(key in existingPipe)) existingPipe[key] = targetRow; // evitar doble append
        row.forEach((val, j) => pipeSheet.row(targetRow).cell(2 + j).value(val ?? ""));
      });

      // ── Pestaña Deuda Técnica ─────────────────────────────────────────────
      const deudaSheet = getSheet(workbook, "Deuda");
      if (!deudaSheet) throw new Error(`Hoja "Deuda Técnica" no encontrada. Hojas: ${workbook.sheets().map(s=>s.name()).join(", ")}`);

      const existingDeuda = buildExistingMap(deudaSheet, 5, 2); // B = col 2
      let nextDeudaRow    = firstEmptyRow(deudaSheet, 5, 2);

      // Una sola fila por aplicativo: tipos y descripciones concatenados
      const deudaRows = [];
      Object.values(repos).forEach(repo => {
        const sd = sonarData[repo.name] || {};
        const link = getSonarUrl(repo.name, sd.branch||cfg.ticket);
        const tipos = [], descs = [], impactos = [];

        if (sd.secRating||sd.secIssues) {
          tipos.push("Seguridad");
          descs.push(`${sd.secIssues||"?"} issues de seguridad — Rating ${sd.secRating||"?"}`);
          impactos.push(ratingToImpacto(sd.secRating));
        }
        if (sd.relRating||sd.relIssues) {
          tipos.push("Confiabilidad");
          descs.push(`${sd.relIssues||"?"} issues de confiabilidad — Rating ${sd.relRating||"?"}`);
          impactos.push(ratingToImpacto(sd.relRating));
        }
        if (sd.maintRating||sd.maintIssues) {
          tipos.push("Mantenibilidad");
          descs.push(`${sd.maintIssues||"?"} issues de mantenibilidad — Rating ${sd.maintRating||"?"}`);
          impactos.push(ratingToImpacto(sd.maintRating));
        }
        if (sd.hotspots) {
          tipos.push("Seguridad (Hotspots)");
          descs.push(`${sd.hotspots} hotspots${sd.hotspotsStatus?" — "+sd.hotspotsStatus:""}`);
          impactos.push("Alto");
        }

        if (tipos.length === 0) return;

        const maxImpacto = impactos.reduce((a,b) =>
          impactoOrder.indexOf(b) > impactoOrder.indexOf(a) ? b : a, "Bajo");

        deudaRows.push([
          repo.name, tipos.join("\n"), descs.join("\n"),
          maxImpacto, cfg.responsable||"", today, "", link,
        ]);
      });

      // UPSERT: actualizar fila existente o agregar nueva
      deudaRows.forEach(row => {
        const key = String(row[0]).trim();
        const targetRow = existingDeuda[key] ?? nextDeudaRow++;
        if (!(key in existingDeuda)) existingDeuda[key] = targetRow;
        row.forEach((val, j) => deudaSheet.row(targetRow).cell(2 + j).value(val ?? ""));
      });

      // 3. Descargar como Blob (estilos y fórmulas intactos)
      const blob = await workbook.outputAsync();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `Pipeline_Dashboard_Aplicativos_${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      showToast(`Dashboard exportado ✓ — ${pipeRows.length} apps · ${deudaRows.length} registros de deuda`);
    } catch(err) {
      showToast("Error exportando: "+err.message, "warn");
      console.error(err);
    }
  };

  // ── STATS ───────────────────────────────────────────────────────────────────
  const stats = useMemo(()=>({
    total:issues.length,
    high:issues.filter(i=>i.severity==="High"||i.severity==="Critical").length,
    medium:issues.filter(i=>i.severity==="Medium").length,
    low:issues.filter(i=>i.severity==="Low").length,
    repos:Object.keys(repos).length,
    hrs:issues.reduce((a,b)=>a+(parseFloat(b.hrs)||0),0).toFixed(1),
    byType:Object.entries(groupBy(issues,"issueType")).map(([k,v])=>({type:k,count:v.length})).sort((a,b)=>b.count-a.count),
  }),[issues,repos]);

  const cipData = useMemo(()=>{
    const bf=groupBy(issues.filter(i=>i.filePath),"filePath");
    return Object.entries(bf).map(([fp,arr])=>({
      filePath:fp, fileName:fname(fp), count:arr.length,
      severity:arr.some(i=>i.severity==="Critical")?"Critical":arr.some(i=>i.severity==="High")?"High":"Medium",
      types:[...new Set(arr.map(i=>i.issueType))].join("; "),
      repo:arr[0].repo,
      hrs:arr.reduce((a,b)=>a+(parseFloat(b.hrs)||0),0).toFixed(1),
      action:fp.includes("Jquery-Plugins")?"EVALUAR":"MODIFICAR",
    })).sort((a,b)=>b.count-a.count);
  },[issues]);


  // ── DOC GENERATORS ────────────────────────────────────────────────────────
  const genCK = ()=>{
    const rows=[
      ["SEC-001","Reporte recibido y registrado en ticket","Análisis","Obligatorio"],
      ["SEC-002","Issues categorizados por severidad","Análisis","Obligatorio"],
      ["SEC-003","Repositorios impactados identificados","Análisis","Obligatorio"],
      ["SEC-004","Método despliegue verificado (Pipeline/Manual)","Diagnóstico","Obligatorio"],
      ["SEC-005","Deuda técnica SonarQube revisada","Diagnóstico","Obligatorio"],
      ["SEC-006","Diseño General redactado y aprobado","Documentación","Obligatorio"],
      ["SEC-007","Diseño Técnico redactado y aprobado","Documentación","Obligatorio"],
      ["SEC-008","CIP completo","Documentación","Obligatorio"],
      ["DEV-001","jquery-validation actualizado ≥1.19.3","Desarrollo","Obligatorio"],
      ["DEV-002","Instancias XSS sanitizadas con DOMPurify","Desarrollo","Obligatorio"],
      ["DEV-003","DOMPurify agregado como dependencia","Desarrollo","Obligatorio"],
      ["DEV-004","select2 / jsoneditor actualizados","Desarrollo","Obligatorio"],
      ["DEV-005","Code review aprobado por Tech Lead","Desarrollo","Obligatorio"],
      ["DEV-006","Pruebas unitarias pasando ≥80% cobertura","Desarrollo","Obligatorio"],
      ["DEV-007","Pruebas de regresión OK","Desarrollo","Obligatorio"],
      ["SCAN-001","Escaneo SonarQube local ejecutado","Escaneo","Obligatorio"],
      ["SCAN-002","Quality Gate: PASSED — 0 Críticos/Altos","Escaneo","Bloqueante"],
      ["SCAN-003","Reporte PDF escaneo descargado","Escaneo","Obligatorio"],
      ["DEP-001","ZIP de respaldo BACKUP_CIP generado","Despliegue","Bloqueante"],
      ["DEP-002","Ventana de mantenimiento confirmada","Despliegue","Obligatorio"],
      ["DEP-003","Plan de rollback documentado","Despliegue","Obligatorio"],
      ["DEP-004","Despliegue ejecutado","Despliegue","Obligatorio"],
      ["POST-001","Smoke tests post-despliegue OK","Post-Deploy","Obligatorio"],
      ["POST-002","Re-escaneo DAST confirma corrección","Post-Deploy","Obligatorio"],
      [`POST-003`,`Ticket ${cfg.ticket} cerrado`,"Cierre","Obligatorio"],
      ["POST-004","Evidencias archivadas","Cierre","Obligatorio"],
      ["OWASP-A3","OWASP A03:2021 Injection mitigado","Normas","Recomendado"],
      ["OWASP-A6","OWASP A06:2021 Outdated Components mitigado","Normas","Recomendado"],
    ];
    return "ID_Control,Descripcion,Categoria,Obligatoriedad,Estado,Responsable,Fecha,Observaciones\n"+
      rows.map(r=>`${r[0]},"${r[1]}",${r[2]},${r[3]},PENDIENTE,,,""`).join("\n");
  };

  const genCIP = ()=>{
    let csv="No,Archivo,Ruta_Completa,Tipo,Accion,Repo,Severity_Max,Issues,Hrs,Issue_IDs\n";
    csv+=cipData.map((c,i)=>{
      const ids=issues.filter(iss=>iss.filePath===c.filePath).map(iss=>iss.id.substring(0,8)).join("|");
      const tipo=c.filePath.includes("packages.config")?"NuGet Config":c.filePath.endsWith(".js")?"JavaScript":"Otro";
      return `${i+1},"${c.fileName}","${c.filePath}",${tipo},${c.action},${c.repo},${c.severity},${c.count},${c.hrs},"${ids}"`;
    }).join("\n");
    csv+=`\n\n# Total archivos: ${cipData.length}\n# Total issues: ${stats.total}\n# Horas: ${stats.hrs}\n# Ticket: ${cfg.ticket}\n# Generado: ${TODAY_D}`;
    return csv;
  };

  const dlFile=(name,content)=>{ const b=new Blob([content],{type:"text/plain;charset=utf-8"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=name; a.click(); };
  const dlAll=()=>{
    // Word: DG + DT
    exportAllVulnsInOneDocx(stats, docData, cfg, TODAY);
    setTimeout(()=>exportAllVulnsDTInOneDocx(stats, docData, cfg, repos, TODAY), 400);
    // CSV: Checklist + CIP
    setTimeout(()=>dlFile(`CHECKLIST_CUMPLIMIENTO_${cfg.projectName}_${TODAY}.csv`,genCK()), 800);
    setTimeout(()=>dlFile(`CIP_${cfg.projectName}_${TODAY}.csv`,genCIP()), 1200);
    showToast("Documentos descargados ✓ (2 Word + 2 CSV)"); setDone(p=>new Set([...p,2]));
  };
  const dl1=(t)=>{
    const m={ck:{n:`CHECKLIST_CUMPLIMIENTO_${cfg.projectName}_${TODAY}.csv`,f:genCK},cip:{n:`CIP_${cfg.projectName}_${TODAY}.csv`,f:genCIP}};
    dlFile(m[t].n,m[t].f()); showToast(m[t].n+" descargado");
  };

  const completePhase=n=>{ setDone(p=>new Set([...p,n])); showToast(`Fase ${n} completada ✓`); if(n<4)setPhase(n+1); };
  const progress=Math.round((done.size/5)*100);
  const PHASES=["Importar Excel","Diagnóstico","Documentos","Ejecución","Despliegue"];

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div data-theme={darkMode ? "dark" : "light"} style={{fontFamily:"'Segoe UI',sans-serif",background:"var(--bg-base)",minHeight:"100vh",color:"var(--text-primary)",fontSize:13}}>
      <style>{`
  [data-theme="dark"] {
    --bg-base: #060B14;
    --bg-panel: #0A1020;
    --bg-card: #0F1E35;
    --bg-input: #0A1828;
    --border: #1A2840;
    --border-mid: #243650;
    --text-dim: #2A4060;
    --text-muted: #3A5070;
    --text-secondary: #4A6080;
    --text-primary: #D0DCF0;
    --text-bright: #E0EDFF;
    --accent: #00D4FF;
    --accent2: #7C3AED;
    --success: #00E676;
    --warning: #FFB800;
    --danger: #FF4444;
    --row-hover: #0F1E3580;
  }
  [data-theme="light"] {
    --bg-base: #F0F4F8;
    --bg-panel: #FFFFFF;
    --bg-card: #F8FAFC;
    --bg-input: #EEF2F7;
    --border: #CBD5E1;
    --border-mid: #E2E8F0;
    --text-dim: #94A3B8;
    --text-muted: #64748B;
    --text-secondary: #475569;
    --text-primary: #1E293B;
    --text-bright: #0F172A;
    --accent: #0284C7;
    --accent2: #7C3AED;
    --success: #16A34A;
    --warning: #D97706;
    --danger: #DC2626;
    --row-hover: #E2E8F080;
  }
`}</style>

      {/* TOPBAR */}
      <div style={{background:"var(--bg-panel)",borderBottom:"1px solid var(--border)",padding:"0 24px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,background:"linear-gradient(135deg,#00D4FF,#7C3AED)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🔐</div>
          <span style={{fontSize:15,fontWeight:700,color:"var(--text-bright)"}}>DevSecOps · Vulnerability Analyzer</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:11,color:"var(--text-muted)",fontFamily:"monospace"}}>{cfg.ticket} | {issues.length} issues | {TODAY_D}</div>
          <button
            onClick={() => setDarkMode(p => !p)}
            title={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            style={{
              background: "none",
              border: "1px solid var(--border-mid)",
              borderRadius: 6,
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 16,
              padding: "3px 8px",
              lineHeight: 1,
            }}
          >
            {darkMode ? "☀" : "🌙"}
          </button>
        </div>
      </div>

      <div style={{display:"flex",minHeight:"calc(100vh - 52px)"}}>

        {/* SIDEBAR */}
        <nav style={{width:200,background:"var(--bg-panel)",borderRight:"1px solid var(--border)",padding:"16px 0",flexShrink:0,display:"flex",flexDirection:"column"}}>
          <div style={{fontSize:9,color:"var(--text-dim)",letterSpacing:2,padding:"0 14px 10px",textTransform:"uppercase",fontFamily:"monospace"}}>FASES SOP</div>
          {PHASES.map((p,i)=>(
            <button key={i} onClick={()=>setPhase(i)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",width:"100%",border:"none",background:phase===i?"var(--bg-card)":"transparent",color:done.has(i)?"var(--success)":phase===i?"var(--accent)":"var(--text-secondary)",cursor:"pointer",textAlign:"left",fontSize:11,fontWeight:600,borderLeft:`2px solid ${phase===i?"var(--accent)":done.has(i)?"var(--success)":"transparent"}`,transition:"all 0.15s"}}>
              <span style={{width:20,height:20,borderRadius:"50%",background:done.has(i)?"var(--success)":phase===i?"var(--accent)":"var(--border)",color:done.has(i)||phase===i?"#000":"var(--text-secondary)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0}}>{done.has(i)?"✓":i}</span>
              {p}
            </button>
          ))}
          <div style={{marginTop:"auto",padding:"14px",borderTop:"1px solid var(--border)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:10,color:"var(--text-dim)",fontFamily:"monospace"}}>PROGRESO</span>
              <span style={{fontSize:10,color:"var(--accent)",fontFamily:"monospace"}}>{progress}%</span>
            </div>
            <div style={{background:"var(--bg-card)",borderRadius:4,height:4}}>
              <div style={{height:4,background:"linear-gradient(90deg,#00D4FF,#7C3AED)",borderRadius:4,width:`${progress}%`,transition:"width 0.4s"}}/>
            </div>
          </div>
        </nav>

        {/* MAIN */}
        <main style={{flex:1,padding:"24px 28px",overflow:"auto"}}>


          {/* ── FASE 0: IMPORTACIÓN ── */}
          {phase===0&&<ImportacionPhase cfg={cfg} setCfg={setCfg} issues={issues} stats={stats} fileRef={fileRef} handleFile={handleFile} lbl={lbl} inp={inp} card={card} infoBox={infoBox} warnBox={warnBox} btnP={btnP} completePhase={completePhase} sevBadge={sevBadge} methBadge={methBadge} darkMode={darkMode}/>}

          {/* ── FASE 1: DIAGNÓSTICO ── */}
          {phase===1&&<DiagnosticoPhase cfg={cfg} issues={issues} repos={repos} stats={stats} sonarData={sonarData} setSonarF={setSonarF} setRepoF={setRepoF} fetchSonar={fetchSonar} mcpUrl={mcpUrl} setMcpUrl={setMcpUrl} mcpStatus={mcpStatus} checkMcpStatus={checkMcpStatus} jenkinsMcpUrl={jenkinsMcpUrl} setJenkinsMcpUrl={setJenkinsMcpUrl} jenkinsMcpStatus={jenkinsMcpStatus} checkJenkinsMcpStatus={checkJenkinsMcpStatus} getSonarUrl={getSonarUrl} checkRepo={checkRepo} checkAll={checkAll} exportPipelineDashboard={exportPipelineDashboard} loadDashboardExcel={loadDashboardExcel} dashboardWbName={dashboardWbName} completePhase={completePhase} showSources={showSources} setShowSources={setShowSources} getSourcesDisplay={getSourcesDisplay} card={card} inp={inp} infoBox={infoBox} warnBox={warnBox} lbl={lbl} btnP={btnP} btnS={btnS} btnG={btnG} btnA={btnA} dot={dot} methBadge={methBadge} sevBadge={sevBadge} darkMode={darkMode}/>}

          {/* ── FASE 2: DOCUMENTOS ── */}
          {phase===2&&<DocumentosPhase cfg={cfg} issues={issues} cipData={cipData} docData={docData} docTab={docTab} setDocTab={setDocTab} setVulnF={setVulnF} stats={stats} sonarData={sonarData} dl1={dl1} dlAll={dlAll} showSources={showSources} setShowSources={setShowSources} getSourcesDisplay={getSourcesDisplay} TODAY={TODAY} card={card} inp={inp} ta={ta} infoBox={infoBox} warnBox={warnBox} lbl={lbl} btnS={btnS} btnG={btnG} sevBadge={sevBadge} fetchAI={fetchAI} fetchAI_DT={fetchAI_DT} fetchAI_field={fetchAI_field} aiLoading={aiLoading} claudeMcpStatus={claudeMcpStatus} repos={repos} darkMode={darkMode}/>}

          {/* ── FASE 3: EJECUCIÓN ── */}
          {phase===3&&<EjecucionPhase cfg={cfg} issues={issues} claudeMcpUrl={claudeMcpUrl} claudeMcpStatus={claudeMcpStatus} checkClaudeMcpStatus={checkClaudeMcpStatus} TODAY={TODAY} completePhase={completePhase} showToast={showToast} card={card} infoBox={infoBox} warnBox={warnBox} btnP={btnP} btnS={btnS} codeBox={codeBox} dlAll={dlAll} darkMode={darkMode}/>}

          {/* ── FASE 4: DESPLIEGUE ── */}
          {phase===4&&<GenericPhase phase={phase} cfg={cfg} cipData={cipData} TODAY={TODAY} dlAll={dlAll} completePhase={completePhase} card={card} infoBox={infoBox} btnP={btnP} btnS={btnS} darkMode={darkMode}/>}
        </main>
      </div>

      {/* TOAST */}
      {toast&&(
        <div style={{position:"fixed",bottom:20,right:20,zIndex:9999,background:"var(--bg-panel)",border:`1px solid ${toast.type==="ok"?"var(--success)":"var(--warning)"}`,borderRadius:8,padding:"10px 16px",fontSize:12,color:toast.type==="ok"?"var(--success)":"var(--warning)",fontFamily:"monospace",boxShadow:`0 8px 24px ${toast.type==="ok"?"#00E67620":"#FFB80020"}`,animation:"slideIn 0.2s ease"}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}


ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
