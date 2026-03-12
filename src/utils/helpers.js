// ── HELPERS ──────────────────────────────────────────────────────────────────
const fname   = u => { if(!u) return ""; const p = u.split("/"); return p[p.length-1] || u; };
const fpath   = u => { if(!u) return ""; const m = u.match(/blob\/[a-f0-9]+\/(.+)$/); return m ? m[1] : u; };
const groupBy = (arr, k) => arr.reduce((a, i) => {
  const v = i[k] || "Unknown";
  if (!a[v]) a[v] = [];
  a[v].push(i);
  return a;
}, {});
