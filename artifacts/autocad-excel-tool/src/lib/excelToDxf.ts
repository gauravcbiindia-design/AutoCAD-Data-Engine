import * as XLSX from "xlsx";

export interface ExcelBlockRow {
  blockName: string;
  layer: string;
  x: number;
  y: number;
  z: number;
  attributes: Record<string, string>;
}

export interface ExcelTextRow {
  type: string;
  content: string;
  layer: string;
  x: number;
  y: number;
  z: number;
  height: number;
}

export interface ImportedExcelData {
  blocks: ExcelBlockRow[];
  texts: ExcelTextRow[];
  errors: string[];
}

export function parseExcelFile(buffer: ArrayBuffer): ImportedExcelData {
  const errors: string[] = [];
  const wb = XLSX.read(buffer, { type: "array" });

  const blocks: ExcelBlockRow[] = [];
  const texts: ExcelTextRow[] = [];

  // Parse Blocks & Attributes sheet
  const blockSheet = wb.Sheets["Blocks & Attributes"];
  if (blockSheet) {
    const rows: any[] = XLSX.utils.sheet_to_json(blockSheet, { defval: "" });
    for (const row of rows) {
      if (row["Note"]) continue;
      const attrs: Record<string, string> = {};
      Object.keys(row).forEach((key) => {
        if (key.startsWith("ATTR: ")) {
          attrs[key.replace("ATTR: ", "")] = String(row[key]);
        }
      });
      blocks.push({
        blockName: String(row["Block Name"] || "UNKNOWN"),
        layer: String(row["Layer"] || "0"),
        x: parseFloat(row["X Position"]) || 0,
        y: parseFloat(row["Y Position"]) || 0,
        z: parseFloat(row["Z Position"]) || 0,
        attributes: attrs,
      });
    }
  }

  // Parse Text & Annotations sheet
  const textSheet = wb.Sheets["Text & Annotations"];
  if (textSheet) {
    const rows: any[] = XLSX.utils.sheet_to_json(textSheet, { defval: "" });
    for (const row of rows) {
      if (row["Note"]) continue;
      texts.push({
        type: String(row["Type"] || "TEXT"),
        content: String(row["Content"] || ""),
        layer: String(row["Layer"] || "0"),
        x: parseFloat(row["X Position"]) || 0,
        y: parseFloat(row["Y Position"]) || 0,
        z: parseFloat(row["Z Position"]) || 0,
        height: parseFloat(row["Text Height"]) || 2.5,
      });
    }
  }

  if (!blockSheet && !textSheet) {
    errors.push('Excel file must have sheets named "Blocks & Attributes" and/or "Text & Annotations".');
  }

  return { blocks, texts, errors };
}

export function generateDxf(data: ImportedExcelData): string {
  const lines: string[] = [];

  const sec = (name: string) => {
    lines.push("  0", "SECTION", "  2", name);
  };
  const endsec = () => lines.push("  0", "ENDSEC");
  const code = (c: number, v: string | number) => lines.push(`  ${c}`, String(v));

  // Collect unique layers
  const layerSet = new Set(["0"]);
  data.blocks.forEach((b) => layerSet.add(b.layer));
  data.texts.forEach((t) => layerSet.add(t.layer));

  // HEADER
  sec("HEADER");
  code(9, "$ACADVER");
  code(1, "AC1015");
  code(9, "$INSUNITS");
  code(70, 4);
  endsec();

  // TABLES
  sec("TABLES");
  // LTYPE table
  code(0, "TABLE");
  code(2, "LTYPE");
  code(70, 1);
  code(0, "LTYPE");
  code(2, "CONTINUOUS");
  code(70, 0);
  code(3, "Solid line");
  code(72, 65);
  code(73, 0);
  code(40, 0);
  code(0, "ENDTAB");

  // LAYER table
  code(0, "TABLE");
  code(2, "LAYER");
  code(70, layerSet.size);
  for (const layer of layerSet) {
    code(0, "LAYER");
    code(2, layer);
    code(70, 0);
    code(62, 7);
    code(6, "CONTINUOUS");
  }
  code(0, "ENDTAB");
  endsec();

  // ENTITIES
  sec("ENTITIES");

  let handle = 100;

  // Write INSERT entities for blocks
  for (const b of data.blocks) {
    code(0, "INSERT");
    code(5, handle++);
    code(8, b.layer);
    code(2, b.blockName);
    code(10, b.x);
    code(20, b.y);
    code(30, b.z);
    code(41, 1); // X scale
    code(42, 1); // Y scale
    code(43, 1); // Z scale
    code(50, 0); // rotation

    const attrKeys = Object.keys(b.attributes);
    if (attrKeys.length > 0) {
      code(66, 1); // attributes follow flag
      for (const tag of attrKeys) {
        code(0, "ATTRIB");
        code(5, handle++);
        code(8, b.layer);
        code(10, b.x);
        code(20, b.y);
        code(30, b.z);
        code(40, 2.5); // text height
        code(1, b.attributes[tag]); // value
        code(2, tag);               // tag
        code(70, 0);
        code(50, 0);
      }
      code(0, "SEQEND");
      code(5, handle++);
      code(8, b.layer);
    }
  }

  // Write TEXT entities
  for (const t of data.texts) {
    if (t.type === "MTEXT") {
      code(0, "MTEXT");
      code(5, handle++);
      code(8, t.layer);
      code(10, t.x);
      code(20, t.y);
      code(30, t.z);
      code(40, t.height || 2.5);
      code(71, 1);
      code(1, t.content);
    } else {
      code(0, "TEXT");
      code(5, handle++);
      code(8, t.layer);
      code(10, t.x);
      code(20, t.y);
      code(30, t.z);
      code(40, t.height || 2.5);
      code(1, t.content);
    }
  }

  endsec();

  // EOF
  lines.push("  0", "EOF");

  return lines.join("\n");
}

export function downloadDxf(content: string, filename: string = "output.dxf") {
  const blob = new Blob([content], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
