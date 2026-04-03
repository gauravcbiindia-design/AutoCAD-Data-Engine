/**
 * @copyright © 2026 G. Bharti. All rights reserved.
 * @description CAD Data Engine — Engineering Data Extractor
 * Produces structured engineering datasets from parsed DXF data:
 * ENGINEER_VISIBLE_DATA, LINE_TOKENS, RAW_EXPORT, TEXT_REVIEW, DRAWING_META.
 * Proprietary software. Unauthorised use strictly prohibited.
 */

import { classifyText, getInstrumentTypeName } from "./textClassifier";
import type { ParsedDxfData, BlockRecord, TextRecord } from "./dxfParser";

// ── Category types ─────────────────────────────────────────────────────────────

export type Category =
  | "LINE"
  | "INSTRUMENT"
  | "EQUIPMENT"
  | "OPC"
  | "TEXT_REVIEW"
  | "DRAWING_META";

const CATEGORY_ORDER: Record<Category, number> = {
  LINE: 0, INSTRUMENT: 1, EQUIPMENT: 2, OPC: 3, TEXT_REVIEW: 4, DRAWING_META: 5,
};

// ── Row interfaces ─────────────────────────────────────────────────────────────

export interface EngineerRow {
  DWG: string;
  Handle: string;
  Category: Category;
  Line_Number: string;
  Instrument_Type: string;
  Instrument_Tag: string;
  Instrument_Display: string;
  Equipment_Tag: string;
  Equipment_Name: string;
  Description: string;
  OPC_From: string;
  OPC_To: string;
  OPC_Display: string;
  Visible_Text: string;
  Source_Block: string;
  Source_Field: string;
  Status: string;
  Remarks: string;
}

export interface LineToken {
  DWG: string;
  Handle: string;
  Line_Number: string;
  Token: string;
}

export interface RawRow {
  DWG: string;
  HANDLE: string;
  Entity_Type: string;
  BLOCK: string;
  Layer: string;
  X: number;
  Y: number;
  Attribute_Tag: string;
  Attribute_Value: string;
  Raw_Text: string;
  Detected_Type: string;
}

export interface ExtractionResult {
  rawRows: RawRow[];
  engineerRows: EngineerRow[];
  lineTokens: LineToken[];
  textReviewRows: EngineerRow[];
  drawingMetaRows: EngineerRow[];
  stats: {
    totalEntities: number;
    blockRows: number;
    textRows: number;
    linesFound: number;
    instrumentsFound: number;
    equipmentFound: number;
    opcFound: number;
    textReview: number;
  };
}

// ── Instrument type master list ────────────────────────────────────────────────

const INSTRUMENT_TYPES: Record<string, string> = {
  FT:"Flow Transmitter", FI:"Flow Indicator", FE:"Flow Element",
  FIC:"Flow Indicating Controller", FRC:"Flow Recording Controller",
  FC:"Flow Controller", FCV:"Flow Control Valve",
  FSH:"Flow Switch High", FSL:"Flow Switch Low",
  PT:"Pressure Transmitter", PI:"Pressure Indicator",
  PIC:"Pressure Indicating Controller", PCV:"Pressure Control Valve",
  PSV:"Pressure Safety Valve", PRV:"Pressure Relief Valve",
  PSH:"Pressure Switch High", PSL:"Pressure Switch Low", PG:"Pressure Gauge",
  LT:"Level Transmitter", LI:"Level Indicator",
  LIC:"Level Indicating Controller", LCV:"Level Control Valve",
  LSH:"Level Switch High", LSL:"Level Switch Low", LG:"Level Gauge",
  TT:"Temperature Transmitter", TI:"Temperature Indicator",
  TC:"Temperature Controller", TIC:"Temperature Indicating Controller",
  TE:"Temperature Element", TW:"Thermowell",
  TSH:"Temperature Switch High", TSL:"Temperature Switch Low",
  AT:"Analytical Transmitter", AI:"Analytical Indicator",
  AIC:"Analytical Indicating Controller",
  XV:"On/Off Valve", XCV:"Control Valve", HV:"Hand Valve",
  BV:"Ball Valve", GV:"Gate Valve", CV:"Check Valve",
  MV:"Motor Valve", SDV:"Shutdown Valve", BDV:"Blowdown Valve",
  MOV:"Motor Operated Valve", SOV:"Solenoid Valve",
  HS:"Hand Switch", HIC:"Hand Indicating Controller",
  XZSOC:"Instrument (XZSOC)",
  ZT:"Position Transmitter", ZI:"Position Indicator",
  ST:"Speed Transmitter", SI:"Speed Indicator",
  VT:"Vibration Transmitter", VI:"Vibration Indicator",
  WT:"Weight Transmitter", WI:"Weight Indicator",
  JT:"Power Transmitter", PV:"Process Valve",
  TV:"Temperature Valve", LV:"Level Valve", FV:"Flow Valve",
};

