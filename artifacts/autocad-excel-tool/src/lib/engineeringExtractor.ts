/**
 * @copyright © 2026 G. Bharti. All rights reserved.
 * @description CAD Data Engine — Engineering Data Extractor
 * Produces structured engineering datasets from parsed DXF data:
 * ENGINEER_VISIBLE_DATA, LINE_TOKENS, RAW_EXPORT, TEXT_REVIEW, DRAWING_META.
 * Proprietary software. Unauthorised use strictly prohibited.
 */

import { classifyText, getInstrumentTypeName } from "./textClassifier";
import type { ParsedDxfData, BlockRecord, BlockAttribute, TextRecord } from "./dxfParser";

// ── Category types ─────────────────────────────────────────────────────────────

export type Category =
  | "LINE"
  | "INSTRUMENT"
  | "STREAM"
  | "EQUIPMENT"
  | "OPC"
  | "TEXT_REVIEW"
  | "DRAWING_META";

const CATEGORY_ORDER: Record<Category, number> = {
  LINE: 0, INSTRUMENT: 1, STREAM: 2, EQUIPMENT: 3, OPC: 4, TEXT_REVIEW: 5, DRAWING_META: 6,
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
  /** Stacked instrument value: code and loop number are emitted on separate rows. */
  Instrument?: string;
  Raw_Text: string;
  Detected_Type: string;
  Ref: string;  // Nearest line-number or instrument tag (spatial lookup) — blank for TEXT/NOTE/TITLE_BLOCK
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
  // ── Flow ──────────────────────────────────────────────────────────────────────
  FT:"Flow Transmitter", FI:"Flow Indicator", FE:"Flow Element",
  FIC:"Flow Indicating Controller", FRC:"Flow Recording Controller",
  FC:"Flow Controller", FFC:"Feedforward Flow Controller",
  FCV:"Flow Control Valve", FY:"Flow Computing/Relay",
  FSH:"Flow Switch High", FSL:"Flow Switch Low", FQI:"Flow Quantity Indicator",
  FAH:"Flow Alarm High", FAL:"Flow Alarm Low",
  FAHH:"Flow Alarm High High", FALL:"Flow Alarm Low Low",
  // ── Pressure ──────────────────────────────────────────────────────────────────
  PT:"Pressure Transmitter", PI:"Pressure Indicator", PDI:"Pressure Diff Indicator",
  PC:"Pressure Controller", PIC:"Pressure Indicating Controller",
  PCV:"Pressure Control Valve", PSV:"Pressure Safety Valve", PRV:"Pressure Relief Valve",
  PSH:"Pressure Switch High", PSL:"Pressure Switch Low", PG:"Pressure Gauge",
  PAH:"Pressure Alarm High", PAL:"Pressure Alarm Low",
  PAHH:"Pressure Alarm High High", PALL:"Pressure Alarm Low Low",
  // ── Level ─────────────────────────────────────────────────────────────────────
  LT:"Level Transmitter", LI:"Level Indicator", LC:"Level Controller",
  LIC:"Level Indicating Controller", LCV:"Level Control Valve",
  LSH:"Level Switch High", LSL:"Level Switch Low", LG:"Level Gauge",
  LAH:"Level Alarm High", LAL:"Level Alarm Low",
  LAHH:"Level Alarm High High", LALL:"Level Alarm Low Low",
  // ── Temperature ───────────────────────────────────────────────────────────────
  TT:"Temperature Transmitter", TI:"Temperature Indicator",
  TC:"Temperature Controller", TIC:"Temperature Indicating Controller",
  TE:"Temperature Element", TW:"Thermowell", TG:"Temperature Gauge",
  TSH:"Temperature Switch High", TSL:"Temperature Switch Low",
  TAH:"Temperature Alarm High", TAL:"Temperature Alarm Low",
  TAHH:"Temperature Alarm High High", TALL:"Temperature Alarm Low Low",
  // ── Analytical ────────────────────────────────────────────────────────────────
  AT:"Analytical Transmitter", AI:"Analytical Indicator",
  AIC:"Analytical Indicating Controller",
  AAH:"Analytical Alarm High", AAL:"Analytical Alarm Low",
  // ── Valves / On-Off ───────────────────────────────────────────────────────────
  XV:"On/Off Valve", XCV:"Control Valve", HV:"Hand Valve",
  BV:"Ball Valve", GV:"Gate Valve", CV:"Check Valve",
  MV:"Motor Valve", SDV:"Shutdown Valve", BDV:"Blowdown Valve",
  MOV:"Motor Operated Valve", SOV:"Solenoid Valve",
  // ── Hand / Manual ─────────────────────────────────────────────────────────────
  HS:"Hand Switch", HC:"Hand Controller", HIC:"Hand Indicating Controller",
  // ── Position / Speed / Special ────────────────────────────────────────────────
  ZT:"Position Transmitter", ZI:"Position Indicator",
  ST:"Speed Transmitter", SI:"Speed Indicator",
  VT:"Vibration Transmitter", VI:"Vibration Indicator",
  WT:"Weight Transmitter", WI:"Weight Indicator",
  JT:"Power Transmitter",
  PV:"Process Valve", TV:"Temperature Valve", LV:"Level Valve", FV:"Flow Valve",
  S:"Solenoid / Instrument (S)",
  // ── Project-specific compound types ───────────────────────────────────────────
  XZSOC:"Instrument (XZSOC)", X2LOC:"Local Control (X2LOC)",
  XZLOC:"Local Control (XZLOC)", X2SOC:"Instrument (X2SOC)",
  XYZ:"Instrument (XYZ)", XZS:"Instrument (XZS)", XYX:"Instrument (XYX)",
};

