// ── VULNERABILITY KNOWLEDGE BASE ────────────────────────────────────────────
// 50+ vulnerabilities — OWASP Top 10 2021, CWE/MITRE, NVD/NIST, CVE, OSV.dev
const VULN_KB = {
  // ── 1. OPEN SOURCE COMPONENT ────────────────────────────────────────────────
  "Open Source Component":{
    label:"Componente Open Source Vulnerable", icon:"📦",
    impactos:`• Permite a un atacante explotar vulnerabilidades conocidas en la librería desactualizada.
• jquery-validation <1.19.3 es vulnerable a ReDoS (Regular Expression Denial of Service): consume CPU ilimitadamente y puede hacer inaccesible la aplicación.
• Riesgo de compromiso de integridad si el componente vulnerable permite ejecución de código no autorizado.
• Posible violación de políticas de licencias si la versión vulnerable tiene restricciones legales.`,
    owasp:`OWASP A06:2021 — Vulnerable and Outdated Components
  • La aplicación usa componentes con vulnerabilidades conocidas y CVEs publicados.
  • Falta de inventario y monitoreo activo de versiones de dependencias (SCA).
  • No se verifica la compatibilidad segura de librerías de terceros antes de integración.
  • Ausencia de proceso automatizado de actualización de dependencias en el pipeline CI/CD.`,
    proceso:`• El proyecto ACE.BasicBook.UI referencia jquery-validation a través de packages.config con versión anterior a 1.19.3.
• No existe proceso automatizado de escaneo SCA en el pipeline actual.
• Las dependencias se actualizan de forma manual y reactiva, sin monitoreo proactivo de CVEs.
• El archivo packages.config es gestionado por NuGet sin políticas de versión mínima segura definidas.`,
    solucion:`1. Actualizar jquery-validation en packages.config a versión ≥ 1.19.3 (fix oficial del CVE ReDoS).
2. Integrar herramienta SCA (OWASP Dependency-Check, Snyk o Dependabot) al pipeline CI/CD.
3. Establecer política de versiones mínimas en NuGet.Config con allowedVersions.
4. Ejecutar escaneo SCA post-actualización para verificar dependencias transitivas.
5. Documentar en el CIP todos los archivos packages.config modificados con hash anterior y nuevo.`,
  },
  "Reflected Cross Site Scripting":{
    label:"Cross-Site Scripting Reflejado (XSS)", icon:"💉",
    impactos:`• Permite inyectar scripts maliciosos en el navegador de la víctima vía parámetros de URL o formularios.
• Posibilita robo de cookies de sesión, tokens de autenticación y datos sensibles del usuario.
• Puede usarse para redirigir al usuario a sitios de phishing o ejecutar acciones en su nombre (CSRF encadenado).
• Permite modificación del DOM afectando integridad visual y funcional de la aplicación.
• Impacto directo en confianza del cliente y posible exposición regulatoria (GDPR, PCI-DSS).`,
    owasp:`OWASP A03:2021 — Injection (incluye XSS Reflejado)
  • Datos del usuario incluidos en la salida HTML sin validación ni codificación contextual.
  • Ausencia de Content Security Policy (CSP) que limite scripts no autorizados.
  • No se usa codificación contextual (HTML encode / JS encode / URL encode según contexto).
  • Las vistas JS construyen DOM dinámicamente con datos sin sanitizar (.html(), innerHTML).

  Archivos con mayor concentración de issues detectados:
  • EnvioEmail.js       — Scripts/Views/Propuesta/Partial/
  • ManejoExcedentes.js — Scripts/Views/Emision/Partial/
  • Producto.js         — Scripts/Views/Producto/
  • Layout.js           — Scripts/
  • jsoneditor.js       — Scripts/Jquery-Plugins/`,
    proceso:`• Los archivos JavaScript construyen HTML dinámico usando .html(), innerHTML o document.write() con datos de respuestas AJAX o parámetros de URL sin sanitizar.
• El framework ASP.NET MVC no aplica auto-encoding en bloques JavaScript de las vistas.
• No existe librería de sanitización centralizada; cada archivo JS maneja (o no) su propio output.
• Los módulos de Suscriptor, Propuesta, Producto, Emisión y Cobranza son los puntos de entrada principales.
• Las librerías select2-bs3.4.1.js y jsoneditor incluyen instancias XSS en código fuente desactualizado.`,
    solucion:`1. Sanitización con DOMPurify (agregar como dependencia validada ≥ 3.0):
   ANTES:  element.innerHTML = userInput  /  $(el).html(data)
   DESPUÉS: element.innerHTML = DOMPurify.sanitize(userInput)
            $(el).html(DOMPurify.sanitize(data))
   Para texto plano usar: element.textContent  /  $(el).text(data)

2. Actualización de librerías vulnerables:
   • select2-bs3 → versión ≥ 4.0.13 (corrige XSS interno)
   • jsoneditor  → versión ≥ 9.x (sin vulnerabilidades XSS activas)

3. Implementar Content Security Policy en header HTTP:
   Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'

4. Validar y codificar en servidor: cualquier dato que vuelva al cliente debe ser codificado en origen.

5. Revisar cada archivo del CIP marcado como XSS y aplicar el fix correspondiente antes del despliegue.`,
  },
  "Stored Cross Site Scripting":{
    label:"Cross-Site Scripting Almacenado (XSS)", icon:"🗄️",
    impactos:`• El payload es persistido en base de datos y ejecutado en cada carga para todos los usuarios.
• Afecta a múltiples usuarios simultáneamente sin requerir interacción adicional del atacante.
• Permite crear backdoors persistentes y modificar contenido de la aplicación permanentemente.
• Riesgo de compromiso masivo de sesiones de usuarios autenticados.`,
    owasp:`OWASP A03:2021 — Injection (XSS Almacenado)
  • Datos almacenados en BD sin sanitización previa son renderizados sin codificación.
  • La aplicación confía en datos almacenados como seguros sin re-validar al momento de la salida.`,
    proceso:`• Los datos ingresados por usuarios son almacenados directamente en BD sin sanitización previa.
• Al recuperar y renderizar estos datos en las vistas, no se aplica encoding de salida contextual.`,
    solucion:`1. Sanitizar ANTES de almacenar en BD usando AntiXSS o DOMPurify en el servidor.
2. Sanitizar TAMBIÉN al momento de renderizar (defensa en profundidad).
3. Implementar validación estricta de tipos y longitud en todos los campos del modelo.
4. Revisar stored procedures y ORM queries para evitar inyección secundaria.`,
  },
  // ── 4. DOM-BASED XSS ────────────────────────────────────────────────────────
  "DOM Cross Site Scripting":{
    label:"Cross-Site Scripting basado en DOM", icon:"🌐",
    impactos:`• El payload se ejecuta completamente en el cliente sin pasar por el servidor, lo que lo hace invisible para los WAF y filtros server-side.
• Permite robo de cookies de sesión, localStorage, sessionStorage y tokens de autenticación.
• Posibilita ejecución de acciones en nombre del usuario (CSRF encadenado) y modificación del DOM.
• Difícil de detectar con herramientas de escaneo dinámico tradicionales.
• Fuente: CWE-79 (MITRE) — Improper Neutralization of Input During Web Page Generation.`,
    owasp:`OWASP A03:2021 — Injection | CWE-79 | CWE-116
Fuente: OWASP DOM-based XSS Prevention Cheat Sheet (cheatsheetseries.owasp.org)
  • Los datos fluyen desde fuentes controladas por el atacante (location.hash, document.URL, document.referrer) hacia sinks peligrosos (innerHTML, document.write, eval).
  • No se aplica output encoding contextual en el cliente.
  • Ausencia de Trusted Types API que restrinja sinks peligrosos.
  • Falta de Content Security Policy que bloquee ejecución de scripts inline.`,
    proceso:`• El código JavaScript lee datos de location.search, location.hash o document.referrer sin sanitización.
• Estos datos se asignan directamente a sinks peligrosos como innerHTML, outerHTML, document.write() o eval().
• Las funciones jQuery .html(), .append() con datos externos propagan el problema.
• No existe revisión de código enfocada en rastrear flujo desde sources DOM hasta sinks peligrosos.`,
    solucion:`1. Identificar todos los DOM sinks peligrosos: innerHTML, outerHTML, document.write, eval, setTimeout(string), setInterval(string), $(selector).html().
2. Reemplazar con sinks seguros:
   ANTES:  el.innerHTML = location.hash.substring(1)
   DESPUÉS: el.textContent = location.hash.substring(1)  // texto plano
            el.innerHTML = DOMPurify.sanitize(location.hash.substring(1))  // HTML necesario
3. Implementar Trusted Types en navegadores modernos:
   trustedTypes.createPolicy('default', { createHTML: input => DOMPurify.sanitize(input) })
4. Agregar CSP: require-trusted-types-for 'script'
5. Usar encodeURIComponent() para datos en URLs.
Referencia: OWASP DOM XSS Prevention Cheat Sheet — cheatsheetseries.owasp.org`,
  },

  // ── 5. SQL INJECTION ────────────────────────────────────────────────────────
  "SQL Injection":{
    label:"Inyección SQL", icon:"🗄️",
    impactos:`• Permite al atacante leer, modificar o eliminar cualquier dato de la base de datos.
• Posibilita eludir mecanismos de autenticación y acceder a cuentas sin credenciales.
• En bases de datos con permisos elevados permite ejecutar comandos del sistema operativo (xp_cmdshell en MSSQL).
• Riesgo de exfiltración masiva de datos de clientes, credenciales y datos financieros.
• Violación directa de GDPR, PCI-DSS, HIPAA según el tipo de datos almacenados.
• Fuente: CWE-89 (MITRE) — Improper Neutralization of Special Elements in SQL Commands.`,
    owasp:`OWASP A03:2021 — Injection | CWE-89 | CWE-564
Fuente: OWASP SQL Injection Prevention Cheat Sheet (cheatsheetseries.owasp.org)
  • Construcción de queries SQL mediante concatenación de strings con datos no validados del usuario.
  • Ausencia de prepared statements / parametrized queries en el acceso a datos.
  • Errores SQL expuestos al cliente que revelan estructura de la base de datos.
  • Permisos de base de datos excesivos para el usuario de la aplicación (principio de mínimo privilegio no aplicado).`,
    proceso:`• Las queries se construyen concatenando directamente parámetros de entrada del usuario.
• El ORM o DAL no fuerza el uso de parámetros vinculados en todas las operaciones.
• Las excepciones de SQL no son manejadas correctamente, exponiendo detalles internos al cliente.
• No existe revisión de código sistemática para detectar queries dinámicas sin parametrizar.`,
    solucion:`1. Usar SIEMPRE prepared statements / parametrized queries:
   ANTES:  "SELECT * FROM usuarios WHERE id = " + Request["id"]
   DESPUÉS: cmd.CommandText = "SELECT * FROM usuarios WHERE id = @id"
            cmd.Parameters.AddWithValue("@id", Request["id"])
2. En Entity Framework usar LINQ o DbContext.Database.SqlQuery con parámetros.
3. Aplicar principio de mínimo privilegio: usuario de BD solo con permisos necesarios (SELECT/INSERT/UPDATE, no DROP/ALTER).
4. Deshabilitar mensajes de error detallados de SQL en producción (customErrors en web.config).
5. Implementar WAF con reglas de detección de SQLi.
6. Escanear con SQLMap o OWASP ZAP en el pipeline CI/CD.
Referencia: OWASP SQL Injection Prevention Cheat Sheet`,
  },

  // ── 6. BROKEN AUTHENTICATION ────────────────────────────────────────────────
  "Broken Authentication":{
    label:"Autenticación Rota / Insegura", icon:"🔐",
    impactos:`• Permite a atacantes comprometer cuentas de usuario mediante credential stuffing, fuerza bruta o explotación de sesiones débiles.
• Acceso no autorizado a datos y funcionalidades protegidas de la aplicación.
• Posibilidad de escalar privilegios y comprometer cuentas administrativas.
• Impacto reputacional severo y exposición a sanciones regulatorias.
• Fuente: CWE-287 — Improper Authentication.`,
    owasp:`OWASP A07:2021 — Identification and Authentication Failures | CWE-287 | CWE-384
Fuente: OWASP Authentication Cheat Sheet (cheatsheetseries.owasp.org)
  • Ausencia de protección contra ataques de fuerza bruta (rate limiting, lockout).
  • Tokens de sesión predecibles o con entropía insuficiente.
  • Sesiones no invalidadas correctamente al cerrar sesión.
  • Ausencia de autenticación multifactor (MFA) en cuentas privilegiadas.
  • Credenciales transmitidas sin cifrado (HTTP en lugar de HTTPS).`,
    proceso:`• El sistema no implementa bloqueo de cuentas ni throttling en el endpoint de login.
• Los tokens de sesión son generados con algoritmos predecibles o de longitud insuficiente.
• Las sesiones persisten más allá del tiempo de inactividad esperado.
• No se fuerza el uso de contraseñas fuertes ni se validan contra listas de contraseñas comunes.`,
    solucion:`1. Implementar rate limiting y lockout en el endpoint de autenticación (máx. 5 intentos, bloqueo de 15 min).
2. Usar tokens de sesión generados con RNGCryptoServiceProvider (mínimo 128 bits de entropía).
3. Configurar timeout de sesión apropiado e invalidar el token al hacer logout (FormsAuthentication.SignOut + Session.Abandon + limpiar cookies).
4. Implementar MFA para cuentas administrativas (TOTP con librería Google Authenticator).
5. Forzar HTTPS con HSTS: Strict-Transport-Security: max-age=31536000; includeSubDomains
6. Validar contraseñas contra Have I Been Pwned API o lista de contraseñas comunes.
Referencia: OWASP Authentication Cheat Sheet`,
  },

  // ── 7. SECURITY MISCONFIGURATION ────────────────────────────────────────────
  "Security Misconfiguration":{
    label:"Mala Configuración de Seguridad", icon:"⚙️",
    impactos:`• Expone información sensible del stack tecnológico (versiones, rutas, configuraciones).
• Puede dar acceso no autorizado a funcionalidades administrativas o de debug.
• Headers de seguridad ausentes permiten ataques de clickjacking, XSS, MIME sniffing.
• Configuraciones por defecto de frameworks y servidores representan vectores de ataque conocidos.
• Fuente: CWE-16 — Configuration.`,
    owasp:`OWASP A05:2021 — Security Misconfiguration | CWE-16 | CWE-611
Fuente: OWASP Security Headers Project, OWASP Top 10 A05
  • Headers HTTP de seguridad ausentes: X-Frame-Options, X-Content-Type-Options, CSP, HSTS.
  • Modos de debug o verbose logging activos en producción.
  • Cuentas y contraseñas por defecto no modificadas.
  • Directorio listing habilitado en servidor web.
  • Mensajes de error detallados expuestos al usuario final.`,
    proceso:`• El proceso de despliegue no incluye hardening checklist del servidor y la aplicación.
• Las configuraciones de desarrollo (debug=true, customErrors=off) se copian a producción sin revisión.
• No existe proceso de revisión periódica de headers de seguridad HTTP.
• Los archivos de configuración sensibles (web.config) no tienen controles de acceso adecuados.`,
    solucion:`1. Implementar headers de seguridad en web.config:
   <add name="X-Frame-Options" value="SAMEORIGIN"/>
   <add name="X-Content-Type-Options" value="nosniff"/>
   <add name="X-XSS-Protection" value="1; mode=block"/>
   <add name="Referrer-Policy" value="strict-origin-when-cross-origin"/>
2. Deshabilitar debug y customErrors en producción: <compilation debug="false"/> y <customErrors mode="On"/>
3. Eliminar headers que revelan tecnología: Server, X-Powered-By, X-AspNet-Version.
4. Deshabilitar directory listing en IIS.
5. Crear checklist de hardening y ejecutarlo en cada despliegue.
Referencia: OWASP Security Misconfiguration (A05:2021)`,
  },

  // ── 8. SENSITIVE DATA EXPOSURE ──────────────────────────────────────────────
  "Sensitive Data Exposure":{
    label:"Exposición de Datos Sensibles", icon:"🔓",
    impactos:`• Exposición de datos personales, financieros o de salud en tránsito o en reposo.
• Violación directa de regulaciones como GDPR, PCI-DSS, HIPAA con sanciones económicas severas.
• Pérdida de confianza del cliente y daño reputacional irreparable.
• Permite a atacantes usar los datos expuestos para ataques posteriores (phishing, fraude).
• Fuente: CWE-311 — Missing Encryption of Sensitive Data.`,
    owasp:`OWASP A02:2021 — Cryptographic Failures | CWE-311 | CWE-312 | CWE-319
Fuente: OWASP Cryptographic Storage Cheat Sheet (cheatsheetseries.owasp.org)
  • Datos sensibles transmitidos en texto plano (HTTP sin TLS).
  • Contraseñas almacenadas sin hashing o con algoritmos débiles (MD5, SHA1 sin salt).
  • Claves de cifrado hardcodeadas o almacenadas en archivos de configuración sin protección.
  • Datos sensibles en logs, URLs, caché del navegador o cookies sin flag Secure.`,
    proceso:`• La aplicación no fuerza HTTPS en todas las comunicaciones.
• Las contraseñas se almacenan con hashing débil o en texto plano en la base de datos.
• Los logs incluyen datos sensibles de usuarios o tokens de autenticación.
• Las cookies de sesión no tienen los flags Secure, HttpOnly y SameSite configurados.`,
    solucion:`1. Forzar HTTPS con HSTS y redirigir todo HTTP a HTTPS.
2. Usar bcrypt o Argon2 para hashing de contraseñas (mínimo cost factor 12 para bcrypt).
3. Cifrar datos sensibles en reposo con AES-256-GCM.
4. Configurar cookies seguras: FormsAuthentication con requireSSL=true, HttpOnly=true.
5. Revisar logs y eliminar cualquier dato personal, token o contraseña.
6. Clasificar datos por nivel de sensibilidad y aplicar controles proporcionales.
Referencia: OWASP Cryptographic Storage Cheat Sheet`,
  },

  // ── 9. XXE ──────────────────────────────────────────────────────────────────
  "XML External Entity":{
    label:"Entidad Externa XML (XXE)", icon:"📄",
    impactos:`• Permite leer archivos arbitrarios del sistema de archivos del servidor (web.config, /etc/passwd).
• Posibilita SSRF (Server-Side Request Forgery) para acceder a servicios internos no expuestos.
• En algunos casos permite ejecución remota de código (RCE) o denegación de servicio (Billion Laughs).
• Exfiltración de credenciales de la aplicación almacenadas en archivos de configuración.
• Fuente: CWE-611 — Improper Restriction of XML External Entity Reference.`,
    owasp:`OWASP A05:2021 — Security Misconfiguration | CWE-611
Fuente: OWASP XXE Prevention Cheat Sheet (cheatsheetseries.owasp.org)
  • El parser XML procesa entidades externas habilitadas por defecto.
  • Documentos XML del usuario no son validados antes del parsing.
  • DTD processing no está deshabilitado en el parser configurado.`,
    proceso:`• La aplicación recibe XML del usuario (APIs, uploads, SOAP) y lo parsea sin restringir entidades externas.
• El XMLDocument o XmlReader en .NET puede tener DTD processing habilitado por configuración legacy.`,
    solucion:`1. Deshabilitar DTD y entidades externas en el parser XML (.NET):
   XmlReaderSettings settings = new XmlReaderSettings();
   settings.DtdProcessing = DtdProcessing.Prohibit;
   settings.XmlResolver = null;
2. Usar XDocument (LINQ to XML) que deshabilita DTD por defecto en .NET.
3. Validar el XML contra un schema (XSD) antes de procesarlo.
4. Actualizar librerías XML a versiones que deshabiliten XXE por defecto.
Referencia: OWASP XXE Prevention Cheat Sheet`,
  },

  // ── 10. INSECURE DESERIALIZATION ────────────────────────────────────────────
  "Insecure Deserialization":{
    label:"Deserialización Insegura", icon:"📦",
    impactos:`• Puede resultar en ejecución remota de código (RCE) en el servidor.
• Permite escalada de privilegios, inyección de objetos y manipulación de lógica de negocio.
• En .NET, la deserialización de tipos arbitrarios con BinaryFormatter o TypeNameHandling puede comprometer completamente el servidor.
• Fuente: CWE-502 — Deserialization of Untrusted Data.`,
    owasp:`OWASP A08:2021 — Software and Data Integrity Failures | CWE-502
Fuente: OWASP Deserialization Cheat Sheet (cheatsheetseries.owasp.org)
  • Objetos serializados de fuentes no confiables son deserializados sin validación de tipo o integridad.
  • Uso de BinaryFormatter (obsoleto y peligroso en .NET).
  • TypeNameHandling.All en Newtonsoft.Json permite instanciar tipos arbitrarios.`,
    proceso:`• La aplicación recibe datos serializados del cliente (cookies, parámetros, APIs) y los deserializa directamente.
• No existe validación de integridad (firma HMAC) antes de la deserialización.`,
    solucion:`1. NO usar BinaryFormatter — está marcado obsoleto en .NET 5+ y eliminado en .NET 7.
2. En Newtonsoft.Json, nunca usar TypeNameHandling.All o Auto con datos externos.
3. Si se necesita deserializar, usar allowlist de tipos permitidos.
4. Firmar los datos serializados con HMAC-SHA256 y validar la firma antes de deserializar.
5. Ejecutar el proceso de deserialización con mínimos privilegios.
Referencia: OWASP Deserialization Cheat Sheet`,
  },

  // ── 11. CSRF ────────────────────────────────────────────────────────────────
  "Cross-Site Request Forgery":{
    label:"Falsificación de Solicitud entre Sitios (CSRF)", icon:"🎭",
    impactos:`• Permite a un sitio malicioso ejecutar acciones en nombre de un usuario autenticado sin su conocimiento.
• Puede resultar en cambio de contraseña, email, transferencias de dinero o eliminación de datos.
• Afecta cualquier acción de estado que dependa solo de cookies de sesión para autenticación.
• Fuente: CWE-352 — Cross-Site Request Forgery.`,
    owasp:`OWASP A01:2021 — Broken Access Control (relacionado) | CWE-352
Fuente: OWASP CSRF Prevention Cheat Sheet (cheatsheetseries.owasp.org)
  • Las solicitudes de estado (POST/PUT/DELETE) no requieren un token CSRF válido.
  • Cookies de sesión sin atributo SameSite=Strict o Lax.
  • Ausencia de validación de Origin/Referer header en endpoints críticos.`,
    proceso:`• Los formularios HTML no incluyen tokens CSRF anti-forgery.
• Las cookies de sesión se envían en solicitudes cross-origin sin restricciones SameSite.
• Los endpoints de modificación de estado solo verifican autenticación pero no origen de la solicitud.`,
    solucion:`1. En ASP.NET MVC, usar el helper integrado de AntiForgery:
   En formulario: @Html.AntiForgeryToken()
   En controlador: [ValidateAntiForgeryToken]
2. Configurar cookies con SameSite=Strict para mayor protección.
3. Para APIs AJAX, incluir el token CSRF en el header X-CSRF-Token.
4. Verificar Origin header en endpoints críticos de API.
Referencia: OWASP CSRF Prevention Cheat Sheet`,
  },

  // ── 12. IDOR ────────────────────────────────────────────────────────────────
  "Insecure Direct Object Reference":{
    label:"Referencia Directa Insegura a Objetos (IDOR)", icon:"🆔",
    impactos:`• Permite acceder, modificar o eliminar recursos de otros usuarios manipulando identificadores en la URL o el cuerpo de la solicitud.
• Expone datos de clientes, registros financieros o documentos confidenciales.
• Puede escalar a acceso a funcionalidades administrativas.
• Fuente: CWE-639 — Authorization Bypass Through User-Controlled Key.`,
    owasp:`OWASP A01:2021 — Broken Access Control | CWE-639 | CWE-284
Fuente: OWASP Insecure Direct Object Reference Prevention Cheat Sheet
  • Los endpoints no verifican que el recurso solicitado pertenece al usuario autenticado.
  • IDs secuenciales o predecibles facilitan la enumeración.
  • Ausencia de autorización a nivel de objeto (row-level security).`,
    proceso:`• Los controladores reciben un ID en la URL (ej. /póliza/1234) y consultan la BD sin verificar que el recurso pertenece al usuario de la sesión.
• No existe middleware de autorización a nivel de recurso.`,
    solucion:`1. En TODOS los endpoints, verificar que el recurso solicitado pertenece al usuario autenticado:
   var poliza = db.Polizas.FirstOrDefault(p => p.Id == id && p.UsuarioId == User.GetUserId());
   if (poliza == null) return Forbid();
2. Usar GUIDs en lugar de IDs secuenciales para dificultar la enumeración.
3. Implementar Row-Level Security en la base de datos como capa adicional.
4. Registrar y alertar sobre accesos denegados para detectar intentos de explotación.
Referencia: OWASP Broken Access Control (A01:2021)`,
  },

  // ── 13. SSRF ────────────────────────────────────────────────────────────────
  "Server-Side Request Forgery":{
    label:"Falsificación de Solicitud del Lado del Servidor (SSRF)", icon:"🌍",
    impactos:`• Permite al atacante hacer que el servidor realice solicitudes HTTP arbitrarias a sistemas internos.
• Puede acceder a servicios cloud de metadatos (AWS IMDSv1, Azure IMDS) y robar credenciales IAM.
• Permite escanear y acceder a servicios internos no expuestos públicamente.
• En entornos cloud puede resultar en takeover completo de la cuenta cloud.
• Fuente: CWE-918 — Server-Side Request Forgery.`,
    owasp:`OWASP A10:2021 — Server-Side Request Forgery | CWE-918
Fuente: OWASP SSRF Prevention Cheat Sheet (cheatsheetseries.owasp.org)
  • La aplicación acepta URLs controladas por el usuario y realiza solicitudes HTTP desde el servidor.
  • Ausencia de validación y allowlist de dominios/IPs destino permitidos.
  • Acceso a URLs internas (169.254.169.254, 10.x.x.x, 172.16.x.x, 192.168.x.x) no bloqueado.`,
    proceso:`• Funcionalidades de preview de URLs, importación de recursos externos, webhooks o integraciones con APIs externas usan la URL proporcionada por el usuario sin validación.`,
    solucion:`1. Implementar allowlist estricta de dominios permitidos para solicitudes externas.
2. Validar y rechazar solicitudes a IPs privadas, loopback y metadata endpoints:
   169.254.169.254, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.1, ::1
3. Deshabilitar redirecciones automáticas en el cliente HTTP.
4. Usar un proxy de salida que filtre solicitudes a destinos no permitidos.
5. Migrar a AWS IMDSv2 (requiere token de sesión) si se usa AWS.
Referencia: OWASP SSRF Prevention Cheat Sheet`,
  },

  // ── 14. COMMAND INJECTION ───────────────────────────────────────────────────
  "Command Injection":{
    label:"Inyección de Comandos del Sistema", icon:"💻",
    impactos:`• Permite ejecutar comandos arbitrarios del sistema operativo con los privilegios del proceso de la aplicación.
• Puede resultar en acceso completo al servidor, exfiltración de datos, instalación de backdoors o ransomware.
• Una de las vulnerabilidades con mayor impacto posible (CVSS score típicamente 9.8-10.0).
• Fuente: CWE-78 — Improper Neutralization of Special Elements in OS Command.`,
    owasp:`OWASP A03:2021 — Injection | CWE-78
Fuente: OWASP OS Command Injection Defense Cheat Sheet (cheatsheetseries.owasp.org)
  • Entrada del usuario incluida directamente en llamadas a Process.Start, cmd.exe, shell_exec.
  • Ausencia de validación de caracteres especiales de shell (;, |, &&, backtick, $()).
  • Privilegios excesivos del proceso de la aplicación web.`,
    proceso:`• La aplicación ejecuta comandos del sistema usando datos del usuario sin sanitización, típicamente en funcionalidades de conversión de archivos, ping, generación de reportes o integración con herramientas externas.`,
    solucion:`1. NUNCA construir comandos del sistema con datos del usuario. Usar APIs nativas del lenguaje.
2. Si es inevitable, usar Process.Start con argumentos como array (no string concatenado):
   var proc = new Process();
   proc.StartInfo.FileName = "programa";
   proc.StartInfo.Arguments = ValidarArgumento(input);  // allowlist estricta
3. Implementar allowlist de valores permitidos para cualquier parámetro que llegue al comando.
4. Ejecutar la aplicación con el mínimo de privilegios necesarios (principio de mínimo privilegio).
5. Usar contenedores/sandboxing para limitar el impacto de una ejecución exitosa.
Referencia: OWASP OS Command Injection Defense Cheat Sheet`,
  },

  // ── 15. PATH TRAVERSAL ──────────────────────────────────────────────────────
  "Path Traversal":{
    label:"Traversal de Directorios / Path Traversal", icon:"📂",
    impactos:`• Permite leer archivos fuera del directorio raíz de la aplicación (web.config, appsettings.json, /etc/passwd).
• Puede exponer credenciales de bases de datos, claves de API y secretos de configuración.
• En casos de escritura de archivos, puede resultar en RCE (webshell upload).
• Fuente: CWE-22 — Improper Limitation of a Pathname to a Restricted Directory.`,
    owasp:`OWASP A01:2021 — Broken Access Control | CWE-22 | CWE-23
Fuente: OWASP Path Traversal (cheatsheetseries.owasp.org)
  • Nombres de archivos o rutas proporcionados por el usuario usados directamente en operaciones de I/O.
  • Secuencias ../  no son filtradas ni normalizadas antes de usar la ruta.
  • El directorio base de trabajo no está restringido correctamente.`,
    proceso:`• La aplicación usa parámetros del usuario (nombre de archivo, ruta) para operaciones de lectura/escritura de archivos, como en descarga de documentos, plantillas o recursos.`,
    solucion:`1. Usar Path.GetFullPath() y verificar que la ruta resultante comienza con el directorio base permitido:
   var basePath = Server.MapPath("~/uploads/");
   var fullPath = Path.GetFullPath(Path.Combine(basePath, userFileName));
   if (!fullPath.StartsWith(basePath)) return BadRequest();
2. Usar una allowlist de extensiones de archivo permitidas.
3. Generar nombres de archivo internos (GUID) en lugar de usar el nombre proporcionado por el usuario.
4. Nunca servir archivos de rutas absolutas proporcionadas por el usuario.
Referencia: OWASP Path Traversal Prevention`,
  },

  // ── 16. CLICKJACKING ────────────────────────────────────────────────────────
  "Clickjacking":{
    label:"Clickjacking / UI Redressing", icon:"🖱️",
    impactos:`• Un atacante embebe la aplicación en un iframe invisible sobre otro sitio, engañando al usuario para hacer clic en elementos sin saberlo.
• Permite ejecutar acciones autenticadas no intencionadas (transferencias, cambios de configuración, autorizaciones).
• Especialmente peligroso en aplicaciones financieras y administrativas.
• Fuente: CWE-1021 — Improper Restriction of Rendered UI Layers.`,
    owasp:`OWASP A05:2021 — Security Misconfiguration | CWE-1021
Fuente: OWASP Clickjacking Defense Cheat Sheet (cheatsheetseries.owasp.org)
  • Ausencia del header X-Frame-Options que impida el embedding en iframes.
  • Ausencia de Content-Security-Policy: frame-ancestors directiva.`,
    proceso:`• La aplicación no envía headers que restrinjan su uso en iframes, permitiendo ser embebida desde cualquier dominio.`,
    solucion:`1. Agregar header X-Frame-Options en web.config:
   <add name="X-Frame-Options" value="SAMEORIGIN"/>
2. Mejor práctica: usar CSP frame-ancestors (más flexible y moderno):
   Content-Security-Policy: frame-ancestors 'self'
3. Para permitir solo dominios específicos:
   Content-Security-Policy: frame-ancestors 'self' https://trusted.empresa.com
4. Implementar framebusting como defensa adicional en JavaScript (no como única medida).
Referencia: OWASP Clickjacking Defense Cheat Sheet`,
  },

  // ── 17. OPEN REDIRECT ───────────────────────────────────────────────────────
  "Open Redirect":{
    label:"Redirección Abierta / Open Redirect", icon:"↪️",
    impactos:`• Permite a un atacante usar la URL confiable de la aplicación para redirigir a usuarios a sitios maliciosos de phishing.
• Los usuarios confían en la URL inicial del dominio legítimo y no detectan la redirección.
• Puede usarse para eludir filtros de phishing y listas negras de URLs maliciosas.
• Fuente: CWE-601 — URL Redirection to Untrusted Site (Open Redirect).`,
    owasp:`OWASP A01:2021 — Broken Access Control | CWE-601
Fuente: OWASP Unvalidated Redirects and Forwards Cheat Sheet
  • Parámetros de URL como returnUrl, redirect, next, url son usados directamente para redirigir sin validación.
  • Ausencia de allowlist de URLs de destino permitidas.`,
    proceso:`• El parámetro returnUrl en el proceso de login o en funcionalidades de "ir a" permite redirección a cualquier URL sin validar el dominio de destino.`,
    solucion:`1. En ASP.NET MVC, usar Url.IsLocalUrl() para validar returnUrl:
   if (Url.IsLocalUrl(returnUrl)) return Redirect(returnUrl);
   else return RedirectToAction("Index", "Home");
2. Si se necesita redirigir a dominios externos, mantener una allowlist explícita.
3. Nunca incluir la URL de destino directamente en parámetros visibles del usuario.
Referencia: OWASP Unvalidated Redirects and Forwards Cheat Sheet`,
  },

  // ── 18. HARDCODED CREDENTIALS ───────────────────────────────────────────────
  "Hardcoded Credentials":{
    label:"Credenciales Hardcodeadas", icon:"🔑",
    impactos:`• Credenciales embebidas en el código fuente son accesibles a cualquiera con acceso al repositorio.
• Una vez publicado el código (accidentalmente o por breach del repo), las credenciales son irrecuperables.
• Acceso permanente hasta que se detecte el problema y se roten las credenciales.
• Fuente: CWE-798 — Use of Hard-coded Credentials.`,
    owasp:`OWASP A02:2021 — Cryptographic Failures / A05 Misconfiguration | CWE-798 | CWE-259
Fuente: GitHub Advisory Database, OWASP
  • Contraseñas, API keys, connection strings o tokens hardcodeados en archivos de código, scripts o configuración versionados.
  • Ausencia de escaneo de secretos en el pipeline CI/CD.`,
    proceso:`• Los desarrolladores hardcodean credenciales de desarrollo/prueba que eventualmente llegan a producción.
• No existe proceso de revisión de código enfocado en detectar secretos.
• Los archivos de configuración con credenciales son incluidos en el repositorio Git.`,
    solucion:`1. Mover TODAS las credenciales a variables de entorno o a Azure Key Vault / AWS Secrets Manager.
2. En ASP.NET MVC, usar ConfigurationManager con appSettings externos:
   <appSettings file="secrets.config"/> y excluir secrets.config del .gitignore.
3. Agregar herramienta de escaneo de secretos al pipeline: git-secrets, truffleHog, GitGuardian.
4. Rotar INMEDIATAMENTE cualquier credencial que haya sido expuesta en el historial de Git.
5. Usar git-filter-repo para eliminar secretos del historial del repositorio.
Referencia: OWASP Secrets Management Cheat Sheet`,
  },

  // ── 19. IMPROPER ERROR HANDLING ─────────────────────────────────────────────
  "Improper Error Handling":{
    label:"Manejo Inadecuado de Errores", icon:"❌",
    impactos:`• Los mensajes de error detallados revelan stack traces, rutas del sistema, versiones de componentes y estructura de la base de datos.
• Esta información facilita el reconocimiento del atacante y acelera la explotación de otras vulnerabilidades.
• Los errores no registrados impiden la detección de ataques en curso.
• Fuente: CWE-209 — Generation of Error Message Containing Sensitive Information.`,
    owasp:`OWASP A05:2021 — Security Misconfiguration | CWE-209 | CWE-544
Fuente: OWASP Error Handling Cheat Sheet (cheatsheetseries.owasp.org)
  • Excepciones no manejadas exponen stack traces al usuario final.
  • customErrors mode="Off" en web.config de producción.
  • Mensajes de error de base de datos (SQL Server errors) expuestos directamente.`,
    proceso:`• La configuración web.config tiene customErrors deshabilitado o en modo RemoteOnly.
• Los controladores no tienen manejo de excepciones global (filtros de excepción).
• Los errores de validación incluyen información técnica interna no apropiada para el usuario.`,
    solucion:`1. En web.config de producción: <customErrors mode="On" defaultRedirect="~/Error"/>
2. Implementar filtro de excepción global en ASP.NET MVC:
   FilterConfig.RegisterGlobalFilters(GlobalFilters.Filters);
   filters.Add(new HandleErrorAttribute());
3. Registrar todos los errores con un sistema de logging (NLog, Serilog) sin exponer al usuario.
4. Mostrar al usuario solo mensajes genéricos amigables, sin detalles técnicos.
5. Deshabilitar los headers que revelan versión: <httpRuntime enableVersionHeader="false"/>
Referencia: OWASP Error Handling Cheat Sheet`,
  },

  // ── 20. DIRECTORY LISTING ───────────────────────────────────────────────────
  "Directory Listing":{
    label:"Listado de Directorios Expuesto", icon:"📁",
    impactos:`• Expone la estructura completa de archivos y directorios de la aplicación al atacante.
• Puede revelar archivos de respaldo, configuración, logs y código fuente accidentalmente publicados.
• Facilita el reconocimiento y la identificación de vectores de ataque adicionales.
• Fuente: CWE-548 — Exposure of Information Through Directory Listing.`,
    owasp:`OWASP A05:2021 — Security Misconfiguration | CWE-548
  • El servidor web tiene habilitado el autoindexing/directory browsing.
  • No existe un archivo index.html o default.aspx en todos los directorios web.`,
    proceso:`• IIS tiene el feature "Directory Browsing" habilitado en el sitio o a nivel de servidor.
• No existe revisión sistemática de la configuración del servidor antes de cada despliegue.`,
    solucion:`1. Deshabilitar Directory Browsing en IIS: IIS Manager → sitio → Directory Browsing → Disable.
2. En web.config: <directoryBrowse enabled="false"/>
3. Asegurar que todos los directorios accesibles tienen un archivo index por defecto.
4. Revisar y restringir los permisos de acceso a directorios de archivos estáticos.
Referencia: OWASP Security Misconfiguration (A05:2021)`,
  },

  // ── 21. FILE UPLOAD ─────────────────────────────────────────────────────────
  "Unrestricted File Upload":{
    label:"Carga de Archivos Sin Restricción", icon:"📤",
    impactos:`• Permite subir y ejecutar código malicioso en el servidor (webshell, reverse shell).
• Puede resultar en compromiso completo del servidor (RCE).
• Archivos maliciosos pueden atacar a otros usuarios que los descarguen (malware, XSS vía SVG/HTML).
• Fuente: CWE-434 — Unrestricted Upload of File with Dangerous Type.`,
    owasp:`OWASP A04:2021 — Insecure Design / A05 Misconfiguration | CWE-434
Fuente: OWASP File Upload Cheat Sheet (cheatsheetseries.owasp.org)
  • Validación de tipo de archivo basada solo en extensión o Content-Type header (ambos falsificables).
  • Archivos subidos almacenados en un directorio ejecutable o accesible desde la web.
  • Ausencia de análisis de contenido real del archivo.`,
    proceso:`• La funcionalidad de carga de archivos valida solo la extensión o el MIME type del header, sin analizar el contenido real del archivo.
• Los archivos se almacenan en directorios dentro del webroot con permisos de ejecución.`,
    solucion:`1. Validar tipo de archivo por firma (magic bytes), no solo por extensión:
   Leer los primeros bytes del archivo y comparar con firmas conocidas.
2. Almacenar archivos FUERA del webroot (no accesibles directamente por URL).
3. Renombrar archivos al subir (GUID + extensión permitida).
4. Usar allowlist estricta de extensiones: solo .pdf, .jpg, .png, .xlsx según el caso de uso.
5. Escanear archivos con antivirus/antimalware antes de procesarlos.
6. Servir archivos como attachment con Content-Disposition: attachment.
Referencia: OWASP File Upload Cheat Sheet`,
  },

  // ── 22. REGEX DOS (ReDoS) ───────────────────────────────────────────────────
  "ReDoS":{
    label:"Denegación de Servicio por Expresión Regular (ReDoS)", icon:"⏱️",
    impactos:`• Una expresión regular vulnerable puede causar que el servidor consuma 100% CPU procesando una entrada especialmente construida.
• Puede resultar en denegación de servicio (DoS) para todos los usuarios de la aplicación.
• El CVE registrado para jquery-validation <1.19.3 es precisamente un ReDoS en la validación de URLs.
• Fuente: CWE-1333 — Inefficient Regular Expression Complexity.
• Referencias: OSV.dev GHSA-jquq-152w-8j8h, GitHub Advisory Database.`,
    owasp:`OWASP A06:2021 — Vulnerable and Outdated Components | CWE-1333
Fuente: OSV.dev, GitHub Advisory Database, NVD/NIST
  • La librería jquery-validation < 1.19.3 contiene una expresión regular vulnerable en la validación de URLs.
  • El motor de regex usa backtracking catastrófico al procesar ciertos inputs.
  • Aplicable también a expresiones regulares custom escritas en el código de la aplicación.`,
    proceso:`• La librería jquery-validation está referenciada en packages.config con una versión anterior a 1.19.3.
• No existe proceso de monitoreo de CVEs para dependencias NuGet.
• El pipeline CI/CD no incluye herramienta SCA (Software Composition Analysis).`,
    solucion:`1. Actualizar jquery-validation a versión ≥ 1.19.3 en packages.config (fix del CVE de ReDoS).
2. Para expresiones regulares custom, revisar y evitar patrones con backtracking catastrófico:
   • Evitar: (a+)+ , ([a-zA-Z]+)* , (a|aa)+
   • Usar límites de longitud en los inputs antes del regex.
3. Integrar herramienta SCA al pipeline: dotnet-outdated, OWASP Dependency-Check o Snyk.
4. Suscribirse a alertas de seguridad de GitHub Dependabot para el repositorio.
5. Verificar en OSV.dev y NVD que no existen CVEs adicionales en otras dependencias.
Referencias: OSV.dev, GitHub Advisory Database, NVD NIST`,
  },

  // ── 23. PROTOTYPE POLLUTION ─────────────────────────────────────────────────
  "Prototype Pollution":{
    label:"Contaminación de Prototipo JavaScript (Prototype Pollution)", icon:"🧬",
    impactos:`• Permite modificar el prototipo de Object en JavaScript, afectando todos los objetos de la aplicación.
• Puede resultar en ejecución de código arbitrario, bypass de controles de seguridad o DoS.
• Especialmente relevante en aplicaciones con jQuery y librerías que realizan deep merge de objetos.
• Fuente: CWE-1321 — Improperly Controlled Modification of Object Prototype Attributes.`,
    owasp:`OWASP A03:2021 — Injection | CWE-1321
Fuente: GitHub Advisory Database, Snyk Vulnerability DB
  • Librerías que realizan deep merge recursivo de objetos sin verificar __proto__, constructor, prototype.
  • jQuery versiones antiguas son vulnerables a Prototype Pollution en $.extend().
  • Inputs del usuario que se fusionan con objetos de configuración sin sanitización.`,
    proceso:`• La aplicación usa jQuery $.extend() o _.merge() con datos del usuario o de APIs externas sin validar.
• Librerías de utilidades en versiones desactualizadas incluyen la vulnerabilidad.`,
    solucion:`1. Actualizar jQuery a versión ≥ 3.4.0 (fix de Prototype Pollution en $.extend).
2. Al realizar deep merge de objetos, validar que las claves no sean __proto__, constructor, prototype:
   function safeMerge(target, source) {
     for (const key of Object.keys(source)) {
       if (key === '__proto__' || key === 'constructor') continue;
       target[key] = source[key];
     }
   }
3. Usar Object.freeze(Object.prototype) en el contexto de la aplicación.
4. Validar y sanitizar todos los inputs JSON antes de operaciones de merge.
Referencia: GitHub Advisory Database — Prototype Pollution advisories`,
  },

  // ── 24. JWT VULNERABILITIES ─────────────────────────────────────────────────
  "JWT Vulnerability":{
    label:"Vulnerabilidad en JSON Web Tokens (JWT)", icon:"🎫",
    impactos:`• Algoritmo 'none': permite crear tokens sin firma, eludiendo la autenticación completamente.
• Confusión RS256→HS256: permite forjar tokens con la clave pública como secreto HMAC.
• Secretos débiles permiten ataques de fuerza bruta offline.
• Impacto: acceso no autorizado a cualquier recurso protegido por JWT.
• Fuente: CWE-347 — Improper Verification of Cryptographic Signature.`,
    owasp:`OWASP A02:2021 — Cryptographic Failures / A07 Auth Failures | CWE-347
Fuente: OWASP JSON Web Token Cheat Sheet (cheatsheetseries.owasp.org)
  • El servidor acepta el algoritmo especificado en el header del token sin verificación.
  • Uso de secretos cortos o predecibles en HMAC-SHA256.
  • Ausencia de validación de campos críticos: exp, iss, aud.
  • Tokens sin tiempo de expiración o con expiración excesivamente larga.`,
    proceso:`• La librería JWT acepta el algoritmo del header del token (alg) sin una allowlist explícita.
• Los secretos JWT son strings cortos almacenados en web.config sin protección adicional.`,
    solucion:`1. Especificar SIEMPRE el algoritmo esperado al validar (nunca aceptar el del token):
   var validationParams = new TokenValidationParameters {
     ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 }
   };
2. Usar secretos de mínimo 256 bits generados con RNGCryptoServiceProvider.
3. Validar exp, iss y aud en cada token.
4. Establecer expiración corta (15-60 min) con refresh tokens.
5. Implementar revocación de tokens con jti claim y lista de tokens revocados.
Referencia: OWASP JWT Cheat Sheet`,
  },

  // ── 25. CORS MISCONFIGURATION ───────────────────────────────────────────────
  "CORS Misconfiguration":{
    label:"Mala Configuración de CORS", icon:"🌐",
    impactos:`• Permite a sitios maliciosos realizar solicitudes autenticadas a la API desde el navegador del usuario.
• Puede resultar en robo de datos, ejecución de acciones no autorizadas o CSRF a través de CORS.
• Configuración Access-Control-Allow-Origin: * con credenciales es especialmente peligrosa.
• Fuente: CWE-942 — Permissive Cross-domain Policy with Untrusted Domains.`,
    owasp:`OWASP A05:2021 — Security Misconfiguration | CWE-942
Fuente: OWASP CORS Security Cheat Sheet
  • Access-Control-Allow-Origin refleja el Origin del request sin validación.
  • Uso de wildcard * con Access-Control-Allow-Credentials: true (inválido per spec pero mal implementado).
  • Allowlist de orígenes que incluye dominios no confiables o subdominios vulnerables.`,
    proceso:`• La configuración CORS de la API no tiene una allowlist explícita de orígenes y refleja cualquier Origin recibido.`,
    solucion:`1. Definir allowlist explícita de orígenes permitidos en web.config o Startup.cs.
2. NUNCA usar Access-Control-Allow-Origin: * para endpoints que manejan autenticación o datos sensibles.
3. Validar el Origin contra la allowlist antes de incluirlo en la respuesta.
4. Revisar todos los subdominios incluidos en la allowlist: un subdominio vulnerable puede comprometer la política CORS.
Referencia: OWASP CORS Security Cheat Sheet`,
  },

  // ── 26. SESSION FIXATION ────────────────────────────────────────────────────
  "Session Fixation":{
    label:"Fijación de Sesión (Session Fixation)", icon:"📌",
    impactos:`• El atacante puede fijar el ID de sesión de la víctima antes del login, y luego asumir esa sesión una vez que la víctima se autentica.
• Acceso completo a la sesión autenticada del usuario víctima.
• Fuente: CWE-384 — Session Fixation.`,
    owasp:`OWASP A07:2021 — Identification and Authentication Failures | CWE-384
Fuente: OWASP Session Management Cheat Sheet (cheatsheetseries.owasp.org)
  • El ID de sesión no se regenera después de una autenticación exitosa.
  • La aplicación acepta IDs de sesión enviados en parámetros de URL.`,
    proceso:`• Al hacer login, la aplicación mantiene el mismo ID de sesión que tenía el usuario antes de autenticarse.
• El ID de sesión puede ser aceptado como parámetro GET en la URL.`,
    solucion:`1. Regenerar SIEMPRE el ID de sesión después de la autenticación exitosa:
   Session.Abandon();
   Response.Cookies.Add(new HttpCookie("ASP.NET_SessionId", ""));
   // El nuevo request generará un nuevo session ID
2. Nunca aceptar session IDs en parámetros de URL (GET).
3. Configurar cookies de sesión con HttpOnly=true, Secure=true, SameSite=Strict.
Referencia: OWASP Session Management Cheat Sheet`,
  },

  // ── 27. INSECURE COOKIE ─────────────────────────────────────────────────────
  "Insecure Cookie":{
    label:"Cookie Insegura / Sin Flags de Seguridad", icon:"🍪",
    impactos:`• Sin HttpOnly: accesible vía JavaScript, permite robo de cookie con XSS.
• Sin Secure: transmitida en HTTP plano, susceptible a sniffing en redes no confiables.
• Sin SameSite: contribuye a ataques CSRF.
• Fuente: CWE-614 — Sensitive Cookie in HTTPS Session Without 'Secure' Attribute.`,
    owasp:`OWASP A02:2021 — Cryptographic Failures / A07 Auth Failures | CWE-614 | CWE-1004
Fuente: OWASP Session Management Cheat Sheet (cheatsheetseries.owasp.org)
  • Las cookies de sesión o de autenticación no tienen los atributos Secure, HttpOnly y SameSite configurados.`,
    proceso:`• La configuración de FormsAuthentication o Session en web.config no especifica requireSSL=true ni httpOnlyCookies=true.`,
    solucion:`1. En web.config:
   <httpCookies httpOnlyCookies="true" requireSSL="true" sameSite="Strict"/>
   <forms ... requireSSL="true"/>
2. Para cookies custom en código:
   var cookie = new HttpCookie("nombre", valor);
   cookie.HttpOnly = true;
   cookie.Secure = true;
   cookie.SameSite = SameSiteMode.Strict;
3. Revisar todas las cookies que se generan y asegurar que las sensibles tengan estos flags.
Referencia: OWASP Session Management Cheat Sheet`,
  },

  // ── 28. HTTP REQUEST SMUGGLING ──────────────────────────────────────────────
  "HTTP Request Smuggling":{
    label:"Contrabando de Solicitudes HTTP (Request Smuggling)", icon:"📬",
    impactos:`• Permite a un atacante interferir con la forma en que un proxy/CDN/balanceador procesa las solicitudes HTTP.
• Puede resultar en bypass de controles de seguridad, envenenamiento de caché, robo de solicitudes de otros usuarios.
• CVSS típicamente 8.1-9.8 dependiendo del impacto.
• Fuente: CWE-444 — Inconsistent Interpretation of HTTP Requests.`,
    owasp:`OWASP A05:2021 — Security Misconfiguration | CWE-444
Fuente: PortSwigger Web Security Academy, OWASP
  • Ambigüedad en el parsing entre Content-Length y Transfer-Encoding headers entre servidor frontal y backend.
  • Versiones desactualizadas de servidores web o proxies con interpretación inconsistente de HTTP/1.1.`,
    proceso:`• La arquitectura usa un proxy reverso (IIS, nginx, CDN) frente al servidor de aplicación, con versiones que interpretan diferente los headers de longitud.`,
    solucion:`1. Actualizar todos los componentes de la cadena HTTP (IIS, ARR, CDN) a versiones que manejen correctamente HTTP/1.1.
2. Preferir HTTP/2 que no tiene este problema (un stream por solicitud).
3. Configurar el servidor para rechazar solicitudes ambiguas con ambos headers (Content-Length y Transfer-Encoding).
4. Deshabilitar la reutilización de conexiones backend en el proxy si no puede corregirse de otra forma.
Referencia: PortSwigger HTTP Request Smuggling`,
  },

  // ── 29. TEMPLATE INJECTION (SSTI) ───────────────────────────────────────────
  "Server-Side Template Injection":{
    label:"Inyección en Plantillas del Servidor (SSTI)", icon:"📝",
    impactos:`• Permite ejecutar código arbitrario en el servidor dentro del contexto del motor de plantillas.
• En muchos motores puede escalar a RCE completo (Jinja2, Freemarker, Velocity, Razor mal configurado).
• Permite leer variables de entorno, archivos y ejecutar comandos del sistema.
• Fuente: CWE-94 — Improper Control of Generation of Code.`,
    owasp:`OWASP A03:2021 — Injection | CWE-94 | CWE-1336
Fuente: OWASP Server-Side Template Injection (cheatsheetseries.owasp.org)
  • Datos del usuario incluidos directamente en la plantilla antes de renderizarla.
  • El motor de plantillas evalúa expresiones dentro de los datos del usuario.`,
    proceso:`• El código genera plantillas dinámicamente concatenando strings con datos del usuario en lugar de pasarlos como variables al contexto de la plantilla.`,
    solucion:`1. NUNCA concatenar datos del usuario en el string de la plantilla. Pasar SIEMPRE como variables de contexto:
   INCORRECTO: engine.Render(template + userInput)
   CORRECTO:   engine.Render(template, new { userInput = userInput })
2. En Razor (ASP.NET MVC), @variable aplica HTML encoding automático — nunca usar @Html.Raw(userInput).
3. Usar sandboxing del motor de plantillas si se permite a usuarios definir plantillas.
Referencia: OWASP SSTI`,
  },

  // ── 30. NOSQL INJECTION ─────────────────────────────────────────────────────
  "NoSQL Injection":{
    label:"Inyección NoSQL", icon:"🗃️",
    impactos:`• Permite manipular queries de bases de datos NoSQL (MongoDB, CouchDB) para acceder a datos no autorizados.
• Puede eludir autenticación, exfiltrar colecciones completas o realizar DoS.
• Diferente a SQL Injection pero igualmente grave.
• Fuente: CWE-943 — Improper Neutralization of Special Elements in Data Query Logic.`,
    owasp:`OWASP A03:2021 — Injection | CWE-943
Fuente: OWASP NoSQL Injection (cheatsheetseries.owasp.org)
  • Operadores MongoDB como $where, $gt, $ne incluidos en datos del usuario son evaluados como parte de la query.
  • JSON del usuario deserializado directamente en el filtro de la query sin validación.`,
    proceso:`• La aplicación construye queries NoSQL usando objetos JSON recibidos del cliente sin sanitizar los operadores especiales.`,
    solucion:`1. Validar y sanitizar inputs para eliminar operadores NoSQL ($where, $gt, $ne, $regex, etc.).
2. Usar ODMs (Mongoose) que parametrizan las queries.
3. Implementar validación de schema estricta para todos los documentos de entrada.
4. Nunca pasar objetos JSON del usuario directamente como filtro de query.
Referencia: OWASP NoSQL Injection Prevention Cheat Sheet`,
  },

  // ── 31. DEPENDENCY CONFUSION ────────────────────────────────────────────────
  "Dependency Confusion":{
    label:"Confusión de Dependencias (Dependency Confusion)", icon:"🔀",
    impactos:`• Un atacante publica en el registro público (npm, PyPI, NuGet) un paquete con el mismo nombre que un paquete interno privado pero con versión mayor.
• Los sistemas de build descargan el paquete malicioso del registro público en lugar del privado.
• Puede resultar en ejecución de código malicioso en el pipeline CI/CD o en producción.
• Fuente: CWE-427 — Uncontrolled Search Path Element.`,
    owasp:`OWASP A06:2021 — Vulnerable and Outdated Components / A08 Software Integrity Failures | CWE-427
Fuente: GitHub Advisory Database, OSV.dev
  • Los gestores de paquetes priorizan registros públicos sobre privados por defecto.
  • Paquetes internos con nombres no registrados en el registro público.`,
    proceso:`• Los proyectos usan feeds privados de NuGet/npm para paquetes internos sin configurar la prioridad correcta ni el scoping de namespaces.`,
    solucion:`1. En NuGet, usar namespaces reservados para paquetes privados (NamespaceReservation).
2. Configurar el feed de paquetes para priorizar el privado: packageSources en NuGet.Config.
3. Registrar el nombre de todos los paquetes internos en el registro público (aunque vacíos) para prevenir squatting.
4. Usar Package ID Prefix Reservation en NuGet.org para los namespaces de la empresa.
5. Auditar regularmente las dependencias con OWASP Dependency-Check.
Referencia: GitHub Advisory Database — Dependency Confusion`,
  },

  // ── 32. WEAK CRYPTOGRAPHY ───────────────────────────────────────────────────
  "Weak Cryptography":{
    label:"Criptografía Débil o Inadecuada", icon:"🔒",
    impactos:`• Datos cifrados con algoritmos débiles (MD5, SHA1, DES, RC4) pueden ser descifrados en tiempo razonable.
• Contraseñas hasheadas con MD5/SHA1 sin salt son vulnerables a ataques de rainbow table y GPU cracking.
• Pérdida de confidencialidad e integridad de los datos protegidos.
• Fuente: CWE-327 — Use of a Broken or Risky Cryptographic Algorithm.`,
    owasp:`OWASP A02:2021 — Cryptographic Failures | CWE-327 | CWE-328 | CWE-330
Fuente: OWASP Cryptographic Storage Cheat Sheet (cheatsheetseries.owasp.org)
  • Uso de MD5 o SHA1 para almacenamiento de contraseñas (roto para este propósito).
  • Uso de DES, 3DES, RC4 para cifrado de datos (obsoletos y vulnerables).
  • IVs estáticos o predecibles en cifrado simétrico.
  • Claves de cifrado de longitud insuficiente.`,
    proceso:`• El código legacy usa APIs criptográficas antiguas de .NET (MD5CryptoServiceProvider, SHA1Managed) para funciones que requieren seguridad.`,
    solucion:`1. Para hashing de contraseñas: usar BCrypt.Net o Argon2 (nunca MD5/SHA1 solos):
   string hash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
2. Para cifrado simétrico: usar AES-256-GCM (System.Security.Cryptography.AesGcm en .NET).
3. Para hashing de integridad: usar SHA-256 o SHA-3 mínimo.
4. Generar IVs/nonces aleatorios con RNGCryptoServiceProvider para cada operación de cifrado.
5. Revisar todo el código criptográfico y migrar de APIs obsoletas.
Referencia: OWASP Cryptographic Storage Cheat Sheet`,
  },

  // ── 33. INSECURE LOGGING / MONITORING ──────────────────────────────────────
  "Insufficient Logging":{
    label:"Registro y Monitoreo Insuficiente", icon:"📋",
    impactos:`• Sin logs adecuados, los ataques no son detectados ni investigados, permitiendo que persistan por meses.
• Imposibilidad de realizar forense digital post-incidente.
• No conformidad con regulaciones que requieren auditoría (GDPR, PCI-DSS, SOX).
• Fuente: CWE-778 — Insufficient Logging.`,
    owasp:`OWASP A09:2021 — Security Logging and Monitoring Failures | CWE-778 | CWE-223
Fuente: OWASP Logging Cheat Sheet (cheatsheetseries.owasp.org)
  • Eventos de seguridad críticos no son registrados: intentos de login fallidos, acceso denegado, cambios de contraseña.
  • Los logs no incluyen suficiente contexto: timestamp, IP, usuario, acción, resultado.
  • Los logs no son monitoreados ni alertados en tiempo real.`,
    proceso:`• La aplicación no tiene una estrategia de logging de seguridad definida.
• Los logs de aplicación mezclan información de debug con eventos de seguridad sin estructura clara.
• No existe integración con un SIEM o sistema de alertas.`,
    solucion:`1. Implementar logging estructurado con Serilog o NLog con campos estándar: timestamp, nivel, usuarioId, IP, acción, recurso, resultado.
2. Registrar obligatoriamente: intentos de autenticación (éxito/fallo), acceso a datos sensibles, cambios de configuración, errores de autorización.
3. No registrar datos sensibles en logs: contraseñas, tokens, números de tarjeta.
4. Centralizar logs en un SIEM (Splunk, ELK Stack, Azure Sentinel).
5. Configurar alertas para patrones de ataque: múltiples fallos de login, accesos a horas inusuales.
Referencia: OWASP Logging Cheat Sheet`,
  },

  // ── 34. MASS ASSIGNMENT ─────────────────────────────────────────────────────
  "Mass Assignment":{
    label:"Asignación Masiva de Propiedades (Mass Assignment)", icon:"📋",
    impactos:`• Permite a un atacante modificar propiedades del modelo que no deberían ser accesibles desde el cliente (ej. roles, isAdmin, precio, saldo).
• Escalada de privilegios no autorizada o manipulación de datos de negocio.
• Fuente: CWE-915 — Improperly Controlled Modification of Dynamically-Determined Object Attributes.`,
    owasp:`OWASP A04:2021 — Insecure Design | CWE-915
Fuente: OWASP Mass Assignment Cheat Sheet (cheatsheetseries.owasp.org)
  • El model binding de ASP.NET MVC mapea automáticamente todos los campos del request al modelo sin filtrar propiedades sensibles.
  • Ausencia de DTOs o ViewModels que expongan solo los campos necesarios.`,
    proceso:`• Los controladores usan la entidad de dominio directamente como parámetro del action method, en lugar de un ViewModel/DTO con solo los campos editables.`,
    solucion:`1. Usar ViewModels/DTOs separados de las entidades de dominio:
   // INCORRECTO: public ActionResult Edit(Usuario usuario)
   // CORRECTO:
   public ActionResult Edit(EditarUsuarioViewModel vm) {
     var usuario = db.Usuarios.Find(vm.Id);
     usuario.Nombre = vm.Nombre; // Solo campos permitidos
   }
2. En ASP.NET MVC usar [Bind(Include="Campo1,Campo2")] para whitelist explícita.
3. Usar [BindNever] en propiedades que nunca deben venir del cliente.
4. Revisar TODOS los action methods que reciben modelos del cliente.
Referencia: OWASP Mass Assignment Cheat Sheet`,
  },

  // ── 35. LDAP INJECTION ──────────────────────────────────────────────────────
  "LDAP Injection":{
    label:"Inyección LDAP", icon:"📒",
    impactos:`• Permite manipular queries LDAP para eludir autenticación, enumerar usuarios o acceder a datos del directorio.
• Puede revelar información sensible del Active Directory como usuarios, grupos y atributos.
• Fuente: CWE-90 — Improper Neutralization of Special Elements used in an LDAP Query.`,
    owasp:`OWASP A03:2021 — Injection | CWE-90
Fuente: OWASP LDAP Injection Prevention Cheat Sheet (cheatsheetseries.owasp.org)
  • Datos del usuario incluidos directamente en filtros LDAP sin escape.
  • Caracteres especiales LDAP no sanitizados: (, ), *, \, NUL.`,
    proceso:`• El código construye filtros LDAP concatenando el username del usuario sin escape de caracteres especiales LDAP.`,
    solucion:`1. Escapar todos los inputs usados en filtros LDAP con la función de escape del framework:
   // En .NET usar SearchRequest con parámetros o escapar manualmente:
   string safeInput = input.Replace("\\","\\5c").Replace("*","\\2a").Replace("(","\\28").Replace(")","\\29");
2. Usar frameworks que parametrizan las queries LDAP automáticamente.
3. Implementar allowlist estricta de caracteres permitidos en el username (alfanumérico + @._-).
4. Principio de mínimo privilegio para la cuenta de servicio LDAP.
Referencia: OWASP LDAP Injection Prevention Cheat Sheet`,
  },

  // ── 36. XML INJECTION ───────────────────────────────────────────────────────
  "XML Injection":{
    label:"Inyección XML", icon:"📄",
    impactos:`• Permite modificar la estructura de documentos XML, inyectar elementos o atributos no autorizados.
• Puede manipular flujos de negocio que procesan XML (transacciones, configuraciones, SOAP).
• Fuente: CWE-91 — XML Injection.`,
    owasp:`OWASP A03:2021 — Injection | CWE-91
  • Datos del usuario incluidos en documentos XML sin escape de caracteres especiales XML.
  • El parser XML procesa los datos del usuario como markup en lugar de como texto.`,
    proceso:`• La aplicación construye mensajes XML o SOAP concatenando strings con datos del usuario sin encode XML.`,
    solucion:`1. Usar SecurityElement.Escape() en .NET para escapar datos antes de incluirlos en XML.
2. Usar XmlWriter o XDocument para construir XML programáticamente (escapan automáticamente).
3. Nunca construir XML por concatenación de strings con datos del usuario.
4. Validar todos los documentos XML recibidos contra un XSD antes de procesarlos.
Referencia: OWASP XML Security Cheat Sheet`,
  },

  // ── 37. HTTP HEADER INJECTION ───────────────────────────────────────────────
  "HTTP Header Injection":{
    label:"Inyección de Headers HTTP / CRLF Injection", icon:"📨",
    impactos:`• Permite inyectar headers HTTP arbitrarios mediante caracteres CRLF (\\r\\n) en parámetros que son reflejados en headers de respuesta.
• Puede resultar en envenenamiento de caché HTTP, XSS vía headers, session fixation o phishing.
• Fuente: CWE-113 — Improper Neutralization of CRLF Sequences in HTTP Headers.`,
    owasp:`OWASP A03:2021 — Injection | CWE-113
Fuente: OWASP HTTP Response Splitting Cheat Sheet
  • Parámetros del usuario incluidos en headers de respuesta HTTP sin filtrar \\r\\n.
  • Típicamente en Location header para redirects, Set-Cookie o headers custom.`,
    proceso:`• Los headers de respuesta incluyen datos del usuario (como returnUrl) sin sanitizar los caracteres CRLF.`,
    solucion:`1. Nunca incluir datos del usuario directamente en headers de respuesta.
2. Si es inevitable, eliminar o rechazar inputs que contengan \\r, \\n o %0d, %0a.
3. Usar Url.IsLocalUrl() para validar URLs de redirect.
4. .NET moderno (Core) rechaza automáticamente CRLF en headers — migrar desde .NET Framework legacy si es posible.
Referencia: OWASP HTTP Response Splitting`,
  },

  // ── 38. OAUTH MISCONFIGURATION ──────────────────────────────────────────────
  "OAuth Misconfiguration":{
    label:"Mala Configuración de OAuth 2.0", icon:"🔑",
    impactos:`• Redirect URI abiertos permiten robar el authorization code o access token.
• Ausencia de state parameter permite ataques CSRF en el flujo OAuth.
• Tokens con permisos excesivos exponen más recursos de los necesarios.
• Fuente: CWE-601, CWE-352 en contexto OAuth.`,
    owasp:`OWASP A07:2021 — Identification and Authentication Failures | CWE-601
Fuente: OWASP OAuth 2.0 Security Best Practices (RFC 9700)
  • Redirect URIs no están estrictamente registradas (se permite cualquier subpath o dominio).
  • Ausencia de PKCE (Proof Key for Code Exchange) en flujos de código de autorización.
  • Estado (state) no validado para prevenir CSRF en el callback.`,
    proceso:`• La configuración del cliente OAuth no tiene las redirect URIs exactas registradas y validadas.
• El parámetro state no es generado ni validado en el flujo de autorización.`,
    solucion:`1. Registrar redirect URIs exactas en el servidor de autorización (sin wildcards).
2. Implementar y validar el parámetro state en cada flujo OAuth.
3. Usar PKCE (code_challenge / code_verifier) para todos los flujos de código.
4. Aplicar principio de mínimo privilegio en los scopes solicitados.
5. Validar el token de acceso en cada llamada a la API (signature + exp + iss + aud).
Referencia: RFC 9700 — OAuth 2.0 Security Best Current Practice`,
  },

  // ── 39. BUSINESS LOGIC VULNERABILITY ────────────────────────────────────────
  "Business Logic Vulnerability":{
    label:"Vulnerabilidad de Lógica de Negocio", icon:"💼",
    impactos:`• Permite manipular flujos de negocio para obtener beneficios no autorizados: descuentos no aplicables, omisión de pagos, aprobación de solicitudes sin cumplir requisitos.
• Difícil de detectar con herramientas automáticas de escaneo.
• Impacto financiero directo y pérdida de integridad del sistema.
• Fuente: CWE-840 — Business Logic Errors.`,
    owasp:`OWASP A04:2021 — Insecure Design | CWE-840
Fuente: OWASP Business Logic Vulnerability Testing Guide
  • Los flujos de negocio asumen que los pasos se ejecutan en orden y sin modificación.
  • Ausencia de validación server-side del estado del flujo en cada paso.
  • Parámetros de precios, cantidades o descuentos enviados desde el cliente y aceptados sin re-validación.`,
    proceso:`• Los valores de negocio críticos (precios, montos, aprobaciones) son enviados desde el cliente y aceptados sin re-calcular en el servidor.
• Los flujos multi-paso no validan que los pasos previos se completaron correctamente.`,
    solucion:`1. NUNCA confiar en valores de negocio críticos enviados desde el cliente. Re-calcular siempre en el servidor.
2. Implementar máquina de estados server-side para flujos multi-paso.
3. Validar todas las reglas de negocio en el servidor, independientemente de la validación client-side.
4. Realizar pruebas de lógica de negocio específicas en el QA (no solo pruebas de seguridad técnicas).
5. Registrar todas las transacciones de negocio para auditoría y detección de anomalías.
Referencia: OWASP Testing Guide — Business Logic Testing`,
  },

  // ── 40. RACE CONDITION ──────────────────────────────────────────────────────
  "Race Condition":{
    label:"Condición de Carrera (Race Condition)", icon:"🏁",
    impactos:`• Permite explotar la ventana temporal entre la verificación de una condición y su uso (TOCTOU).
• En aplicaciones financieras puede resultar en doble gasto, saldo negativo o múltiples usos de un cupón/beneficio.
• Fuente: CWE-362 — Concurrent Execution using Shared Resource with Improper Synchronization.`,
    owasp:`OWASP A04:2021 — Insecure Design | CWE-362 | CWE-367
Fuente: OWASP Race Condition Prevention
  • Operaciones check-then-act no atómicas en transacciones de negocio.
  • Ausencia de locks optimistas o pesimistas en operaciones que modifican recursos compartidos.`,
    proceso:`• Las transacciones financieras o de estado realizan SELECT + validación + UPDATE como operaciones separadas sin bloqueo de la fila.`,
    solucion:`1. Usar transacciones de base de datos con el nivel de aislamiento correcto (Serializable para operaciones críticas).
2. Implementar SELECT ... WITH (UPDLOCK, HOLDLOCK) en SQL Server para bloqueo optimista.
3. Usar optimistic concurrency con RowVersion/Timestamp en Entity Framework.
4. Implementar idempotency keys para operaciones críticas que no deben ejecutarse dos veces.
Referencia: OWASP Race Condition Prevention`,
  },

  // ── 41. SUPPLY CHAIN ATTACK ─────────────────────────────────────────────────
  "Supply Chain Attack":{
    label:"Ataque a la Cadena de Suministro de Software", icon:"⛓️",
    impactos:`• Compromiso de código malicioso en dependencias de terceros que se distribuye automáticamente a todos los proyectos que las usan.
• Puede afectar miles de aplicaciones con una sola inserción maliciosa upstream.
• Ejemplos: SolarWinds, Log4Shell, XZ Utils backdoor.
• Fuente: CWE-506 — Embedded Malicious Code.`,
    owasp:`OWASP A06:2021 — Vulnerable and Outdated Components / A08 Software and Data Integrity Failures | CWE-506
Fuente: OWASP Software Supply Chain Security, GitHub Advisory Database, CISA KEV
  • Dependencias descargadas sin verificación de integridad (hash SHA-256 o firma).
  • Ausencia de SBOM (Software Bill of Materials) que inventaríe todas las dependencias.
  • Build pipeline que descarga dependencias en tiempo real sin cache verificado.`,
    proceso:`• El proceso de build descarga paquetes NuGet/npm en tiempo real sin verificar hashes ni usar un mirror interno verificado.
• No existe proceso de revisión de cambios en dependencias críticas.`,
    solucion:`1. Usar lock files (packages.lock.json en NuGet) para fijar versiones exactas y hashes.
2. Configurar NuGet para verificar hashes de paquetes.
3. Usar un mirror/proxy interno de paquetes (Azure Artifacts, Nexus) con paquetes pre-verificados.
4. Generar y mantener un SBOM (Software Bill of Materials) con cada release.
5. Monitorear dependencias con GitHub Dependabot, Snyk o OWASP Dependency-Check.
Referencias: CISA KEV, GitHub Advisory Database, OSV.dev`,
  },

  // ── 42. SUBDOMAIN TAKEOVER ──────────────────────────────────────────────────
  "Subdomain Takeover":{
    label:"Apropiación de Subdominio (Subdomain Takeover)", icon:"🌍",
    impactos:`• Un atacante puede tomar control de un subdominio de la empresa cuyo CNAME apunta a un servicio externo que ya no existe o no está reclamado.
• Permite servir contenido malicioso bajo un dominio de confianza de la empresa.
• Puede usarse para phishing, robo de cookies (si el dominio está en el scope de cookies) o bypass de CSP.
• Fuente: CWE-116 relacionado, sin CWE específico estándar.`,
    owasp:`OWASP A05:2021 — Security Misconfiguration
Fuente: OWASP Testing for Subdomain Takeover (WSTG-CONF-10)
  • Registros DNS que apuntan a servicios externos (GitHub Pages, Azure, Heroku, AWS S3) que ya fueron eliminados pero el registro DNS permanece.`,
    proceso:`• Al desactivar servicios cloud o cambiar proveedores, los registros DNS CNAME correspondientes no son eliminados del DNS de la empresa.`,
    solucion:`1. Auditar todos los registros DNS CNAME y verificar que los destinos existen y son controlados.
2. Antes de eliminar un servicio cloud, eliminar el registro DNS correspondiente.
3. Reclamar explícitamente los subdominios en los servicios cloud (GitHub Pages, Azure Static Web Apps).
4. Usar herramientas de monitoreo continuo de DNS como can-i-take-over-xyz.
Referencia: OWASP WSTG-CONF-10`,
  },

  // ── 43. INSECURE DIRECT DESERIALIZATION (PICKLE/JAVA) ─────────────────────
  "Deserialization Attack":{
    label:"Ataque de Deserialización de Objetos", icon:"📦",
    impactos:`• Permite ejecución remota de código (RCE) al deserializar objetos maliciosos.
• .NET: BinaryFormatter, NetDataContractSerializer, LosFormatter son vectores conocidos.
• Java: Java Object Serialization con gadget chains en librerías comunes (Commons Collections).
• Fuente: CWE-502 — Deserialization of Untrusted Data.`,
    owasp:`OWASP A08:2021 — Software and Data Integrity Failures | CWE-502
Fuente: OWASP Deserialization Cheat Sheet (cheatsheetseries.owasp.org)
  • Uso de formatos de serialización que permiten instanciar tipos arbitrarios.
  • Datos de deserialización aceptados de fuentes no confiables (red, usuario, archivos).
  • Ausencia de validación de integridad antes de deserializar.`,
    proceso:`• La aplicación deserializa objetos recibidos del cliente o de almacenamiento externo usando BinaryFormatter o configuraciones inseguras de JSON.`,
    solucion:`1. Eliminar uso de BinaryFormatter (obsoleto en .NET 5+, eliminado en .NET 9).
2. Usar System.Text.Json con TypeInfoResolver restrictivo para controlar qué tipos se deserializan.
3. Implementar firma HMAC-SHA256 de los datos serializados y validar antes de deserializar.
4. Nunca deserializar datos de fuentes no confiables con tipos arbitrarios.
Referencia: OWASP Deserialization Cheat Sheet`,
  },

  // ── 44. INFORMATION DISCLOSURE ──────────────────────────────────────────────
  "Information Disclosure":{
    label:"Divulgación de Información Sensible", icon:"📢",
    impactos:`• Expone información interna que facilita ataques: versiones de componentes, rutas de servidor, estructura de datos, nombres de usuarios, IPs internas.
• Los atacantes usan esta información para personalizar ataques y reducir el tiempo de explotación.
• Fuente: CWE-200 — Exposure of Sensitive Information to an Unauthorized Actor.`,
    owasp:`OWASP A05:2021 — Security Misconfiguration | CWE-200 | CWE-209 | CWE-116
Fuente: OWASP Testing Guide — Information Gathering
  • Headers HTTP revelan versiones de servidor, framework y sistema operativo.
  • Mensajes de error contienen stack traces, rutas de archivos o consultas SQL.
  • Endpoints de diagnóstico o debug accesibles en producción (/elmah, /trace.axd, /_profiler).`,
    proceso:`• La configuración del servidor IIS y ASP.NET no tiene suprimidos los headers informativos.
• Los errores no manejados llegan al usuario con el stack trace completo.
• Endpoints de diagnóstico del framework no están protegidos o deshabilitados.`,
    solucion:`1. Eliminar headers informativos en web.config:
   <httpRuntime enableVersionHeader="false"/>
   <customHeaders><remove name="X-Powered-By"/><remove name="Server"/></customHeaders>
2. Deshabilitar trace.axd: <trace enabled="false"/>
3. Proteger o deshabilitar /elmah y otros endpoints de diagnóstico en producción.
4. Implementar customErrors con páginas de error genéricas.
5. Revisar que los mensajes de error expuestos al usuario no contengan datos técnicos.
Referencia: OWASP Testing for Information Leakage`,
  },

  // ── 45. CACHE POISONING ─────────────────────────────────────────────────────
  "Cache Poisoning":{
    label:"Envenenamiento de Caché (Cache Poisoning)", icon:"🗑️",
    impactos:`• Permite a un atacante almacenar respuestas maliciosas en el caché compartido que son servidas a otros usuarios.
• Puede resultar en XSS persistente, redirecciones maliciosas o entrega de contenido modificado a múltiples usuarios.
• Fuente: CWE-345 — Insufficient Verification of Data Authenticity.`,
    owasp:`OWASP A05:2021 — Security Misconfiguration | CWE-345
Fuente: PortSwigger Web Security — Web Cache Poisoning
  • El caché almacena respuestas que incluyen datos de headers no cacheados (Host, X-Forwarded-Host).
  • Ausencia de Vary header apropiado en respuestas cacheadas.`,
    proceso:`• La CDN o caché reverso no está configurado para excluir headers que pueden variar por usuario o que contienen datos del atacante.`,
    solucion:`1. Configurar correctamente los headers Vary para incluir todos los inputs que afectan la respuesta.
2. Deshabilitar el caché para respuestas que incluyan datos del usuario.
3. Validar y sanitizar el header Host y X-Forwarded-Host antes de usarlos en URLs de respuesta.
4. Usar Cache-Control: no-store para páginas con datos personalizados.
5. Revisar la configuración del CDN/proxy para que no cachee headers peligrosos.
Referencia: PortSwigger Web Cache Poisoning Research`,
  },

  // ── 46. CRYPTOGRAPHIC KEY MANAGEMENT ────────────────────────────────────────
  "Insecure Key Management":{
    label:"Gestión Insegura de Claves Criptográficas", icon:"🗝️",
    impactos:`• Claves de cifrado expuestas comprometen todos los datos cifrados con ellas, presentes y pasados.
• Rotación inadecuada de claves prolonga la ventana de exposición en caso de compromiso.
• Fuente: CWE-321 — Use of Hard-coded Cryptographic Key.`,
    owasp:`OWASP A02:2021 — Cryptographic Failures | CWE-321 | CWE-324
Fuente: OWASP Key Management Cheat Sheet (cheatsheetseries.owasp.org)
  • Claves criptográficas hardcodeadas en el código fuente o archivos de configuración.
  • Ausencia de rotación periódica de claves.
  • Claves almacenadas con los datos que protegen.`,
    proceso:`• Las claves de cifrado y los secretos de firma están en web.config o appSettings sin protección adicional, sin rotación definida.`,
    solucion:`1. Usar Azure Key Vault, AWS KMS o HashiCorp Vault para almacenamiento de claves.
2. En .NET Core, usar Data Protection API para claves de sesión y tokens.
3. Implementar rotación de claves periódica (mínimo anual, recomendado trimestral para datos sensibles).
4. Separar almacenamiento de claves del almacenamiento de datos cifrados.
5. Usar HSM (Hardware Security Module) para claves de alto valor.
Referencia: OWASP Key Management Cheat Sheet`,
  },

  // ── 47. BROKEN OBJECT LEVEL AUTHORIZATION ───────────────────────────────────
  "Broken Object Level Authorization":{
    label:"Autorización Rota a Nivel de Objeto (BOLA/IDOR)", icon:"🎯",
    impactos:`• El API endpoint más explotado según OWASP API Security Top 10.
• Permite acceder a objetos de cualquier usuario modificando el ID del recurso.
• Sin validación de propiedad del objeto, cualquier usuario autenticado puede acceder a datos de otros.
• Fuente: CWE-639, relacionado con OWASP API1:2023.`,
    owasp:`OWASP API1:2023 — Broken Object Level Authorization | CWE-639
Fuente: OWASP API Security Top 10 2023 (owasp.org/API-Security)
  • Los endpoints de API usan IDs de objetos predecibles sin verificar que pertenecen al usuario autenticado.
  • Ausencia de autorización granular a nivel de recurso (row-level).`,
    proceso:`• Los endpoints API GET /api/polizas/{id} o PUT /api/contratos/{id} no verifican que el recurso {id} pertenece al usuario del token.`,
    solucion:`1. Implementar verificación de propiedad en TODOS los endpoints:
   var poliza = await db.Polizas.FirstOrDefaultAsync(p => p.Id == id && p.OwnerId == currentUserId);
   if (poliza == null) return Forbid();
2. Usar GUIDs/ULIDs en lugar de IDs secuenciales.
3. Implementar middleware de autorización que valide ownership automáticamente.
4. Incluir pruebas de BOLA en la suite de pruebas de seguridad de la API.
Referencia: OWASP API Security Top 10 — API1:2023`,
  },

  // ── 48. SENSITIVE DATA IN URL ────────────────────────────────────────────────
  "Sensitive Data in URL":{
    label:"Datos Sensibles en URL / Query String", icon:"🔗",
    impactos:`• URLs con datos sensibles (tokens, contraseñas, IDs) quedan en logs de servidor, historial del navegador, headers Referer y logs de proxies.
• Pueden ser filtrados accidentalmente a terceros a través del header Referer.
• Fuente: CWE-598 — Use of GET Request Method with Sensitive Query Strings.`,
    owasp:`OWASP A02:2021 — Cryptographic Failures | CWE-598
Fuente: OWASP Transport Layer Security Cheat Sheet
  • Parámetros de autenticación, tokens de sesión o datos PII incluidos en query strings de URLs GET.
  • Tokens de reset de contraseña o magic links expuestos en logs.`,
    proceso:`• El flujo de autenticación pasa tokens o credenciales como parámetros GET en la URL en lugar de en el cuerpo de la solicitud o headers.`,
    solucion:`1. Pasar datos sensibles siempre en el cuerpo de una solicitud POST, nunca en query strings.
2. Los tokens de reset de contraseña deben ser de un solo uso, con expiración corta (15 min) y pasar por POST.
3. Agregar header Referrer-Policy: no-referrer-when-downgrade para limitar fugas por Referer.
4. Revisar configuración de logs del servidor para no registrar query strings con datos sensibles.
Referencia: OWASP Transport Layer Security Cheat Sheet`,
  },

  // ── 49. API KEY EXPOSURE ─────────────────────────────────────────────────────
  "API Key Exposure":{
    label:"Exposición de Claves de API (API Key Exposure)", icon:"🔑",
    impactos:`• Una API key expuesta permite al atacante usar el servicio en nombre de la empresa: llamadas a APIs de pago, acceso a datos de clientes, consumo de servicios cloud.
• Impacto económico directo si la API key tiene acceso a servicios de pago por uso.
• Posible exfiltración de datos a través del servicio comprometido.
• Fuente: CWE-522 — Insufficiently Protected Credentials.`,
    owasp:`OWASP A02:2021 — Cryptographic Failures | CWE-522 | CWE-798
Fuente: GitHub Advisory Database, OWASP Secrets Management Cheat Sheet
  • API keys en código fuente versionado en repositorios (incluso privados).
  • API keys en variables de entorno expuestas en logs o respuestas de error.
  • API keys sin restricciones de IP, dominio o scope de permisos.`,
    proceso:`• Las claves de API de servicios externos se almacenan en web.config, appsettings.json o directamente en el código, y son versionadas en el repositorio Git.`,
    solucion:`1. Mover todas las API keys a variables de entorno del servidor o a Azure Key Vault.
2. Rotar INMEDIATAMENTE cualquier key que haya estado en el repositorio.
3. Configurar restricciones en las API keys: IPs permitidas, dominios, permisos mínimos.
4. Agregar git-secrets o truffleHog al pre-commit hook y al pipeline CI/CD.
5. Revisar el historial completo de Git con truffleHog para detectar keys históricas.
Referencia: OWASP Secrets Management Cheat Sheet, GitHub Advisory Database`,
  },

  // ── 50. DEFAULT ──────────────────────────────────────────────────────────────

  // ── CLEARTEXT TRANSMISSION ──────────────────────────────────────────────────
  "Cleartext Transmission of Sensitive Information":{
    label:"Transmisión en Texto Claro de Información Sensible", icon:"🔓",
    impactos:`• La información sensible (credenciales, tokens, datos personales) viaja sin cifrado y puede ser interceptada con herramientas de captura de red (Wireshark, tcpdump).
• Riesgo de exposición de credenciales de servicios internos (CyberArk, PaymentHub) que permiten acceso privilegiado no autorizado.
• Uso de versiones obsoletas de TLS (TLS 1.0/1.1) que tienen vulnerabilidades conocidas y no proveen cifrado robusto.
• Incumplimiento regulatorio: PCI-DSS requiere TLS ≥ 1.2 para transmisión de datos de tarjetas; GDPR exige protección de datos en tránsito.
• Impacto en disponibilidad si el atacante modifica datos en tránsito (Man-in-the-Middle).`,
    owasp:`OWASP A02:2021 — Cryptographic Failures (antes Sensitive Data Exposure)
CWE-319: Cleartext Transmission of Sensitive Information
CWE-326: Inadequate Encryption Strength
Fuente: OWASP Transport Layer Security Cheat Sheet (cheatsheetseries.owasp.org)
  • Uso de protocolos obsoletos: TLS 1.0, TLS 1.1, SSL 3.0 están deprecados (RFC 7568, RFC 8996).
  • En .NET Framework: ServicePointManager.SecurityProtocol debe forzar TLS 1.2/1.3 explícitamente.
  • Los archivos CyberArkAPI.cs y PaymetHubApi.cs realizan llamadas HTTP a APIs internas sin forzar TLS seguro.
  • Web.config puede exponer configuración sensible si customErrors está deshabilitado.`,
    proceso:`• Los archivos BusinessLogic/CyberArkService/CyberArkAPI.cs y BusinessLogic/PaymentHubAPI/PaymetHubApi.cs realizan llamadas a servicios externos usando HttpClient sin forzar protocolo TLS seguro.
• El archivo BusinessLogic/Security.cs implementa configuraciones de seguridad de red que permiten versiones deprecadas de TLS.
• .NET Framework por defecto en versiones antiguas permite TLS 1.0/1.1 a menos que se configure explícitamente lo contrario.
• Web.config con customErrors="Off" puede revelar rutas absolutas y stack traces en producción.`,
    solucion:`1. Forzar TLS 1.2/1.3 globalmente en Application_Start (Global.asax.cs):
   ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls13;

2. En cada HttpClient de CyberArkAPI.cs y PaymetHubApi.cs:
   var handler = new HttpClientHandler {
     SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13,
     CheckCertificateRevocationList = true
   };

3. En Web.config, habilitar customErrors en producción:
   <customErrors mode="On" defaultRedirect="~/Error"/>

4. Verificar y deshabilitar TLS 1.0/1.1 a nivel de servidor IIS (registro de Windows o IIS Crypto).

5. Ejecutar escaneo con SSL Labs o similar para confirmar configuración TLS post-corrección.`,
  },

  // ── ERRORHANDLING REVEALDETAILS ─────────────────────────────────────────────
  "ErrorHandling.RevealDetails.Message":{
    label:"Revelación de Detalles de Error (Error Handling)", icon:"📋",
    impactos:`• Expone rutas absolutas del servidor web, nombres de servidores, versión de frameworks y stack traces al atacante.
• El atacante puede mapear la estructura interna del sistema de archivos del servidor para planear ataques de path traversal o LFI.
• Revela tecnologías y versiones exactas del stack (ASP.NET versión, IIS versión) que facilitan la búsqueda de exploits conocidos.
• Puede exponer cadenas de conexión, nombres de variables internas o lógica de negocio sensible en mensajes de error detallados.`,
    owasp:`OWASP A05:2021 — Security Misconfiguration
CWE-209: Generation of Error Message Containing Sensitive Information
CWE-200: Exposure of Sensitive Information to an Unauthorized Actor
Fuente: OWASP Error Handling Cheat Sheet (cheatsheetseries.owasp.org)
  • Los mensajes de error detallados en producción son una misconfiguration de seguridad clásica.
  • ASP.NET MVC con customErrors="Off" devuelve la excepción completa con stack trace al cliente.
  • El archivo Web.config con debug="true" activa trazas detalladas visibles en el navegador.`,
    proceso:`• El archivo Web.config tiene configurado customErrors="Off" o mode="RemoteOnly", lo que permite que los errores no manejados se muestren con detalle completo en el navegador.
• El atributo debug="true" en la sección <compilation> de Web.config activa información de diagnóstico adicional.
• No existe un manejador global de errores que intercepte excepciones no controladas y devuelva páginas de error genéricas.
• Los controladores MVC no tienen manejo uniforme de excepciones con IExceptionFilter o HandleErrorAttribute configurado globalmente.`,
    solucion:`1. En Web.config, configurar customErrors en modo seguro:
   <customErrors mode="On" defaultRedirect="~/Views/Shared/Error.cshtml"/>
   <compilation debug="false" targetFramework="4.x"/>

2. Implementar manejador global de errores en Global.asax.cs:
   Application_Error: log interno + redirect a página genérica sin detalles.

3. Registrar ExceptionFilter global en FilterConfig.cs:
   filters.Add(new HandleErrorAttribute());

4. Usar logging interno (log4net, NLog, Serilog) para registrar el detalle del error — nunca al cliente.

5. Revisar todos los bloques catch que hagan Response.Write o return Json(ex.Message) y reemplazar con mensajes genéricos.`,
  },

  // ── CRYPTOGRAPHY NONSTANDARD ────────────────────────────────────────────────
  "Cryptography.NonStandard":{
    label:"Criptografía No Estándar / Débil (Weak Cryptography)", icon:"🔑",
    impactos:`• El uso de algoritmos criptográficos débiles o no estándar hace que datos cifrados sean recuperables por un atacante con recursos moderados.
• RSA con claves cortas (<2048 bits) o padding inseguro (PKCS#1 v1.5) es vulnerable a ataques de factorización y Bleichenbacher.
• Compromiso de confidencialidad de datos sensibles cifrados en la aplicación (credenciales, tokens, datos de asegurados).
• Incumplimiento de estándares NIST SP 800-131A que depreca algoritmos como MD5, SHA-1, DES, y RSA <2048 bits.`,
    owasp:`OWASP A02:2021 — Cryptographic Failures
CWE-327: Use of a Broken or Risky Cryptographic Algorithm
CWE-326: Inadequate Encryption Strength
CWE-780: Use of RSA Algorithm without OAEP
Fuente: OWASP Cryptographic Storage Cheat Sheet (cheatsheetseries.owasp.org)
  • El archivo AsymmetricRSAEncryption.cs implementa RSA con configuración no estándar o tamaño de clave insuficiente.
  • NIST recomienda RSA ≥ 2048 bits con OAEP padding; PKCS#1 v1.5 está deprecado para cifrado.
  • Algoritmos prohibidos: MD5, SHA-1, DES, 3DES, RC4, RSA <2048 bits.`,
    proceso:`• El archivo BusinessLogic/Utilerias/AsymmetricRSAEncryption.cs implementa cifrado RSA con parámetros que no cumplen los estándares actuales de seguridad.
• Posiblemente usa RSACryptoServiceProvider con tamaño de clave <2048 bits o padding PKCS#1 v1.5 en lugar de OAEP.
• No se valida el tamaño mínimo de clave en tiempo de ejecución.
• La implementación fue desarrollada sin seguir las guías NIST/OWASP de criptografía segura.`,
    solucion:`1. En AsymmetricRSAEncryption.cs, migrar a RSA con OAEP y clave mínima 2048 bits:
   // ANTES (inseguro):
   var rsa = new RSACryptoServiceProvider(1024);
   var encrypted = rsa.Encrypt(data, false); // PKCS#1 v1.5

   // DESPUÉS (seguro):
   using var rsa = RSA.Create(2048);
   var encrypted = rsa.Encrypt(data, RSAEncryptionPadding.OaepSHA256);

2. Para hashing: reemplazar MD5/SHA-1 por SHA-256 o SHA-512 (System.Security.Cryptography.SHA256).

3. Para cifrado simétrico: usar AES-256-GCM en lugar de DES/3DES/RC4.

4. Ejecutar análisis estático post-corrección con SonarQube o Checkmarx para confirmar eliminación de algoritmos débiles.

5. Documentar el esquema criptográfico actualizado en el diseño técnico de seguridad.`,
  },
  "default":{
    label:"Vulnerabilidad de Seguridad", icon:"⚠️",
    impactos:`• Riesgo de acceso no autorizado a datos sensibles de la aplicación.
• Posible compromiso de integridad o disponibilidad del sistema.
• Impacto en cumplimiento regulatorio (GDPR, PCI-DSS, HIPAA) y reputacional.
• Consultar la clasificación CWE específica en cwe.mitre.org para el detalle de esta vulnerabilidad.`,
    owasp:`Consultar OWASP Top 10 2021 en owasp.org/Top10/2021/ para ubicar esta vulnerabilidad en su categoría de riesgo correspondiente.
Fuentes de referencia:
  • OWASP Cheat Sheet Series: cheatsheetseries.owasp.org/index.html
  • CWE/MITRE: cwe.mitre.org
  • NVD/NIST: nvd.nist.gov
  • CVE Program: cve.org`,
    proceso:`• El proceso actual no contempla controles preventivos específicos para este tipo de vulnerabilidad.
• Se requiere revisión del flujo de datos desde la entrada hasta la salida del sistema.
• Consultar OWASP Testing Guide para el procedimiento de verificación correspondiente.`,
    solucion:`1. Aplicar controles de seguridad según la guía OWASP para este tipo de vulnerabilidad.
2. Revisar y reforzar validaciones en las capas de presentación, lógica de negocio y acceso a datos.
3. Consultar el Cheat Sheet específico en cheatsheetseries.owasp.org para controles detallados.
4. Ejecutar pruebas de penetración post-corrección con OWASP ZAP o Burp Suite para confirmar remediación.
5. Registrar la corrección en el sistema de seguimiento de vulnerabilidades con evidencia de escaneo.`,
  },
};

// ── ALIAS PARA NOMBRES ALTERNATIVOS DE VULNERABILIDADES ─────────────────────
