// ── DiagnosticoPhase ─────────────────────────────────────────────────────────────────
// Props destructured from App state
function DiagnosticoPhase({ cfg, issues, repos, stats, sonarData, setSonarF, fetchSonar, mcpUrl, setMcpUrl, mcpStatus, checkMcpStatus, getSonarUrl, checkRepo, checkAll, completePhase, showSources, setShowSources, getSourcesDisplay, card, inp, infoBox, warnBox, lbl, btnP, btnS, btnG, btnA, dot, methBadge, sevBadge }) {
  return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,paddingBottom:18,borderBottom:"1px solid #1A2840"}}>
                <div>
                  <div style={{fontSize:10,color:"#00D4FF",letterSpacing:2,fontFamily:"monospace",marginBottom:4}}>FASE 1 — DIAGNÓSTICO</div>
                  <div style={{fontSize:24,fontWeight:800,color:"#E0EDFF"}}>Verificación Pipeline + Deuda Técnica</div>
                  <div style={{fontSize:12,color:"#4A6080",marginTop:4}}>Verificación dual: Jenkinsfile en Git + Job activo en Jenkins + SonarQube.</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button style={btnA} onClick={checkAll}>⚡ Analizar Todos</button>
                  <button style={btnP} onClick={()=>completePhase(1)}>Continuar →</button>
                </div>
              </div>

              {issues.length===0&&<div style={warnBox}>⚠ Sin issues. Regresa a Fase 0 para importar el Excel.</div>}

              {/* SonarQube MCP Server */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 14px",background:"#060B14",border:`1px solid ${mcpStatus==="ok"?"#00E67630":mcpStatus==="error"?"#FF456030":"#1A2840"}`,borderRadius:8}}>
                <span style={{fontSize:10,color:"#00D4FF",fontFamily:"monospace",whiteSpace:"nowrap"}}>⚡ SONAR MCP</span>
                <input style={{...inp,flex:1,fontSize:11}} value={mcpUrl} onChange={e=>setMcpUrl(e.target.value)} placeholder="http://127.0.0.1:3747"/>
                <button
                  onClick={()=>checkMcpStatus(mcpUrl)}
                  disabled={mcpStatus==="checking"}
                  style={{padding:"6px 12px",borderRadius:6,border:"1px solid #00D4FF40",background:"#00D4FF10",color:"#00D4FF",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"monospace",whiteSpace:"nowrap",opacity:mcpStatus==="checking"?0.6:1}}>
                  {mcpStatus==="checking"?"⟳…":"Conectar"}
                </button>
                <span style={{fontSize:10,fontFamily:"monospace",whiteSpace:"nowrap",color:mcpStatus==="ok"?"#00E676":mcpStatus==="error"?"#FF4560":"#2A4060"}}>
                  {mcpStatus==="ok"?"● Conectado":mcpStatus==="error"?"● Sin conexión":mcpStatus==="checking"?"● Verificando…":"● Sin verificar"}
                </span>
                <span style={{fontSize:9,color:"#2A4060",fontFamily:"monospace",whiteSpace:"nowrap"}}>node sonar-mcp-server.js</span>
              </div>

              {/* Distribución por tipo */}
              <div style={card()}>
                <div style={{fontSize:11,fontWeight:700,color:"#00D4FF",letterSpacing:1.5,marginBottom:12,textTransform:"uppercase",fontFamily:"monospace"}}>📊 Distribución por Tipo</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {stats.byType.map(t=>(
                    <div key={t.type} style={{background:"#0F1E35",border:"1px solid #1A2840",borderRadius:8,padding:"8px 14px",textAlign:"center",minWidth:100}}>
                      <div style={{fontSize:20,fontWeight:800,color:"#FF4560"}}>{t.count}</div>
                      <div style={{fontSize:10,color:"#3A5070",maxWidth:120,marginTop:2}}>{TYPE_MAP[t.type]||t.type}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Repo cards */}
              {Object.values(repos).map(repo=>{
                const repoName=repo.name;
                const isChecking=repo.gitCheckStatus==="checking"||repo.jenkinsCheckStatus==="checking"||repo.debtStatus==="checking";
                const isDone=repo.debtStatus==="ok";
                const method=repo.method||"unknown";
                return (
                  <div key={repo.name} style={card({border:`1px solid ${isDone?(method==="pipeline"?"#00D4FF30":"#A78BFA30"):"#1A2840"}`})}>
                    {/* Header */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:36,height:36,borderRadius:8,background:"#0F1E35",border:"1px solid #1A2840",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🗃</div>
                        <div>
                          <div style={{fontWeight:700,color:"#E0EDFF",fontSize:14}}>{repo.name}</div>
                          <div style={{fontSize:10,color:"#3A5070",fontFamily:"monospace",marginTop:1}}>{repo.issues.length} vulnerabilidades · {repo.gitUrl||cfg.gitBase+repo.name}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {isDone&&<span style={methBadge(method)}>{method==="pipeline"?"⚡ Pipeline CI/CD":"🔧 Manual"}</span>}
                        {!isDone&&<button style={{...btnG,fontSize:11,opacity:isChecking?0.6:1}} onClick={()=>!isChecking&&checkRepo(repo.name)} disabled={isChecking}>{isChecking?"⟳ Analizando…":"🔍 Analizar Repo"}</button>}
                      </div>
                    </div>

                    {/* 3 panels */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                      {/* Git / Jenkinsfile */}
                      <div style={{background:"#060B14",borderRadius:8,padding:14,border:`1px solid ${repo.gitCheckStatus==="ok"?"#00E67630":repo.gitCheckStatus==="error"?"#FF456030":"#1A2840"}`}}>
                        <div style={{fontSize:10,color:"#3A5070",fontFamily:"monospace",marginBottom:10}}>📁 GIT — JENKINSFILE</div>
                        <div style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:8}}>
                          <span style={dot(repo.gitCheckStatus||"gray")}/>
                          <div>
                            <div style={{fontSize:11,fontWeight:600,color:repo.gitCheckStatus==="ok"?"#00E676":repo.gitCheckStatus==="error"?"#FF4560":repo.gitCheckStatus==="checking"?"#FFB800":"#3A5070"}}>
                              {repo.gitCheckStatus==="ok"?"Jenkinsfile encontrado":repo.gitCheckStatus==="error"?"Jenkinsfile ausente":repo.gitCheckStatus==="checking"?"Buscando…":"Sin verificar"}
                            </div>
                            <div style={{fontSize:10,color:"#3A5070",marginTop:2,fontFamily:"monospace"}}>{repo.gitCheckMsg||"GET /raw/master/Jenkinsfile"}</div>
                          </div>
                        </div>
                        <div style={{fontSize:10,color:"#2A4060",fontFamily:"monospace",wordBreak:"break-all",padding:"5px 8px",background:"#0A1020",borderRadius:4}}>{(repo.gitUrl||cfg.gitBase+repo.name)+"/raw/master/Jenkinsfile"}</div>
                      </div>

                      {/* Jenkins job */}
                      <div style={{background:"#060B14",borderRadius:8,padding:14,border:`1px solid ${repo.jenkinsCheckStatus==="ok"?"#00D4FF30":repo.jenkinsCheckStatus==="error"?"#FF456030":"#1A2840"}`}}>
                        <div style={{fontSize:10,color:"#3A5070",fontFamily:"monospace",marginBottom:10}}>⚙ JENKINS — JOB ACTIVO</div>
                        <div style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:8}}>
                          <span style={dot(repo.jenkinsCheckStatus==="ok"?"ok":repo.jenkinsCheckStatus==="error"?"error":repo.jenkinsCheckStatus==="checking"?"checking":"gray")}/>
                          <div>
                            <div style={{fontSize:11,fontWeight:600,color:repo.jenkinsCheckStatus==="ok"?"#00D4FF":repo.jenkinsCheckStatus==="error"?"#FF4560":repo.jenkinsCheckStatus==="checking"?"#FFB800":"#3A5070"}}>
                              {repo.jenkinsCheckStatus==="ok"?"Job activo en Jenkins":repo.jenkinsCheckStatus==="error"?"Job no encontrado":repo.jenkinsCheckStatus==="checking"?"Verificando…":repo.jenkinsCheckStatus==="skipped"?"Omitido (sin Jenkinsfile)":"Pendiente de Step 1"}
                            </div>
                            <div style={{fontSize:10,color:"#3A5070",marginTop:2,fontFamily:"monospace"}}>{repo.jenkinsCheckMsg||"GET /api/json?tree=lastBuild"}</div>
                          </div>  
                        </div>
                        {repo.lastBuild&&(
                          <div style={{display:"flex",gap:6,marginTop:4}}>
                            <span style={{background:"#0A1020",borderRadius:4,padding:"3px 7px",fontSize:10,fontFamily:"monospace",color:"#8AACCC"}}>Build: <strong style={{color:"#E0EDFF"}}>{repo.lastBuild}</strong></span>
                            <span style={{background:"#0A1020",borderRadius:4,padding:"3px 7px",fontSize:10,fontFamily:"monospace",color:repo.lastBuildStatus==="SUCCESS"?"#00E676":"#FF4560",fontWeight:700}}>{repo.lastBuildStatus}</span>
                          </div>
                        )}
                        <div style={{fontSize:10,color:"#2A4060",fontFamily:"monospace",wordBreak:"break-all",padding:"5px 8px",background:"#0A1020",borderRadius:4,marginTop:6}}>{(repo.jenkinsUrl||cfg.jenkinsBase+repo.name)+"/api/json"}</div>
                      </div>

                      {/* SonarQube — manual entry panel */}
                      {(()=>{
                        const sd = sonarData[repoName] || {};
                        const qgOk = sd.qg==="Passed";
                        const qgSet = !!sd.qg;
                        const sonarUrl = getSonarUrl(sd.branch || cfg.ticket);
                        const ratingColor = r => ({A:"#00E676",B:"#69F0AE",C:"#FFB800",D:"#FF7043",E:"#FF4560"}[r]||"#3A5070");
                        return (
                          <div style={{background:"#060B14",borderRadius:8,padding:14,border:`1px solid ${qgSet?(qgOk?"#00E67640":"#FF456040"):"#1A2840"}`}}>
                            {/* Header + URL */}
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                              <div style={{fontSize:10,color:"#3A5070",fontFamily:"monospace"}}>📊 SONARQUBE — DEUDA TÉCNICA</div>
                              <a href={sonarUrl} target="_blank" rel="noopener noreferrer"
                                style={{fontSize:10,color:"#00D4FF",background:"#00D4FF10",padding:"3px 10px",borderRadius:4,border:"1px solid #00D4FF30",textDecoration:"none",fontFamily:"monospace",display:"flex",alignItems:"center",gap:5}}>
                                🔗 Abrir SonarQube ↗
                              </a>
                            </div>

                            {/* Dynamic URL preview */}
                            <div style={{fontSize:9,color:"#2A4060",fontFamily:"monospace",wordBreak:"break-all",padding:"4px 8px",background:"#030810",borderRadius:4,marginBottom:10,border:"1px solid #0A1828"}}>
                              {sonarUrl}
                            </div>

                            {/* Branch field + Fetch button */}
                            <div style={{marginBottom:10}}>
                              <label style={lbl}>Branch (ej. CNEV-374)</label>
                              <div style={{display:"flex",gap:6}}>
                                <input style={{...inp,flex:1,fontSize:11}} value={sd.branch||""} onChange={e=>setSonarF(repoName,"branch",e.target.value)} placeholder="CNEV-374"/>
                                <button
                                  onClick={()=>fetchSonar(repoName, sd.branch||"")}
                                  disabled={sd._fetching}
                                  style={{padding:"6px 12px",borderRadius:6,border:"1px solid #00D4FF40",background:sd._fetching?"#00D4FF10":"#00D4FF15",color:"#00D4FF",fontSize:11,fontWeight:700,cursor:sd._fetching?"not-allowed":"pointer",fontFamily:"monospace",whiteSpace:"nowrap",opacity:sd._fetching?0.6:1}}>
                                  {sd._fetching?"⟳ Cargando…":"⬇ Fetch"}
                                </button>
                              </div>
                              {sd._fetchError&&<div style={{fontSize:10,color:"#FF4560",fontFamily:"monospace",marginTop:4}}>⚠ {sd._fetchError}</div>}
                            </div>

                            {/* Quality Gate — auto-filled by Fetch, editable manual */}
                            <div style={{marginBottom:10}}>
                              <label style={lbl}>Quality Gate</label>
                              <div style={{display:"flex",gap:6}}>
                                {["Passed","Failed"].map(opt=>(
                                  <button key={opt} onClick={()=>setSonarF(repoName,"qg",opt)}
                                    style={{flex:1,padding:"7px 0",borderRadius:6,border:`1px solid ${sd.qg===opt?(opt==="Passed"?"#00E676":"#FF4560"):"#1A2840"}`,background:sd.qg===opt?(opt==="Passed"?"#00E67615":"#FF456015"):"transparent",color:sd.qg===opt?(opt==="Passed"?"#00E676":"#FF4560"):"#4A6080",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"monospace"}}>
                                    {opt==="Passed"?"✓ Passed":"✗ Failed"}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Metrics grid — mirrors SonarQube dashboard */}
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:8}}>
                              {/* Security */}
                              <div style={{background:"#0A1020",borderRadius:6,padding:"8px 10px"}}>
                                <div style={{fontSize:9,color:"#3A5070",fontFamily:"monospace",marginBottom:5,letterSpacing:1}}>SECURITY</div>
                                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                                  <input style={{...inp,width:55,fontSize:12,textAlign:"center",padding:"4px 6px"}} value={sd.secIssues||""} onChange={e=>setSonarF(repoName,"secIssues",e.target.value)} placeholder="7"/>
                                  <span style={{fontSize:10,color:"#3A5070"}}>issues</span>
                                  <select style={{...inp,width:44,fontSize:12,padding:"4px 4px",textAlign:"center"}} value={sd.secRating||""} onChange={e=>setSonarF(repoName,"secRating",e.target.value)}>
                                    <option value="">-</option>
                                    {["A","B","C","D","E"].map(r=><option key={r} value={r}>{r}</option>)}
                                  </select>
                                </div>
                                {sd.secRating&&<div style={{fontSize:16,fontWeight:800,color:ratingColor(sd.secRating),marginTop:4}}>{sd.secRating}</div>}
                              </div>

                              {/* Reliability */}
                              <div style={{background:"#0A1020",borderRadius:6,padding:"8px 10px"}}>
                                <div style={{fontSize:9,color:"#3A5070",fontFamily:"monospace",marginBottom:5,letterSpacing:1}}>RELIABILITY</div>
                                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                                  <input style={{...inp,width:55,fontSize:12,textAlign:"center",padding:"4px 6px"}} value={sd.relIssues||""} onChange={e=>setSonarF(repoName,"relIssues",e.target.value)} placeholder="41"/>
                                  <span style={{fontSize:10,color:"#3A5070"}}>issues</span>
                                  <select style={{...inp,width:44,fontSize:12,padding:"4px 4px"}} value={sd.relRating||""} onChange={e=>setSonarF(repoName,"relRating",e.target.value)}>
                                    <option value="">-</option>
                                    {["A","B","C","D","E"].map(r=><option key={r} value={r}>{r}</option>)}
                                  </select>
                                </div>
                                {sd.relRating&&<div style={{fontSize:16,fontWeight:800,color:ratingColor(sd.relRating),marginTop:4}}>{sd.relRating}</div>}
                              </div>

                              {/* Maintainability */}
                              <div style={{background:"#0A1020",borderRadius:6,padding:"8px 10px"}}>
                                <div style={{fontSize:9,color:"#3A5070",fontFamily:"monospace",marginBottom:5,letterSpacing:1}}>MAINTAINABILITY</div>
                                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                                  <input style={{...inp,width:55,fontSize:12,textAlign:"center",padding:"4px 6px"}} value={sd.maintIssues||""} onChange={e=>setSonarF(repoName,"maintIssues",e.target.value)} placeholder="2.3k"/>
                                  <span style={{fontSize:10,color:"#3A5070"}}>issues</span>
                                  <select style={{...inp,width:44,fontSize:12,padding:"4px 4px"}} value={sd.maintRating||""} onChange={e=>setSonarF(repoName,"maintRating",e.target.value)}>
                                    <option value="">-</option>
                                    {["A","B","C","D","E"].map(r=><option key={r} value={r}>{r}</option>)}
                                  </select>
                                </div>
                                {sd.maintRating&&<div style={{fontSize:16,fontWeight:800,color:ratingColor(sd.maintRating),marginTop:4}}>{sd.maintRating}</div>}
                              </div>
                            </div>

                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:7,marginBottom:8}}>
                              {/* Coverage */}
                              <div style={{background:"#0A1020",borderRadius:6,padding:"8px 10px"}}>
                                <div style={{fontSize:9,color:"#3A5070",fontFamily:"monospace",marginBottom:5}}>COVERAGE %</div>
                                <input style={{...inp,fontSize:12,textAlign:"center",padding:"4px 6px"}} value={sd.coverage||""} onChange={e=>setSonarF(repoName,"coverage",e.target.value)} placeholder="0.0%"/>
                              </div>
                              {/* Duplications */}
                              <div style={{background:"#0A1020",borderRadius:6,padding:"8px 10px"}}>
                                <div style={{fontSize:9,color:"#3A5070",fontFamily:"monospace",marginBottom:5}}>DUPLICATIONS %</div>
                                <input style={{...inp,fontSize:12,textAlign:"center",padding:"4px 6px"}} value={sd.duplications||""} onChange={e=>setSonarF(repoName,"duplications",e.target.value)} placeholder="11.4%"/>
                              </div>
                              {/* Hotspots */}
                              <div style={{background:"#0A1020",borderRadius:6,padding:"8px 10px"}}>
                                <div style={{fontSize:9,color:"#3A5070",fontFamily:"monospace",marginBottom:5}}>HOTSPOTS</div>
                                <input style={{...inp,fontSize:12,textAlign:"center",padding:"4px 6px"}} value={sd.hotspots||""} onChange={e=>setSonarF(repoName,"hotspots",e.target.value)} placeholder="6"/>
                                <select style={{...inp,fontSize:10,padding:"3px 4px",marginTop:4}} value={sd.hotspotsStatus||""} onChange={e=>setSonarF(repoName,"hotspotsStatus",e.target.value)}>
                                  <option value="">Estado</option>
                                  <option value="Failed">Failed</option>
                                  <option value="Reviewed">Reviewed</option>
                                </select>
                              </div>
                              {/* Lines of Code */}
                              <div style={{background:"#0A1020",borderRadius:6,padding:"8px 10px"}}>
                                <div style={{fontSize:9,color:"#3A5070",fontFamily:"monospace",marginBottom:5}}>LINES OF CODE</div>
                                <input style={{...inp,fontSize:12,textAlign:"center",padding:"4px 6px"}} value={sd.loc||""} onChange={e=>setSonarF(repoName,"loc",e.target.value)} placeholder="45k"/>
                              </div>
                            </div>

                            {/* Version */}
                            <div>
                              <label style={lbl}>Versión SonarQube</label>
                              <input style={{...inp,fontSize:11}} value={sd.version||""} onChange={e=>setSonarF(repoName,"version",e.target.value)} placeholder="1.0.4-CNEV-374"/>
                            </div>

                            {/* Summary badges when data entered */}
                            {qgSet&&(
                              <div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:5}}>
                                <span style={{...sevBadge(qgOk?"Low":"High"),fontSize:9}}>QG: {sd.qg}</span>
                                {sd.secIssues&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:100,background:"#FF456015",color:"#FF4560",border:"1px solid #FF456030",fontFamily:"monospace"}}>🔒 Seg: {sd.secIssues} ({sd.secRating||"?"})</span>}
                                {sd.relIssues&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:100,background:"#FFB80015",color:"#FFB800",border:"1px solid #FFB80030",fontFamily:"monospace"}}>⚡ Rel: {sd.relIssues} ({sd.relRating||"?"})</span>}
                                {sd.hotspots&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:100,background:"#FF456015",color:"#FF7043",border:"1px solid #FF456030",fontFamily:"monospace"}}>🔥 Hotspots: {sd.hotspots} ({sd.hotspotsStatus||"?"})</span>}
                                {sd.coverage&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:100,background:"#00D4FF15",color:"#00D4FF",border:"1px solid #00D4FF30",fontFamily:"monospace"}}>📊 Coverage: {sd.coverage}</span>}
                                {sd.duplications&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:100,background:"#A78BFA15",color:"#A78BFA",border:"1px solid #A78BFA30",fontFamily:"monospace"}}>⧉ Dup: {sd.duplications}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Result bar */}
                    {isDone&&(
                      <div style={{marginTop:12,padding:"10px 14px",borderRadius:7,background:method==="pipeline"?"#00D4FF08":"#A78BFA08",border:`1px solid ${method==="pipeline"?"#00D4FF20":"#A78BFA20"}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:16}}>{method==="pipeline"?"⚡":"🔧"}</span>
                          <div>
                            <div style={{fontSize:12,fontWeight:700,color:method==="pipeline"?"#00D4FF":"#A78BFA"}}>
                              {method==="pipeline"?"Pipeline CI/CD confirmado — Jenkinsfile ✓ + Job Jenkins ✓":`Despliegue Manual${!repo.hasJF?" — Jenkinsfile ausente":" — Job Jenkins no encontrado"}`}
                            </div>
                            <div style={{fontSize:10,color:"#3A5070",marginTop:2}}>{method==="pipeline"?`Último build: ${repo.lastBuild} (${repo.lastBuildStatus})`:"Requiere ventana de mantenimiento y transferencia manual"}</div>
                          </div>
                        </div>
                        <div style={{fontSize:10,fontFamily:"monospace",color:"#3A5070"}}>
                          {sonarData[repoName]?.qg&&<span>QG: <span style={{color:sonarData[repoName]?.qg==="Passed"?"#00E676":"#FF4560",fontWeight:700}}>{sonarData[repoName]?.qg}</span></span>}
                          {sonarData[repoName]?.hotspots&&<span style={{marginLeft:8}}>🔥 {sonarData[repoName]?.hotspots} hotspots</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
  );
}
