/**
 * @copyright © 2026 G. Bharti. All rights reserved.
 * @description CAD Data Engine — Excel to DXF Patch Module
 *
 * CORRECT APPROACH: Instead of generating DXF from scratch (which produces
 * structurally invalid files AutoCAD cannot open), we READ the original DXF
 * files and PATCH only the changed values in-place, then write back.
 *
 * This guarantees AutoCAD compatibility because the file structure, HEADER,
 * TABLES, BLOCKS, OBJECTS sections all come from the original valid file.
 * Only attribute values and text content are modified.
 *
 * Workflow:
 *   1. User uploads edited RAW_EXPORT.xlsx
 *   2. App reads DWG + HANDLE + Attribute_Tag + Attribute_Value columns
 *   3. App groups changes by source DWG filename
 *   4. For each DWG, user's original .dxf is read from the selected folder
 *   5. App patches ATTRIB/TEXT/MTEXT entities by handle
 *   6. App outputs "updated_{original}.dxf" — one per source drawing
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

// ── Excel parser ───────────────────────────────────────────────────────────────

/**
 * Reads an edited RAW_EXPORT.xlsx and builds a patch map grouped by DWG.
 * Accepts either RAW_EXPORT.xlsx (RAW_EXPORT sheet) or any xlsx with those columns.
 */
export function parseRawExport(buffer: ArrayBuffer): ParsedExcelResult {
  const errors: string[] = [];
  const byDwg = new Map<string, DwgPatchMap>();
  let totalChanges = 0;

  const wb = XLSX.read(buffer, { type: "array" });

  // Accept "RAW_EXPORT" sheet name (from our export) or first sheet
  const sheetName = wb.SheetNames.includes("RAW_EXPORT")
    ? "RAW_EXPORT"
    : wb.SheetNames[0];

  if (!sheetName) {
    errors.push("Excel file has no sheets.");
    return { byDwg, totalChanges, dwgNames: [], errors };
  }

  const ws = wb.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (rows.length === 0) {
    errors.push(`Sheet "${sheetName}" is empty.`);
    return { byDwg, totalChanges, dwgNames: [], errors };
  }

  // Check required columns exist
  const firstRow = rows[0];
  const hasRequired = "DWG" in firstRow && "HANDLE" in firstRow;
  if (!hasRequired) {
    errors.push(
      `Sheet "${sheetName}" must have DWG and HANDLE columns. ` +
      `Found columns: ${Object.keys(firstRow).join(", ")}`
    );
    return { byDwg, totalChanges, dwgNames: [], errors };
  }

  for (const row of rows) {
    // Skip header-like or empty rows
    if (!row.DWG || !row.HANDLE) continue;

    const dwg = String(row.DWG).trim().replace(/\.dxf$/i, "").replace(/\.dwg$/i, "");
    const handle = String(row.HANDLE).trim().toUpperCase();
    const entityType = String(row.Entity_Type || "").trim().toUpperCase();
    const attrTag = String(row.Attribute_Tag || "").trim();
    const attrValue = String(row.Attribute_Value ?? "").trim();
    const rawText = String(row.Raw_Text ?? "").trim();

    if (!handle || handle === "HANDLE") continue; // skip header row if repeated

    if (!byDwg.has(dwg)) byDwg.set(dwg, new Map());
    const patchMap = byDwg.get(dwg)!;

    patchMap.set(handle, {
      tag: attrTag,
      value: attrValue,
      rawText,
      entityType,
    });
    totalChanges++;
  }

  const dwgNames = Array.from(byDwg.keys()).sort();
  return { byDwg, totalChanges, dwgNames, errors };
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

/** Write text back to folder as a new file */
export async function writeUpdatedDxf(
  folderHandle: FileSystemDirectoryHandle,
  originalName: string,
  content: string
): Promise<string> {
  const baseName = originalName.replace(/\.dxf$/i, "");
  const outName = `updated_${baseName}.dxf`;
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
