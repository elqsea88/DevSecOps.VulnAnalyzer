# DevSecOps · Vulnerability Analyzer

Monorepo para el generador de HTML standalone de análisis de vulnerabilidades DevSecOps.

## Estructura del proyecto

```
DevSecOps.VulnAnalyzer/
│
├── src/
│   ├── utils/
│   │   ├── constants.js         SEV, TYPE_MAP, TODAY, PHASES
│   │   └── helpers.js           fname(), fpath(), groupBy()
│   │
│   ├── data/
│   │   ├── vuln-kb.js           Base de conocimiento (50+ vulnerabilidades)
│   │   ├── vuln-aliases.js      Mapa de alias + función getKB()
│   │   └── sources-display.js   Referencias OWASP/CWE + función getSourcesDisplay()
│   │
│   ├── styles/
│   │   └── theme.js             Helpers de estilos inline (card, btn, inp, etc.)
│   │
│   ├── features/
│   │   ├── importacion/
│   │   │   └── ImportacionPhase.jsx    Fase 0 — Cargar Excel
│   │   ├── diagnostico/
│   │   │   └── DiagnosticoPhase.jsx    Fase 1 — Pipeline + SonarQube
│   │   ├── documentos/
│   │   │   └── DocumentosPhase.jsx     Fase 2 — Generar documentos
│   │   └── generic/
│   │       └── GenericPhase.jsx        Fases 3-5 — Aprobación/Ejecución/Despliegue
│   │
│   ├── generators/
│   │   └── generators.js        genDG(), genDT(), genCK(), genCIP(), dlAll()
│   │
│   ├── App.jsx                  Componente principal — state, handlers, render
│   └── index.html.template      Plantilla HTML con CDN scripts
│
├── dist/                        ← Generado por el build (no editar)
│   └── DevSecOps_VulnAnalyzer.html
│
├── build.js                     Script ensamblador
├── package.json
└── README.md
```

## Instalación

No se requieren dependencias de producción.  
El build usa solo Node.js nativo (fs, path).

```bash
# Verificar versión de Node (requiere >=16)
node --version
```

## Uso

### Build único (genera el HTML)
```bash
node build.js
```
O con npm:
```bash
npm run build
```

El archivo generado queda en: **`dist/DevSecOps_VulnAnalyzer.html`**

### Modo Watch (rebuild automático al guardar)
```bash
node build.js --watch
# ó
npm run watch
```

Cada vez que guardes cualquier archivo en `src/`, el HTML se regenera automáticamente en `dist/`.

## Flujo de trabajo en VS Code

1. Abrir la carpeta `DevSecOps.VulnAnalyzer/` en VS Code
2. Abrir una terminal integrada (`Ctrl + `` ` ``)
3. Ejecutar: `node build.js --watch`
4. Editar cualquier archivo en `src/`
5. Al guardar, el HTML se regenera en `dist/`
6. Abrir `dist/DevSecOps_VulnAnalyzer.html` con Live Server o doble clic

### Extensiones recomendadas para VS Code
- **Live Server** — recarga el HTML automáticamente
- **Prettier** — formatea JSX/JS
- **ES7+ React snippets** — autocompletado para JSX

## Orden de concatenación

El `build.js` une los archivos en este orden (cada archivo puede usar todo lo definido antes):

```
1. src/utils/constants.js
2. src/utils/helpers.js
3. src/data/vuln-kb.js
4. src/data/vuln-aliases.js      ← incluye getKB()
5. src/data/sources-display.js   ← incluye getSourcesDisplay()
6. src/styles/theme.js
7. src/features/importacion/ImportacionPhase.jsx
8. src/features/diagnostico/DiagnosticoPhase.jsx
9. src/features/documentos/DocumentosPhase.jsx
10. src/features/generic/GenericPhase.jsx
11. src/App.jsx                   ← componente principal
```

## Agregar una nueva vulnerabilidad a la KB

Editar `src/data/vuln-kb.js` y agregar una entrada al objeto `VULN_KB`:

```js
"Nombre Exacto del Issue Type": {
  label:    "Nombre legible",
  icon:     "🔒",
  impactos: `• Impacto 1\n• Impacto 2`,
  owasp:    `OWASP A0X:2021 — Nombre\n  • Detalle`,
  proceso:  `• Descripción del proceso actual vulnerable`,
  solucion: `1. Paso 1\n2. Paso 2`,
},
```

Si el nombre en el Excel es diferente al key, agregar el alias en `src/data/vuln-aliases.js`:

```js
"nombre en excel": "Nombre Exacto del Issue Type",
```

Luego ejecutar `node build.js` para regenerar el HTML.

## Configuración del proyecto

Los valores por defecto (URLs de Jenkins, Git, SonarQube) se editan en `src/App.jsx`:

```js
const [cfg, setCfg] = useState({
  jenkinsBase:    "https://jenkins.chubbdigital.com/job/",
  gitBase:        "https://nausp-aapp0001.aceins.com/mexico-it-chubbnet/",
  sonarBase:      "https://sonar.chubb.com",
  sonarProjectKey:"NAGH-APM0001304-mexico-it-chubbnet-ACE.BasicBook",
  projectName:    "ACE.BasicBook",
  ...
});
```
