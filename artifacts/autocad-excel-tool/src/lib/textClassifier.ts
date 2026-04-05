/**
 * @copyright © 2026 G. Bharti. All rights reserved.
 * @description CAD Data Engine — Engineering Text Classification Engine
 * Classifies DXF text into instrument tags, line numbers, sizes, specs and more.
 * Proprietary software. Unauthorised use strictly prohibited.
 */

// ── Engineering Text Classification Engine ────────────────────────────────────
// Classifies DXF text entities into useful categories for engineering drawings
// (P&IDs, isometrics, general arrangement drawings)

export type TextClass =
  | "INSTRUMENT_TAG"   // FT-101, PIC-201A
  | "LINE_NUMBER"      // 4"-P-101-A1A, 6"-CS-2001
  | "SIZE"             // 4", DN100, NPS 6
  | "SPEC"             // A1A, CS-150, SS316
  | "SERVICE"          // Water, Steam, Gas, Crude, etc.
  | "STATUS"           // EXIST, NEW, FUTURE, DEMO
  | "LABEL"            // Short useful labels not classified above
  | "TITLE"            // Title block text (long ALL CAPS)
  | "REVISION"         // REV A, REVISION 2, etc.
  | "NOTE"             // Notes, general text strings
  | "GARBAGE";         // Coordinates, single chars, junk

export interface ClassifiedText {
  raw: string;
  clean: string;
  textClass: TextClass;
  instrumentType?: string;  // FT, PIC, XV, etc.
  tagValue?: string;        // P-101, 201A
  lineNumber?: string;      // extracted line number
  size?: string;            // 4", DN100
  spec?: string;            // A1A, CS-150
  service?: string;
  status?: string;
  isUseful: boolean;        // false = exclude from CLEAN output
}

// ── Instrument type dictionary ───────────────────────────────────────────────
const INSTRUMENT_TYPES: Record<string, string> = {
  FT: "Flow Transmitter",
  FI: "Flow Indicator",
  FE: "Flow Element",
  FIC: "Flow Indicating Controller",
  FRC: "Flow Recording Controller",
  FC: "Flow Controller",
  FFC: "Feedforward Flow Controller",
  FCV: "Flow Control Valve",
  FSH: "Flow Switch High",
  FSL: "Flow Switch Low",
  PT: "Pressure Transmitter",
  PI: "Pressure Indicator",
  PC: "Pressure Controller",
  PIC: "Pressure Indicating Controller",
  PCV: "Pressure Control Valve",
  PSV: "Pressure Safety Valve",
  PRV: "Pressure Relief Valve",
  PSH: "Pressure Switch High",
  PSL: "Pressure Switch Low",
  PG: "Pressure Gauge",
  LT: "Level Transmitter",
  LI: "Level Indicator",
  LIC: "Level Indicating Controller",
  LCV: "Level Control Valve",
  LSH: "Level Switch High",
  LSL: "Level Switch Low",
  LG: "Level Gauge",
  TT: "Temperature Transmitter",
  TI: "Temperature Indicator",
  TIC: "Temperature Indicating Controller",
  TE: "Temperature Element",
  TW: "Thermowell",
  TSH: "Temperature Switch High",
  TSL: "Temperature Switch Low",
  AT: "Analytical Transmitter",
  AI: "Analytical Indicator",
  AIC: "Analytical Indicating Controller",
  XV: "On/Off Valve",
  XCV: "Control Valve",
  HV: "Hand Valve",
  BV: "Ball Valve",
  GV: "Gate Valve",
  CV: "Check Valve",
  MV: "Motor Valve",
  SDV: "Shutdown Valve",
  BDV: "Blowdown Valve",
  MOV: "Motor Operated Valve",
  SOV: "Solenoid Valve",
  HS: "Hand Switch",
  HIC: "Hand Indicating Controller",
  ZT: "Position Transmitter",
  ZI: "Position Indicator",
  ST: "Speed Transmitter",
  SI: "Speed Indicator",
  VT: "Vibration Transmitter",
  VI: "Vibration Indicator",
  WT: "Weight Transmitter",
  WI: "Weight Indicator",
  JT: "Power Transmitter",
};

