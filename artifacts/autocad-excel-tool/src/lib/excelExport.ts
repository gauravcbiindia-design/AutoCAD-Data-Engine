import * as XLSX from "xlsx";
import type { ExtractionResult } from "./engineeringExtractor";
import type { ParsedDxfData } from "./dxfParser";

export interface FileParsedResult {
  fileName: string;
  data: ParsedDxfData;
}

// ── Engineering bulk export (two workbooks) ────────────────────────────────────

export function exportEngineeringExcel(result: ExtractionResult, baseName: string = "autocad-bulk") {
  const timestamp = new Date().toISOString().slice(0, 10);

  exportRaw(result, `RAW_BULK_EXPORT_${timestamp}.xlsx`);
  exportClean(result, `CLEAN_SORTED_OUTPUT_${timestamp}.xlsx`);
}

export function generateRawBuffer(result: ExtractionResult): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(result.rawRows.length ? result.rawRows : [{ Note: "No data" }]);
  autoSizeColumns(ws);
  XLSX.utils.book_append_sheet(wb, ws, "RAW_BULK_EXPORT");
  const statsRows = [
    { Metric: "Total Raw Entities", Value: result.stats.totalEntities },
    { Metric: "Block / Attribute Rows", Value: result.stats.blockRows },
    { Metric: "Text / Annotation Rows", Value: result.stats.textRows },
    { Metric: "Filtered Out (garbage/notes/titles)", Value: result.stats.filteredOut },
    { Metric: "Duplicates Detected", Value: result.stats.duplicates },
    { Metric: "Generated", Value: new Date().toLocaleString() },
  ];
  const wsStats = XLSX.utils.json_to_sheet(statsRows);
  autoSizeColumns(wsStats);
  XLSX.utils.book_append_sheet(wb, wsStats, "Export_Stats");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

export function generateCleanBuffer(result: ExtractionResult): Uint8Array {
  const wb = XLSX.utils.book_new();
  const cleanData = result.cleanRows.length ? result.cleanRows : [{ Note: "No clean data extracted." }];
  const wsClean = XLSX.utils.json_to_sheet(cleanData);
  autoSizeColumns(wsClean);
  XLSX.utils.book_append_sheet(wb, wsClean, "CLEAN_SORTED_OUTPUT");
  const dupes = result.cleanRows.filter((r) => r.Duplicate === "YES");
  const wsDupes = XLSX.utils.json_to_sheet(dupes.length ? dupes : [{ Note: "No duplicates found." }]);
  autoSizeColumns(wsDupes);
  XLSX.utils.book_append_sheet(wb, wsDupes, "Duplicates");
  const instrMap = new Map<string, { count: number; dwgs: Set<string> }>();
  result.cleanRows.forEach((r) => {
    if (r.Instrument_Type) {
      if (!instrMap.has(r.Instrument_Type)) instrMap.set(r.Instrument_Type, { count: 0, dwgs: new Set() });
      const entry = instrMap.get(r.Instrument_Type)!;
      entry.count++;
      entry.dwgs.add(r.DWG);
    }
  });
  const instrRows = [...instrMap.entries()]
    .map(([type, v]) => ({ Instrument_Type: type, Count: v.count, Drawings: [...v.dwgs].join(", ") }))
    .sort((a, b) => b.Count - a.Count);
  const wsInstr = XLSX.utils.json_to_sheet(instrRows.length ? instrRows : [{ Note: "No instruments found." }]);
  autoSizeColumns(wsInstr);
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instrument_Summary");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

export function exportRaw(result: ExtractionResult, filename: string) {
  const wb = XLSX.utils.book_new();

  // RAW DATA sheet
  const ws = XLSX.utils.json_to_sheet(result.rawRows.length ? result.rawRows : [{ Note: "No data" }]);
  autoSizeColumns(ws);
  XLSX.utils.book_append_sheet(wb, ws, "RAW_BULK_EXPORT");

  // Stats sheet
  const statsRows = [
    { Metric: "Total Raw Entities", Value: result.stats.totalEntities },
    { Metric: "Block / Attribute Rows", Value: result.stats.blockRows },
    { Metric: "Text / Annotation Rows", Value: result.stats.textRows },
    { Metric: "Filtered Out (garbage/notes/titles)", Value: result.stats.filteredOut },
    { Metric: "Duplicates Detected", Value: result.stats.duplicates },
    { Metric: "Generated", Value: new Date().toLocaleString() },
  ];
  const wsStats = XLSX.utils.json_to_sheet(statsRows);
  autoSizeColumns(wsStats);
  XLSX.utils.book_append_sheet(wb, wsStats, "Export_Stats");

  XLSX.writeFile(wb, filename);
}

export function exportClean(result: ExtractionResult, filename: string) {
  const wb = XLSX.utils.book_new();

  // CLEAN SORTED OUTPUT
  const cleanData = result.cleanRows.length ? result.cleanRows : [{ Note: "No clean data extracted." }];
  const wsClean = XLSX.utils.json_to_sheet(cleanData);
  autoSizeColumns(wsClean);
  XLSX.utils.book_append_sheet(wb, wsClean, "CLEAN_SORTED_OUTPUT");

  // Duplicates sheet
  const dupes = result.cleanRows.filter((r) => r.Duplicate === "YES");
  const wsDupes = XLSX.utils.json_to_sheet(dupes.length ? dupes : [{ Note: "No duplicates found." }]);
  autoSizeColumns(wsDupes);
  XLSX.utils.book_append_sheet(wb, wsDupes, "Duplicates");

  // Instrument summary sheet
  const instrMap = new Map<string, { count: number; dwgs: Set<string> }>();
  result.cleanRows.forEach((r) => {
    if (r.Instrument_Type) {
      if (!instrMap.has(r.Instrument_Type)) instrMap.set(r.Instrument_Type, { count: 0, dwgs: new Set() });
      const entry = instrMap.get(r.Instrument_Type)!;
      entry.count++;
      entry.dwgs.add(r.DWG);
    }
  });
  const instrRows = [...instrMap.entries()]
    .map(([type, v]) => ({
      Instrument_Type: type,
      Count: v.count,
      Drawings: [...v.dwgs].join(", "),
    }))
    .sort((a, b) => b.Count - a.Count);
  const wsInstr = XLSX.utils.json_to_sheet(instrRows.length ? instrRows : [{ Note: "No instruments found." }]);
  autoSizeColumns(wsInstr);
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instrument_Summary");

  XLSX.writeFile(wb, filename);
}

// ── Legacy single-file export (kept for backwards compat) ─────────────────────
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

  const summaryRows = results.map(({ fileName, data }) => ({
    "File Name": fileName,
    "Block Insertions": data.blocks.length,
    "Text Entities": data.texts.length,
    "Unique Layers": data.layers.length,
  }));
  const ws3 = XLSX.utils.json_to_sheet(summaryRows.length ? summaryRows : [{ Note: "No files." }]);
  autoSizeColumns(ws3);
  XLSX.utils.book_append_sheet(wb, ws3, "Summary");

  XLSX.writeFile(wb, filename);
}

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