// ── Stream number detector ─────────────────────────────────────────────────────
// PFD stream diamonds use LA-numbered attributes:
//   LA000 = blank (stream description prompt)
//   LA001 = stream number (e.g. "1102")
// Block names: FSML001, FSM001, STREAMDIA, STRM*, etc.

const LA_STREAM_TAG_RE = /^LA\d{2,3}$/i;
const STREAM_BLOCK_RE = /^(?:FSM[LD]?\d*|STREAM|STRM|STR[-_]?DIA|DIAMOND)/i;

interface StreamMatch {
  streamNumber: string;
  description: string;
}

// Prompt text that reliably identifies a stream attribute
const STREAM_PROMPT_RE = /stream\s*(?:number|no\.?|num|name|desc|#)?/i;

function detectStream(blockName: string, attrs: { tag: string; value: string; prompt?: string }[]): StreamMatch | null {
  // Primary: any attribute has a prompt containing "STREAM" keyword
  const hasStreamPrompt = attrs.some((a) => STREAM_PROMPT_RE.test(a.prompt ?? ""));
  // Secondary: attribute tag names follow LA\d{2,3} pattern
  const hasLaAttrs = attrs.some((a) => LA_STREAM_TAG_RE.test(a.tag.trim()));
  // Tertiary: block name matches known stream block naming
  const isStreamBlock = STREAM_BLOCK_RE.test(blockName.trim());

  if (!hasStreamPrompt && !hasLaAttrs && !isStreamBlock) return null;

  // Find stream number: numeric value in attr with "STREAM NUMBER" prompt first,
  // then fall back to any numeric-looking value
  const STREAM_NUM_RE = /^\d{2,6}$/;
  let streamNumber = "";
  let description = "";

  // First pass: prefer the attr whose prompt mentions "stream number/no"
  for (const a of attrs) {
    const v = a.value.trim();
    if (!v) continue;
    if (STREAM_NUM_RE.test(v) && STREAM_PROMPT_RE.test(a.prompt ?? "") && !streamNumber) {
      streamNumber = v;
    }
  }

  // Second pass: fallback to any numeric value if still not found
  for (const a of attrs) {
    const v = a.value.trim();
    if (!v) continue;
    if (STREAM_NUM_RE.test(v) && !streamNumber) {
      streamNumber = v;
    } else if (!STREAM_NUM_RE.test(v) && !description) {
      description = v;
    }
  }

  return { streamNumber, description };
}

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

// ── Alarm setpoint codes ───────────────────────────────────────────────────────
// Single / multi-letter alarm level suffixes that appear as standalone attribute values
const ALARM_VALUES = new Set([
  "H", "L", "HH", "LL", "HHH", "LLL",
  "LAH", "LAL", "LAHH", "LALL", "LAHH", "LALL",
  "PAH", "PAL", "PAHH", "PALL",
  "TAH", "TAL", "TAHH", "TALL",
  "FAH", "FAL", "FAHH", "FALL",
  "AAH", "AAL",
]);

// ── Interlock codes ────────────────────────────────────────────────────────────
const INTERLOCK_VALUES = new Set([
  "Z", "I", "IL", "INT", "INTLK", "INTLOCK",
  "SD", "SIS", "ESD", "IPF",
]);

// ── Helpers ────────────────────────────────────────────────────────────────────

function isInstrumentType(code: string): boolean {
  const clean = code.toUpperCase().trim();
  // ISA drawings also use project-specific X-prefixed combinations such as
  // XYZ, XZS and XYX. Keep this deliberately short to avoid treating words
  // in notes as instrument codes.
  return !!INSTRUMENT_TYPES[clean] || /^X[A-Z]{1,3}$/.test(clean);
}

function isComponentType(code: string): boolean {
  return !!COMPONENT_TYPES[code.toUpperCase().trim()];
}

function isAlarmCode(code: string): boolean {
  return ALARM_VALUES.has(code.toUpperCase().trim());
}

function isInterlockCode(code: string): boolean {
  return INTERLOCK_VALUES.has(code.toUpperCase().trim());
}

// ── Instrument loop number detector ───────────────────────────────────────────
// Standalone 3–4 digit numbers are instrument loop numbers separated from tag
const INSTR_NUM_RE = /^\d{3,5}$/;

function isInstrumentNumber(val: string): boolean {
  return INSTR_NUM_RE.test(val.trim());
}

// ── Title Block block-name detector ───────────────────────────────────────────
// These block names are title/border/revision table blocks — not P&ID data
const TITLE_BLOCK_RE = /^(?:TITLE|TITLEBLK|TITLE[-_]?BLK|TITLE[-_]?BLOCK|TB$|T[-_]BLOCK|SHEET|SHEETBDR|SHT|BORDER|FORMAT|DRG[-_]?BORDER|FRAME|REV[-_]?(?:BLOCK|TABLE|BOX|TBL)?|REVISION[-_]?(?:TABLE|BLOCK)?|DRAWING[-_]?(?:INFO|TITLE|BORDER)|DRG[-_]?INFO|PROJ[-_]?INFO|STAMP|LOGO|NORTH[-_]?ARROW|LEGEND[-_]?BOX)$/i;

function isTitleBlock(blockName: string): boolean {
  return TITLE_BLOCK_RE.test(blockName.trim());
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

interface TextInstrumentPair {
  typeIndex: number;
  numberIndex: number;
  instrType: string;
  instrNumber: string;
}

interface EmptyTextInstrumentSlot {
  typeIndex: number;
  instrType: string;
  x: number;
  y: number;
}

const GENERIC_INSTRUMENT_CODE_RE = /^[A-Z][A-Z0-9]{0,7}$/;
const INSTRUMENT_VALUE_RE = /^\d{3,5}[A-Z]?$/i;

/**
 * Project drawings do not use one universal attribute tag for the function
 * code. Detect a stacked code/value pair from the drawing geometry instead:
 * short code-like text above a nearby numeric value.
 */
function isGenericInstrumentCode(value: string): boolean {
  const clean = stripDxfCodes(value).trim().toUpperCase();
  return GENERIC_INSTRUMENT_CODE_RE.test(clean) && !INSTRUMENT_VALUE_RE.test(clean);
}

function detectAttributeInstrumentPairs(
  attrs: BlockAttribute[],
): Map<number, TextInstrumentPair> {
  const pairs = new Map<number, TextInstrumentPair>();
  const usedNumberIndexes = new Set<number>();
  const hasCoordinates = attrs.some((attr) =>
    Number.isFinite(attr.x) && Number.isFinite(attr.y) &&
    (attr.x !== 0 || attr.y !== 0),
  );

  // Older/synthetic block data may not contain ATTRIB coordinates. In that
  // case retain the existing attribute-name/value detection instead of
  // guessing a spatial relationship.
  if (!hasCoordinates) return pairs;

  const typeIndexes = attrs
    .map((attr, index) => ({
      attr,
      index,
      value: stripDxfCodes(attr.value).trim().toUpperCase(),
    }))
    .filter(({ value }) => isGenericInstrumentCode(value));

  for (const { attr: typeAttr, index: typeIndex, value: instrType } of typeIndexes) {
    const typeHeight = typeAttr.height || 1;
    const candidates = attrs
      .map((attr, index) => ({
        attr,
        index,
        value: stripDxfCodes(attr.value).trim(),
      }))
      .filter(({ attr, index, value }) => {
        if (index === typeIndex || usedNumberIndexes.has(index)) return false;
        if (!INSTRUMENT_VALUE_RE.test(value)) return false;
        if (!Number.isFinite(attr.x) || !Number.isFinite(attr.y)) return false;

        const verticalGap = (typeAttr.y ?? 0) - (attr.y ?? 0);
        const horizontalGap = Math.abs((typeAttr.x ?? 0) - (attr.x ?? 0));
        const numberHeight = attr.height || typeHeight;
        const maxVerticalGap = Math.max(typeHeight, numberHeight) * 5;
        const maxHorizontalGap = Math.max(typeHeight, numberHeight) * 2;
        return verticalGap > 0 &&
          verticalGap <= maxVerticalGap &&
          horizontalGap <= maxHorizontalGap;
      })
      .sort((a, b) => {
        const aDistance = Math.abs((typeAttr.x ?? 0) - (a.attr.x ?? 0)) +
          ((typeAttr.y ?? 0) - (a.attr.y ?? 0));
        const bDistance = Math.abs((typeAttr.x ?? 0) - (b.attr.x ?? 0)) +
          ((typeAttr.y ?? 0) - (b.attr.y ?? 0));
        return aDistance - bDistance;
      });

    const match = candidates[0];
    if (!match) continue;

    const pair: TextInstrumentPair = {
      typeIndex,
      numberIndex: match.index,
      instrType,
      instrNumber: match.value.toUpperCase(),
    };
    pairs.set(typeIndex, pair);
    pairs.set(match.index, pair);
    usedNumberIndexes.add(match.index);
  }

  return pairs;
}

/**
 * Pair the two loose TEXT/MTEXT entities used by an ISA instrument bubble:
 * the instrument code is above the numeric loop number. The code may be
 * project-specific; geometry is the primary signal. DXF coordinates use
 * increasing Y upward, so the number is below the type when number.y < type.y.
 */
function detectTextInstrumentPairs(texts: TextRecord[]): Map<number, TextInstrumentPair> {
  const pairs = new Map<number, TextInstrumentPair>();
  const usedNumberIndexes = new Set<number>();

  const typeIndexes = texts
    .map((text, index) => ({ text, index, value: stripDxfCodes(text.content).toUpperCase() }))
    .filter(({ value }) => isGenericInstrumentCode(value));

  for (const { text: typeText, index: typeIndex, value: instrType } of typeIndexes) {
    const typeHeight = typeText.height || 1;
    const candidates = texts
      .map((text, index) => ({ text, index, value: stripDxfCodes(text.content).trim() }))
      .filter(({ text, index, value }) => {
        if (index === typeIndex || usedNumberIndexes.has(index)) return false;
        if (!INSTRUMENT_VALUE_RE.test(value)) return false;
        if (text.layer !== typeText.layer) return false;

        const verticalGap = typeText.y - text.y;
        const horizontalGap = Math.abs(typeText.x - text.x);
        const numberHeight = text.height || typeHeight;
        const maxVerticalGap = Math.max(typeHeight, numberHeight) * 5;
        const maxHorizontalGap = Math.max(typeHeight, numberHeight) * 2;
        return verticalGap > 0 &&
          verticalGap <= maxVerticalGap &&
          horizontalGap <= maxHorizontalGap;
      })
      .sort((a, b) => {
        const aDistance = Math.abs(typeText.x - a.text.x) + (typeText.y - a.text.y);
        const bDistance = Math.abs(typeText.x - b.text.x) + (typeText.y - b.text.y);
        return aDistance - bDistance;
      });

    const match = candidates[0];
    if (!match) continue;

    const pair: TextInstrumentPair = {
      typeIndex,
      numberIndex: match.index,
      instrType,
      instrNumber: match.value.toUpperCase(),
    };
    pairs.set(typeIndex, pair);
    pairs.set(match.index, pair);
    usedNumberIndexes.add(match.index);
  }

  return pairs;
}

/**
 * Some drawings leave the lower loop-number position of a loose instrument
 * label blank. There is no DXF entity to export in that case, so preserve the
 * expected position as an export-only row instead of silently dropping it.
 */
function detectEmptyTextInstrumentSlots(
  texts: TextRecord[],
  pairs: Map<number, TextInstrumentPair>,
): Map<number, EmptyTextInstrumentSlot> {
  const slots = new Map<number, EmptyTextInstrumentSlot>();

  for (const [typeIndex, typeText] of texts.entries()) {
    const instrType = stripDxfCodes(typeText.content).trim().toUpperCase();

    // A paired project-specific code has geometric proof. An unpaired label
    // has no such evidence, so only create a blank lower field for a known
    // instrument code. This avoids turning ordinary all-caps notes or
    // equipment labels into false missing-instrument findings.
    if (!isInstrumentType(instrType) || pairs.has(typeIndex)) continue;

    const typeHeight = typeText.height || 1;
    slots.set(typeIndex, {
      typeIndex,
      instrType,
      x: typeText.x,
      // Match the normal stacked-label spacing while keeping the field below
      // the real source text in CSV reading order.
      y: typeText.y - (typeHeight * 3.5),
    });
  }

  return slots;
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

function detectInstrument(
  attrs: BlockAttribute[],
  blockName = ""
): InstrumentMatch | null {
  const spatialPairs = detectAttributeInstrumentPairs(attrs);
  for (const [index, pair] of spatialPairs) {
    if (index === pair.typeIndex) {
      return {
        instrType: pair.instrType,
        instrTag: pair.instrNumber,
        display: `${pair.instrType}-${pair.instrNumber}`,
      };
    }
  }

  const map: Record<string, string> = {};
  attrs.forEach((a) => { map[a.tag.toUpperCase()] = a.value.trim(); });

  const allValues = Object.values(map);

  // ── Helper: find best numeric loop-number from all attribute values ──────
  // Prefers 3–5 digit standalone numbers, accepts trailing letter suffix (e.g. 2101A)
  const LOOP_NUM_RE = /^\d{2,5}[A-Z]?$/;
  function findLoopNumber(): string {
    // 1. Known "number" attribute tags — ordered from most to least specific
    const NUMBER_TAGS = [
      "BOTTOM", "BOTATTR", "NUMBER", "NUM", "TAGNO", "TAG_NO",
      "LOOP", "LOOP_NO", "LOOPNO", "LOOP_NUMBER", "LOOP_NUM",
      "TAG", "ITEM", "ITEM_NO", "ID", "ID_NO",
      "REF", "REF_NO", "SEQ", "SEQ_NO", "CODE", "CODE_NO",
      "MID", "MIDATTR", "SUFFIX", "AREA_NUM",
    ];
    for (const t of NUMBER_TAGS) {
      const v = (map[t] || "").trim();
      if (v && LOOP_NUM_RE.test(v)) return v;
    }
    // 2. Scan ALL values for a numeric-looking one
    const numericVal = allValues.find((x) => LOOP_NUM_RE.test(x.trim()));
    if (numericVal) return numericVal.trim();
    // 3. Try block name itself — only real engineering loop numbers (4+ digits)
    //    e.g. "PG-2401" → "2401"  but NOT "PG-001" (AutoCAD sequential, not a loop number)
    const blockNumMatch = blockName.match(/\d{4,5}[A-Z]?/);
    if (blockNumMatch) return blockNumMatch[0];
    return "";
  }

  // ── Pass 1: Known TOP attribute tags ────────────────────────────────────
  const TOP_TAGS = [
    "TOP", "TOPATTR", "FUNCT", "FUNCTN", "FUNCTION", "INSTRUMENT",
    "TYPE", "INSTR_TYPE", "INST_TYPE", "TAG_TYPE",
  ];
  for (const t of TOP_TAGS) {
    const v = (map[t] || "").trim().toUpperCase();
    if (v && isInstrumentType(v)) {
      const num = findLoopNumber();
      return { instrType: v, instrTag: num, display: num ? `${v}-${num}` : v };
    }
  }

  // ── Pass 2: Any attribute value that IS a full tag (e.g. PI-2101) ───────
  const FULL_TAG_RE = /^([A-Z]{1,4})-(\d{2,5}[A-Z]?)$/i;
  for (const a of attrs) {
    const m = a.value.trim().toUpperCase().match(FULL_TAG_RE);
    if (m && isInstrumentType(m[1])) {
      return { instrType: m[1], instrTag: m[2], display: `${m[1]}-${m[2]}` };
    }
  }

  // ── Pass 3: Any attribute value that is just an instrument type code ─────
  // (IA100-style blocks, non-standard TOP attribute names, etc.)
  for (const a of attrs) {
    const v = a.value.trim().toUpperCase();
    if (!v || v.length > 6) continue;
    if (isInstrumentType(v)) {
      const num = findLoopNumber();
      return { instrType: v, instrTag: num, display: num ? `${v}-${num}` : v };
    }
  }

  // ── Pass 4: Instrument type embedded in block name (e.g. "PG_GAUGE") ────
  const BLOCK_TYPE_RE = /^([A-Z]{1,4})[_\-\s]/i;
  const bm = blockName.toUpperCase().match(BLOCK_TYPE_RE);
  if (bm && isInstrumentType(bm[1])) {
    const num = findLoopNumber();
    return { instrType: bm[1], instrTag: num, display: num ? `${bm[1]}-${num}` : bm[1] };
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
    const value = a.value.trim();
    if (LINE_RE.test(value) || /[-–—].*[-–—]/.test(value)) return value;
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
      // Check if block name itself is an instrument type (e.g. PG, TG, PSV)
      // so these symbol-only blocks (no ATTRIBs) still appear in the export
      const blockPrefix = blockName.toUpperCase().split(/[-_\s]/)[0];
      const blockIsTitleBlockNoAttr = isTitleBlock(blockName);
      const noAttrInstrType = !blockIsTitleBlockNoAttr && blockPrefix.length > 0 && isInstrumentType(blockPrefix)
        ? blockPrefix : "";
      const noAttrDetected = noAttrInstrType ? "INSTRUMENTS" : "BLOCK";
      rawRows.push({
        DWG: dwgName, HANDLE: handle, Entity_Type: "INSERT",
        BLOCK: blockName, Layer: block.layer,
        X: +block.x.toFixed(4), Y: +block.y.toFixed(4),
        Attribute_Tag: "", Attribute_Value: noAttrInstrType, Raw_Text: "",
        Detected_Type: noAttrDetected, Ref: "",
      });
    } else {
      // Tags that identify instrument data in P&ID blocks
      // SUBFIX/SUFFIX = alarm suffix tag (e.g. PDI-2104-H where SUBFIX="H")
      const INSTRUMENT_ATTR_TAGS = new Set([
        "TOP", "BOTTOM", "MID", "TOPATTR", "BOTATTR", "FUNCT", "FUNCTN", "FUNCTION",
        "SUBFIX", "SUFFIX",
      ]);

      // If this is a Title Block / border / revision table → mark everything as TITLE_BLOCK
      // MUST be declared before any variable that references blockIsTitleBlock
      const blockIsTitleBlock = isTitleBlock(blockName);

      // IA-numbered instrument attribute pattern (IA100, IA101, IA103 etc.)
      // Used in FSMB001-type instrument blocks:
      //   IA100 = function code (PC, FC, FFC...)
      //   IA101 = instrument tag slot (blank — user fills in e.g. "PC-1001")
      //   IA103 = second instrument tag slot
      const IA_ATTR_TAG_RE = /^IA\d{2,3}$/i;

      // True if this block uses IA-style attrs and at least one has a known instrument type value
      const blockHasIaType = !blockIsTitleBlock && attrs.some((a) =>
        IA_ATTR_TAG_RE.test(a.tag.trim()) && isInstrumentType(a.value.trim())
      );

      // Stream diamond detection — uses prompt text as primary signal (most reliable),
      // falls back to LA\d{2,3} tag pattern or known stream block names
      const blockHasStreamAttrs = !blockIsTitleBlock && (
        attrs.some((a) => STREAM_PROMPT_RE.test((a as any).prompt ?? "")) ||
        attrs.some((a) => LA_STREAM_TAG_RE.test(a.tag.trim())) ||
        STREAM_BLOCK_RE.test(blockName.trim())
      );

      // OPC connector tag pattern: DA1001, DA1002, DB2001, etc. (2 letters + 3-6 digits)
      const OPC_TAG_RE = /^D[A-Z]\d{3,6}$/i;

      // OPC value pattern: "FROM ...", "TO ...", "CONT FROM", "CONTINUED TO" etc.
      const OPC_VALUE_RE = /^(?:FROM|TO|CONT(?:INUED)?\s+(?:FROM|TO)|FROM\s+DWG|TO\s+DWG)\b/i;

      // Equipment tag pattern: EQLINE1, EQNAME1, EQNAME2, EQNAME3, EQNO, EQTAG etc.
      const EQUIPMENT_TAG_RE = /^EQ/i;

      // Pre-compute full instrument tag for this block (e.g. "TT-2411")
      // so every attribute row can reference which instrument it belongs to
      const attributeInstrumentPairs = blockIsTitleBlock
        ? new Map<number, TextInstrumentPair>()
        : detectAttributeInstrumentPairs(attrs);
      const blockInstrMatch = blockIsTitleBlock ? null : detectInstrument(attrs, blockName);

      // Attribute tags that hold the instrument NUMBER/LOOP in P&ID blocks
      // If blank → still keep in CSV so engineer can fill in the missing number
      const INSTR_NUMBER_ATTR_TAGS = new Set([
        "BOTTOM", "BOTATTR", "NUMBER", "NUM", "TAGNO", "TAG_NO",
        "TAG", "ITEM", "ITEM_NO", "MID", "MIDATTR", "LOOP", "LOOP_NO",
        "SUBFIX", "SUFFIX", "CODE", "CODE_NO",
      ]);
      // Block has an instrument type — via standard attr tags OR via block name (e.g. "PG", "TG")
      // blockInstrMatch uses 4-pass detection including block name prefix, so if it's non-null
      // the block IS an instrument even if attributes are all blank or use non-standard tag names
      const blockHasInstrType = !blockIsTitleBlock && (
        blockInstrMatch !== null ||
        attributeInstrumentPairs.size > 0 ||
        attrs.some((a) => INSTRUMENT_ATTR_TAGS.has(a.tag.toUpperCase().trim()) && isInstrumentType(a.value.trim()))
      );
      // Interlock block: any attribute value is an interlock code (Z, I, IL, etc.)
      // → mark ALL attributes (including blank TOP/MIDDLE/BOTTOM) as INTERLOCK
      const blockHasInterlockValue = !blockIsTitleBlock &&
        attrs.some((a) => isInterlockCode(a.value.trim()));
      // Valve block: has TOP/BOTTOM/MID structure but NO instrument type value anywhere in block
      // e.g. gate valves, ball valves, control valves that look like instrument blocks but are blank
      const blockHasAnyInstrValue = (blockInstrMatch !== null) || attrs.some((a) => {
        const v = a.value.trim();
        return v.length > 0 && isInstrumentType(v);
      });
      const blockIsValve = !blockIsTitleBlock && !blockHasInstrType && !blockHasAnyInstrValue
        && !blockHasInterlockValue
        && attrs.some((a) => INSTRUMENT_ATTR_TAGS.has(a.tag.toUpperCase().trim()));

      for (const [attrIndex, attr] of attrs.entries()) {
        const tagUpper = attr.tag.toUpperCase().trim();
        const valTrim = attr.value.trim();
        const isSpatialInstrumentValue = attributeInstrumentPairs.has(attrIndex);
        const isInstrAttr  = INSTRUMENT_ATTR_TAGS.has(tagUpper);
        const isIaAttr     = IA_ATTR_TAG_RE.test(tagUpper); // IA100, IA101, IA103 etc.
        const isLaAttr     = LA_STREAM_TAG_RE.test(tagUpper); // LA000, LA001 — stream diamond attrs
        const isOpcAttr    = OPC_TAG_RE.test(tagUpper) || OPC_VALUE_RE.test(valTrim);
        const isEquipAttr  = EQUIPMENT_TAG_RE.test(tagUpper);
        // If the attribute VALUE itself is an instrument type code (e.g. FT, TV, PSV, TC)
        // treat this row as INSTRUMENTS — UC and other non-instrument codes stay as-is
        const isInstrValue    = valTrim.length >= 1 && valTrim.length <= 12 && isInstrumentType(valTrim);
        // Physical component type (GATE, BALL, CHECK etc.)
        const isCompValue     = valTrim.length >= 3 && valTrim.length <= 12 && isComponentType(valTrim);
        // Alarm setpoint codes: H, L, HH, LL, HHH, LLL etc.
        const isAlarmValue    = isAlarmCode(valTrim);
        // Interlock codes: Z, I, IL, INT etc.
        const isInterlockValue = isInterlockCode(valTrim);
        // 3–4 digit standalone numbers = instrument loop numbers split from their tag
        const isInstrNum      = isInstrumentNumber(valTrim);
        // Project rule: any non-title AutoCAD value with 2+ hyphens is a line number.
        const isMultiHyphenLine = /[-–—].*[-–—]/.test(valTrim);
        // Blank NUMBER/BOTTOM/TAGNO attr in an instrument block → keep for engineer to fill in
        const isBlankInstrSlot = blockHasInstrType && INSTR_NUMBER_ATTR_TAGS.has(tagUpper);
        // IA-attr in an IA-type block (blank tag slots user needs to fill in)
        const isIaSlot         = isIaAttr && blockHasIaType;
        const classified   = classifyText(attr.value);
        const detectedType = blockIsTitleBlock           ? "TITLE_BLOCK"
                           : isMultiHyphenLine         ? "LINE_NUMBER"
                           : blockHasStreamAttrs      ? "STREAM"      // PFD stream diamond (LA000/LA001, FSM* blocks)
                           : blockHasInterlockValue   ? "INTERLOCK"   // whole Z-block = INTERLOCK (blank attrs too)
                           : blockIsValve             ? "VALVES"      // blank TOP/BOTTOM/MID = valve symbol
                           : isSpatialInstrumentValue ? "INSTRUMENTS" // project-independent spatial code/value pair
                           : isInstrAttr && isInstrValue ? "INSTRUMENTS" // TOP=TAHH/LC/FY → INSTRUMENTS before alarm check
                           : isAlarmValue             ? "ALARM"       // standalone H/L/HH alarm code
                           : isInterlockValue         ? "INTERLOCK"   // standalone Z/I interlock code
                           : isBlankInstrSlot         ? "INSTRUMENTS"
                           : isInstrAttr              ? "INSTRUMENTS"
                           : isIaSlot                 ? "INSTRUMENTS" // IA100/IA101/IA103 slots (incl. blank tag fields)
                           : isLaAttr                 ? "STREAM"      // LA000/LA001 outside an FSM block (safety net)
                           : isOpcAttr                ? "OPC"
                           : isEquipAttr              ? "EQUIPMENT"
                           : isInstrNum               ? "INSTRUMENTS"
                           : isInstrValue             ? "INSTRUMENTS"
                           : isCompValue              ? "COMPONENTS"
                           :                            classified.textClass;

        // Strip AutoCAD formatting codes (%%U etc.) from displayed value
        const cleanValue = stripDxfCodes(attr.value);
        // Keep the value on its original attribute row so the CSV preserves
        // the drawing's local TOP/BOTTOM relationship.
        const isInstrumentStackValue = blockHasInstrType && (
          isSpatialInstrumentValue ||
          isInstrValue ||
          /^\d{3,5}[A-Z]?$/i.test(valTrim) ||
          /^[A-Z]{1,4}[-–]\d{2,5}[A-Z]?$/i.test(valTrim)
        );

        // Use the individual ATTRIB entity's own handle for write-back accuracy.
        // Fall back to INSERT block handle if ATTRIB handle is missing.
        const attribHandle = attr.handle || handle;
        rawRows.push({
          DWG: dwgName, HANDLE: attribHandle, Entity_Type: "ATTRIB",
          BLOCK: blockName, Layer: block.layer,
          X: +(Number.isFinite(attr.x) ? attr.x! : block.x).toFixed(4),
          Y: +(Number.isFinite(attr.y) ? attr.y! : block.y).toFixed(4),
          Attribute_Tag: attr.tag, Attribute_Value: cleanValue,
          Instrument: isInstrumentStackValue ? cleanValue : undefined,
          Raw_Text: "", Detected_Type: detectedType, Ref: "",
        });
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
            Raw_Text: "", Detected_Type: "EQUIPMENT", Ref: "",
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

    // ── Stream? (PFD stream diamond — LA000/LA001 attrs, FSM* blocks) ──────
    const streamMatch = detectStream(blockName, attrs);
    if (streamMatch) {
      const row = emptyRow(dwgName, handle, "STREAM");
      row.Line_Number = streamMatch.streamNumber;   // stream number as primary ID
      row.Description = streamMatch.description;
      row.Visible_Text = visibleText;
      row.Source_Block = blockName;
      row.Source_Field = "STREAM";
      row.Status = statusVal;
      engineerRows.push(row);
      continue;
    }

    // ── Instrument? ────────────────────────────────────────────────────────
    const instrMatch = detectInstrument(attrs, blockName);
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
  const textInstrumentPairs = detectTextInstrumentPairs(parsedData.texts);
  const emptyTextInstrumentSlots = detectEmptyTextInstrumentSlots(
    parsedData.texts,
    textInstrumentPairs,
  );

  for (let textIndex = 0; textIndex < parsedData.texts.length; textIndex++) {
    const text = parsedData.texts[textIndex];
    const handle = text.handle || "";
    const classified = classifyText(text.content);
    const isOpcText = OPC_LOOSE_RE.test(text.content.trim());
    const instrumentPair = textInstrumentPairs.get(textIndex);
    const emptyInstrumentSlot = emptyTextInstrumentSlots.get(textIndex);

    // TEXT / MTEXT rows labelled by category so engineers can filter each group
    const contentTrim = text.content.trim();
    const rawDetectedType = instrumentPair || emptyInstrumentSlot ? "INSTRUMENTS"
                          : isOpcText                                   ? "OPC"
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
      Instrument: instrumentPair
        ? instrumentPair.typeIndex === textIndex
          ? instrumentPair.instrType
          : instrumentPair.instrNumber
        : emptyInstrumentSlot
          ? emptyInstrumentSlot.instrType
        : classified.textClass === "INSTRUMENT_TAG"
          ? classified.clean
          : isInstrumentType(contentTrim)
            ? contentTrim.toUpperCase()
            : undefined,
      Raw_Text: text.content, Detected_Type: rawDetectedType, Ref: "",
    });

    if (emptyInstrumentSlot) {
      // This is deliberately not a DXF entity: it represents the empty lower
      // text position in an instrument bubble, not a value created by the app.
      rawRows.push({
        DWG: dwgName, HANDLE: "", Entity_Type: "INSTRUMENT_SLOT",
        BLOCK: "", Layer: text.layer,
        X: +emptyInstrumentSlot.x.toFixed(4), Y: +emptyInstrumentSlot.y.toFixed(4),
        Attribute_Tag: "INSTRUMENT_LOOP_NUMBER", Attribute_Value: "",
        Instrument: "", Raw_Text: "", Detected_Type: "INSTRUMENTS", Ref: "",
      });

      const row = emptyRow(dwgName, handle, "INSTRUMENT");
      row.Instrument_Type = emptyInstrumentSlot.instrType;
      row.Instrument_Display = emptyInstrumentSlot.instrType;
      row.Visible_Text = emptyInstrumentSlot.instrType;
      row.Source_Field = text.layer;
      row.Remarks = "Loop/tag field is blank in drawing";
      engineerRows.push(row);
      continue;
    }

    const cleanVal = classified.clean;

    // Paired ISA instrument labels: type above, loop number below.
    if (instrumentPair) {
      if (instrumentPair.typeIndex === textIndex) {
        const row = emptyRow(dwgName, handle, "INSTRUMENT");
        row.Instrument_Type = instrumentPair.instrType;
        row.Instrument_Tag = instrumentPair.instrNumber;
        row.Instrument_Display = `${instrumentPair.instrType}-${instrumentPair.instrNumber}`;
        row.Visible_Text = `${instrumentPair.instrType} ${instrumentPair.instrNumber}`;
        row.Source_Field = text.layer;
        engineerRows.push(row);
      }
      continue;
    }

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

    // A standalone instrument code is still useful even when its loop number
    // is absent or could not be paired spatially.
    if (isInstrumentType(contentTrim)) {
      const row = emptyRow(dwgName, handle, "INSTRUMENT");
      row.Instrument_Type = contentTrim.toUpperCase();
      row.Instrument_Display = contentTrim.toUpperCase();
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

  // ── Spatial "Ref": nearest line-number for each instrument / valve row ────────
  // Anchors = LINE_NUMBER rows that have a non-blank value.
  // Target  = INSTRUMENTS, VALVES, ALARM, INTERLOCK, COMPONENTS, EQUIPMENT, SPEC.
  // Result  = nearest anchor's line-number text (squared Euclidean distance).
  {
    interface Anchor { x: number; y: number; tag: string; }
    const lineAnchors: Anchor[] = rawRows
      .filter((r) => r.Detected_Type === "LINE_NUMBER")
      .map((r) => {
        const v = (r.Attribute_Value || r.Raw_Text || "").trim();
        return v ? { x: r.X, y: r.Y, tag: v } : null;
      })
      .filter(Boolean) as Anchor[];

    if (lineAnchors.length > 0) {
      const REF_TYPES = new Set([
        "INSTRUMENTS", "VALVES", "ALARM", "INTERLOCK",
        "COMPONENTS", "EQUIPMENT", "SPEC",
      ]);
      for (const row of rawRows) {
        if (!REF_TYPES.has(row.Detected_Type)) continue;
        let minDist = Infinity;
        let nearest = "";
        for (const a of lineAnchors) {
          const dx = row.X - a.x;
          const dy = row.Y - a.y;
          const d = dx * dx + dy * dy;
          if (d < minDist) { minDist = d; nearest = a.tag; }
        }
        row.Ref = nearest;
      }
    }
  }
  // ──────────────────────────────────────────────────────────────────────────────

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
