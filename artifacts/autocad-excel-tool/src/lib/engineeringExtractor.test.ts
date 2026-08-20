import { strict as assert } from "node:assert";
import { extractEngineeringData } from "./engineeringExtractor";
import { buildRawCsvString } from "./excelExport";
import type { ParsedDxfData } from "./dxfParser";

const xhsInstrumentBlock: ParsedDxfData = {
  blocks: [{
    blockName: "Aqa_pi-02",
    layer: "P&ID",
    x: 250,
    y: 100,
    z: 0,
    handle: "B100",
    attributes: [
      { tag: "FUNCT", value: "XHS", handle: "A100" },
      { tag: "CODE", value: "10105", handle: "A101" },
    ],
  }],
  texts: [],
  layers: ["P&ID"],
  errors: [],
};

const extracted = extractEngineeringData("sample.dxf", xhsInstrumentBlock);
const exportedAttributes = extracted.rawRows.filter((row) => row.Entity_Type === "ATTRIB");

assert.deepEqual(
  exportedAttributes.map((row) => ({
    value: row.Attribute_Value,
    instrument: row.Instrument,
    type: row.Detected_Type,
  })),
  [
    { value: "XHS", instrument: "XHS", type: "INSTRUMENTS" },
    { value: "10105", instrument: "10105", type: "INSTRUMENTS" },
  ],
);

const csv = buildRawCsvString({
  rawRows: extracted.rawRows,
  engineerRows: extracted.engineerRows,
  lineTokens: extracted.lineTokens,
  textReviewRows: extracted.textReviewRows,
  drawingMetaRows: extracted.drawingMetaRows,
  stats: {
    totalEntities: extracted.rawRows.length,
    blockRows: 1,
    textRows: 0,
    linesFound: 0,
    instrumentsFound: 1,
    equipmentFound: 0,
    opcFound: 0,
    textReview: 0,
  },
});

assert.ok(
  csv.includes("sample.dxf,A100,ATTRIB,Aqa_pi-02,P&ID,250,100,FUNCT,XHS,XHS,,INSTRUMENTS,"),
);
assert.ok(
  csv.includes("sample.dxf,A101,ATTRIB,Aqa_pi-02,P&ID,250,100,CODE,10105,10105,,INSTRUMENTS,"),
);

const formulaSafeCsv = buildRawCsvString({
  rawRows: [
    {
      DWG: "lines.dxf", HANDLE: "F001", Entity_Type: "ATTRIB", BLOCK: "LINE_TAG",
      Layer: "P&ID", X: 0, Y: 0, Attribute_Tag: "CLASS",
      Attribute_Value: "-A50QA1-N", Raw_Text: "", Detected_Type: "LINE_NUMBER", Ref: "",
    },
    {
      DWG: "lines.dxf", HANDLE: "F002", Entity_Type: "ATTRIB", BLOCK: "LINE_TAG",
      Layer: "P&ID", X: 0, Y: 0, Attribute_Tag: "CLASS",
      Attribute_Value: "=-A50QA1-N", Raw_Text: "", Detected_Type: "LINE_NUMBER", Ref: "",
    },
    {
      DWG: "lines.dxf", HANDLE: "F003", Entity_Type: "ATTRIB", BLOCK: "LINE_TAG",
      Layer: "P&ID", X: 0, Y: 0, Attribute_Tag: "CLASS",
      Attribute_Value: "\uFEFF-B50QA1-N", Raw_Text: "", Detected_Type: "LINE_NUMBER", Ref: "",
    },
  ],
  engineerRows: [],
  lineTokens: [],
  textReviewRows: [],
  drawingMetaRows: [],
  stats: {
    totalEntities: 3,
    blockRows: 3,
    textRows: 0,
    linesFound: 3,
    instrumentsFound: 0,
    equipmentFound: 0,
    opcFound: 0,
    textReview: 0,
  },
});

assert.ok(formulaSafeCsv.includes(",CLASS,'-A50QA1-N,"));
assert.ok(formulaSafeCsv.includes(",CLASS,'=-A50QA1-N,"));
assert.ok(formulaSafeCsv.includes(",CLASS,'\uFEFF-B50QA1-N,"));

const spatialProjectInstrument: ParsedDxfData = {
  blocks: [{
    blockName: "PROJECT_SPECIFIC_BUBBLE",
    layer: "P&ID",
    x: 500,
    y: 500,
    z: 0,
    handle: "B200",
    attributes: [
      {
        tag: "PROJECT_FUNCTION",
        value: "QRT",
        x: 500,
        y: 510,
        height: 2,
        handle: "A200",
      },
      {
        tag: "PROJECT_VALUE",
        value: "71005",
        x: 500.5,
        y: 503,
        height: 2,
        handle: "A201",
      },
    ],
  }],
  texts: [
    {
      type: "TEXT",
      content: "CUSTOM7",
      layer: "P&ID",
      x: 700,
      y: 510,
      z: 0,
      height: 2,
      handle: "T200",
    },
    {
      type: "TEXT",
      content: "71006",
      layer: "P&ID",
      x: 700.5,
      y: 503,
      z: 0,
      height: 2,
      handle: "T201",
    },
  ],
  layers: ["P&ID"],
  errors: [],
};

const spatialExtracted = extractEngineeringData("spatial.dxf", spatialProjectInstrument);

assert.deepEqual(
  spatialExtracted.rawRows
    .filter((row) => ["QRT", "71005", "CUSTOM7", "71006"].includes(row.Attribute_Value || row.Raw_Text))
    .map((row) => ({
      value: row.Attribute_Value || row.Raw_Text,
      instrument: row.Instrument,
      type: row.Detected_Type,
    })),
  [
    { value: "QRT", instrument: "QRT", type: "INSTRUMENTS" },
    { value: "71005", instrument: "71005", type: "INSTRUMENTS" },
    { value: "CUSTOM7", instrument: "CUSTOM7", type: "INSTRUMENTS" },
    { value: "71006", instrument: "71006", type: "INSTRUMENTS" },
  ],
);

assert.ok(spatialExtracted.engineerRows.some((row) =>
  row.Instrument_Type === "QRT" && row.Instrument_Tag === "71005",
));
assert.ok(spatialExtracted.engineerRows.some((row) =>
  row.Instrument_Type === "CUSTOM7" && row.Instrument_Tag === "71006",
));

console.log("Instrument spatial pairing and spreadsheet-safe CSV tests passed.");