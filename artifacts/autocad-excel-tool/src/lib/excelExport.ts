/**
 * @copyright © 2026 G. Bharti. All rights reserved.
 * @description CAD Data Engine — Excel Export Module
 * Generates ENGINEER_DATA and RAW_EXPORT Excel workbooks from extracted data.
 * Sheet structure: ENGINEER_VISIBLE_DATA, LINE_TOKENS, TEXT_REVIEW, DRAWING_META,
 * RAW_EXPORT, Export_Stats.
 * Proprietary software. Unauthorised use strictly prohibited.
 */

import * as XLSX from "xlsx";
import type { ExtractionResult } from "./engineeringExtractor";
import type { ParsedDxfData } from "./dxfParser";

export interface FileParsedResult {
  fileName: string;
  data: ParsedDxfData;
}

// ── Column order definitions ───────────────────────────────────────────────────

const ENGINEER_COLUMNS = [
  "DWG", "Handle", "Category",
  "Line_Number",
  "Instrument_Type", "Instrument_Tag", "Instrument_Display",
  "Equipment_Tag", "Equipment_Name", "Description",
  "OPC_From", "OPC_To", "OPC_Display",
  "Visible_Text", "Source_Block", "Source_Field",
  "Status", "Remarks",
];

const TOKEN_COLUMNS = ["DWG", "Handle", "Line_Number", "Token"];

const RAW_COLUMNS = [
  "DWG", "HANDLE", "Entity_Type", "BLOCK", "Layer",
  "X", "Y", "Attribute_Tag", "Attribute_Value", "Raw_Text", "Detected_Type",
];

// ── Sheet builder helper ───────────────────────────────────────────────────────

function makeSheet<T extends object>(
  data: T[],
  columns: string[],
  emptyNote: string
): XLSX.WorkSheet {
  if (data.length === 0) {
    const ws = XLSX.utils.json_to_sheet([{ Note: emptyNote }]);
    autoSizeColumns(ws);
    return ws;
  }
  // Enforce column order — only include defined columns
  const ordered = data.map((row) => {
    const out: Record<string, unknown> = {};
    columns.forEach((col) => { out[col] = (row as any)[col] ?? ""; });
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(ordered, { header: columns });
  autoSizeColumns(ws);
  return ws;
}

// ── ENGINEER_DATA workbook (main output) ──────────────────────────────────────

export function buildEngineerWorkbook(result: ExtractionResult): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — ENGINEER_VISIBLE_DATA
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(result.engineerRows, ENGINEER_COLUMNS, "No engineer-visible data extracted."),
    "ENGINEER_VISIBLE_DATA"
  );

  // Sheet 2 — LINE_TOKENS
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(result.lineTokens, TOKEN_COLUMNS, "No line numbers found."),
    "LINE_TOKENS"
  );

  // Sheet 3 — TEXT_REVIEW
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(result.textReviewRows, ENGINEER_COLUMNS, "No text review items."),
    "TEXT_REVIEW"
  );

  // Sheet 4 — DRAWING_META
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(result.drawingMetaRows, ENGINEER_COLUMNS, "No drawing metadata found."),
    "DRAWING_META"
  );

  return wb;
}

// ── RAW_EXPORT workbook ────────────────────────────────────────────────────────

export function buildRawWorkbook(result: ExtractionResult): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — RAW_EXPORT
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(result.rawRows, RAW_COLUMNS, "No raw data."),
    "RAW_EXPORT"
  );

  // Sheet 2 — Export_Stats
  const statsRows = [
    { Metric: "Total Raw Entities",   Value: result.stats.totalEntities },
    { Metric: "Block / Attribute Rows", Value: result.stats.blockRows },
    { Metric: "Text / Annotation Rows", Value: result.stats.textRows },
    { Metric: "Lines Found",           Value: result.stats.linesFound },
    { Metric: "Instruments Found",     Value: result.stats.instrumentsFound },
    { Metric: "Equipment Found",       Value: result.stats.equipmentFound },
    { Metric: "OPC Connectors Found",  Value: result.stats.opcFound },
    { Metric: "Text Review Items",     Value: result.stats.textReview },
    { Metric: "Line Tokens Generated", Value: result.lineTokens.length },
    { Metric: "Generated",             Value: new Date().toLocaleString() },
  ];
  const wsStats = XLSX.utils.json_to_sheet(statsRows);
  autoSizeColumns(wsStats);
  XLSX.utils.book_append_sheet(wb, wsStats, "Export_Stats");

  return wb;
}

