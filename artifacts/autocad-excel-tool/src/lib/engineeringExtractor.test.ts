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

console.log("Instrument FUNCT/CODE export test passed.");