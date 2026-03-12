// ── GenericPhase ─────────────────────────────────────────────────────────────────
// Props destructured from App state
function GenericPhase({ phase, cfg, cipData, TODAY, dlAll, completePhase, card, infoBox, btnP, btnS }) {
  return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,paddingBottom:18,borderBottom:"1px solid #1A2840"}}>
                <div>
                  <div style={{fontSize:10,color:"#00D4FF",letterSpacing:2,fontFamily:"monospace",marginBottom:4}}>FASE {phase} — {["","","","APROBACIÓN","EJECUCIÓN","DESPLIEGUE"][phase]}</div>
                  <div style={{fontSize:24,fontWeight:800,color:"#E0EDFF"}}>{["","","","Visto Bueno (VO)","Ejecución y Validación","Despliegue y Contingencia"][phase]}</div>
                </div>
                <button style={btnP} onClick={()=>completePhase(phase)}>{phase<5?`Completar Fase ${phase} →`:"✓ Cerrar SOP"}</button>
              </div>
              <div style={infoBox}><strong style={{color:"#00D4FF"}}>Continúa el flujo SOP</strong> usando el módulo DevSecOps completo con los documentos generados en Fase 2.</div>
              <div style={card()}>
                <div style={{fontSize:11,fontWeight:700,color:"#00D4FF",letterSpacing:1.5,marginBottom:12,textTransform:"uppercase",fontFamily:"monospace"}}>📦 Entregables Generados</div>
                {[
                  `DISEÑO_GENERAL_${cfg.projectName}_${TODAY}.txt`,
                  `DISEÑO_TECNICO_${cfg.projectName}_${TODAY}.txt`,
                  `CHECKLIST_CUMPLIMIENTO_${cfg.projectName}_${TODAY}.csv`,
                  `CIP_${cfg.projectName}_${TODAY}.csv — ${cipData.length} archivos únicos`,
                ].map((f,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #111D2E",fontSize:12}}>
                    <span style={{fontFamily:"monospace",color:"#8AACCC"}}>{f}</span>
                    <span style={{color:"#00E676",fontWeight:700}}>✅ Listo</span>
                  </div>
                ))}
                <div style={{marginTop:14}}>
                  <button style={btnS} onClick={dlAll}>⬇ Re-descargar los 4 Documentos</button>
                </div>
              </div>
            </div>
  );
}
