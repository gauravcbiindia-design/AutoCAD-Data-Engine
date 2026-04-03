/**
 * @copyright © 2026 G. Bharti. All rights reserved.
 * @description Web Worker — runs DXF parsing + extraction off the main thread
 * so the UI never freezes on large files.
 * Proprietary software. Unauthorised use strictly prohibited.
 */

import { parseDxf } from "./dxfParser";
import { extractEngineeringData } from "./engineeringExtractor";

export interface WorkerRequest {
  type: "parse";
  dwgName: string;
  content: string;
}

export interface WorkerSuccess {
  type: "done";
  dwgName: string;
  rawRows: any[];
  engineerRows: any[];
  lineTokens: any[];
  textReviewRows: any[];
  drawingMetaRows: any[];
  blockCount: number;
  textCount: number;
}

export interface WorkerError {
  type: "error";
  dwgName: string;
  message: string;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { dwgName, content } = e.data;
  try {
    const parsed = parseDxf(content);
    const { rawRows, engineerRows, lineTokens, textReviewRows, drawingMetaRows } =
      extractEngineeringData(dwgName, parsed);
    const msg: WorkerSuccess = {
      type: "done",
      dwgName,
      rawRows,
      engineerRows,
      lineTokens,
      textReviewRows,
      drawingMetaRows,
      blockCount: parsed.blocks.length,
      textCount: parsed.texts.length,
    };
    self.postMessage(msg);
  } catch (err: any) {
    const msg: WorkerError = { type: "error", dwgName, message: err?.message ?? String(err) };
    self.postMessage(msg);
  }
};
