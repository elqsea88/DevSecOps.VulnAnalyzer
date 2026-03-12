// ── THEME / STYLE HELPERS ─────────────────────────────────────────────────────
// Usage: import via build concatenation — these are plain JS objects / fns

const card = (extra = {}) => ({
  background:    "#0A1020",
  border:        "1px solid #1A2840",
  borderRadius:  10,
  padding:       "18px 20px",
  marginBottom:  14,
  ...extra,
});

const inp = {
  width:         "100%",
  background:    "#0F1E35",
  border:        "1px solid #1A2840",
  borderRadius:  6,
  color:         "#D0DCF0",
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
  background:    "#00D4FF",
  color:         "#000",
  border:        "none",
  borderRadius:  6,
  fontSize:      12,
  fontWeight:    700,
  cursor:        "pointer",
};

const btnS = { ...btnP, background: "#00E676" };
const btnG = { ...btnP, background: "transparent", color: "#4A6080", border: "1px solid #1A2840" };
const btnA = { ...btnP, background: "#FFB800" };

const lbl = {
  display:       "block",
  fontSize:      10,
  color:         "#3A5070",
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
  background:    "#00D4FF12",
  borderLeft:    "3px solid #00D4FF",
  padding:       "10px 14px",
  borderRadius:  "0 7px 7px 0",
  fontSize:      12,
  color:         "#8AACCC",
  marginBottom:  14,
  lineHeight:    1.6,
};

const warnBox = {
  background:    "#FFB80012",
  borderLeft:    "3px solid #FFB800",
  padding:       "10px 14px",
  borderRadius:  "0 7px 7px 0",
  fontSize:      12,
  color:         "#CCAC88",
  marginBottom:  14,
  lineHeight:    1.6,
};

const codeBox = {
  background:    "#030810",
  border:        "1px solid #1A2840",
  borderRadius:  8,
  padding:       16,
  fontFamily:    "monospace",
  fontSize:      11,
  color:         "#8AACCC",
  lineHeight:    1.7,
  whiteSpace:    "pre-wrap",
  maxHeight:     400,
  overflow:      "auto",
};
