// ── OFFICIAL REFERENCE SOURCES (display only — no fetch) ────────────────────
const SOURCES_DISPLAY = {
  xss: [
    { label:"OWASP XSS Prevention Cheat Sheet", url:"https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html" },
    { label:"OWASP Top 10 A03:2021 Injection",  url:"https://owasp.org/Top10/2021/A03_2021-Injection/" },
    { label:"CWE-79 (MITRE)",                   url:"https://cwe.mitre.org/data/definitions/79.html" },
    { label:"jQuery UI Security Advisories",    url:"https://github.com/jquery/jquery-ui/security/advisories" },
    { label:"jQuery Support",                   url:"https://jquery.com/support/" },
  ],
  oss: [
    { label:"OSV.dev",                          url:"https://osv.dev/" },
    { label:"GitHub Advisory Database",         url:"https://github.com/advisories" },
    { label:"NVD / NIST",                       url:"https://nvd.nist.gov/vuln/search" },
    { label:"CVE Program",                      url:"https://www.cve.org/" },
    { label:"CISA KEV Catalog",                 url:"https://www.cisa.gov/known-exploited-vulnerabilities-catalog" },
    { label:"OWASP A06:2021 Outdated Components",url:"https://owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components/" },
  ],
  auth: [
    { label:"OWASP A07:2021 Auth Failures",     url:"https://owasp.org/Top10/2021/A07_2021-Identification_and_Authentication_Failures/" },
    { label:"OWASP Auth Cheat Sheet",           url:"https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html" },
    { label:"CWE-287 Improper Authentication",  url:"https://cwe.mitre.org/data/definitions/287.html" },
  ],
  injection: [
    { label:"OWASP A03:2021 Injection",         url:"https://owasp.org/Top10/2021/A03_2021-Injection/" },
    { label:"OWASP SQL Injection Cheat Sheet",  url:"https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html" },
    { label:"CWE-89 SQL Injection",             url:"https://cwe.mitre.org/data/definitions/89.html" },
  ],
  misconfig: [
    { label:"OWASP A05:2021 Misconfiguration",  url:"https://owasp.org/Top10/2021/A05_2021-Security_Misconfiguration/" },
    { label:"OWASP Security Headers",           url:"https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html" },
  ],
  crypto: [
    { label:"OWASP A02:2021 Crypto Failures",   url:"https://owasp.org/Top10/2021/A02_2021-Cryptographic_Failures/" },
    { label:"OWASP Crypto Storage Cheat Sheet", url:"https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html" },
  ],
  default: [
    { label:"OWASP Top 10 2021",                url:"https://owasp.org/Top10/2021/" },
    { label:"OWASP Cheat Sheet Series",         url:"https://cheatsheetseries.owasp.org/index.html" },
    { label:"CWE / MITRE",                      url:"https://cwe.mitre.org/" },
    { label:"NVD / NIST",                       url:"https://nvd.nist.gov/" },
  ],
};

const getSourcesDisplay = (type) => {
  const t = type.toLowerCase();
  if(t.includes("cross site")||t.includes("xss"))           return SOURCES_DISPLAY.xss;
  if(t.includes("open source")||t.includes("component")||t.includes("redos")||t.includes("dependency")) return SOURCES_DISPLAY.oss;
  if(t.includes("authentication")||t.includes("session")||t.includes("jwt")||t.includes("oauth"))       return SOURCES_DISPLAY.auth;
  if(t.includes("injection")||t.includes("sql")||t.includes("command")||t.includes("ldap"))             return SOURCES_DISPLAY.injection;
  if(t.includes("misconfig")||t.includes("header")||t.includes("cors")||t.includes("clickjack"))        return SOURCES_DISPLAY.misconfig;
  if(t.includes("crypto")||t.includes("cipher")||t.includes("weak"))                                    return SOURCES_DISPLAY.crypto;
  return SOURCES_DISPLAY.default;
};
