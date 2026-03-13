#!/usr/bin/env node
/**
 * create-template.js — Genera el template Word base para Diseño General
 * ───────────────────────────────────────────────────────────────────────
 * Crea dist/docs/TemplateDisenoGeneral.docx con marcadores de posición
 * que DocumentosPhase.jsx reemplaza al exportar un ÚNICO documento con
 * TODAS las vulnerabilidades detectadas.
 *
 * Uso:
 *   node create-template.js
 *   npm run create-template
 *
 * Marcadores de encabezado (reemplazados directamente):
 *   {PROJECT_NAME}        → Nombre del proyecto
 *   {FECHA}               → Fecha de generación
 *   {TOTAL_VULNS}         → Número total de tipos de vulnerabilidad
 *
 * Marcador de contenido (se expande con una sección por vulnerabilidad):
 *   %%VULNERABILIDADES%%  → Bloque completo de todas las vulnerabilidades
 *
 * Estructura generada por vulnerabilidad:
 *   ─────────────────────────────
 *   [Nombre Vulnerabilidad] — N issues
 *   ─────────────────────────────
 *   Impactos de la Vulnerabilidad: [Nombre]
 *   [contenido]
 *   Impactos Asociados a OWASP: [Nombre]
 *   [contenido]
 *   Proceso Actual: [Nombre]
 *   [contenido]
 *   Propuesta de Solución: [Nombre]
 *   [contenido]
 */

"use strict";
const PizZip = require("pizzip");
const fs     = require("fs");
const path   = require("path");

const OUT_FILE = path.join(__dirname, "dist/docs/TemplateDisenoGeneral.docx");

// ── Helpers para construir XML de párrafos Word ───────────────────────────────
function para(content, opts = {}) {
  const {
    bold        = false,
    sz          = "22",
    color       = "000000",
    align       = null,
    spaceBefore = "0",
    spaceAfter  = "160",
    borderTop   = false,
    borderBot   = false,
  } = opts;

  const rPr = [
    bold ? "<w:b/>" : "",
    `<w:sz w:val="${sz}"/>`,
    `<w:szCs w:val="${sz}"/>`,
    color !== "000000" ? `<w:color w:val="${color}"/>` : "",
    `<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>`,
  ].filter(Boolean).join("");

  const borders = [
    borderTop ? `<w:top w:val="single" w:sz="6" w:space="1" w:color="1A3A5C"/>` : "",
    borderBot ? `<w:bottom w:val="single" w:sz="6" w:space="1" w:color="2E75B6"/>` : "",
  ].filter(Boolean).join("");

  const pPrParts = [
    align    ? `<w:jc w:val="${align}"/>` : "",
    `<w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}"/>`,
    borders  ? `<w:pBdr>${borders}</w:pBdr>` : "",
  ].filter(Boolean).join("");

  return `<w:p><w:pPr>${pPrParts}</w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${content}</w:t></w:r></w:p>`;
}

// Párrafo mixto: label en negrita azul + valor normal (para info de encabezado)
function infoLine(label, valueMarker, szVal = "22") {
  return [
    `<w:p>`,
    `<w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="80"/></w:pPr>`,
    `<w:r><w:rPr><w:b/><w:sz w:val="${szVal}"/><w:szCs w:val="${szVal}"/>`,
    `<w:color w:val="2E75B6"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>`,
    `<w:t xml:space="preserve">${label} </w:t></w:r>`,
    `<w:r><w:rPr><w:sz w:val="${szVal}"/><w:szCs w:val="${szVal}"/>`,
    `<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>`,
    `<w:t>${valueMarker}</w:t></w:r>`,
    `</w:p>`,
  ].join("");
}

// Marcador expandible — formato EXACTO que el browser busca con regex
function placeholder(marker) {
  return `<w:p><w:r><w:t>${marker}</w:t></w:r></w:p>`;
}

// ── XML de los archivos del DOCX ──────────────────────────────────────────────
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

// ── Construcción del document.xml ─────────────────────────────────────────────
const DOCUMENT_BODY = [

  // ── Título ────────────────────────────────────────────────────────────────
  para("DISEÑO GENERAL DE SEGURIDAD", {
    bold: true, sz: "32", color: "1F3864", align: "center",
    spaceBefore: "0", spaceAfter: "80",
  }),
  para("Documento de Análisis y Remediación de Vulnerabilidades", {
    sz: "22", color: "666666", align: "center",
    spaceBefore: "0", spaceAfter: "200",
  }),

  // ── Info del proyecto ─────────────────────────────────────────────────────
  infoLine("Proyecto:", "{PROJECT_NAME}", "24"),
  infoLine("Fecha de Generación:", "{FECHA}", "20"),
  infoLine("Total de Vulnerabilidades:", "{TOTAL_VULNS}", "20"),

  // ── Línea divisora ────────────────────────────────────────────────────────
  para("", { borderBot: true, spaceBefore: "120", spaceAfter: "240" }),

  // ── Encabezado de la sección principal ───────────────────────────────────
  para("Diseño de la Aplicación", {
    bold: true, sz: "28", color: "1F3864",
    spaceBefore: "0", spaceAfter: "200",
  }),

  // ── Marcador único — se expande con TODAS las vulnerabilidades ────────────
  placeholder("%%VULNERABILIDADES%%"),

].join("\n");

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
${DOCUMENT_BODY}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1800"/>
    </w:sectPr>
  </w:body>
</w:document>`;

// ── Generar el ZIP (DOCX) ─────────────────────────────────────────────────────
const zip = new PizZip();
zip.file("[Content_Types].xml",          CONTENT_TYPES);
zip.file("_rels/.rels",                  ROOT_RELS);
zip.file("word/document.xml",            DOCUMENT_XML);
zip.file("word/_rels/document.xml.rels", DOC_RELS);

const buf = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, buf);

const sizeKb = (buf.length / 1024).toFixed(1);
console.log(`✓ Template generado: ${OUT_FILE}  (${sizeKb} KB)`);
console.log(`  Marcadores de encabezado : {PROJECT_NAME}  {FECHA}  {TOTAL_VULNS}`);
console.log(`  Marcador de contenido    : %%VULNERABILIDADES%%  (se expande con todas las vulns)`);
console.log(`\n  Ejecuta 'npm run build' para embeber el template en el HTML.`);
