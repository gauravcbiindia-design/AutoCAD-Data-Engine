/**
 * @copyright © 2026 G. Bharti. All rights reserved.
 * @description CAD Data Engine — DXF Parser Module
 * Custom raw DXF group-code scanner with ATTRIB extraction fix.
 * Proprietary software. Unauthorised use strictly prohibited.
 */

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

// ── Raw DXF group-code reader ─────────────────────────────────────────────────
// dxf-parser silently drops ATTRIB entities, so we read them directly
// from the raw file content as group-code pairs.

interface DxfGroupPair {
  code: number;
  value: string;
}

function readGroupPairs(content: string): DxfGroupPair[] {
  const lines = content.split(/\r?\n/);
  const pairs: DxfGroupPair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    const value = lines[i + 1].trim();
    if (!isNaN(code)) pairs.push({ code, value });
  }
  return pairs;
}

interface RawAttrib {
  handle?: string;
  ownerHandle?: string;
  layer: string;
  tag: string;
  value: string;
  x: number;
  y: number;
}

interface RawInsert {
  handle?: string;
  layer: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

function parseEntitiesSection(pairs: DxfGroupPair[]): {
  inserts: RawInsert[];
  attribs: RawAttrib[];
} {
  const inserts: RawInsert[] = [];
  const attribs: RawAttrib[] = [];

  let inEntities = false;
  let i = 0;

  // Find the ENTITIES section
  while (i < pairs.length) {
    if (pairs[i].code === 0 && pairs[i + 1]?.code === 2 &&
        pairs[i].value === "SECTION" && pairs[i + 1]?.value === "ENTITIES") {
      inEntities = true;
      i += 2;
      break;
    }
    i++;
  }

  if (!inEntities) return { inserts, attribs };

  while (i < pairs.length) {
    const p = pairs[i];

    if (p.code === 0 && p.value === "ENDSEC") break;

    if (p.code === 0 && p.value === "INSERT") {
      const ins: RawInsert = { layer: "0", name: "", x: 0, y: 0, z: 0 };
      i++;
      while (i < pairs.length && !(pairs[i].code === 0)) {
        const { code, value } = pairs[i];
        if (code === 5) ins.handle = value;
        else if (code === 8) ins.layer = value;
        else if (code === 2) ins.name = value;
        else if (code === 10) ins.x = parseFloat(value) || 0;
        else if (code === 20) ins.y = parseFloat(value) || 0;
        else if (code === 30) ins.z = parseFloat(value) || 0;
        i++;
      }
      inserts.push(ins);
      continue;
    }

    if (p.code === 0 && p.value === "ATTRIB") {
      const att: RawAttrib = { layer: "0", tag: "", value: "", x: 0, y: 0 };
      i++;
      while (i < pairs.length && !(pairs[i].code === 0)) {
        const { code, value } = pairs[i];
        if (code === 5) att.handle = value;
        else if (code === 330) att.ownerHandle = value;
        else if (code === 8) att.layer = value;
        else if (code === 1) att.value = value;
        else if (code === 2) att.tag = value;
        else if (code === 10) att.x = parseFloat(value) || 0;
        else if (code === 20) att.y = parseFloat(value) || 0;
        i++;
      }
      if (att.tag) attribs.push(att);
      continue;
    }

    i++;
  }

  return { inserts, attribs };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function parseDxf(fileContent: string): ParsedDxfData {
  const errors: string[] = [];
  const blocks: BlockRecord[] = [];
  const texts: TextRecord[] = [];
  const layerSet = new Set<string>();

  // ── Step 1: Use dxf-parser for TEXT / MTEXT / layer table ────────────────
  const parser = new DxfParser();
  let dxf: any;
  try {
    dxf = parser.parseSync(fileContent);
  } catch (e: any) {
    return { blocks: [], texts: [], layers: [], errors: [`Failed to parse DXF: ${e.message}`] };
  }

  if (!dxf || !dxf.entities) {
    return { blocks: [], texts: [], layers: [], errors: ["No entities found in DXF file."] };
  }

  // Layer names from table
  if (dxf.tables?.layer?.layers) {
    Object.keys(dxf.tables.layer.layers).forEach((l) => layerSet.add(l));
  }

  // TEXT / MTEXT from dxf-parser (these work fine)
  for (const entity of dxf.entities) {
    const layer = entity.layer || "0";
    layerSet.add(layer);

    if (entity.type === "TEXT") {
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

  // ── Step 2: Raw parse for INSERT + ATTRIB entities ────────────────────────
  const pairs = readGroupPairs(fileContent);
  const { inserts: rawInserts, attribs: rawAttribs } = parseEntitiesSection(pairs);

  // Build a sequential insert→attrib map:
  // ATTRIBs follow their INSERT in the file (between INSERT and SEQEND).
  // Group them by finding attribs that share the same layer block or
  // fall sequentially between INSERTs. We use handle-based lookup first,
  // then fall back to sequential grouping.

  // Try ownerHandle linking first (newer DXF files)
  const attribsByOwner = new Map<string, RawAttrib[]>();
  const unownedAttribs: RawAttrib[] = [];
  for (const att of rawAttribs) {
    if (att.ownerHandle) {
      if (!attribsByOwner.has(att.ownerHandle)) attribsByOwner.set(att.ownerHandle, []);
      attribsByOwner.get(att.ownerHandle)!.push(att);
    } else {
      unownedAttribs.push(att);
    }
  }

  // For unowned attribs, group them sequentially between INSERTs
  // by re-scanning the raw group pairs for SEQEND boundaries
  if (unownedAttribs.length > 0 && rawInserts.length > 0) {
    // Re-scan to find INSERT→SEQEND blocks and collect the attribs in between
    let i = 0;
    let currentInsertHandle: string | null = null;

    while (i < pairs.length) {
      if (pairs[i].code === 0 && pairs[i].value === "INSERT") {
        // Find handle of this insert
        let j = i + 1;
        let handle: string | undefined;
        while (j < pairs.length && pairs[j].code !== 0) {
          if (pairs[j].code === 5) handle = pairs[j].value;
          j++;
        }
        currentInsertHandle = handle || null;
        i = j;
        continue;
      }

      if (pairs[i].code === 0 && pairs[i].value === "ATTRIB" && currentInsertHandle) {
        // Read attrib
        let j = i + 1;
        let tag = "", value = "";
        while (j < pairs.length && pairs[j].code !== 0) {
          if (pairs[j].code === 2) tag = pairs[j].value;
          else if (pairs[j].code === 1) value = pairs[j].value;
          j++;
        }
        if (tag) {
          if (!attribsByOwner.has(currentInsertHandle)) attribsByOwner.set(currentInsertHandle, []);
          // Only add if not already there
          const existing = attribsByOwner.get(currentInsertHandle)!;
          if (!existing.find((a) => a.tag === tag)) {
            existing.push({ handle: undefined, ownerHandle: currentInsertHandle, layer: "0", tag, value, x: 0, y: 0 });
          }
        }
        i = j;
        continue;
      }

      if (pairs[i].code === 0 && pairs[i].value === "SEQEND") {
        currentInsertHandle = null;
      }

      i++;
    }
  }

  // Build BlockRecord from rawInserts
  for (const ins of rawInserts) {
    const layer = ins.layer || "0";
    layerSet.add(layer);

    const handle = ins.handle || "";
    const attrList = attribsByOwner.get(handle) || [];
    const attributes: BlockAttribute[] = attrList.map((a) => ({
      tag: a.tag,
      value: a.value,
    }));

    blocks.push({
      blockName: ins.name || "UNKNOWN",
      layer,
      x: ins.x,
      y: ins.y,
      z: ins.z,
      handle,
      attributes,
    });
  }

  return {
    blocks,
    texts,
    layers: Array.from(layerSet).sort(),
    errors,
  };
}
