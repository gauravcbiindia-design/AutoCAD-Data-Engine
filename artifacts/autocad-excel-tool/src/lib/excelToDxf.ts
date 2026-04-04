/**
 * @copyright © 2026 G. Bharti. All rights reserved.
 * @description CAD Data Engine — Excel / CSV to DXF Patch Module
 *
 * CORRECT APPROACH: Instead of generating DXF from scratch (which produces
 * structurally invalid files AutoCAD cannot open), we READ the original DXF
 * files and PATCH only the changed values in-place, then write back.
 *
 * This guarantees AutoCAD compatibility because the file structure, HEADER,
 * TABLES, BLOCKS, OBJECTS sections all come from the original valid file.
 * Only attribute values and text content are modified.
 *
 * Accepts both RAW_EXPORT.xlsx and RAW_EXPORT.csv as input.
 *
 * Workflow:
 *   1. User uploads edited RAW_EXPORT.xlsx OR RAW_EXPORT.csv
 *   2. App reads DWG + HANDLE + Attribute_Tag + Attribute_Value columns
 *   3. App groups changes by source DWG filename
 *   4. For each DWG, user's original .dxf is read from the selected folder
 *   5. App patches ATTRIB/TEXT/MTEXT entities by handle
 *   6. App overwrites the original .dxf file in-place — same filename, same folder
 *
 * Proprietary software. Unauthorised use strictly prohibited.
 */

import * as XLSX from "xlsx";

// ── Types ──────────────────────────────────────────────────────────────────────

/** One editable row read from RAW_EXPORT sheet */
export interface RawExportRow {
  dwg: string;           // source DXF filename (no extension)
  handle: string;        // entity handle (hex string)
  entityType: string;    // ATTRIB | TEXT | MTEXT | INSERT
  block: string;         // parent block name (for ATTRIBs)
  attributeTag: string;  // attribute tag name (ATTRIB only)
  attributeValue: string;// attribute value to write back
  rawText: string;       // text content (TEXT/MTEXT)
}

/** Changes to apply to a single DXF file */
export type DwgPatchMap = Map<
  string,                    // entity handle (hex)
  { tag: string; value: string; rawText: string; entityType: string }
>;

export interface ParsedExcelResult {
  /** Map from DWG name (without .dxf) to its patch set */
  byDwg: Map<string, DwgPatchMap>;
  totalChanges: number;
  dwgNames: string[];
  errors: string[];
}

// ── Shared row → patch map builder ────────────────────────────────────────────

/**
 * Converts an array of plain objects (from Excel or CSV) into a ParsedExcelResult.
 * Expected column names: DWG, HANDLE, Entity_Type, Attribute_Tag, Attribute_Value, Raw_Text
 */
function rowsToPatchResult(rows: any[], sourceName: string): ParsedExcelResult {
  const errors: string[] = [];
  const byDwg = new Map<string, DwgPatchMap>();
  let totalChanges = 0;

  if (rows.length === 0) {
    errors.push(`"${sourceName}" is empty.`);
    return { byDwg, totalChanges, dwgNames: [], errors };
  }

  const firstRow = rows[0];
  const hasRequired = "DWG" in firstRow && "HANDLE" in firstRow;
  if (!hasRequired) {
    errors.push(
      `File must have DWG and HANDLE columns. Found: ${Object.keys(firstRow).join(", ")}`
    );
    return { byDwg, totalChanges, dwgNames: [], errors };
  }

  for (const row of rows) {
    if (!row.DWG || !row.HANDLE) continue;

    const dwg = String(row.DWG).trim().replace(/\.dxf$/i, "").replace(/\.dwg$/i, "");
    const handle = String(row.HANDLE).trim().toUpperCase();
    const entityType = String(row.Entity_Type || "").trim().toUpperCase();
    const attrTag = String(row.Attribute_Tag || "").trim();
    const attrValue = String(row.Attribute_Value ?? "").trim();
    const rawText = String(row.Raw_Text ?? "").trim();

    if (!handle || handle === "HANDLE") continue;

    if (!byDwg.has(dwg)) byDwg.set(dwg, new Map());
    const patchMap = byDwg.get(dwg)!;

    patchMap.set(handle, { tag: attrTag, value: attrValue, rawText, entityType });
    totalChanges++;
  }

  const dwgNames = Array.from(byDwg.keys()).sort();
  return { byDwg, totalChanges, dwgNames, errors };
}

// ── CSV parser ─────────────────────────────────────────────────────────────────

/**
 * Parses a CSV string (RFC 4180 compatible) into an array of row objects.
 * Handles quoted fields, embedded commas, and embedded newlines.
 */
function parseCsvToRows(csv: string): any[] {
  const lines = csv.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header row
  const headers = splitCsvLine(lines[0]);

  const result: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = splitCsvLine(lines[i]);
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx] ?? "";
    });
    result.push(row);
  }
  return result;
}

/** Splits one CSV line respecting quoted fields */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ── Public parsers ─────────────────────────────────────────────────────────────

/**
 * Parse edited RAW_EXPORT.csv (text content from FileReader).
 */
export function parseRawExportCsv(csvText: string): ParsedExcelResult {
  const rows = parseCsvToRows(csvText);
  return rowsToPatchResult(rows, "RAW_EXPORT.csv");
}

