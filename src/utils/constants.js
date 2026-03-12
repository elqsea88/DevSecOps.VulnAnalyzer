// ── CONSTANTS ────────────────────────────────────────────────────────────────
const TODAY   = new Date().toISOString().split("T")[0].replace(/-/g,"");
const TODAY_D = new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});

const PHASES = ["Importar Excel","Diagnóstico","Documentos","Aprobación","Ejecución","Despliegue"];

const SEV = {
  High:     { label:"ALTA",    color:"#FF4560", bg:"#FF456018", border:"#FF4560" },
  Critical: { label:"CRÍTICA", color:"#FF0055", bg:"#FF005518", border:"#FF0055" },
  Medium:   { label:"MEDIA",   color:"#FFB800", bg:"#FFB80018", border:"#FFB800" },
  Low:      { label:"BAJA",    color:"#00E676", bg:"#00E67618", border:"#00E676" },
};

const TYPE_MAP = {
  "Reflected Cross Site Scripting": "XSS Reflejado",
  "Stored Cross Site Scripting":    "XSS Almacenado",
  "Open Source Component":          "Componente OSS Vulnerable",
  "SQL Injection":                  "Inyección SQL",
  "Broken Authentication":          "Autenticación Rota",
  "Security Misconfiguration":      "Mala Configuración",
};
