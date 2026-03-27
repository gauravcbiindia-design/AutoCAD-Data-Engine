import * as XLSX from "xlsx";
import type { ParsedDxfData } from "./dxfParser";

export function exportToExcel(data: ParsedDxfData, filename: string = "autocad-data.xlsx") {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Blocks & Attributes ──────────────────────────────────────────
  const blockRows: Record<string, string | number>[] = [];

  if (data.blocks.length === 0) {
    blockRows.push({ Note: "No INSERT/block entities found in this DXF file." });
  } else {
    // Collect all unique attribute tags across all blocks
    const allTags = new Set<string>();
    data.blocks.forEach((b) => b.attributes.forEach((a) => allTags.add(a.tag)));
    const tagList = Array.from(allTags).sort();

    data.blocks.forEach((block) => {
      const row: Record<string, string | number> = {
        "Block Name": block.blockName,
        Layer: block.layer,
        "X Position": +block.x.toFixed(4),
        "Y Position": +block.y.toFixed(4),
        "Z Position": +block.z.toFixed(4),
        Handle: block.handle || "",
      };
      // Add each attribute tag as a column
      tagList.forEach((tag) => {
        const attr = block.attributes.find((a) => a.tag === tag);
        row[`ATTR: ${tag}`] = attr ? attr.value : "";
      });
      blockRows.push(row);
    });

    // Sort by Block Name then Layer
    blockRows.sort((a, b) => {
      const nameA = String(a["Block Name"]).toLowerCase();
      const nameB = String(b["Block Name"]).toLowerCase();
      if (nameA !== nameB) return nameA < nameB ? -1 : 1;
      return String(a["Layer"]).toLowerCase() < String(b["Layer"]).toLowerCase() ? -1 : 1;
    });
  }

  const wsBlocks = XLSX.utils.json_to_sheet(blockRows);
  styleSheet(wsBlocks, blockRows.length);
  XLSX.utils.book_append_sheet(wb, wsBlocks, "Blocks & Attributes");

  // ── Sheet 2: Text & Annotations ───────────────────────────────────────────
  const textRows: Record<string, string | number>[] = [];

  if (data.texts.length === 0) {
    textRows.push({ Note: "No TEXT or MTEXT entities found in this DXF file." });
  } else {
    data.texts.forEach((t) => {
      textRows.push({
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

    // Sort by Layer then Content
    textRows.sort((a, b) => {
      const layA = String(a["Layer"]).toLowerCase();
      const layB = String(b["Layer"]).toLowerCase();
      if (layA !== layB) return layA < layB ? -1 : 1;
      return String(a["Content"]).toLowerCase() < String(b["Content"]).toLowerCase() ? -1 : 1;
    });
  }

  const wsTexts = XLSX.utils.json_to_sheet(textRows);
  styleSheet(wsTexts, textRows.length);
  XLSX.utils.book_append_sheet(wb, wsTexts, "Text & Annotations");

  // ── Sheet 3: Layers ───────────────────────────────────────────────────────
  const layerRows = data.layers.map((l) => ({ "Layer Name": l }));
  const wsLayers = XLSX.utils.json_to_sheet(layerRows.length ? layerRows : [{ Note: "No layers found." }]);
  XLSX.utils.book_append_sheet(wb, wsLayers, "Layers");

  XLSX.writeFile(wb, filename);
}

function styleSheet(ws: XLSX.WorkSheet, dataRowCount: number) {
  // Auto-size columns based on header names
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const colWidths: number[] = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let maxLen = 10;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v) {
        maxLen = Math.max(maxLen, String(cell.v).length + 2);
      }
    }
    colWidths.push(Math.min(maxLen, 50));
  }
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));
}
