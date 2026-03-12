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
                      <div style={{display:"flex",gap:8,marginBottom:16}}>
                        <button style={btnG} onClick={()=>dl1("dg")}>⬇ Exportar TXT</button>
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
                      <div style={{display:"flex",gap:8,marginBottom:14}}>
                        <button style={btnG} onClick={()=>dl1("dt")}>⬇ Exportar TXT</button>
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