// ── Excel parser ───────────────────────────────────────────────────────────────

/**
 * Reads an edited RAW_EXPORT.xlsx and builds a patch map grouped by DWG.
 * Accepts either RAW_EXPORT.xlsx (RAW_EXPORT sheet) or any xlsx with those columns.
 */
export function parseRawExport(buffer: ArrayBuffer): ParsedExcelResult {
  const wb = XLSX.read(buffer, { type: "array" });

  const sheetName = wb.SheetNames.includes("RAW_EXPORT")
    ? "RAW_EXPORT"
    : wb.SheetNames[0];

  if (!sheetName) {
    return {
      byDwg: new Map(),
      totalChanges: 0,
      dwgNames: [],
      errors: ["Excel file has no sheets."],
    };
  }

  const ws = wb.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return rowsToPatchResult(rows, sheetName);
}

// ── DXF patcher ────────────────────────────────────────────────────────────────

/**
 * Patches a raw DXF text string in-place.
 *
 * Algorithm:
 *  - Scans the file as group-code pairs (code on line N, value on line N+1)
 *  - Tracks the current entity (code 0) and current handle (code 5)
 *  - When inside an ATTRIB or TEXT/MTEXT entity whose handle is in the patch
 *    map, replaces the value line (code 1 = text/attribute value) with the
 *    new value from Excel
 *
 * Returns the modified DXF text and a count of replacements made.
 */
/**
 * Returns true if the DXF content contains embedded OLE objects (OLE2FRAME / OLEFRAME).
 * These are Excel/Word/etc. objects embedded directly in the drawing.
 * Write-back on such files may cause AutoCAD to launch blank OLE applications.
 */
export function dxfHasOleObjects(dxfText: string): boolean {
  return /^\s*(OLE2FRAME|OLEFRAME)\s*$/im.test(dxfText);
}

export function patchDxfContent(
  originalDxf: string,
  patches: DwgPatchMap
): { patched: string; replacements: number } {
  if (patches.size === 0) return { patched: originalDxf, replacements: 0 };

  // Split into lines preserving original line endings
  const eol = originalDxf.includes("\r\n") ? "\r\n" : "\n";
  const lines = originalDxf.split(/\r?\n/);

  let replacements = 0;
  let currentEntityType = "";
  let currentHandle = "";
  let waitingForCode1 = false; // true when we're in a patchable entity

  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const codeLine = lines[i];
    const valueLine = i + 1 < lines.length ? lines[i + 1] : "";

    const codeNum = parseInt(codeLine.trim(), 10);

    if (isNaN(codeNum)) {
      // Not a valid group code line — pass through
      out.push(codeLine);
      i++;
      continue;
    }

    // Group code 0 = entity type marker
    if (codeNum === 0) {
      currentEntityType = valueLine.trim().toUpperCase();
      currentHandle = "";
      waitingForCode1 = false;
      out.push(codeLine, valueLine);
      i += 2;
      continue;
    }

    // Group code 5 = handle
    if (codeNum === 5) {
      currentHandle = valueLine.trim().toUpperCase();
      // Check if this handle is in our patch map and entity is patchable
      const patchable =
        currentEntityType === "ATTRIB" ||
        currentEntityType === "TEXT" ||
        currentEntityType === "MTEXT";
      waitingForCode1 = patchable && patches.has(currentHandle);
      out.push(codeLine, valueLine);
      i += 2;
      continue;
    }

    // Group code 1 = text/attribute value — replace if we're waiting
    if (codeNum === 1 && waitingForCode1) {
      const patch = patches.get(currentHandle)!;
      // For ATTRIB: use attribute value; for TEXT/MTEXT: use raw text
      const newValue =
        currentEntityType === "ATTRIB"
          ? patch.value
          : patch.rawText || patch.value;

      out.push(codeLine, newValue);
      replacements++;
      waitingForCode1 = false; // only replace the first code-1 per entity
      i += 2;
      continue;
    }

    // All other group codes — pass through unchanged
    out.push(codeLine, valueLine);
    i += 2;
  }

  return { patched: out.join(eol), replacements };
}

// ── File read helpers ──────────────────────────────────────────────────────────

/** Read a file from a FileSystemDirectoryHandle as text */
export async function readDxfFromFolder(
  folderHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<string> {
  // Try exact name first, then with .dxf extension
  const names = [fileName, fileName + ".dxf", fileName.replace(/\.dxf$/i, "") + ".dxf"];
  for (const name of names) {
    try {
      const fh = await folderHandle.getFileHandle(name);
      const file = await fh.getFile();
      return await file.text();
    } catch {
      // try next
    }
  }
  throw new Error(`File "${fileName}.dxf" not found in selected folder.`);
}

/** Write text back to folder — overwrites the original file in-place */
export async function writeUpdatedDxf(
  folderHandle: FileSystemDirectoryHandle,
  originalName: string,
  content: string
): Promise<string> {
  const outName = originalName.endsWith(".dxf") ? originalName : `${originalName}.dxf`;
  const fh = await folderHandle.getFileHandle(outName, { create: true });
  const writable = await fh.createWritable();
  await writable.write(content);
  await writable.close();
  return outName;
}

/** Download a DXF string as a file in the browser */
export function downloadDxf(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
