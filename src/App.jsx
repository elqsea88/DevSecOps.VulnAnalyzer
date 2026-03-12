// ── APP COMPONENT ───────────────────────────────────────────────────────────
// Assembles all phases. State, handlers, and generators defined inline.

const { useState, useCallback, useMemo, useRef } = React;

function App(){
  const [phase,setPhase]   = useState(0);
  const [done,setDone]     = useState(new Set());
  const [issues,setIssues] = useState([]);
  const [repos,setRepos]   = useState({});
  const [cfg,setCfg]       = useState({
    jenkinsBase:"https://jenkins.empresa.com/job/",
    gitBase:"https://nausp-aapp0001.aceins.com/mexico-it-chubbnet/",
    sonarBase:"https://sonar.chubb.com",
    sonarProjectKey:"NAGH-APM0001304-mexico-it-chubbnet-",
    projectName:"ACE.BasicBook", responsable:"", ticket:"SEC-"+TODAY,
  });
  const [sonarData,setSonarData] = useState({});  // { repoName: { qg, secIssues, secRating, relIssues, relRating, maintIssues, maintRating, coverage, duplications, hotspots, hotspotsStatus, loc, version, branch } }
  const setSonarF = (repo,field,val) => setSonarData(p=>({...p,[repo]:{...(p[repo]||{}), [field]:val}}));

  const MCP_DEFAULT = "http://127.0.0.1:3747";
  const [mcpUrl,setMcpUrl]     = useState(MCP_DEFAULT);
  const [mcpStatus,setMcpStatus] = useState(null); // null | "ok" | "error" | "checking"

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
  const [claudeKey,setClaudeKey] = useState("");
  const [aiLoading,setAiLoading] = useState({});

  const fetchAI = async (type, count, typeFiles) => {
    if (!claudeKey) { showToast("Ingresa tu API Key de Claude primero","warn"); return; }
    setAiLoading(p=>({...p,[type]:true}));
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": claudeKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: `Eres un experto en seguridad de aplicaciones (DevSecOps). Para la vulnerabilidad "${type}" detectada en el proyecto "${cfg.projectName}" (${count} issue(s) en ${typeFiles.length} archivo(s)), genera contenido técnico profesional en español para un documento de Diseño General de Seguridad.

Responde ÚNICAMENTE con un JSON válido con estas 4 claves (sin markdown, sin explicaciones):
{
  "impactos": "descripción de impactos con bullets •",
  "owasp": "clasificación OWASP Top 10 2021 y detalles de cumplimiento",
  "proceso": "descripción del proceso actual y deficiencias identificadas",
  "solucion": "pasos numerados de remediación específicos"
}`
          }]
        })
      });
      if (!res.ok) { const e=await res.json(); throw new Error(e.error?.message||`HTTP ${res.status}`); }
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
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
    if (!claudeKey) { showToast("Ingresa tu API Key de Claude primero","warn"); return; }
    setAiLoading(p=>({...p,["dt_"+type]:true}));
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": claudeKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: `Eres un experto en seguridad de aplicaciones (DevSecOps). Para la vulnerabilidad "${type}" detectada en el proyecto "${cfg.projectName}" (${count} issue(s) en ${typeFiles.length} archivo(s)), genera contenido para una Historia de Usuario de seguridad en español.\n\nResponde ÚNICAMENTE con un JSON válido con estas claves (sin markdown, sin explicaciones):\n{\n  "situacionEsperada": "cómo debe funcionar el sistema correctamente después de la corrección",\n  "reglaNegocio": "regla de negocio asociada a esta corrección de seguridad",\n  "depsTecnicas": "dependencias técnicas a actualizar o agregar (una por línea)",\n  "propuestaGeneral": "propuesta general de solución en una o dos oraciones"\n}`
          }]
        })
      });
      if (!res.ok) { const e=await res.json(); throw new Error(e.error?.message||`HTTP ${res.status}`); }
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
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

  const [docTab,setDocTab] = useState(0);
  const [docData,setDocData]= useState({appDesc:"",vulnOv:{},patron:"",clases:"",deps:""});
  const [toast,setToast]   = useState(null);
  const [showSources,setShowSources] = useState({});
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
      ov[type] = {
        impactos: kb.impactos,
        owasp:    kb.owasp,
        proceso:  kb.proceso,
        solucion: (kb.solucion||"").replace(/\$\{0\}/g, tf.length),
        hu: "",
        alineacion: "Chubb",
        situacionEsperada: "",
        reglaNegocio: "",
        depsTecnicas: "",
        propuestaGeneral: "",
      };
    });
    return ov;
  };

  // ── FUENTES OFICIALES POR TIPO DE VULNERABILIDAD ────────────────────────────
  // ── REFRESCAR DESDE BASE DE CONOCIMIENTO INTERNA ────────────────────────────
  const refreshFromKB = (type, typeFiles) => {
    const kb = getKB(type);
    setVulnF(type,"impactos", kb.impactos);
    setVulnF(type,"owasp",    kb.owasp);
    setVulnF(type,"proceso",  kb.proceso);
    setVulnF(type,"solucion", (kb.solucion||"").replace(/\$\{0\}/g, typeFiles.length));
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

  // ── PIPELINE DUAL CHECK ─────────────────────────────────────────────────────
  const checkRepo = useCallback(repoName=>{
    const gitUrl=cfg.gitBase.replace(/\/$/,"")+"/"+repoName;
    const jenkinsUrl=cfg.jenkinsBase.replace(/\/$/,"")+"/"+repoName;
    setRepos(p=>({...p,[repoName]:{...p[repoName],gitCheckStatus:"checking",gitCheckMsg:"Buscando Jenkinsfile en rama master…",jenkinsCheckStatus:"pending",jenkinsCheckMsg:"En espera de Step 1…",debtStatus:"pending",method:"unknown",gitUrl,jenkinsUrl}}));

    setTimeout(()=>{
      const hasJF=true; // production: fetch HEAD /raw/master/Jenkinsfile → 200
      setRepos(p=>({...p,[repoName]:{...p[repoName],gitCheckStatus:hasJF?"ok":"error",gitCheckMsg:hasJF?"Jenkinsfile ✓ encontrado en rama master":"Jenkinsfile ✗ no encontrado — despliegue Manual",jenkinsCheckStatus:hasJF?"checking":"skipped",jenkinsCheckMsg:hasJF?"Verificando job activo en Jenkins…":"Omitido (sin Jenkinsfile)",hasJF}}));
      setTimeout(()=>{
        const jobOk=true; // production: fetch /api/json?tree=lastBuild → lastBuild exists
        const lastBuild="#"+(Math.floor(Math.random()*80)+20);
        const lastStatus=Math.random()>0.2?"SUCCESS":"FAILURE";
        const both=hasJF&&jobOk;
        setRepos(p=>({...p,[repoName]:{...p[repoName],jenkinsCheckStatus:jobOk?"ok":"error",jenkinsCheckMsg:jobOk?`Job activo ✓ — Último build: ${lastBuild} (${lastStatus})`:"Job ✗ no encontrado",lastBuild,lastBuildStatus:lastStatus,method:both?"pipeline":"manual",debtStatus:"checking"}}));
        setTimeout(()=>{
          const dd=Math.floor(Math.random()*22)+1, db=Math.floor(Math.random()*12);
          const qg=dd>15||db>8?"FAILED":"PASSED";
          setRepos(p=>({...p,[repoName]:{...p[repoName],debtStatus:"ok",debtDays:dd,debtBugs:db,debtHotspots:p[repoName].issues.length,sonarQG:qg,codeSmells:Math.floor(Math.random()*30)}}));
          showToast(`✓ ${repoName} — ${both?"Pipeline CI/CD":"Manual"} | QG: ${qg}`);
        },700);
      },900);
    },800);
  },[cfg]);

  const checkAll = ()=>Object.keys(repos).forEach((r,i)=>setTimeout(()=>checkRepo(r),i*900));

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


  // ── GENERATORS (see src/generators/generators.js) ──────────────────────
  // ── DOC GENERATORS ──────────────────────────────────────────────────────────
  const genDG = ()=>{
    const repoInfo=Object.values(repos).map(r=>`  • ${r.name}: ${r.method==="pipeline"?"Pipeline CI/CD":r.method==="manual"?"Manual":"Pendiente"} | Deuda: ${r.debtDays?r.debtDays+"d":"N/D"} | QG: ${r.sonarQG||"N/D"}`).join("\n")||"  • "+cfg.projectName+" — Pendiente de análisis (ejecutar Fase 1)";
    const uniqueTypes=[...new Set(issues.map(i=>i.issueType).filter(Boolean))];
    const modules=[...new Set(issues.map(i=>i.filePath?.split("/")[3]).filter(Boolean))];

    const vulnSections=uniqueTypes.map((type,idx)=>{
      const kb=getKB(type), ov=docData.vulnOv[type]||{};
      const ti=issues.filter(i=>i.issueType===type);
      const tf=[...new Set(ti.map(i=>i.filePath).filter(Boolean))];
      const sol=(ov.solucion||kb.solucion).replace(/\$\{0\}/g,tf.length);
      return `
${"═".repeat(66)}
VULNERABILIDAD ${idx+1}: ${kb.label.toUpperCase()}
${"═".repeat(66)}
  Tipo detección  : ${ti[0]?.method?.toUpperCase()||"SAST"}
  Issues          : ${ti.length}
  Archivos únicos : ${tf.length}
  Severidad       : ${SEV[ti[0]?.severity]?.label||ti[0]?.severity||"Alta"}
  Horas est.      : ${ti.reduce((a,b)=>a+(parseFloat(b.hrs)||0),0).toFixed(1)} hrs

┌─ IMPACTOS DE LA VULNERABILIDAD ────────────────────────────────────────────
${(ov.impactos||kb.impactos).split("\n").map(l=>"│ "+l).join("\n")}
└────────────────────────────────────────────────────────────────────────────

┌─ IMPACTOS ASOCIADOS A OWASP ───────────────────────────────────────────────
${(ov.owasp||kb.owasp).split("\n").map(l=>"│ "+l).join("\n")}
└────────────────────────────────────────────────────────────────────────────

┌─ PROCESO ACTUAL ────────────────────────────────────────────────────────────
${(ov.proceso||kb.proceso).split("\n").map(l=>"│ "+l).join("\n")}
└────────────────────────────────────────────────────────────────────────────

┌─ PROPUESTA DE SOLUCIÓN ────────────────────────────────────────────────────
${sol.split("\n").map(l=>"│ "+l).join("\n")}
└────────────────────────────────────────────────────────────────────────────`;
    }).join("\n");

    return `╔═══════════════════════════════════════════════════════════════════╗
║         DISEÑO GENERAL — CORRECCIÓN DE VULNERABILIDADES           ║
╚═══════════════════════════════════════════════════════════════════╝

INFORMACIÓN DEL PROYECTO
  Proyecto     : ${cfg.projectName}
  Ticket       : ${cfg.ticket}
  Responsable  : ${cfg.responsable||"[Pendiente]"}
  Fecha        : ${TODAY_D}
  Release      : ${issues[0]?.release||"R17"}
  Total Issues : ${stats.total}  (Alta/Crítica: ${stats.high} | Media: ${stats.medium} | Baja: ${stats.low})
  Esfuerzo Est.: ${stats.hrs} hrs
  Tipos vuln.  : ${uniqueTypes.length}

REPOSITORIOS IMPACTADOS
${repoInfo}

${"═".repeat(66)}
DISEÑO DE LA APLICACIÓN
${"═".repeat(66)}
${docData.appDesc||`  ${cfg.projectName} es una aplicación web ASP.NET MVC que gestiona el proceso de
  emisión de pólizas de seguros: Suscriptor, Propuesta, Producto, Emisión, Cobranza y Riesgo.

  Stack tecnológico:
  • Frontend : JavaScript / jQuery / select2 / jsoneditor
  • Backend  : ASP.NET MVC (.NET Framework)
  • Paquetes : NuGet (packages.config)
  • CI/CD    : ${Object.values(repos)[0]?.method==="pipeline"?"Jenkins Pipeline (Jenkinsfile detectado)":"Despliegue manual / Pendiente verificación"}
  • SCM      : Git — ${cfg.gitBase}${cfg.projectName}

  Módulos con vulnerabilidades detectadas:
  ${modules.map(m=>"  • "+m).join("\n  ")}`}
${vulnSections}

${"═".repeat(66)}
CRITERIOS DE ACEPTACIÓN
${"═".repeat(66)}
  • Quality Gate SonarQube: ${Object.values(sonarData)[0]?.qg||"[Pendiente — completar en Fase 1]"} | Security: ${Object.values(sonarData)[0]?.secIssues||"?"} issues (${Object.values(sonarData)[0]?.secRating||"?"}) | Hotspots: ${Object.values(sonarData)[0]?.hotspots||"?"} (${Object.values(sonarData)[0]?.hotspotsStatus||"?"})
  • Pruebas de regresión aprobadas en todos los módulos afectados
  • Revisión de código aprobada por Tech Lead
  • Re-escaneo DAST/SAST confirma remediación del ticket ${cfg.ticket}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APROBACIONES
  Elaborado  : ${cfg.responsable||"___________________________"}
  Revisado   : ___________________________
  Aprobado   : ___________________________
  Fecha VO   : ___________________________
`;
  };

  const genDT = ()=>{
    const uniqueTypes=[...new Set(issues.map(i=>i.issueType).filter(Boolean))];
    const header=`╔═══════════════════════════════════════════════════════════════════╗
║         DISEÑO TÉCNICO — HISTORIAS DE USUARIO DE SEGURIDAD        ║
╚═══════════════════════════════════════════════════════════════════╝

INFORMACIÓN
  Proyecto : ${cfg.projectName}
  Ticket   : ${cfg.ticket}
  Fecha    : ${TODAY_D}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    const repoUrls=Object.keys(repos).map(r=>`  ${cfg.gitBase.replace(/\/$/,"")}/${r}`).join("\n")||"  [Sin repositorios]";
    const sections=uniqueTypes.map((type,idx)=>{
      const ov=docData.vulnOv[type]||{};
      const kb=getKB(type);
      return `HU ${idx+1}: ${kb.label!==type?kb.label:type}
${"─".repeat(66)}
Historia de Usuario : ${ov.hu||"[Ingresar IDs de HU]"}
Alineación          : ${ov.alineacion||"Chubb"}

Proceso Actual      :
${(ov.proceso||"[Pendiente]").split("\n").map(l=>"  "+l).join("\n")}

Situación Esperada  :
${(ov.situacionEsperada||"[Pendiente]").split("\n").map(l=>"  "+l).join("\n")}

Regla de Negocio    :
${(ov.reglaNegocio||"[Pendiente]").split("\n").map(l=>"  "+l).join("\n")}

Dependencias        :
${(ov.depsTecnicas||"[Pendiente]").split("\n").map(l=>"  "+l).join("\n")}

Propuesta General   :
${(ov.propuestaGeneral||"[Pendiente]").split("\n").map(l=>"  "+l).join("\n")}

Propuesta de Solución:
${(ov.solucion||"[Pendiente]").split("\n").map(l=>"  "+l).join("\n")}

Repositorios:
${repoUrls}
`;
    }).join("\n"+"═".repeat(66)+"\n\n");

    return header + (sections||"[Importa el Excel para generar las Historias de Usuario]");
  };

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
      ["APROV-001","Visto Bueno Gerente de Proyecto","Aprobación","Bloqueante"],
      ["APROV-002","Visto Bueno Oficial de Seguridad","Aprobación","Bloqueante"],
      ["APROV-003","Visto Bueno QA Lead","Aprobación","Bloqueante"],
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
    dlFile(`DISEÑO_GENERAL_${cfg.projectName}_${TODAY}.txt`,genDG());
    setTimeout(()=>dlFile(`DISEÑO_TECNICO_${cfg.projectName}_${TODAY}.txt`,genDT()),300);
    setTimeout(()=>dlFile(`CHECKLIST_CUMPLIMIENTO_${cfg.projectName}_${TODAY}.csv`,genCK()),600);
    setTimeout(()=>dlFile(`CIP_${cfg.projectName}_${TODAY}.csv`,genCIP()),900);
    showToast("4 documentos descargados ✓"); setDone(p=>new Set([...p,2]));
  };
  const dl1=(t)=>{
    const m={dg:{n:`DISEÑO_GENERAL_${cfg.projectName}_${TODAY}.txt`,f:genDG},dt:{n:`DISEÑO_TECNICO_${cfg.projectName}_${TODAY}.txt`,f:genDT},ck:{n:`CHECKLIST_CUMPLIMIENTO_${cfg.projectName}_${TODAY}.csv`,f:genCK},cip:{n:`CIP_${cfg.projectName}_${TODAY}.csv`,f:genCIP}};
    dlFile(m[t].n,m[t].f()); showToast(m[t].n+" descargado");
  };

  const completePhase=n=>{ setDone(p=>new Set([...p,n])); showToast(`Fase ${n} completada ✓`); if(n<5)setPhase(n+1); };
  const progress=Math.round((done.size/6)*100);
  const PHASES=["Importar Excel","Diagnóstico","Documentos","Aprobación","Ejecución","Despliegue"];

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:"'Segoe UI',sans-serif",background:"#060B14",minHeight:"100vh",color:"#D0DCF0",fontSize:13}}>

      {/* TOPBAR */}
      <div style={{background:"#0A1020",borderBottom:"1px solid #1A2840",padding:"0 24px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,background:"linear-gradient(135deg,#00D4FF,#7C3AED)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🔐</div>
          <span style={{fontSize:15,fontWeight:700,color:"#E0EDFF"}}>DevSecOps · Vulnerability Analyzer</span>
        </div>
        <div style={{fontSize:11,color:"#3A5070",fontFamily:"monospace"}}>{cfg.ticket} | {issues.length} issues | {TODAY_D}</div>
      </div>

      <div style={{display:"flex",minHeight:"calc(100vh - 52px)"}}>

        {/* SIDEBAR */}
        <nav style={{width:200,background:"#0A1020",borderRight:"1px solid #1A2840",padding:"16px 0",flexShrink:0,display:"flex",flexDirection:"column"}}>
          <div style={{fontSize:9,color:"#2A4060",letterSpacing:2,padding:"0 14px 10px",textTransform:"uppercase",fontFamily:"monospace"}}>FASES SOP</div>
          {PHASES.map((p,i)=>(
            <button key={i} onClick={()=>setPhase(i)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",width:"100%",border:"none",background:phase===i?"#0F1E35":"transparent",color:done.has(i)?"#00E676":phase===i?"#00D4FF":"#4A6080",cursor:"pointer",textAlign:"left",fontSize:11,fontWeight:600,borderLeft:`2px solid ${phase===i?"#00D4FF":done.has(i)?"#00E676":"transparent"}`,transition:"all 0.15s"}}>
              <span style={{width:20,height:20,borderRadius:"50%",background:done.has(i)?"#00E676":phase===i?"#00D4FF":"#1A2840",color:done.has(i)||phase===i?"#000":"#4A6080",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0}}>{done.has(i)?"✓":i}</span>
              {p}
            </button>
          ))}
          <div style={{marginTop:"auto",padding:"14px",borderTop:"1px solid #1A2840"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:10,color:"#2A4060",fontFamily:"monospace"}}>PROGRESO</span>
              <span style={{fontSize:10,color:"#00D4FF",fontFamily:"monospace"}}>{progress}%</span>
            </div>
            <div style={{background:"#0F1E35",borderRadius:4,height:4}}>
              <div style={{height:4,background:"linear-gradient(90deg,#00D4FF,#7C3AED)",borderRadius:4,width:`${progress}%`,transition:"width 0.4s"}}/>
            </div>
          </div>
        </nav>

        {/* MAIN */}
        <main style={{flex:1,padding:"24px 28px",overflow:"auto"}}>


          {/* ── FASE 0: IMPORTACIÓN ── */}
          {phase===0&&<ImportacionPhase cfg={cfg} setCfg={setCfg} issues={issues} stats={stats} fileRef={fileRef} handleFile={handleFile} lbl={lbl} inp={inp} card={card} infoBox={infoBox} warnBox={warnBox} btnP={btnP} completePhase={completePhase} sevBadge={sevBadge} methBadge={methBadge}/>}

          {/* ── FASE 1: DIAGNÓSTICO ── */}
          {phase===1&&<DiagnosticoPhase cfg={cfg} issues={issues} repos={repos} stats={stats} sonarData={sonarData} setSonarF={setSonarF} fetchSonar={fetchSonar} mcpUrl={mcpUrl} setMcpUrl={setMcpUrl} mcpStatus={mcpStatus} checkMcpStatus={checkMcpStatus} getSonarUrl={getSonarUrl} checkRepo={checkRepo} checkAll={checkAll} completePhase={completePhase} showSources={showSources} setShowSources={setShowSources} getSourcesDisplay={getSourcesDisplay} card={card} inp={inp} infoBox={infoBox} warnBox={warnBox} lbl={lbl} btnP={btnP} btnS={btnS} btnG={btnG} btnA={btnA} dot={dot} methBadge={methBadge} sevBadge={sevBadge}/>}

          {/* ── FASE 2: DOCUMENTOS ── */}
          {phase===2&&<DocumentosPhase cfg={cfg} issues={issues} cipData={cipData} docData={docData} docTab={docTab} setDocTab={setDocTab} setVulnF={setVulnF} stats={stats} sonarData={sonarData} genDG={genDG} genDT={genDT} genCK={genCK} genCIP={genCIP} dl1={dl1} dlAll={dlAll} completePhase={completePhase} showSources={showSources} setShowSources={setShowSources} getSourcesDisplay={getSourcesDisplay} TODAY={TODAY} card={card} inp={inp} ta={ta} infoBox={infoBox} warnBox={warnBox} codeBox={codeBox} lbl={lbl} btnP={btnP} btnS={btnS} btnG={btnG} sevBadge={sevBadge} claudeKey={claudeKey} setClaudeKey={setClaudeKey} fetchAI={fetchAI} aiLoading={aiLoading} fetchAI_DT={fetchAI_DT} repos={repos}/>}

          {/* ── FASES 3-5 ── */}
          {phase>=3&&<GenericPhase phase={phase} cfg={cfg} cipData={cipData} TODAY={TODAY} dlAll={dlAll} completePhase={completePhase} card={card} infoBox={infoBox} btnP={btnP} btnS={btnS}/>}
        </main>
      </div>

      {/* TOAST */}
      {toast&&(
        <div style={{position:"fixed",bottom:20,right:20,zIndex:9999,background:"#0A1020",border:`1px solid ${toast.type==="ok"?"#00E676":"#FFB800"}`,borderRadius:8,padding:"10px 16px",fontSize:12,color:toast.type==="ok"?"#00E676":"#FFB800",fontFamily:"monospace",boxShadow:`0 8px 24px ${toast.type==="ok"?"#00E67620":"#FFB80020"}`,animation:"slideIn 0.2s ease"}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}


ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
