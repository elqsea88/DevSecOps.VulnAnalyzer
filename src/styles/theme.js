// ── THEME / STYLE HELPERS ─────────────────────────────────────────────────────
// Usage: import via build concatenation — these are plain JS objects / fns

const card = (extra = {}) => ({
  background:    "var(--bg-panel)",
  border:        "1px solid var(--border)",
  borderRadius:  10,
  padding:       "18px 20px",
  marginBottom:  14,
  ...extra,
});

const inp = {
  width:         "100%",
  background:    "var(--bg-card)",
  border:        "1px solid var(--border)",
  borderRadius:  6,
  color:         "var(--text-primary)",
  fontSize:      12,
  padding:       "8px 10px",
  boxSizing:     "border-box",
};

const ta = {
  ...inp,
  resize:        "vertical",
  minHeight:     90,
  fontFamily:    "'Segoe UI',sans-serif",
  lineHeight:    1.5,
};

const btnP = {
  display:       "inline-flex",
  alignItems:    "center",
  gap:           6,
  padding:       "8px 16px",
  background:    "var(--accent)",
  color:         "#000",
  border:        "none",
  borderRadius:  6,
  fontSize:      12,
  fontWeight:    700,
  cursor:        "pointer",
};

const btnS = { ...btnP, background: "var(--success)" };
const btnG = { ...btnP, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)" };
const btnA = { ...btnP, background: "var(--warning)" };

const lbl = {
  display:       "block",
  fontSize:      10,
  color:         "var(--text-muted)",
  letterSpacing: 1.5,
  marginBottom:  5,
  textTransform: "uppercase",
  fontFamily:    "monospace",
};

const sevBadge = s => {
  const c = SEV[s] || SEV.Medium;
  return {
    display:       "inline-flex",
    alignItems:    "center",
    padding:       "2px 8px",
    borderRadius:  100,
    fontSize:      10,
    fontWeight:    700,
    fontFamily:    "monospace",
    background:    c.bg,
    color:         c.color,
    border:        `1px solid ${c.border}`,
  };
};

const methBadge = m => ({
  display:       "inline-flex",
  alignItems:    "center",
  padding:       "2px 8px",
  borderRadius:  100,
  fontSize:      10,
  fontWeight:    700,
  fontFamily:    "monospace",
  background:    m === "pipeline" ? "#00D4FF15" : m === "manual" ? "#7C3AED20" : "#FFB80015",
  color:         m === "pipeline" ? "#00D4FF"   : m === "manual" ? "#A78BFA"   : "#FFB800",
  border:        `1px solid ${m === "pipeline" ? "#00D4FF" : m === "manual" ? "#7C3AED" : "#FFB800"}`,
});

const dot = s => ({
  width:         8,
  height:        8,
  borderRadius:  "50%",
  display:       "inline-block",
  marginRight:   5,
  flexShrink:    0,
  background:    s === "ok" ? "#00E676" : s === "checking" ? "#FFB800" : s === "error" ? "#FF4560" : "#2A4060",
  boxShadow:     s === "ok" ? "0 0 6px #00E676" : s === "checking" ? "0 0 6px #FFB800" : "none",
});

const infoBox = {
  background:    "var(--bg-input)",
  borderLeft:    "3px solid var(--accent)",
  padding:       "10px 14px",
  borderRadius:  "0 7px 7px 0",
  fontSize:      12,
  color:         "var(--text-muted)",
  marginBottom:  14,
  lineHeight:    1.6,
};

const warnBox = {
  background:    "var(--bg-input)",
  borderLeft:    "3px solid var(--warning)",
  padding:       "10px 14px",
  borderRadius:  "0 7px 7px 0",
  fontSize:      12,
  color:         "var(--text-secondary)",
  marginBottom:  14,
  lineHeight:    1.6,
};

const codeBox = {
  background:    "var(--bg-input)",
  border:        "1px solid var(--border)",
  borderRadius:  8,
  padding:       16,
  fontFamily:    "monospace",
  fontSize:      11,
  color:         "var(--text-muted)",
  lineHeight:    1.7,
  whiteSpace:    "pre-wrap",
  maxHeight:     400,
  overflow:      "auto",
};
