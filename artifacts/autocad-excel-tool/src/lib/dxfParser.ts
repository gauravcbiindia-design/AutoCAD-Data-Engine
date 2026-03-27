import DxfParser from "dxf-parser";

export interface BlockAttribute {
  tag: string;
  value: string;
}

export interface BlockRecord {
  blockName: string;
  layer: string;
  x: number;
  y: number;
  z: number;
  handle?: string;
  attributes: BlockAttribute[];
}

export interface TextRecord {
  type: "TEXT" | "MTEXT";
  content: string;
  layer: string;
  x: number;
  y: number;
  z: number;
  height?: number;
  handle?: string;
}

export interface ParsedDxfData {
  blocks: BlockRecord[];
  texts: TextRecord[];
  layers: string[];
  errors: string[];
}

export function parseDxf(fileContent: string): ParsedDxfData {
  const parser = new DxfParser();
  const errors: string[] = [];
  const blocks: BlockRecord[] = [];
  const texts: TextRecord[] = [];
  const layerSet = new Set<string>();

  let dxf: any;
  try {
    dxf = parser.parseSync(fileContent);
  } catch (e: any) {
    return { blocks: [], texts: [], layers: [], errors: [`Failed to parse DXF: ${e.message}`] };
  }

  if (!dxf || !dxf.entities) {
    return { blocks: [], texts: [], layers: [], errors: ["No entities found in DXF file."] };
  }

  // Collect layer names
  if (dxf.tables?.layer?.layers) {
    Object.keys(dxf.tables.layer.layers).forEach((l) => layerSet.add(l));
  }

  // Group ATTRIB entities by their INSERT handle
  const attribsByInsert: Map<string, BlockAttribute[]> = new Map();

  // First pass: collect all ATTRIBs
  for (const entity of dxf.entities) {
    if (entity.type === "ATTRIB") {
      const ownerHandle = entity.ownerHandle || entity.inOwnerHandle;
      if (ownerHandle) {
        if (!attribsByInsert.has(ownerHandle)) {
          attribsByInsert.set(ownerHandle, []);
        }
        attribsByInsert.get(ownerHandle)!.push({
          tag: entity.tag || entity.attributeTag || "",
          value: entity.text || entity.value || "",
        });
      }
    }
  }

  // Second pass: process entities
  for (const entity of dxf.entities) {
    const layer = entity.layer || "0";
    layerSet.add(layer);

    if (entity.type === "INSERT") {
      const pos = entity.position || { x: 0, y: 0, z: 0 };
      const handle = entity.handle || "";

      // Get attributes either from grouped attribs or from entity.attributes
      let attrs: BlockAttribute[] = [];
      if (entity.attributes && Array.isArray(entity.attributes)) {
        attrs = entity.attributes.map((a: any) => ({
          tag: a.tag || a.attributeTag || "",
          value: a.text || a.value || "",
        }));
      } else if (attribsByInsert.has(handle)) {
        attrs = attribsByInsert.get(handle)!;
      }

      blocks.push({
        blockName: entity.name || entity.block || "UNKNOWN",
        layer,
        x: pos.x ?? 0,
        y: pos.y ?? 0,
        z: pos.z ?? 0,
        handle,
        attributes: attrs,
      });
    } else if (entity.type === "TEXT") {
      const pos = entity.startPoint || entity.position || { x: 0, y: 0, z: 0 };
      texts.push({
        type: "TEXT",
        content: entity.text || "",
        layer,
        x: pos.x ?? 0,
        y: pos.y ?? 0,
        z: pos.z ?? 0,
        height: entity.textHeight || entity.height,
        handle: entity.handle,
      });
    } else if (entity.type === "MTEXT") {
      const pos = entity.position || { x: 0, y: 0, z: 0 };
      // Strip MTEXT formatting codes
      const raw = entity.text || entity.string || "";
      const clean = raw.replace(/\\[A-Za-z0-9;.,]+|[{}]|\\P/g, " ").trim();
      texts.push({
        type: "MTEXT",
        content: clean || raw,
        layer,
        x: pos.x ?? 0,
        y: pos.y ?? 0,
        z: pos.z ?? 0,
        height: entity.height,
        handle: entity.handle,
      });
    }
  }

  return {
    blocks,
    texts,
    layers: Array.from(layerSet).sort(),
    errors,
  };
}