// ── Regex patterns ────────────────────────────────────────────────────────────

// Instrument tag: 1-4 uppercase letters, hyphen, digits optionally with suffix letter
const INSTRUMENT_TAG_RE = /^([A-Z]{1,4})-(\d{2,5}[A-Z]?)$/;

// Line number patterns (common P&ID formats):
// 4"-P-101-A1A, 6"-CS-2001-B2B, 2"-N2-301, 12"-FW-1001-A1A-INS
// X"-P-602-2104-D1D, X"-LF-602-2107-A2A  (X = unknown/TBD nominal size)
// With insulation/tracing suffix: 6"-N-602-2209-B1A-H, 4"-P-602-2101-D1D-P
// Suffix can be 1 char (-H, -P, -T) or longer (-INS, -HT, -ELEC)
const LINE_NUMBER_RE = /^(?:\d{1,4}|[A-Z]{1,3})["']?[-–]\s*[A-Z]{1,4}[-–]\s*\d{2,6}(?:[-–][A-Z0-9]{1,6}){0,4}$/i;

// Size patterns: 4", 4IN, DN100, NPS 6, 2" x 1"
const SIZE_RE = /^(?:(?:\d{1,3}(?:\.\d+)?["']?\s*(?:x\s*\d{1,3}(?:\.\d+)?["']?)?)|(?:DN\s*\d{1,4})|(?:NPS\s*\d{1,3})|(?:\d{1,3}\s*(?:mm|in|inch)))$/i;

// Status keywords
const STATUS_KEYWORDS = /^(EXIST(?:ING)?|NEW|FUTURE|DEMO(?:LISH)?|ABANDON(?:ED)?|TEMP(?:ORARY)?|TBD|TBC|N\/A)$/i;

// Service / fluid codes
const SERVICE_KEYWORDS = /^(?:WATER|STEAM|GAS|OIL|AIR|NITROGEN|N2|FUEL|CRUDE|CONDENSATE|GLYCOL|CHEMICAL|ACID|CAUSTIC|FLARE|DRAIN|VENT|HP|LP|MP|LPS|MPS|HPS|FW|CW|SW|PW|DW|HO|CO|FO|IA|PA|CA|NG|LPG|LNG|NGL)$/i;

// Revision markers
const REVISION_RE = /^(?:REV(?:ISION)?\.?\s*[A-Z0-9]{1,3}|ISSUED?(?:\s+FOR\s+\w+)?|FOR\s+(?:APPROVAL|REVIEW|CONSTRUCTION|INFORMATION|BID|IFC|IFR|IFA|AFD))$/i;

// Title-block-like text (long all caps, or known title keywords)
const TITLE_KEYWORDS = /^(?:TITLE|PROJECT|CLIENT|DOCUMENT|DWG|DRAWING|NO\.?|SHEET|DATE|SCALE|CHECKED?|APPROVED?|DESIGN(?:ED)?|DRAWN|COMPANY|CONTRACTOR|DISCIPLINE|REVISION|STATUS|DESCRIPTION)(?:\s|$)/i;

// Notes pattern
const NOTE_RE = /^(?:NOTE|N[Oo]TE?S?|GENERAL\s+NOTES?|[\d]+\s*[.)]\s+\w)/i;

// Garbage: just numbers, coords, single chars, very short
const GARBAGE_RE = /^[0-9.,-]{1,6}$|^[A-Z]$|^[\s\-_./]{1,3}$/;

// ── Known spec class patterns ─────────────────────────────────────────────────
// Piping spec codes:
//   LDL   → A2A, D1D, B1A, A1K       (Letter + Digit + 1 Letter)
//   LDLL  → A2AH, D1DX, B1AH, A1KK   (Letter + Digit + 2 Letters)
//   LDLLL → A2AHH                     (Letter + Digit + 3 Letters)
//   With insulation/tracing suffix:    B1A-H, A1A-P (trailing -Letter)
const PIPING_SPEC_RE = /^[A-Z]\d[A-Z]{1,3}(?:-[A-Z])?$/;
const SPEC_RE = /^(?:[A-Z]{1,3}\d{0,3}[-–]?(?:\d{2,4})?(?:[-–][A-Z0-9]{2,6})?(?:[-–][A-Z0-9]{2,6})?)$/;

// ── Classifier function ───────────────────────────────────────────────────────

export function classifyText(raw: string): ClassifiedText {
  // Clean up: strip MTEXT formatting codes, trim
  const clean = raw
    .replace(/\\[A-Za-z0-9;.,]+/g, "")
    .replace(/[{}]/g, "")
    .replace(/\\P/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const base: ClassifiedText = {
    raw,
    clean,
    textClass: "GARBAGE",
    isUseful: false,
  };

  if (!clean || clean.length === 0) return base;

  const upper = clean.toUpperCase();

  // 1. Garbage
  if (GARBAGE_RE.test(clean)) return { ...base, textClass: "GARBAGE", isUseful: false };
  if (clean.length === 1) return { ...base, textClass: "GARBAGE", isUseful: false };

  // 2. Revision
  if (REVISION_RE.test(clean.trim())) {
    return { ...base, textClass: "REVISION", isUseful: false };
  }

  // 3. Status
  const statusMatch = upper.match(STATUS_KEYWORDS);
  if (statusMatch) {
    return { ...base, textClass: "STATUS", status: upper, isUseful: true };
  }

  // 4. Instrument tag
  const instrMatch = upper.match(INSTRUMENT_TAG_RE);
  if (instrMatch) {
    const instrType = instrMatch[1];
    const instrNum = instrMatch[2];
    return {
      ...base,
      textClass: "INSTRUMENT_TAG",
      instrumentType: instrType,
      tagValue: instrNum,
      isUseful: true,
    };
  }

  // 5. Line number
  if (LINE_NUMBER_RE.test(clean)) {
    return {
      ...base,
      textClass: "LINE_NUMBER",
      lineNumber: clean,
      isUseful: true,
    };
  }

  // 6. Size
  if (SIZE_RE.test(clean)) {
    return { ...base, textClass: "SIZE", size: clean, isUseful: true };
  }

  // 7. Service
  if (SERVICE_KEYWORDS.test(upper)) {
    return { ...base, textClass: "SERVICE", service: upper, isUseful: true };
  }

  // 8. Notes
  if (NOTE_RE.test(clean)) {
    return { ...base, textClass: "NOTE", isUseful: false };
  }

  // 9. Title keywords
  if (TITLE_KEYWORDS.test(clean)) {
    return { ...base, textClass: "TITLE", isUseful: false };
  }

  // 10. Long sentences / paragraphs → NOTE
  if (clean.length > 80 || clean.split(" ").length > 10) {
    return { ...base, textClass: "NOTE", isUseful: false };
  }

  // 11. Piping spec code: A2A, D2A, D1D, B1A, A1K (Letter + Digit + 1-2 Letters)
  if (upper === clean && PIPING_SPEC_RE.test(clean)) {
    return { ...base, textClass: "SPEC", spec: clean, isUseful: true };
  }

  // 11b. General spec code: CS-150, SS316 etc.
  if (upper === clean && SPEC_RE.test(clean) && clean.length >= 2 && clean.length <= 12) {
    return { ...base, textClass: "SPEC", spec: clean, isUseful: true };
  }

  // 12. Default: label (short, useful-looking text)
  return { ...base, textClass: "LABEL", isUseful: true };
}

export function getInstrumentTypeName(code: string): string {
  return INSTRUMENT_TYPES[code.toUpperCase()] || code;
}
