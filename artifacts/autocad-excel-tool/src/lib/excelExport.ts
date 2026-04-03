/**
 * @copyright © 2026 G. Bharti. All rights reserved.
 * @description CAD Data Engine — CSV Export Module
 * Generates RAW_EXPORT CSV from extracted engineering data.
 * No Excel / XLSX generation — CSV only, safe for AutoCAD workflows (no background processes).
 * Proprietary software. Unauthorised use strictly prohibited.
 */

import type { ExtractionResult } from "./engineeringExtractor";

export interface FileParsedResult {
  fileName: string;
  data: import("./dxfParser").ParsedDxfData;
}

// ── Column order ───────────────────────────────────────────────────────────────

export const RAW_COLUMNS = [
  "DWG", "HANDLE", "Entity_Type", "BLOCK", "Layer",
  "X", "Y", "Attribute_Tag", "Attribute_Value", "Full_Tag", "Raw_Text", "Detected_Type",
] as const;

// ── CSV builder ────────────────────────────────────────────────────────────────

/**
 * Build a CSV string from RAW_EXPORT data.
 * Filtering rules:
 *   - OPC, INSTRUMENTS, EQUIPMENT rows → always kept even if value is blank
 *   - LINE_NUMBER, NOTE, TEXT rows with blank/N/A value → filtered out
 *   - Duplicate LINE_NUMBER values (any source) → deduplicated
 */
export function buildRawCsvString(result: ExtractionResult): string {
  const SKIP_VALUES = new Set(["", "n/a", "none", "na"]);
  // These detected types are always kept regardless of blank/N/A values
  const ALWAYS_KEEP = new Set(["OPC", "INSTRUMENTS", "EQUIPMENT", "COMPONENTS", "ALARM", "INTERLOCK"]);

  const filtered = result.rawRows.filter((row: any) => {
    if (ALWAYS_KEEP.has(String(row.Detected_Type ?? ""))) return true;
    const val = String(row.Attribute_Value ?? "").trim().toLowerCase();
    const txt = String(row.Raw_Text ?? "").trim().toLowerCase();
    return !SKIP_VALUES.has(val) || !SKIP_VALUES.has(txt);
  });

  // Deduplicate LINE_NUMBER rows — same value from any source appears only once
  const seenLineNumbers = new Set<string>();
  const rows = filtered.filter((row: any) => {
    const type = String(row.Detected_Type ?? "");
    if (type !== "LINE_NUMBER") return true;
    const lineVal = (
      String(row.Attribute_Value ?? "").trim() ||
      String(row.Raw_Text ?? "").trim()
    ).toUpperCase();
    if (!lineVal || seenLineNumbers.has(lineVal)) return false;
    seenLineNumbers.add(lineVal);
    return true;
  });

  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const headers = RAW_COLUMNS as unknown as string[];
  const lines = [
    headers.join(","),
    ...rows.map((row: any) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ];
  return lines.join("\r\n");
}

/**
 * Trigger browser download of RAW_EXPORT.csv.
 * Uses Blob + anchor — no background process, safe for AutoCAD workflows.
 */
export function exportRawCsv(result: ExtractionResult) {
  if (result.rawRows.length === 0) return;
  const date = new Date().toISOString().slice(0, 10);
  const csv = buildRawCsvString(result);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `RAW_EXPORT_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
