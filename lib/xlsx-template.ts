import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

// Remplissage d'un classeur Excel modèle (.xlsx) en écrivant directement dans ses fichiers XML :
// mise en forme, cellules fusionnées, images et mise en page restent exactement celles du modèle.
// (Les bibliothèques de lecture/écriture habituelles perdent les styles en réenregistrant.)

export type CellValue = string | number;
/** Feuille → cellule (ex. « F12 ») → valeur. */
export type TemplateEdits = Record<string, Record<string, CellValue>>;

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function attr(tag: string, name: string) {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

/** Numéro de colonne (A = 1) d'une adresse de cellule. */
function columnIndex(ref: string) {
  let n = 0;
  for (const ch of /^[A-Z]+/.exec(ref)?.[0] ?? '') n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

function cellXml(ref: string, value: CellValue, style: string | undefined) {
  const s = style ? ` s="${style}"` : '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Valeur invalide pour ${ref}`);
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

/** Écrit une valeur dans une cellule de la feuille, en gardant son style ; crée la cellule (et la ligne) si besoin. */
export function setCellInSheetXml(xml: string, ref: string, value: CellValue): string {
  const existing = new RegExp(`<c r="${ref}"(?:\\s[^>]*?)?(?:/>|>[\\s\\S]*?</c>)`).exec(xml);
  if (existing) {
    const open = /^<c[^>]*?\/?>/.exec(existing[0])![0];
    return xml.slice(0, existing.index) + cellXml(ref, value, attr(open, 's')) + xml.slice(existing.index + existing[0].length);
  }

  const rowNumber = Number(/\d+$/.exec(ref)![0]);
  const col = columnIndex(ref);
  const row = new RegExp(`<row r="${rowNumber}"(?:\\s[^>]*?)?(?:/>|>[\\s\\S]*?</row>)`).exec(xml);
  if (row) {
    const openTag = /^<row[^>]*?\/?>/.exec(row[0])![0];
    const selfClosing = openTag.endsWith('/>');
    const inner = selfClosing ? '' : row[0].slice(openTag.length, -'</row>'.length);
    // Insertion à sa place parmi les cellules de la ligne (ordre des colonnes obligatoire)
    const cells = [...inner.matchAll(/<c r="([A-Z]+)\d+"[\s\S]*?(?:\/>|<\/c>)/g)];
    const after = cells.find((c) => columnIndex(c[1]) > col);
    const pos = after ? after.index! : inner.length;
    const newInner = inner.slice(0, pos) + cellXml(ref, value, undefined) + inner.slice(pos);
    const newRow = `${selfClosing ? openTag.slice(0, -2) + '>' : openTag}${newInner}</row>`;
    return xml.slice(0, row.index) + newRow + xml.slice(row.index + row[0].length);
  }

  // Ligne absente : insérée avant la première ligne de numéro supérieur
  const newRow = `<row r="${rowNumber}">${cellXml(ref, value, undefined)}</row>`;
  if (xml.includes('<sheetData/>')) return xml.replace('<sheetData/>', `<sheetData>${newRow}</sheetData>`);
  const next = [...xml.matchAll(/<row r="(\d+)"/g)].find((m) => Number(m[1]) > rowNumber);
  const pos = next ? next.index! : xml.indexOf('</sheetData>');
  return xml.slice(0, pos) + newRow + xml.slice(pos);
}

/** Chemin du fichier XML de chaque feuille, par nom de feuille. */
function sheetPaths(files: Record<string, Uint8Array>) {
  const workbook = strFromU8(files['xl/workbook.xml']);
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels']);
  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\s[^>]*>/g)) {
    const id = attr(m[0], 'Id');
    const target = attr(m[0], 'Target');
    if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }
  const paths = new Map<string, string>();
  for (const m of workbook.matchAll(/<sheet\s[^>]*>/g)) {
    const name = attr(m[0], 'name');
    const id = attr(m[0], 'r:id');
    const path = id ? targets.get(id) : undefined;
    if (name && path) paths.set(unescapeXml(name), path);
  }
  return paths;
}

/**
 * Remplit un classeur modèle. `sharedText` peut réécrire les textes communs du classeur
 * (ex. l'en-tête répété sur chaque page) : il reçoit chaque texte et renvoie le nouveau, ou null.
 */
export function fillTemplate(
  template: Uint8Array,
  edits: TemplateEdits,
  sharedText?: (text: string) => string | null,
): Uint8Array {
  const files = unzipSync(template);
  const paths = sheetPaths(files);

  for (const [sheet, cells] of Object.entries(edits)) {
    const path = paths.get(sheet);
    if (!path || !files[path]) throw new Error(`Feuille introuvable dans le modèle : « ${sheet} »`);
    let xml = strFromU8(files[path]);
    for (const [ref, value] of Object.entries(cells)) xml = setCellInSheetXml(xml, ref, value);
    files[path] = strToU8(xml);
  }

  if (sharedText && files['xl/sharedStrings.xml']) {
    const xml = strFromU8(files['xl/sharedStrings.xml']).replace(/<si>([\s\S]*?)<\/si>/g, (whole, inner: string) => {
      const text = [...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');
      const next = sharedText(text);
      return next === null ? whole : `<si><t xml:space="preserve">${escapeXml(next)}</t></si>`;
    });
    files['xl/sharedStrings.xml'] = strToU8(xml);
  }

  // Excel recalcule les quelques formules du modèle à l'ouverture
  files['xl/workbook.xml'] = strToU8(
    strFromU8(files['xl/workbook.xml']).replace(/<calcPr\b([^>]*?)\/>/, (tag, attrs: string) =>
      attrs.includes('fullCalcOnLoad') ? tag : `<calcPr${attrs} fullCalcOnLoad="1"/>`,
    ),
  );

  return zipSync(files, { level: 6 });
}
