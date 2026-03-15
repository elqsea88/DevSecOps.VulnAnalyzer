// ── DOCUMENT GENERATORS + DOWNLOAD HELPERS ──────────────────────────────────
// Defined inside App() — use: cfg, issues, cipData, docData, stats, sonarData, repos, TODAY, TODAY_D, SEV

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
    const xssFiles=[...new Set(issues.filter(i=>i.issueType.includes("Cross Site")).map(i=>"  • "+i.filePath))];
    const ossFiles=issues.filter(i=>i.issueType.includes("Open Source")).map(i=>"  • "+i.filePath);
    return `╔═══════════════════════════════════════════════════════════════════╗
║         DISEÑO TÉCNICO — CORRECCIÓN DE VULNERABILIDADES           ║
╚═══════════════════════════════════════════════════════════════════╝

INFORMACIÓN
  Proyecto : ${cfg.projectName}
  Ticket   : ${cfg.ticket}
  Fecha    : ${TODAY_D}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ARCHIVOS XSS REFLEJADO (${issues.filter(i=>i.issueType.includes("Cross Site")).length} issues)
${[...new Set(xssFiles)].join("\n")||"  [Sin archivos]"}

2. ARCHIVOS OSS VULNERABLE
${ossFiles.join("\n")||"  • E001VulnerabilityRemediationReg/packages.config"}

3. PATRÓN DE SOLUCIÓN XSS
${docData.patron||`  PROBLEMA: Uso de .html() / innerHTML / document.write() sin sanitización.
  SOLUCIÓN:
    a) Actualizar jquery-validation ≥ 1.19.3 (corrige ReDoS CVE)
    b) Reemplazar asignaciones inseguras:
       ANTES:  element.innerHTML = userInput  /  $(el).html(data)
       DESPUÉS: element.innerHTML = DOMPurify.sanitize(userInput)
    c) Para texto plano: element.textContent  /  $(el).text(data)
    d) Agregar DOMPurify ≥ 3.0 como dependencia validada
    e) Actualizar select2-bs3 ≥ 4.0.13 y jsoneditor ≥ 9.x`}

4. COMPONENTES A MODIFICAR (top 10)
${cipData.slice(0,10).map(c=>`  • [${c.action}] ${c.filePath}  (${c.count} issues, ${c.hrs} hrs)`).join("\n")||"  [Completar después de análisis]"}

5. DEPENDENCIAS
${docData.deps||`  • jquery-validation : <1.19.3 → ≥ 1.19.3
  • select2-bs3       : actual  → ≥ 4.0.13
  • jsoneditor        : actual  → ≥ 9.x
  • DOMPurify         : AGREGAR ≥ 3.0`}

6. FLUJO DE CAMBIO
  Branch  : feature/SEC-${cfg.ticket}-xss-remediation
  Pipeline: ${Object.values(repos)[0]?.jenkinsUrl||cfg.jenkinsBase+cfg.projectName}
  Commit  : "fix(security): remediate XSS + update jquery-validation [${cfg.ticket}]"

7. PRUEBAS REQUERIDAS
  • Unit tests: sanitización en cada módulo JS modificado
  • Regresión: Suscriptor, Propuesta, Producto, Emisión, Cobranza
  • SAST post-corrección con SonarQube: Quality Gate ${Object.values(sonarData)[0]?.qg||"[Pendiente]"} | Coverage: ${Object.values(sonarData)[0]?.coverage||"?"} | Duplicaciones: ${Object.values(sonarData)[0]?.duplications||"?"}
  • Revisión manual de módulos UI afectados

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APROBACIONES
  Elaborado  : ${cfg.responsable||"___________________________"}
  Revisado   : ___________________________
  Aprobado   : ___________________________
`;
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

  const completePhase=n=>{ setDone(p=>new Set([...p,n])); showToast(`Fase ${n} completada ✓`); if(n<4)setPhase(n+1); };
  const progress=Math.round((done.size/5)*100);
