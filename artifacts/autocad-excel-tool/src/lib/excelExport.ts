import * as XLSX from "xlsx";
import type { ParsedDxfData } from "./dxfParser";

export interface FileParsedResult {
  fileName: string;
  data: ParsedDxfData;
}

export function exportToExcel(data: ParsedDxfData, filename: string = "autocad-data.xlsx") {
  exportBatchToExcel([{ fileName: filename.replace(/\.xlsx$/i, ".dxf"), data }], filename);
}

export function exportBatchToExcel(results: FileParsedResult[], filename: string = "autocad-batch-data.xlsx") {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Blocks & Attributes ─────────────────────────────────────────
  const blockRows: Record<string, string | number>[] = [];

  const allTags = new Set<string>();
  results.forEach(({ data }) =>
    data.blocks.forEach((b) => b.attributes.forEach((a) => allTags.add(a.tag)))
  );
  const tagList = Array.from(allTags).sort();

  for (const { fileName, data } of results) {
    if (data.blocks.length === 0) continue;
    data.blocks.forEach((block) => {
      const row: Record<string, string | number> = {
        "Source File": fileName,
        "Block Name": block.blockName,
        Layer: block.layer,
        "X Position": +block.x.toFixed(4),
        "Y Position": +block.y.toFixed(4),
        "Z Position": +block.z.toFixed(4),
        Handle: block.handle || "",
      };
      tagList.forEach((tag) => {
        const attr = block.attributes.find((a) => a.tag === tag);
        row[`ATTR: ${tag}`] = attr ? attr.value : "";
      });
      blockRows.push(row);
    });
  }

  if (blockRows.length === 0) {
    blockRows.push({ Note: "No INSERT/block entities found in the uploaded DXF files." });
  } else {
    blockRows.sort((a, b) => {
      const fA = String(a["Source File"]).toLowerCase();
      const fB = String(b["Source File"]).toLowerCase();
      if (fA !== fB) return fA < fB ? -1 : 1;
      const nA = String(a["Block Name"]).toLowerCase();
      const nB = String(b["Block Name"]).toLowerCase();
      if (nA !== nB) return nA < nB ? -1 : 1;
      return String(a["Layer"]).toLowerCase() < String(b["Layer"]).toLowerCase() ? -1 : 1;
    });
  }

  const wsBlocks = XLSX.utils.json_to_sheet(blockRows);
  autoSizeColumns(wsBlocks);
  XLSX.utils.book_append_sheet(wb, wsBlocks, "Blocks & Attributes");

  // ── Sheet 2: Text & Annotations ──────────────────────────────────────────
  const textRows: Record<string, string | number>[] = [];

  for (const { fileName, data } of results) {
    if (data.texts.length === 0) continue;
    data.texts.forEach((t) => {
      textRows.push({
        "Source File": fileName,
        Type: t.type,
        Content: t.content,
        Layer: t.layer,
        "X Position": +t.x.toFixed(4),
        "Y Position": +t.y.toFixed(4),
        "Z Position": +t.z.toFixed(4),
        "Text Height": t.height != null ? +t.height.toFixed(4) : "",
        Handle: t.handle || "",
      });
    });
  }

  if (textRows.length === 0) {
    textRows.push({ Note: "No TEXT or MTEXT entities found in the uploaded DXF files." });
  } else {
    textRows.sort((a, b) => {
      const fA = String(a["Source File"]).toLowerCase();
      const fB = String(b["Source File"]).toLowerCase();
      if (fA !== fB) return fA < fB ? -1 : 1;
      const lA = String(a["Layer"]).toLowerCase();
      const lB = String(b["Layer"]).toLowerCase();
      if (lA !== lB) return lA < lB ? -1 : 1;
      return String(a["Content"]).toLowerCase() < String(b["Content"]).toLowerCase() ? -1 : 1;
    });
  }

  const wsTexts = XLSX.utils.json_to_sheet(textRows);
  autoSizeColumns(wsTexts);
  XLSX.utils.book_append_sheet(wb, wsTexts, "Text & Annotations");

  // ── Sheet 3: Summary ─────────────────────────────────────────────────────
  const summaryRows = results.map(({ fileName, data }) => ({
    "File Name": fileName,
    "Block Insertions": data.blocks.length,
    "Text Entities": data.texts.length,
    "Unique Layers": data.layers.length,
    "Parse Errors": data.errors.join("; ") || "None",
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows.length ? summaryRows : [{ Note: "No files processed." }]);
  autoSizeColumns(wsSummary);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

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
