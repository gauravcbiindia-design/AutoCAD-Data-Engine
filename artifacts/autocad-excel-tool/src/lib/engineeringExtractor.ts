// ── Engineering Data Extractor ────────────────────────────────────────────────
// Takes parsed DXF data and produces two datasets:
// 1. RAW — every entity as-is (block attrs + text)
// 2. CLEAN — classified, structured, sorted engineering records

import { classifyText, getInstrumentTypeName } from "./textClassifier";
import type { ParsedDxfData, BlockRecord, TextRecord } from "./dxfParser";

export interface RawRow {
  DWG: string;
  HANDLE: string;
  Entity_Type: string;   // INSERT | TEXT | MTEXT
  BLOCK: string;
  Layer: string;
  X: number;
  Y: number;
  Attribute_Tag: string;
  Attribute_Value: string;
  Raw_Text: string;
  Detected_Type: string; // textClass from classifier
}

export interface CleanRow {
  DWG: string;
  HANDLE: string;
  BLOCK: string;
  Layer: string;
  Attribute_Tag: string;
  Attribute_Value: string;
  Detected_Type: string;
  Instrument_Type: string;
  TAG: string;
  Line_Number: string;
  Size: string;
  Spec: string;
  Insulation: string;
  Tracing: string;
  Service: string;
  Status: string;
  Raw_Text: string;
  Duplicate: string;     // "YES" if duplicate key found
}

