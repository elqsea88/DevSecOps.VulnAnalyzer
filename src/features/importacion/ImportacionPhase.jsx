// ── ImportacionPhase ─────────────────────────────────────────────────────────────────
// Props destructured from App state
function ImportacionPhase({ cfg, setCfg, issues, stats, fileRef, handleFile, lbl, inp, card, infoBox, warnBox, btnP, completePhase, sevBadge, methBadge }) {
  return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,paddingBottom:18,borderBottom:"1px solid #1A2840"}}>
                <div>
                  <div style={{fontSize:10,color:"#00D4FF",letterSpacing:2,fontFamily:"monospace",marginBottom:4}}>FASE 0 — IMPORTACIÓN</div>
                  <div style={{fontSize:24,fontWeight:800,color:"#E0EDFF"}}>Cargar Reporte de Vulnerabilidades</div>
                  <div style={{fontSize:12,color:"#4A6080",marginTop:4}}>Importa tu Excel. Las columnas se detectan automáticamente.</div>
                </div>
                {issues.length>0&&<button style={btnP} onClick={()=>completePhase(0)}>Continuar →</button>}
              </div>

              <div style={card()}>
                <div style={{fontSize:11,fontWeight:700,color:"#00D4FF",letterSpacing:1.5,marginBottom:14,textTransform:"uppercase",fontFamily:"monospace"}}>⚙ Configuración del Proyecto</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                  {[["projectName","Nombre del Proyecto"],["responsable","Responsable / Tech Lead"],["ticket","Ticket ID"]].map(([k,l])=>(
                    <div key={k}><label style={lbl}>{l}</label><input style={inp} value={cfg[k]} onChange={e=>setCfg(p=>({...p,[k]:e.target.value}))}/></div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:8}}>
                  {[["jenkinsBase","Jenkins Base URL"],["gitBase","Git Base URL"]].map(([k,l])=>(
                    <div key={k}><label style={lbl}>{l}</label><input style={inp} value={cfg[k]} onChange={e=>setCfg(p=>({...p,[k]:e.target.value}))}/></div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:12,marginTop:8}}>
                  <div>
                    <label style={lbl}>SonarQube Base URL</label>
                    <input style={inp} value={cfg.sonarBase} onChange={e=>setCfg(p=>({...p,sonarBase:e.target.value}))} placeholder="https://sonar.chubb.com"/>
                  </div>
                  <div>
                    <label style={lbl}>SonarQube Project Key <span style={{color:"#FFB800",fontWeight:400}}>(solo prefijo)</span></label>
                    <input style={inp} value={cfg.sonarProjectKey} onChange={e=>setCfg(p=>({...p,sonarProjectKey:e.target.value}))} placeholder="NAGH-APM0001304-mexico-it-chubbnet-"/>
                    <div style={{fontSize:9,color:"#2A4060",fontFamily:"monospace",marginTop:4}}>
                      Key completo: {cfg.sonarProjectKey||"NAGH-APM0001304-mexico-it-chubbnet-"}<span style={{color:"#FFB800"}}>[NombreRepo]</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={card()}>
                <div style={{fontSize:11,fontWeight:700,color:"#00D4FF",letterSpacing:1.5,marginBottom:12,textTransform:"uppercase",fontFamily:"monospace"}}>📂 Importar Excel</div>
                <div style={infoBox}><strong style={{color:"#00D4FF"}}>Columnas detectadas:</strong> Issue Id · Severity · Issue Type Name · Threat Class · Repo · Discovery Method · Git Source File Uri · hrs · Release · Comentario</div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{display:"none"}}/>
                <button style={btnP} onClick={()=>fileRef.current.click()}>📂 Seleccionar Archivo Excel</button>
              </div>

              {issues.length>0&&(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}}>
                    {[{l:"Total Issues",v:stats.total,c:"#00D4FF"},{l:"Alta / Crítica",v:stats.high,c:"#FF4560"},{l:"Media",v:stats.medium,c:"#FFB800"},{l:"Repos",v:stats.repos,c:"#A78BFA"},{l:"Horas Est.",v:stats.hrs,c:"#00E676"}].map(s=>(
                      <div key={s.l} style={card({marginBottom:0,textAlign:"center"})}>
                        <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div>
                        <div style={{fontSize:10,color:"#3A5070",marginTop:2}}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={card()}>
                    <div style={{fontSize:11,fontWeight:700,color:"#00D4FF",letterSpacing:1.5,marginBottom:12,textTransform:"uppercase",fontFamily:"monospace"}}>📋 Issues Importados ({issues.length})</div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>{["Severidad","Tipo","Repo","Archivo","Método","Hrs"].map(h=><th key={h} style={{padding:"7px 10px",borderBottom:"1px solid #1A2840",textAlign:"left",fontSize:10,color:"#3A5070",letterSpacing:1,textTransform:"uppercase",fontFamily:"monospace",background:"#0A1020"}}>{h}</th>)}</tr></thead>
                        <tbody>
                          {issues.map((iss,i)=>(
                            <tr key={i}>
                              <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E",verticalAlign:"middle"}}><span style={sevBadge(iss.severity)}>{SEV[iss.severity]?.label||iss.severity}</span></td>
                              <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E",color:"#D0DCF0",maxWidth:150}}>{TYPE_MAP[iss.issueType]||iss.issueType}</td>
                              <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E",color:"#8AACCC"}}>{iss.repo}</td>
                              <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><span style={{fontFamily:"monospace",fontSize:10,color:"#00D4FF"}} title={iss.filePath}>{iss.fileName}</span></td>
                              <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E"}}><span style={methBadge("sast")}>{iss.method||"SAST"}</span></td>
                              <td style={{padding:"8px 10px",borderBottom:"1px solid #111D2E",color:"#8AACCC",textAlign:"right"}}>{iss.hrs}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
  );
}