// ── Buffer generators (for folder save-back) ──────────────────────────────────

export function generateEngineerBuffer(result: ExtractionResult): Uint8Array {
  return XLSX.write(buildEngineerWorkbook(result), { bookType: "xlsx", type: "array" });
}

export function generateRawBuffer(result: ExtractionResult): Uint8Array {
  return XLSX.write(buildRawWorkbook(result), { bookType: "xlsx", type: "array" });
}

// ── Browser download functions ─────────────────────────────────────────────────

export function exportEngineerData(result: ExtractionResult) {
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(buildEngineerWorkbook(result), `ENGINEER_DATA_${date}.xlsx`);
}

export function exportRaw(result: ExtractionResult) {
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(buildRawWorkbook(result), `RAW_EXPORT_${date}.xlsx`);
}

/** Build a CSV string from RAW_EXPORT data (no file I/O — pure string) */
export function buildRawCsvString(result: ExtractionResult): string {
  const rows = result.rawRows;
  const headers = RAW_COLUMNS;

  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row: any) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ];
  return lines.join("\r\n");
}

/** Export RAW_EXPORT data as a plain CSV file (no background process — safe for AutoCAD workflows) */
export function exportRawCsv(result: ExtractionResult) {
  if (result.rawRows.length === 0) return;
  const date = new Date().toISOString().slice(0, 10);
  const csv = buildRawCsvString(result);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `RAW_EXPORT_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Legacy Excel → DXF export (kept for Blocks & Attributes sheet compat) ────
export function exportBatchToExcel(results: FileParsedResult[], filename: string = "autocad-batch-data.xlsx") {
  const wb = XLSX.utils.book_new();

  const allTags = new Set<string>();
  results.forEach(({ data }) =>
    data.blocks.forEach((b) => b.attributes.forEach((a) => allTags.add(a.tag)))
  );
  const tagList = Array.from(allTags).sort();

  const blockRows: Record<string, string | number>[] = [];
  for (const { fileName, data } of results) {
    if (data.blocks.length === 0) continue;
    data.blocks.forEach((block) => {
      const row: Record<string, string | number> = {
        "Source File": fileName,
        "Block Name": block.blockName,
        Layer: block.layer,
        "X Position": +block.x.toFixed(4),
        "Y Position": +block.y.toFixed(4),
        Handle: block.handle || "",
      };
      tagList.forEach((tag) => {
        const attr = block.attributes.find((a) => a.tag === tag);
        row[`ATTR: ${tag}`] = attr ? attr.value : "";
      });
      blockRows.push(row);
    });
  }
  if (blockRows.length === 0) blockRows.push({ Note: "No block entities found." });

  const textRows: Record<string, string | number>[] = [];
  for (const { fileName, data } of results) {
    data.texts.forEach((t) => {
      textRows.push({
        "Source File": fileName,
        Type: t.type,
        Content: t.content,
        Layer: t.layer,
        "X Position": +t.x.toFixed(4),
        "Y Position": +t.y.toFixed(4),
        Handle: t.handle || "",
      });
    });
  }
  if (textRows.length === 0) textRows.push({ Note: "No text entities found." });

  const ws1 = XLSX.utils.json_to_sheet(blockRows);
  autoSizeColumns(ws1);
  XLSX.utils.book_append_sheet(wb, ws1, "Blocks & Attributes");

  const ws2 = XLSX.utils.json_to_sheet(textRows);
  autoSizeColumns(ws2);
  XLSX.utils.book_append_sheet(wb, ws2, "Text & Annotations");

  XLSX.writeFile(wb, filename);
}

// ── Auto column width ──────────────────────────────────────────────────────────

function autoSizeColumns(ws: XLSX.WorkSheet) {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const colWidths: number[] = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let maxLen = 10;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v) maxLen = Math.max(maxLen, String(cell.v).length + 2);
    }
    colWidths.push(Math.min(maxLen, 60));
  }
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));
}