export interface ExtractionResult {
  rawRows: RawRow[];
  cleanRows: CleanRow[];
  stats: {
    totalEntities: number;
    blockRows: number;
    textRows: number;
    filteredOut: number;
    duplicates: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Try to extract insulation code from attribute tag/value or layer name
function detectInsulation(attrs: Record<string, string>, layer: string): string {
  const keys = Object.keys(attrs);
  for (const key of keys) {
    if (/insul|ins$/i.test(key)) return attrs[key];
  }
  if (/[-_]INS(?:UL)?[-_]?/i.test(layer)) return "YES";
  return "";
}

function detectTracing(attrs: Record<string, string>, layer: string): string {
  const keys = Object.keys(attrs);
  for (const key of keys) {
    if (/trac|trace|ht|heat/i.test(key)) return attrs[key];
  }
  if (/[-_]HT[-_]?/i.test(layer)) return "YES";
  return "";
}

// Try to find specific engineering values from block attributes
function extractFromAttrs(attrs: { tag: string; value: string }[]): {
  tag: string; lineNumber: string; size: string; spec: string;
  insulation: string; tracing: string; service: string; status: string;
} {
  const result = {
    tag: "", lineNumber: "", size: "", spec: "",
    insulation: "", tracing: "", service: "", status: "",
  };
  const map: Record<string, string> = {};
  attrs.forEach((a) => { map[a.tag.toUpperCase()] = a.value; });

  // TAG — common attribute names for instrument/item tag
  for (const k of ["TAG", "TAG_NO", "TAGNO", "TAG NO", "INSTRUMENT", "ITEM", "ITEM_NO", "ITEM NO", "TAG_NUMBER"]) {
    if (map[k]) { result.tag = map[k]; break; }
  }
  // Also check if any attr VALUE looks like an instrument tag
  if (!result.tag) {
    for (const a of attrs) {
      const classified = classifyText(a.value);
      if (classified.textClass === "INSTRUMENT_TAG") { result.tag = a.value; break; }
    }
  }

  // LINE NUMBER
  for (const k of ["LINE", "LINE_NO", "LINENO", "LINE NO", "LINE_NUMBER", "PIPELINE", "PIPING"]) {
    if (map[k]) { result.lineNumber = map[k]; break; }
  }
  if (!result.lineNumber) {
    for (const a of attrs) {
      const c = classifyText(a.value);
      if (c.textClass === "LINE_NUMBER") { result.lineNumber = a.value; break; }
    }
  }

  // SIZE
  for (const k of ["SIZE", "PIPE_SIZE", "PIPESIZE", "BORE", "NPS", "DN"]) {
    if (map[k]) { result.size = map[k]; break; }
  }
  if (!result.size) {
    for (const a of attrs) {
      const c = classifyText(a.value);
      if (c.textClass === "SIZE") { result.size = a.value; break; }
    }
  }

  // SPEC
  for (const k of ["SPEC", "PIPE_SPEC", "PIPESPEC", "CLASS", "RATING", "MATERIAL_CLASS"]) {
    if (map[k]) { result.spec = map[k]; break; }
  }

  // INSULATION
  for (const k of ["INSULATION", "INS", "INSUL"]) {
    if (map[k]) { result.insulation = map[k]; break; }
  }

  // TRACING
  for (const k of ["TRACING", "TRACE", "HEAT_TRACE", "HT"]) {
    if (map[k]) { result.tracing = map[k]; break; }
  }

  // SERVICE
  for (const k of ["SERVICE", "FLUID", "MEDIUM", "CONTENTS"]) {
    if (map[k]) { result.service = map[k]; break; }
  }
  if (!result.service) {
    for (const a of attrs) {
      const c = classifyText(a.value);
      if (c.textClass === "SERVICE") { result.service = a.value; break; }
    }
  }

  // STATUS
  for (const k of ["STATUS", "CONDITION", "STATE"]) {
    if (map[k]) { result.status = map[k]; break; }
  }
  if (!result.status) {
    for (const a of attrs) {
      const c = classifyText(a.value);
      if (c.textClass === "STATUS") { result.status = a.value; break; }
    }
  }

  return result;
}

// ── Main extractor ────────────────────────────────────────────────────────────

export function extractEngineeringData(
  dwgName: string,
  parsedData: ParsedDxfData
): { rawRows: RawRow[]; cleanRows: CleanRow[] } {
  const rawRows: RawRow[] = [];
  const cleanRows: CleanRow[] = [];

  // ── 1. Process block INSERTs ──────────────────────────────────────────────
  for (const block of parsedData.blocks) {
    const handle = block.handle || "";
    const attrMap = Object.fromEntries(block.attributes.map((a) => [a.tag.toUpperCase(), a.value]));

    if (block.attributes.length === 0) {
      // INSERT with no attributes — add a minimal raw row
      rawRows.push({
        DWG: dwgName,
        HANDLE: handle,
        Entity_Type: "INSERT",
        BLOCK: block.blockName,
        Layer: block.layer,
        X: +block.x.toFixed(4),
        Y: +block.y.toFixed(4),
        Attribute_Tag: "",
        Attribute_Value: "",
        Raw_Text: "",
        Detected_Type: "BLOCK",
      });
    } else {
      // One raw row per attribute
      for (const attr of block.attributes) {
        const classified = classifyText(attr.value);
        rawRows.push({
          DWG: dwgName,
          HANDLE: handle,
          Entity_Type: "INSERT",
          BLOCK: block.blockName,
          Layer: block.layer,
          X: +block.x.toFixed(4),
          Y: +block.y.toFixed(4),
          Attribute_Tag: attr.tag,
          Attribute_Value: attr.value,
          Raw_Text: attr.value,
          Detected_Type: classified.textClass,
        });
      }

      // One clean row per block (all attrs collapsed into structured fields)
      const extracted = extractFromAttrs(block.attributes);
      const tagClassified = extracted.tag ? classifyText(extracted.tag) : null;
      const instrType = tagClassified?.instrumentType || "";

      cleanRows.push({
        DWG: dwgName,
        HANDLE: handle,
        BLOCK: block.blockName,
        Layer: block.layer,
        Attribute_Tag: block.attributes.map((a) => a.tag).join(", "),
        Attribute_Value: block.attributes.map((a) => a.value).join(", "),
        Detected_Type: "BLOCK_ATTRIB",
        Instrument_Type: instrType ? `${instrType} — ${getInstrumentTypeName(instrType)}` : "",
        TAG: extracted.tag,
        Line_Number: extracted.lineNumber,
        Size: extracted.size,
        Spec: extracted.spec,
        Insulation: extracted.insulation,
        Tracing: extracted.tracing,
        Service: extracted.service,
        Status: extracted.status,
        Raw_Text: block.attributes.map((a) => `${a.tag}=${a.value}`).join(" | "),
        Duplicate: "",
      });
    }
  }

  // ── 2. Process TEXT / MTEXT entities ─────────────────────────────────────
  for (const text of parsedData.texts) {
    const handle = text.handle || "";
    const classified = classifyText(text.content);

    rawRows.push({
      DWG: dwgName,
      HANDLE: handle,
      Entity_Type: text.type,
      BLOCK: "",
      Layer: text.layer,
      X: +text.x.toFixed(4),
      Y: +text.y.toFixed(4),
      Attribute_Tag: "",
      Attribute_Value: "",
      Raw_Text: text.content,
      Detected_Type: classified.textClass,
    });

    // Only useful text goes into the clean output
    if (!classified.isUseful) continue;

    cleanRows.push({
      DWG: dwgName,
      HANDLE: handle,
      BLOCK: "",
      Layer: text.layer,
      Attribute_Tag: "",
      Attribute_Value: classified.clean,
      Detected_Type: classified.textClass,
      Instrument_Type: classified.instrumentType
        ? `${classified.instrumentType} — ${getInstrumentTypeName(classified.instrumentType)}`
        : "",
      TAG: classified.textClass === "INSTRUMENT_TAG" ? classified.clean : "",
      Line_Number: classified.lineNumber || "",
      Size: classified.size || "",
      Spec: classified.spec || "",
      Insulation: "",
      Tracing: "",
      Service: classified.service || "",
      Status: classified.status || "",
      Raw_Text: text.content,
      Duplicate: "",
    });
  }

  return { rawRows, cleanRows };
}

// ── Merge and post-process across all files ────────────────────────────────────

export function mergeAndPostProcess(
  allResults: { dwgName: string; rawRows: RawRow[]; cleanRows: CleanRow[] }[]
): ExtractionResult {
  const rawRows: RawRow[] = allResults.flatMap((r) => r.rawRows);
  let cleanRows: CleanRow[] = allResults.flatMap((r) => r.cleanRows);

  // Remove completely blank clean rows (no tag, no value, no text)
  cleanRows = cleanRows.filter(
    (r) =>
      r.TAG || r.Attribute_Value || r.Line_Number || r.Size || r.Service || r.Status
  );

  // Duplicate detection: same DWG + HANDLE + TAG
  const seen = new Map<string, number>();
  cleanRows.forEach((row, i) => {
    const key = `${row.DWG}|${row.HANDLE}|${row.TAG}|${row.Attribute_Value}`;
    if (seen.has(key)) {
      cleanRows[i].Duplicate = "YES";
    } else {
      seen.set(key, i);
    }
  });

  const duplicates = cleanRows.filter((r) => r.Duplicate === "YES").length;
  const filteredOut = rawRows.length - cleanRows.length;

  // Sort: DWG → Line_Number → Instrument_Type → TAG → HANDLE
  cleanRows.sort((a, b) => {
    if (a.DWG !== b.DWG) return a.DWG.localeCompare(b.DWG);
    if (a.Line_Number !== b.Line_Number) return a.Line_Number.localeCompare(b.Line_Number);
    if (a.Instrument_Type !== b.Instrument_Type) return a.Instrument_Type.localeCompare(b.Instrument_Type);
    if (a.TAG !== b.TAG) return a.TAG.localeCompare(b.TAG);
    return a.HANDLE.localeCompare(b.HANDLE);
  });

  // Sort raw by DWG → entity type → layer
  rawRows.sort((a, b) => {
    if (a.DWG !== b.DWG) return a.DWG.localeCompare(b.DWG);
    if (a.Entity_Type !== b.Entity_Type) return a.Entity_Type.localeCompare(b.Entity_Type);
    return a.Layer.localeCompare(b.Layer);
  });

  return {
    rawRows,
    cleanRows,
    stats: {
      totalEntities: rawRows.length,
      blockRows: rawRows.filter((r) => r.Entity_Type === "INSERT").length,
      textRows: rawRows.filter((r) => r.Entity_Type !== "INSERT").length,
      filteredOut,
      duplicates,
    },
  };
}