// ── Component / valve body type list ──────────────────────────────────────────
// These are physical piping components (valve bodies, fittings etc.)
// They appear as attribute values in P&ID blocks — separate from instrument codes

const COMPONENT_TYPES: Record<string, string> = {
  GATE:"Gate Valve", BALL:"Ball Valve", GLOBE:"Globe Valve",
  CHECK:"Check Valve", BUTTERFLY:"Butterfly Valve", NEEDLE:"Needle Valve",
  PLUG:"Plug Valve", DIAPHRAGM:"Diaphragm Valve", PINCH:"Pinch Valve",
  PISTON:"Piston Valve", ANGLE:"Angle Valve",
  STRAINER:"Strainer", FILTER:"Filter", TRAP:"Steam Trap",
  ORIFICE:"Orifice Plate", NOZZLE:"Nozzle", FLANGE:"Flange",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function isInstrumentType(code: string): boolean {
  return !!INSTRUMENT_TYPES[code.toUpperCase().trim()];
}

function isComponentType(code: string): boolean {
  return !!COMPONENT_TYPES[code.toUpperCase().trim()];
}

/**
 * Strip AutoCAD inline formatting codes from a string:
 *   %%U → underline toggle (most common in equipment tags like %%U602-DR-01A/B)
 *   %%O → overline toggle
 *   %%D → degree symbol (°)
 *   %%P → plus/minus (±)
 *   %%C → diameter (Ø)
 * Returns clean, readable text.
 */
function stripDxfCodes(val: string): string {
  return val
    .replace(/%%[UuOo]/g, "")   // underline / overline toggles
    .replace(/%%[Dd]/g, "°")
    .replace(/%%[Pp]/g, "±")
    .replace(/%%[Cc]/g, "Ø")
    .trim();
}

/** Build a neutral token list from a line number string */
function tokenise(lineNumber: string): string[] {
  return lineNumber
    .split(/[-\s./\\,]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0);
}

/** Empty EngineerRow template */
function emptyRow(dwg: string, handle: string, category: Category): EngineerRow {
  return {
    DWG: dwg, Handle: handle, Category: category,
    Line_Number: "", Instrument_Type: "", Instrument_Tag: "", Instrument_Display: "",
    Equipment_Tag: "", Equipment_Name: "", Description: "",
    OPC_From: "", OPC_To: "", OPC_Display: "",
    Visible_Text: "", Source_Block: "", Source_Field: "", Status: "", Remarks: "",
  };
}

// ── Block-level category detection ────────────────────────────────────────────

interface InstrumentMatch {
  instrType: string;
  instrTag: string;
  display: string;
}

function detectInstrument(attrs: { tag: string; value: string }[]): InstrumentMatch | null {
  const map: Record<string, string> = {};
  attrs.forEach((a) => { map[a.tag.toUpperCase()] = a.value.trim(); });

  // TOP/BOTTOM pattern (most common P&ID block format)
  const top = map["TOP"] || map["TOPATTR"] || map["FUNCTN"] || map["FUNCTION"] || map["INSTRUMENT"] || "";
  const bottom =
    map["BOTTOM"] || map["BOTATTR"] || map["NUMBER"] || map["NUM"] ||
    map["TAGNO"] || map["TAG_NO"] || map["TAG"] || map["ITEM"] || map["ITEM_NO"] || "";

  if (top && isInstrumentType(top)) {
    const instrType = top.toUpperCase();
    const instrTag = bottom;
    return {
      instrType,
      instrTag,
      display: instrTag ? `${instrType}-${instrTag}` : instrType,
    };
  }

  // Any attribute value that IS a full instrument tag (e.g. PI-2101)
  const FULL_TAG_RE = /^([A-Z]{1,4})-(\d{2,5}[A-Z]?)$/i;
  for (const a of attrs) {
    const m = a.value.trim().toUpperCase().match(FULL_TAG_RE);
    if (m && isInstrumentType(m[1])) {
      return { instrType: m[1], instrTag: m[2], display: a.value.trim().toUpperCase() };
    }
  }

  // Any attribute value that is JUST an instrument type code (broken block TOP)
  for (const a of attrs) {
    const v = a.value.trim().toUpperCase();
    if (isInstrumentType(v)) {
      // Find a numeric-looking attr for tag
      const tagVal = Object.values(map).find((x) => /^\d{2,6}[A-Z]?$/.test(x.trim())) || "";
      return { instrType: v, instrTag: tagVal, display: tagVal ? `${v}-${tagVal}` : v };
    }
  }

  return null;
}

interface EquipmentMatch {
  tag: string;
  name: string;
  desc: string;
}

function detectEquipment(blockName: string, attrs: { tag: string; value: string }[]): EquipmentMatch | null {
  const map: Record<string, string> = {};
  attrs.forEach((a) => { map[a.tag.toUpperCase()] = a.value.trim(); });

  // Known equipment attribute patterns
  const tag =
    map["EQTAG"] || map["EQNO"] || map["EQUIP_NO"] || map["EQUIP_TAG"] ||
    map["EQLINE1"] || map["EQ_TAG"] || map["TAG"] || "";
  const name =
    map["EQNAME"] || map["EQUIP_NAME"] || map["EQLINE2"] || map["EQDESC"] ||
    map["EQDES"] || map["DESCRIPTION"] || map["NAME"] || "";
  const desc =
    map["EQDES"] || map["EQDESC"] || map["EQLINE3"] || map["DESCRIPTION"] ||
    map["DESC"] || map["REMARKS"] || "";

  if (tag || name) return { tag, name, desc };

  // Block name heuristic
  const EQ_BLOCK_RE =
    /^(?:PUMP|VESSEL|TANK|DRUM|COMP(?:RESSOR)?|HEX|E-|V-|P-|C-|T-|D-|COLUMN|REACTOR|FILTER|SEPARATOR|AGIT|FAN|BLOWER|MIXER)/i;
  if (EQ_BLOCK_RE.test(blockName)) {
    const allVals = attrs.map((a) => a.value.trim()).filter(Boolean);
    return {
      tag: allVals[0] || blockName,
      name: allVals[1] || "",
      desc: allVals.slice(2).join(" | "),
    };
  }

  return null;
}

interface OpcMatch {
  from: string;
  to: string;
  display: string;
  connTag: string;
}

function detectOpc(blockName: string, attrs: { tag: string; value: string }[]): OpcMatch | null {
  const map: Record<string, string> = {};
  attrs.forEach((a) => { map[a.tag.toUpperCase()] = a.value.trim(); });

  // Block name check
  const OPC_BLOCK_RE =
    /OPC|OFF[-_\s]?PAGE|ARROW|CONT(?:IN)?|CONNECTOR|MATCHLINE|MATCH[-_\s]?LINE/i;
  const isOpcBlock = OPC_BLOCK_RE.test(blockName);

  // Attribute-based FROM/TO
  const from = map["FROM"] || map["SOURCE"] || map["SOURCEDWG"] || map["FROMDWG"] || "";
  const to = map["TO"] || map["DESTINATION"] || map["TODWG"] || map["DESTDWG"] || "";
  const connTag = map["TAG"] || map["CONNTAG"] || map["CONNECTOR"] || map["LINENO"] || "";
  const lineText = Object.values(map).find((v) =>
    /^(?:CONT(?:INUED)?\s+(?:FROM|TO)|FROM\s+DWG|TO\s+DWG)/i.test(v)
  ) || "";

  if (isOpcBlock || from || to || lineText) {
    const display = from && to
      ? `FROM: ${from} → TO: ${to}`
      : from ? `FROM: ${from}` : to ? `TO: ${to}` : blockName;
    return { from, to, display, connTag };
  }
  return null;
}

function detectLineNumber(attrs: { tag: string; value: string }[]): string {
  const map: Record<string, string> = {};
  attrs.forEach((a) => { map[a.tag.toUpperCase()] = a.value.trim(); });

  // Common line number attribute names (including # convention)
  const LINE_KEYS = [
    "#", "LINE", "LINE_NO", "LINENO", "LINE NO", "LINE_NUMBER",
    "LINE.NO", "LINNUM", "PIPELINE", "PIPING", "PIPENUM",
  ];
  for (const k of LINE_KEYS) {
    if (map[k]) return map[k];
  }

  // Fall back: any attr value that looks like a line number
  const LINE_RE = /^\d{1,4}["']?[-–]\s*[A-Z]{1,4}[-–]\s*\d{2,6}(?:[-–][A-Z0-9]{2,6}){0,3}$/i;
  for (const a of attrs) {
    if (LINE_RE.test(a.value.trim())) return a.value.trim();
  }

  return "";
}

function detectStatus(attrs: { tag: string; value: string }[]): string {
  const map: Record<string, string> = {};
  attrs.forEach((a) => { map[a.tag.toUpperCase()] = a.value.trim(); });
  return map["STATUS"] || map["CONDITION"] || map["STATE"] || map["PHASE"] || "";
}

function isDrawingMetaBlock(blockName: string, attrs: { tag: string; value: string }[]): boolean {
  const META_RE =
    /^(?:TITLE|TITLEBLOCK|TITLEBLK|DRAWINGNO|REVBLOCK|REVTABLE|REVISIONTABLE|BORDER|REVISN|PROJINFO|DRWINFO)/i;
  if (META_RE.test(blockName)) return true;
  const map: Record<string, string> = {};
  attrs.forEach((a) => { map[a.tag.toUpperCase()] = a.value.trim(); });
  return !!(map["TITLE"] || map["DRWNO"] || map["DWGNO"] || map["PROJNO"] || map["REVNO"]);
}

function allAttrText(attrs: { tag: string; value: string }[]): string {
  return attrs
    .filter((a) => a.value.trim())
    .map((a) => `${a.tag}=${a.value}`)
    .join(" | ");
}

// ── Main extractor ────────────────────────────────────────────────────────────

export function extractEngineeringData(
  dwgName: string,
  parsedData: ParsedDxfData
): {
  rawRows: RawRow[];
  engineerRows: EngineerRow[];
  lineTokens: LineToken[];
  textReviewRows: EngineerRow[];
  drawingMetaRows: EngineerRow[];
} {
  const rawRows: RawRow[] = [];
  const engineerRows: EngineerRow[] = [];
  const lineTokens: LineToken[] = [];
  const textReviewRows: EngineerRow[] = [];
  const drawingMetaRows: EngineerRow[] = [];

  // ── 1. Block INSERT entities ──────────────────────────────────────────────
  for (const block of parsedData.blocks) {
    const handle = block.handle || "";
    const blockName = block.blockName || "";
    const attrs = block.attributes;

    // Raw rows (one per attribute, or one minimal row if no attrs)
    if (attrs.length === 0) {
      rawRows.push({
        DWG: dwgName, HANDLE: handle, Entity_Type: "INSERT",
        BLOCK: blockName, Layer: block.layer,
        X: +block.x.toFixed(4), Y: +block.y.toFixed(4),
        Attribute_Tag: "", Attribute_Value: "", Raw_Text: "", Detected_Type: "BLOCK",
      });
    } else {
      // Tags that identify instrument data in P&ID blocks
      const INSTRUMENT_ATTR_TAGS = new Set(["TOP", "BOTTOM", "MID", "TOPATTR", "BOTATTR", "FUNCTN", "FUNCTION"]);

      // OPC connector tag pattern: DA1001, DA1002, DB2001, etc. (2 letters + 3-6 digits)
      const OPC_TAG_RE = /^D[A-Z]\d{3,6}$/i;

      // OPC value pattern: "FROM ...", "TO ...", "CONT FROM", "CONTINUED TO" etc.
      const OPC_VALUE_RE = /^(?:FROM|TO|CONT(?:INUED)?\s+(?:FROM|TO)|FROM\s+DWG|TO\s+DWG)\b/i;

      // Equipment tag pattern: EQLINE1, EQNAME1, EQNAME2, EQNAME3, EQNO, EQTAG etc.
      const EQUIPMENT_TAG_RE = /^EQ/i;

      for (const attr of attrs) {
        const tagUpper = attr.tag.toUpperCase().trim();
        const valTrim = attr.value.trim();
        const isInstrAttr  = INSTRUMENT_ATTR_TAGS.has(tagUpper);
        const isOpcAttr    = OPC_TAG_RE.test(tagUpper) || OPC_VALUE_RE.test(valTrim);
        const isEquipAttr  = EQUIPMENT_TAG_RE.test(tagUpper);
        // If the attribute VALUE itself is an instrument type code (e.g. FT, TV, PSV, TC)
        // treat this row as INSTRUMENTS — UC and other non-instrument codes stay as-is
        const isInstrValue = valTrim.length >= 2 && valTrim.length <= 12 && isInstrumentType(valTrim);
        // If the attribute VALUE is a physical component type (GATE, BALL, CHECK etc.)
        const isCompValue  = valTrim.length >= 3 && valTrim.length <= 12 && isComponentType(valTrim);
        const classified   = classifyText(attr.value);
        const detectedType = isInstrAttr   ? "INSTRUMENTS"
                           : isOpcAttr     ? "OPC"
                           : isEquipAttr   ? "EQUIPMENT"
                           : isInstrValue  ? "INSTRUMENTS"
                           : isCompValue   ? "COMPONENTS"
                           :                 classified.textClass;

        // Strip AutoCAD formatting codes (%%U etc.) from displayed value
        const cleanValue = stripDxfCodes(attr.value);

        rawRows.push({
          DWG: dwgName, HANDLE: handle, Entity_Type: "INSERT",
          BLOCK: blockName, Layer: block.layer,
          X: +block.x.toFixed(4), Y: +block.y.toFixed(4),
          Attribute_Tag: attr.tag, Attribute_Value: cleanValue,
          Raw_Text: "", Detected_Type: detectedType,
        });
      }

      // If this block contains TOP/BOTTOM/MID attributes, add one combined
      // INSTRUMENT summary row (e.g. "PG-2104") so users can filter easily
      const hasInstrAttr = attrs.some(
        (a) => INSTRUMENT_ATTR_TAGS.has(a.tag.toUpperCase().trim())
      );
      if (hasInstrAttr) {
        const instrMatch = detectInstrument(attrs);
        if (instrMatch) {
          rawRows.push({
            DWG: dwgName, HANDLE: handle, Entity_Type: "INSERT",
            BLOCK: blockName, Layer: block.layer,
            X: +block.x.toFixed(4), Y: +block.y.toFixed(4),
            Attribute_Tag: "INSTRUMENT",
            Attribute_Value: instrMatch.display,
            Raw_Text: "", Detected_Type: "INSTRUMENTS",
          });
        }
      }

      // If this block contains EQ* attributes, add one combined EQUIPMENT summary row
      // EQLINE1 → Equipment Tag (e.g. 602-DR-01A/B after stripping %%U)
      // EQNAME1 + EQNAME2 + EQNAME3 → Equipment Name (combined)
      const hasEquipAttr = attrs.some((a) => EQUIPMENT_TAG_RE.test(a.tag.toUpperCase().trim()));
      if (hasEquipAttr) {
        const eqMap: Record<string, string> = {};
        for (const a of attrs) {
          eqMap[a.tag.toUpperCase().trim()] = stripDxfCodes(a.value);
        }
        const eqTag  = eqMap["EQLINE1"] || eqMap["EQNO"] || eqMap["EQTAG"] || "";
        const eqName = [eqMap["EQNAME1"], eqMap["EQNAME2"], eqMap["EQNAME3"]]
          .filter(Boolean).join(" ").trim();
        const eqDisplay = [eqTag, eqName].filter(Boolean).join(" — ");
        if (eqDisplay) {
          rawRows.push({
            DWG: dwgName, HANDLE: handle, Entity_Type: "INSERT",
            BLOCK: blockName, Layer: block.layer,
            X: +block.x.toFixed(4), Y: +block.y.toFixed(4),
            Attribute_Tag: "EQUIPMENT",
            Attribute_Value: eqDisplay,
            Raw_Text: "", Detected_Type: "EQUIPMENT",
          });
        }
      }
    }

    if (attrs.length === 0) continue; // no engineering data to classify

    const visibleText = allAttrText(attrs);
    const statusVal = detectStatus(attrs);

    // ── Drawing Meta? ──────────────────────────────────────────────────────
    if (isDrawingMetaBlock(blockName, attrs)) {
      const map: Record<string, string> = {};
      attrs.forEach((a) => { map[a.tag.toUpperCase()] = a.value.trim(); });
      const row = emptyRow(dwgName, handle, "DRAWING_META");
      row.Source_Block = blockName;
      row.Visible_Text = visibleText;
      row.Description =
        map["TITLE"] || map["DRWTITLE"] || "";
      row.Remarks =
        [map["PROJNO"], map["DRWNO"], map["DWGNO"], map["REVNO"]]
          .filter(Boolean).join(" | ");
      row.Status = statusVal;
      drawingMetaRows.push(row);
      continue;
    }

    // ── OPC? ───────────────────────────────────────────────────────────────
    const opcMatch = detectOpc(blockName, attrs);
    if (opcMatch) {
      const row = emptyRow(dwgName, handle, "OPC");
      row.OPC_From = opcMatch.from;
      row.OPC_To = opcMatch.to;
      row.OPC_Display = opcMatch.display;
      row.Visible_Text = visibleText;
      row.Source_Block = blockName;
      row.Source_Field = opcMatch.connTag;
      row.Status = statusVal;
      engineerRows.push(row);
      continue;
    }

    // ── Instrument? ────────────────────────────────────────────────────────
    const instrMatch = detectInstrument(attrs);
    if (instrMatch) {
      const row = emptyRow(dwgName, handle, "INSTRUMENT");
      row.Instrument_Type = instrMatch.instrType;
      row.Instrument_Tag = instrMatch.instrTag;
      row.Instrument_Display = instrMatch.display;
      row.Visible_Text = visibleText;
      row.Source_Block = blockName;
      row.Status = statusVal;
      engineerRows.push(row);
      continue;
    }

    // ── Equipment? ────────────────────────────────────────────────────────
    const eqMatch = detectEquipment(blockName, attrs);
    if (eqMatch) {
      const row = emptyRow(dwgName, handle, "EQUIPMENT");
      row.Equipment_Tag = eqMatch.tag;
      row.Equipment_Name = eqMatch.name;
      row.Description = eqMatch.desc;
      row.Visible_Text = visibleText;
      row.Source_Block = blockName;
      row.Status = statusVal;
      engineerRows.push(row);
      continue;
    }

    // ── Line Number? ───────────────────────────────────────────────────────
    const lineNum = detectLineNumber(attrs);
    if (lineNum) {
      const row = emptyRow(dwgName, handle, "LINE");
      row.Line_Number = lineNum;
      row.Visible_Text = visibleText;
      row.Source_Block = blockName;
      row.Status = statusVal;
      engineerRows.push(row);
      // Generate tokens
      tokenise(lineNum).forEach((token) => {
        lineTokens.push({ DWG: dwgName, Handle: handle, Line_Number: lineNum, Token: token });
      });
      continue;
    }

    // ── TEXT_REVIEW fallback ───────────────────────────────────────────────
    const row = emptyRow(dwgName, handle, "TEXT_REVIEW");
    row.Visible_Text = visibleText;
    row.Source_Block = blockName;
    row.Status = statusVal;
    row.Remarks = "Block: unclassified — check attributes";
    textReviewRows.push(row);
  }

  // ── 2. TEXT / MTEXT entities ──────────────────────────────────────────────
  // OPC pattern for loose text: "FROM ...", "TO ...", "CONT FROM/TO" etc.
  const OPC_LOOSE_RE = /^(?:FROM|TO|CONT(?:INUED)?\s+(?:FROM|TO)|FROM\s+DWG|TO\s+DWG)\b/i;

  for (const text of parsedData.texts) {
    const handle = text.handle || "";
    const classified = classifyText(text.content);
    const isOpcText = OPC_LOOSE_RE.test(text.content.trim());

    // TEXT / MTEXT rows labelled by category so engineers can filter each group
    const contentTrim = text.content.trim();
    const rawDetectedType = isOpcText                                   ? "OPC"
                          : classified.textClass === "LINE_NUMBER"      ? "LINE_NUMBER"
                          : classified.textClass === "NOTE"             ? "NOTE"
                          : classified.textClass === "INSTRUMENT_TAG"   ? "INSTRUMENTS"
                          : isInstrumentType(contentTrim)               ? "INSTRUMENTS"
                          :                                               "TEXT";

    rawRows.push({
      DWG: dwgName, HANDLE: handle, Entity_Type: text.type,
      BLOCK: "", Layer: text.layer,
      X: +text.x.toFixed(4), Y: +text.y.toFixed(4),
      Attribute_Tag: "", Attribute_Value: "",
      Raw_Text: text.content, Detected_Type: rawDetectedType,
    });

    const cleanVal = classified.clean;

    // Skip pure garbage / revision / notes
    if (!classified.isUseful) continue;

    // ── OPC text (FROM/TO pattern in free text) ────────────────────────────
    const OPC_TEXT_RE =
      /^(?:CONT(?:INUED)?\s+(?:FROM|TO)|FROM\s+(?:DWG|SHEET|SHT)|TO\s+(?:DWG|SHEET|SHT))/i;
    if (OPC_TEXT_RE.test(cleanVal)) {
      const row = emptyRow(dwgName, handle, "OPC");
      row.Visible_Text = cleanVal;
      row.OPC_Display = cleanVal;
      row.Source_Block = "";
      row.Source_Field = text.layer;
      engineerRows.push(row);
      continue;
    }

    // ── Drawing meta text (TITLE/REVISION) ────────────────────────────────
    if (
      classified.textClass === "TITLE" ||
      classified.textClass === "REVISION"
    ) {
      const row = emptyRow(dwgName, handle, "DRAWING_META");
      row.Visible_Text = cleanVal;
      row.Source_Field = text.layer;
      row.Remarks = classified.textClass;
      drawingMetaRows.push(row);
      continue;
    }

    // ── Instrument tag ─────────────────────────────────────────────────────
    if (classified.textClass === "INSTRUMENT_TAG" && classified.instrumentType) {
      const row = emptyRow(dwgName, handle, "INSTRUMENT");
      row.Instrument_Type = classified.instrumentType;
      row.Instrument_Tag = classified.tagValue || "";
      row.Instrument_Display = classified.instrumentType && classified.tagValue
        ? `${classified.instrumentType}-${classified.tagValue}` : cleanVal;
      row.Visible_Text = cleanVal;
      row.Source_Field = text.layer;
      engineerRows.push(row);
      continue;
    }

    // ── Line number ────────────────────────────────────────────────────────
    if (classified.textClass === "LINE_NUMBER") {
      const row = emptyRow(dwgName, handle, "LINE");
      row.Line_Number = cleanVal;
      row.Visible_Text = cleanVal;
      row.Source_Field = text.layer;
      engineerRows.push(row);
      tokenise(cleanVal).forEach((token) => {
        lineTokens.push({ DWG: dwgName, Handle: handle, Line_Number: cleanVal, Token: token });
      });
      continue;
    }

    // ── Status text ────────────────────────────────────────────────────────
    if (classified.textClass === "STATUS") {
      const row = emptyRow(dwgName, handle, "TEXT_REVIEW");
      row.Visible_Text = cleanVal;
      row.Status = cleanVal;
      row.Source_Field = text.layer;
      row.Remarks = "Status text";
      textReviewRows.push(row);
      continue;
    }

    // ── Everything else useful → TEXT_REVIEW ──────────────────────────────
    const row = emptyRow(dwgName, handle, "TEXT_REVIEW");
    row.Visible_Text = cleanVal;
    row.Source_Field = text.layer;
    row.Remarks = `${classified.textClass} — verify`;
    textReviewRows.push(row);
  }

  return { rawRows, engineerRows, lineTokens, textReviewRows, drawingMetaRows };
}

// ── Merge and post-process across all files ────────────────────────────────────

export function mergeAndPostProcess(
  allResults: {
    dwgName: string;
    rawRows: RawRow[];
    engineerRows: EngineerRow[];
    lineTokens: LineToken[];
    textReviewRows: EngineerRow[];
    drawingMetaRows: EngineerRow[];
  }[]
): ExtractionResult {
  const rawRows: RawRow[] = allResults.flatMap((r) => r.rawRows);
  let engineerRows: EngineerRow[] = allResults.flatMap((r) => r.engineerRows);
  const lineTokens: LineToken[] = allResults.flatMap((r) => r.lineTokens);
  const textReviewRows: EngineerRow[] = allResults.flatMap((r) => r.textReviewRows);
  const drawingMetaRows: EngineerRow[] = allResults.flatMap((r) => r.drawingMetaRows);

  // Sort engineer rows: DWG → Category → Line_Number|Instrument_Tag → Handle
  engineerRows.sort((a, b) => {
    if (a.DWG !== b.DWG) return a.DWG.localeCompare(b.DWG);
    const catDiff = CATEGORY_ORDER[a.Category] - CATEGORY_ORDER[b.Category];
    if (catDiff !== 0) return catDiff;
    const aKey = a.Line_Number || a.Instrument_Tag || a.Equipment_Tag || a.OPC_Display || "";
    const bKey = b.Line_Number || b.Instrument_Tag || b.Equipment_Tag || b.OPC_Display || "";
    if (aKey !== bKey) return aKey.localeCompare(bKey);
    return a.Handle.localeCompare(b.Handle);
  });

  // Sort raw: DWG → entity type → layer
  rawRows.sort((a, b) => {
    if (a.DWG !== b.DWG) return a.DWG.localeCompare(b.DWG);
    if (a.Entity_Type !== b.Entity_Type) return a.Entity_Type.localeCompare(b.Entity_Type);
    return a.Layer.localeCompare(b.Layer);
  });

  // Sort tokens: DWG → Line_Number → Token
  lineTokens.sort((a, b) => {
    if (a.DWG !== b.DWG) return a.DWG.localeCompare(b.DWG);
    if (a.Line_Number !== b.Line_Number) return a.Line_Number.localeCompare(b.Line_Number);
    return a.Token.localeCompare(b.Token);
  });

  const linesFound = engineerRows.filter((r) => r.Category === "LINE").length;
  const instrumentsFound = engineerRows.filter((r) => r.Category === "INSTRUMENT").length;
  const equipmentFound = engineerRows.filter((r) => r.Category === "EQUIPMENT").length;
  const opcFound = engineerRows.filter((r) => r.Category === "OPC").length;

  return {
    rawRows,
    engineerRows,
    lineTokens,
    textReviewRows,
    drawingMetaRows,
    stats: {
      totalEntities: rawRows.length,
      blockRows: rawRows.filter((r) => r.Entity_Type === "INSERT").length,
      textRows: rawRows.filter((r) => r.Entity_Type !== "INSERT").length,
      linesFound,
      instrumentsFound,
      equipmentFound,
      opcFound,
      textReview: textReviewRows.length,
    },
  };
}
