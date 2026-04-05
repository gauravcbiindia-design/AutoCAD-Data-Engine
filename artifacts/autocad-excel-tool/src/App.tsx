/**
 * @copyright © 2026 G. Bharti. All rights reserved.
 * @description CAD Data Engine — Main Application
 * Proprietary software. Unauthorised copying, modification, distribution,
 * or use of this software, via any medium, is strictly prohibited.
 */

import { useState, useRef, useEffect } from "react";
import {
  mergeAndPostProcess,
  type ExtractionResult,
} from "@/lib/engineeringExtractor";
import { exportRawCsv, buildRawCsvString } from "@/lib/excelExport";
import {
  parseRawExport, parseRawExportCsv, patchDxfContent,
  readDxfFromFolder, writeUpdatedDxf, dxfHasOleObjects, removeOleFromDxf,
  type ParsedExcelResult,
} from "@/lib/excelToDxf";

// ── File System Access API helpers ────────────────────────────────────────────

const folderApiSupported = "showDirectoryPicker" in window;

async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!folderApiSupported) return null;
  try {
    return await (window as any).showDirectoryPicker({ mode: "readwrite" });
  } catch {
    return null;
  }
}

async function readDxfFilesFromFolder(handle: FileSystemDirectoryHandle): Promise<File[]> {
  const files: File[] = [];
  for await (const entry of (handle as any).values()) {
    if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".dxf")) {
      files.push(await entry.getFile());
    }
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function writeBufferToFolder(
  handle: FileSystemDirectoryHandle,
  fileName: string,
  buffer: Uint8Array
): Promise<void> {
  const fh = await (handle as any).getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();
  await writable.write(buffer);
  await writable.close();
}

async function writeTextToFolder(
  handle: FileSystemDirectoryHandle,
  fileName: string,
  text: string
): Promise<void> {
  const fh = await (handle as any).getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();
  await writable.write(text);
  await writable.close();
}

type Tab = "extract" | "excel-to-dxf" | "fix-dxf";

// ── AutoLISP tool content ─────────────────────────────────────────────────────

const CDE_EXPORT_LSP = `\
;;; ==========================================================
;;; CAD Data Engine — CDE_Export.lsp
;;; Converts all DWG files in a selected folder to DXF format
;;;
;;; How to use:
;;;   1. In AutoCAD: Tools -> Load Application (APPLOAD)
;;;   2. Select this file
;;;   3. Type at the command line: CDE_EXPORT
;;; ==========================================================

(vl-load-com)

(defun c:CDE_EXPORT (/ any-file folder files f full-path dxf-path acad-obj docs doc-obj n)
  (setq any-file (getfiled "Select any DWG file in your project folder" "" "dwg" 0))
  (if (null any-file)
    (progn (princ "\\n[CDE] Cancelled.") (princ))
    (progn
      (setq folder (vl-filename-directory any-file))
      (setq files  (vl-directory-files folder "*.dwg" 1))
      (if (null files)
        (progn (princ "\\n[CDE] No DWG files found in folder.") (princ))
        (progn
          (setq acad-obj (vlax-get-acad-object))
          (setq docs     (vla-get-Documents acad-obj))
          (setq n 0)
          (foreach f files
            (setq full-path (strcat folder "\\\\" f))
            (setq dxf-path  (strcat folder "\\\\" (vl-filename-base f)))
            (princ (strcat "\\n  Converting: " f))
            (setq doc-obj (vla-Open docs full-path :vlax-false))
            (vla-SaveAs doc-obj dxf-path acDXF)
            (vla-Close doc-obj :vlax-false)
            (setq n (1+ n))
          )
          (princ (strcat "\\n\\n[CDE] Export complete! " (itoa n) " DXF files ready."))
          (princ "\\n[CDE] Return to CAD Data Engine and click Reload to extract data.\\n")
        )
      )
    )
  )
  (princ)
)

(princ "\\n[CDE] Export tool loaded. Command: CDE_EXPORT\\n")
(princ)
`;

const CDE_IMPORT_LSP = `\
;;; ==========================================================
;;; CAD Data Engine — CDE_Import.lsp
;;; Converts patched DXF files back to DWG format
;;;
;;; How to use:
;;;   1. First complete Apply Changes in CAD Data Engine
;;;   2. In AutoCAD: Tools -> Load Application (APPLOAD)
;;;   3. Select this file
;;;   4. Type at the command line: CDE_IMPORT
;;; ==========================================================

(vl-load-com)

(defun c:CDE_IMPORT (/ any-file folder files f full-path dwg-path acad-obj docs doc-obj n)
  (setq any-file (getfiled "Select any DXF file in your patched folder" "" "dxf" 0))
  (if (null any-file)
    (progn (princ "\\n[CDE] Cancelled.") (princ))
    (progn
      (setq folder (vl-filename-directory any-file))
      (setq files  (vl-directory-files folder "*.dxf" 1))
      (if (null files)
        (progn (princ "\\n[CDE] No DXF files found in folder.") (princ))
        (progn
          (setq acad-obj (vlax-get-acad-object))
          (setq docs     (vla-get-Documents acad-obj))
          (setq n 0)
          (foreach f files
            (setq full-path (strcat folder "\\\\" f))
            (setq dwg-path  (strcat folder "\\\\" (vl-filename-base f)))
            (princ (strcat "\\n  Converting: " f " -> " (vl-filename-base f) ".dwg"))
            (setq doc-obj (vla-Open docs full-path :vlax-false))
            (vla-SaveAs doc-obj dwg-path acNative)
            (vla-Close doc-obj :vlax-false)
            (setq n (1+ n))
          )
          (princ (strcat "\\n\\n[CDE] Import complete! " (itoa n) " DWG files updated."))
          (princ "\\n[CDE] Original DWG files now contain the updated data.\\n")
        )
      )
    )
  )
  (princ)
)

(princ "\\n[CDE] Import tool loaded. Command: CDE_IMPORT\\n")
(princ)
`;

async function writeLispToolsToFolder(handle: FileSystemDirectoryHandle) {
  await writeTextToFolder(handle, "CDE_Export.lsp", CDE_EXPORT_LSP);
  await writeTextToFolder(handle, "CDE_Import.lsp", CDE_IMPORT_LSP);
}

// ── Cover / Splash page ───────────────────────────────────────────────────────

function CoverPage({ onEnter }: { onEnter: () => void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleEnter = () => {
    setLeaving(true);
    setTimeout(onEnter, 600);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-600 ${
        leaving ? "opacity-0" : visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ background: "hsl(216 28% 10%)" }}
    >
      <div className="w-full flex items-center justify-center px-2 pt-4 pb-3">
        <img
          src="/cover2.png"
          alt="CAD Data Engine — Gaurav Bharti"
          className="w-full max-w-5xl"
          style={{ maxHeight: "calc(100svh - 64px)", width: "100%", height: "auto", display: "block" }}
        />
      </div>
      <div className="w-full flex justify-center pb-6 shrink-0">
        <button
          onClick={handleEnter}
          className="flex items-center gap-2 px-8 py-2.5 rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #0077b6 0%, #023e8a 100%)",
            color: "#fff",
            boxShadow: "0 0 24px rgba(0,119,182,0.45), 0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Launch
        </button>
      </div>
    </div>
  );
}

type FileStatus = "pending" | "processing" | "done" | "error";

interface FileEntry {
  file: File;
  status: FileStatus;
  selected: boolean;
  result?: ExtractionResult;
  error?: string;
  blockCount?: number;
  textCount?: number;
}

// ── App shell ─────────────────────────────────────────────────────────────────

function App() {
  const [showCover, setShowCover] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("extract");
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);

  if (showCover) return <CoverPage onEnter={() => setShowCover(false)} />;

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Glass Hero Header ─────────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden"
        style={{ minHeight: 180 }}
      >
        {/* Cover image full-bleed background */}
        <img
          src="/cover2.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center 40%" }}
        />
        {/* Blue gradient scrim — matches cover image's blue palette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(2,62,138,0.82) 0%, rgba(0,119,182,0.70) 50%, rgba(2,62,138,0.85) 100%)",
          }}
        />

        {/* Glass panel */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 flex flex-col gap-5">
          <div
            className="flex items-center gap-5 px-6 py-5 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(18px) saturate(1.4)",
              WebkitBackdropFilter: "blur(18px) saturate(1.4)",
              border: "1px solid rgba(255,255,255,0.13)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            {/* Logo badge */}
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
              style={{
                background: "linear-gradient(135deg, #0077b6 0%, #023e8a 100%)",
                boxShadow: "0 0 20px rgba(0,119,182,0.5)",
              }}
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">
                CAD Data Engine
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                Bulk extract blocks, attributes & classified text from DXF drawings · Export to structured CSV
              </p>
            </div>

            {/* Feature pills */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              {["5 Categories", "LINE_TOKENS Filter", "Instrument Pairing", "OPC Detection"].map((pill) => (
                <span
                  key={pill}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(0,180,255,0.18)",
                    border: "1px solid rgba(0,180,255,0.4)",
                    color: "#7de8ff",
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>

          {/* Tabs as glass pills */}
          <div className="flex gap-2">
            {[
              { id: "extract" as Tab, label: "Bulk DXF → Excel", icon: "⬇️" },
              { id: "excel-to-dxf" as Tab, label: "Excel → DXF", icon: "⬆️" },
              { id: "fix-dxf" as Tab, label: "Fix DXF (OLE)", icon: "🔧" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-5 py-2 text-sm font-medium rounded-lg transition-all duration-150"
                style={
                  activeTab === tab.id
                    ? {
                        background: "rgba(0,180,255,0.25)",
                        color: "#fff",
                        boxShadow: "0 0 14px rgba(0,160,230,0.35)",
                        border: "1px solid rgba(0,200,255,0.5)",
                      }
                    : {
                        background: "rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.7)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        backdropFilter: "blur(8px)",
                      }
                }
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === "extract"
          ? <BulkExtractor folderHandle={folderHandle} setFolderHandle={setFolderHandle} />
          : activeTab === "excel-to-dxf"
          ? <ExcelToDxf folderHandle={folderHandle} setFolderHandle={setFolderHandle} />
          : <OleRemover />}
      </main>

      <footer className="border-t border-border mt-12 py-5 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} <strong className="text-foreground">G. Bharti</strong> — All rights reserved.</span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            CAD Data Engine · Proprietary Software · Unauthorised use prohibited
          </span>
        </div>
      </footer>
    </div>
  );
}

// ── Bulk DXF Extractor ────────────────────────────────────────────────────────

interface BulkExtractorProps {
  folderHandle: FileSystemDirectoryHandle | null;
  setFolderHandle: (h: FileSystemDirectoryHandle | null) => void;
}

function BulkExtractor({ folderHandle, setFolderHandle }: BulkExtractorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lispStatus, setLispStatus] = useState<"idle" | "saved" | "error">("idle");
  const [hasDwgOnly, setHasDwgOnly] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".dxf"));
    if (arr.length === 0) return;
    setResult(null);
    setEntries((prev) => {
      const existing = new Set(prev.map((e) => e.file.name));
      const fresh: FileEntry[] = arr
        .filter((f) => !existing.has(f.name))
        .map((file) => ({ file, status: "pending", selected: true }));
      return [...prev, ...fresh];
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSelectFolder = async () => {
    const handle = await pickFolder();
    if (!handle) return;
    setFolderHandle(handle);
    setEntries([]);
    setResult(null);
    setSaveStatus("idle");
    setLispStatus("idle");
    setHasDwgOnly(false);

    // Always write LISP tools to folder
    try {
      await writeLispToolsToFolder(handle);
      setLispStatus("saved");
    } catch {
      setLispStatus("error");
    }

    const dxfFiles = await readDxfFilesFromFolder(handle);
    if (dxfFiles.length === 0) {
      // Check if DWG files exist
      let dwgCount = 0;
      for await (const entry of (handle as any).values()) {
        if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".dwg")) dwgCount++;
      }
      if (dwgCount > 0) setHasDwgOnly(true);
      return;
    }
    addFiles(dxfFiles);
  };

  const reloadFolder = async () => {
    if (!folderHandle) return;
    setHasDwgOnly(false);
    const dxfFiles = await readDxfFilesFromFolder(folderHandle);
    if (dxfFiles.length === 0) {
      setHasDwgOnly(true);
      return;
    }
    setEntries([]);
    setResult(null);
    setSaveStatus("idle");
    addFiles(dxfFiles);
  };

  const handleSaveToFolder = async () => {
    if (!folderHandle || !result) return;
    setSaveStatus("saving");
    try {
      const date = new Date().toISOString().slice(0, 10);
      // Save as CSV only — no background Excel process, safe for AutoCAD workflows
      await writeTextToFolder(folderHandle, `RAW_EXPORT_${date}.csv`, buildRawCsvString(result));
      setSaveStatus("saved");
    } catch (e) {
      setSaveStatus("error");
    }
  };

  const removeEntry = (name: string) => {
    setEntries((prev) => prev.filter((e) => e.file.name !== name));
    setResult(null);
  };

  const toggleSelected = (name: string) => {
    setEntries((prev) =>
      prev.map((e) => e.file.name === name && e.status === "pending"
        ? { ...e, selected: !e.selected } : e)
    );
  };

  const toggleAllSelected = (val: boolean) => {
    setEntries((prev) =>
      prev.map((e) => e.status === "pending" ? { ...e, selected: val } : e)
    );
  };

  const processAll = async () => {
    setIsProcessing(true);
    setResult(null);
    const updated = [...entries];
    const perFile: { dwgName: string; rawRows: any[]; engineerRows: any[]; lineTokens: any[]; textReviewRows: any[]; drawingMetaRows: any[] }[] = [];

    // Create ONE shared worker — compiled once, processes all files sequentially.
    // Avoids repeated JS compilation cost on each file (the main cause of freezing).
    const worker = new Worker(
      new URL("./lib/dxfWorker.ts", import.meta.url),
      { type: "module" }
    );

    try {
      for (let i = 0; i < updated.length; i++) {
        // Skip files that are not selected or already processed
        if (!updated[i].selected || updated[i].status !== "pending") continue;

        updated[i] = { ...updated[i], status: "processing" };
        setEntries([...updated]);

        // Step 1: read file as text (async, non-blocking via FileReader)
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("Could not read file"));
          reader.readAsText(updated[i].file);
        });

        // Step 2: parse + extract in the shared Worker (never blocks the UI)
        const dwgName = updated[i].file.name.replace(/\.dxf$/i, "");
        await new Promise<void>((resolve) => {
          worker.onmessage = (e) => {
            const data = e.data;
            if (data.type === "done") {
              updated[i] = {
                ...updated[i],
                status: "done",
                blockCount: data.blockCount,
                textCount: data.textCount,
              };
              perFile.push({
                dwgName: data.dwgName,
                rawRows: data.rawRows,
                engineerRows: data.engineerRows,
                lineTokens: data.lineTokens,
                textReviewRows: data.textReviewRows,
                drawingMetaRows: data.drawingMetaRows,
              });
            } else {
              updated[i] = { ...updated[i], status: "error", error: data.message };
            }
            setEntries([...updated]);
            resolve(); // worker stays alive for the next file
          };

          worker.onerror = (e) => {
            updated[i] = { ...updated[i], status: "error", error: e.message ?? "Worker error" };
            setEntries([...updated]);
            resolve();
          };

          worker.postMessage({ type: "parse", dwgName, content });
        });
      }
    } finally {
      // Always clean up the shared worker after all files are done
      worker.terminate();
    }

    const merged = mergeAndPostProcess(perFile);
    setResult(merged);
    setIsProcessing(false);
  };

  const reset = () => {
    setEntries([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const doneCount = entries.filter((e) => e.status === "done").length;
  const errorCount = entries.filter((e) => e.status === "error").length;
  const pendingCount = entries.filter((e) => e.status === "pending").length;
  const selectedPendingCount = entries.filter((e) => e.status === "pending" && e.selected).length;
  const allPendingSelected = pendingCount > 0 && pendingCount === selectedPendingCount;
  const hasFiles = entries.length > 0;
  const allDone = !isProcessing && (doneCount + errorCount) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold mb-1">Bulk Engineering Data Extraction</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Upload multiple DXF files or select a folder directly. Extracts block attributes and classifies text
            into engineering fields, removes garbage, detects duplicates, and exports two Excel files.
          </p>
        </div>
        {/* Folder select + reload buttons */}
        {folderApiSupported && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSelectFolder}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
              style={{
                background: folderHandle ? "rgba(34,197,94,0.1)" : "rgba(99,102,241,0.1)",
                border: folderHandle ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(99,102,241,0.4)",
                color: folderHandle ? "#16a34a" : "#6366f1",
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              {folderHandle ? `📂 ${(folderHandle as any).name}` : "Select Folder"}
            </button>
            {folderHandle && (
              <button
                onClick={reloadFolder}
                disabled={isProcessing}
                title="Reload DXF files after running CDE_EXPORT in AutoCAD"
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
                style={{
                  background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  color: "#818cf8",
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reload
              </button>
            )}
          </div>
        )}
      </div>

      {/* DWG AutoLISP workflow guide */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 overflow-hidden">
        <div className="px-4 py-2.5 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center gap-2">
          <span className="text-sm font-semibold text-indigo-300">⚙ DWG Workflow — Direct via AutoLISP</span>
          {lispStatus === "saved" && folderHandle && (
            <span className="ml-auto text-xs text-green-400 font-medium">✓ LISP tools saved to folder</span>
          )}
        </div>
        <div className="px-4 py-3 space-y-2 text-xs text-indigo-200/80">
          <div className="grid grid-cols-1 gap-1.5">
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-[10px]">1</span>
              <span>Click <strong className="text-indigo-100">Select Folder</strong> — LISP tools will be saved automatically to your folder (<code className="bg-black/30 px-1 rounded">CDE_Export.lsp</code>, <code className="bg-black/30 px-1 rounded">CDE_Import.lsp</code>)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-[10px]">2</span>
              <span><strong className="text-indigo-100">In AutoCAD:</strong> <code className="bg-black/30 px-1 rounded">APPLOAD</code> → load <code className="bg-black/30 px-1 rounded">CDE_Export.lsp</code> → run command: <code className="bg-black/30 px-1 rounded">CDE_EXPORT</code> — all DWG files will be converted to DXF</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-[10px]">3</span>
              <span>Return to app → click <strong className="text-indigo-100">Reload</strong> → DXF files load → Extract → download CSV</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-[10px]">4</span>
              <span>Edit CSV → go to <strong className="text-indigo-100">Excel → DXF tab</strong> → upload edited CSV → Apply Changes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-[10px]">5</span>
              <span><strong className="text-indigo-100">In AutoCAD:</strong> <code className="bg-black/30 px-1 rounded">APPLOAD</code> → load <code className="bg-black/30 px-1 rounded">CDE_Import.lsp</code> → run command: <code className="bg-black/30 px-1 rounded">CDE_IMPORT</code> — DXF files overwritten as DWG</span>
            </div>
          </div>
        </div>
      </div>

      {/* DWG-only folder warning + reload */}
      {hasDwgOnly && folderHandle && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-yellow-500/30 bg-yellow-500/10">
          <svg className="w-5 h-5 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1 text-sm">
            <span className="text-yellow-300 font-medium">No DXF files found — run </span>
            <code className="bg-black/30 px-1.5 py-0.5 rounded text-yellow-200 text-xs">CDE_EXPORT</code>
            <span className="text-yellow-300 font-medium"> in AutoCAD first, then click Reload</span>
          </div>
          <button
            onClick={reloadFolder}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 hover:bg-yellow-500/30 transition-colors shrink-0"
          >
            ↻ Reload Folder
          </button>
        </div>
      )}

      {/* Upload zone — only show if no folder is selected */}
      {!folderHandle && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isProcessing ? "cursor-not-allowed opacity-60" :
            isDragging ? "border-primary bg-primary/5 cursor-pointer" :
            "border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
          }`}
        >
          <input ref={fileRef} type="file" accept=".dxf" multiple className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); }} />
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="font-medium text-sm">{hasFiles ? "Drop more DXF files to add" : "Drop DXF files here"}</p>
            <p className="text-xs text-muted-foreground">or click to browse — multiple files supported</p>
            <span className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full">.dxf files only</span>
          </div>
        </div>
      )}

      {/* File list */}
      {hasFiles && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Files ({entries.length})
            </h3>
            <div className="flex items-center gap-3">
              {!isProcessing && pendingCount > 0 && (
                <button onClick={() => toggleAllSelected(!allPendingSelected)}
                  className="text-xs text-primary hover:underline transition-colors">
                  {allPendingSelected ? "Deselect All" : "Select All"}
                </button>
              )}
              {!isProcessing && (
                <button onClick={() => { setEntries([]); setResult(null); }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.file.name}
                className={`flex items-center gap-3 px-4 py-3 bg-card transition-colors
                  ${entry.status === "pending" && !isProcessing ? "hover:bg-muted/30 cursor-pointer" : "hover:bg-muted/20"}`}
                onClick={() => { if (entry.status === "pending" && !isProcessing) toggleSelected(entry.file.name); }}>

                {/* Checkbox for pending files, StatusIcon for others */}
                {entry.status === "pending" && !isProcessing ? (
                  <div onClick={(e) => { e.stopPropagation(); toggleSelected(entry.file.name); }}
                    className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors
                      ${entry.selected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground bg-transparent"}`}>
                    {entry.selected && (
                      <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                ) : (
                  <StatusIcon status={entry.status} />
                )}

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${entry.status === "pending" && !entry.selected && !isProcessing ? "text-muted-foreground" : ""}`}>
                    {entry.file.name.replace(/\.dxf$/i, "")}
                  </p>
                  {entry.status === "done" && (
                    <p className="text-xs text-muted-foreground">
                      {entry.blockCount} blocks · {entry.textCount} text entities
                    </p>
                  )}
                  {entry.status === "error" && <p className="text-xs text-destructive">{entry.error}</p>}
                  {entry.status === "pending" && (
                    <p className="text-xs text-muted-foreground">{(entry.file.size / 1024).toFixed(0)} KB · {entry.selected ? "Ready" : "Skipped"}</p>
                  )}
                  {entry.status === "processing" && <p className="text-xs text-primary animate-pulse">Extracting...</p>}
                </div>
                {!isProcessing && (
                  <button onClick={(e) => { e.stopPropagation(); removeEntry(entry.file.name); }}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {isProcessing && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Processing files...</span>
                <span>{doneCount + errorCount} / {entries.length}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${((doneCount + errorCount) / entries.length) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Results panel */}
          {result && allDone && (
            <ResultsPanel result={result} doneCount={doneCount} />
          )}

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            {!allDone && pendingCount > 0 && (
              <button onClick={processAll} disabled={isProcessing || selectedPendingCount === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Extract {selectedPendingCount} of {pendingCount} File{pendingCount !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            )}

            {result && (
              <>
                <button onClick={() => exportRawCsv(result)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download RAW_EXPORT.csv
                </button>
                {folderHandle && (
                  <button
                    onClick={handleSaveToFolder}
                    disabled={saveStatus === "saving"}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-60"
                    style={{
                      background: saveStatus === "saved" ? "rgba(34,197,94,0.15)" : "rgba(99,102,241,0.12)",
                      border: saveStatus === "saved" ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(99,102,241,0.4)",
                      color: saveStatus === "saved" ? "#15803d" : "#6366f1",
                    }}
                  >
                    {saveStatus === "saving" ? (
                      <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Saving...</>
                    ) : saveStatus === "saved" ? (
                      <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> Saved to Folder ✓</>
                    ) : saveStatus === "error" ? (
                      "❌ Save Failed — Retry"
                    ) : (
                      <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg> Save Both to Folder</>
                    )}
                  </button>
                )}
              </>
            )}

            {!isProcessing && hasFiles && (
              <button onClick={reset}
                className="px-5 py-2.5 border border-border rounded-lg font-medium text-sm hover:bg-muted/50 transition-colors">
                Clear All
              </button>
            )}
          </div>

          {errorCount > 0 && (
            <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
              {errorCount} file{errorCount !== 1 ? "s" : ""} failed to parse. Ensure they are valid DXF files.
            </div>
          )}
        </div>
      )}

      {/* Feature cards when empty */}
      {!hasFiles && (
        <div className="grid grid-cols-2 gap-4 mt-2">
          {[
            { icon: "📋", title: "5 Engineering Categories", desc: "Every visible entity is sorted into LINE, INSTRUMENT, EQUIPMENT, OPC, or TEXT_REVIEW. One meaning = one column, no splits." },
            { icon: "🔑", title: "LINE_TOKENS Sheet", desc: "Line numbers are kept full and intact. A separate token sheet lets you filter all 6\", A1A, or HI lines without splitting the original." },
            { icon: "🎯", title: "Instrument Pairing", desc: "TOP/BOTTOM block attributes are auto-paired into Instrument_Type + Tag + Display (PI-2101). Works even with broken blocks." },
            { icon: "🔀", title: "OPC Connector Detection", desc: "OFF-PAGE connectors and arrows with FROM/TO references are structured into OPC_From, OPC_To, and OPC_Display columns." },
          ].map((item) => (
            <div key={item.title} className="bg-card border border-border rounded-xl p-5">
              <div className="text-2xl mb-2">{item.icon}</div>
              <h3 className="font-semibold mb-1 text-sm">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Category badge colours ─────────────────────────────────────────────────────

const CAT_STYLE: Record<string, { bg: string; text: string }> = {
  LINE:         { bg: "bg-green-900/40",  text: "text-green-300" },
  INSTRUMENT:   { bg: "bg-blue-900/40",   text: "text-blue-300" },
  EQUIPMENT:    { bg: "bg-purple-900/40", text: "text-purple-300" },
  OPC:          { bg: "bg-yellow-900/30", text: "text-yellow-300" },
  TEXT_REVIEW:  { bg: "bg-orange-900/30", text: "text-orange-300" },
  DRAWING_META: { bg: "bg-slate-700/50",  text: "text-slate-300" },
};

// ── Results Panel ─────────────────────────────────────────────────────────────

// Detected_Type badge colour map
const TYPE_BADGE: Record<string, string> = {
  LINE_NUMBER: "bg-green-900/50 text-green-300",
  INSTRUMENTS: "bg-blue-900/50 text-blue-300",
  EQUIPMENT:   "bg-purple-900/50 text-purple-300",
  COMPONENTS:  "bg-teal-900/50 text-teal-300",
  VALVES:      "bg-cyan-900/50 text-cyan-300",
  ALARM:       "bg-red-900/50 text-red-300",
  INTERLOCK:   "bg-pink-900/50 text-pink-300",
  OPC:         "bg-yellow-900/40 text-yellow-300",
  NOTE:        "bg-orange-900/40 text-orange-300",
  TEXT:        "bg-slate-700/50 text-slate-300",
  TITLE_BLOCK: "bg-zinc-700/50 text-zinc-500",
  BLOCK:       "bg-zinc-800/50 text-zinc-400",
};

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_BADGE[type] ?? "bg-zinc-800/50 text-zinc-400";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap ${cls}`}>
      {type || "—"}
    </span>
  );
}

function ResultsPanel({ result, doneCount }: { result: ExtractionResult; doneCount: number }) {
  const { rawRows } = result;

  // Count by Detected_Type in rawRows for accurate display
  const typeCounts: Record<string, number> = {};
  for (const row of rawRows) {
    const t = (row as any).Detected_Type || "OTHER";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  const statCards = [
    { label: "Drawings",    value: doneCount,                             bg: "bg-blue-900/30",   color: "text-blue-300" },
    { label: "Total Rows",  value: rawRows.length,                        bg: "bg-primary/15",    color: "text-primary" },
    { label: "LINE_NUMBER", value: typeCounts["LINE_NUMBER"] ?? 0,        bg: "bg-green-900/30",  color: "text-green-300" },
    { label: "INSTRUMENTS", value: typeCounts["INSTRUMENTS"] ?? 0,        bg: "bg-blue-900/30",   color: "text-blue-300" },
    { label: "EQUIPMENT",   value: typeCounts["EQUIPMENT"] ?? 0,          bg: "bg-purple-900/30", color: "text-purple-300" },
    { label: "COMPONENTS",  value: typeCounts["COMPONENTS"] ?? 0,         bg: "bg-teal-900/30",   color: "text-teal-300" },
    { label: "VALVES",      value: typeCounts["VALVES"] ?? 0,             bg: "bg-cyan-900/30",   color: "text-cyan-300" },
    { label: "ALARM",       value: typeCounts["ALARM"] ?? 0,              bg: "bg-red-900/30",    color: "text-red-300" },
    { label: "INTERLOCK",   value: typeCounts["INTERLOCK"] ?? 0,          bg: "bg-pink-900/30",   color: "text-pink-300" },
    { label: "OPC",         value: typeCounts["OPC"] ?? 0,                bg: "bg-yellow-900/30", color: "text-yellow-300" },
    { label: "NOTE",        value: typeCounts["NOTE"] ?? 0,               bg: "bg-orange-900/30", color: "text-orange-300" },
    { label: "TEXT",        value: typeCounts["TEXT"] ?? 0,               bg: "bg-slate-700/40",  color: "text-slate-300" },
    { label: "TITLE_BLOCK", value: typeCounts["TITLE_BLOCK"] ?? 0,        bg: "bg-zinc-800/40",   color: "text-zinc-500" },
  ];

  const RAW_PREVIEW_COLS = ["DWG", "Entity_Type", "BLOCK", "Layer", "Attribute_Tag", "Attribute_Value", "Raw_Text", "Detected_Type", "Ref"];
  const preview = rawRows.slice(0, 20);

  return (
    <div className="space-y-5 border border-border rounded-xl p-5 bg-card">
      <h3 className="font-semibold text-base">Extraction Results</h3>

      {/* Stats grid — 4 columns */}
      <div className="grid grid-cols-4 gap-2">
        {statCards.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center`}>
            <div className={`text-xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* RAW data preview */}
      {preview.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            RAW_EXPORT Preview — first {preview.length} rows
          </h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {RAW_PREVIEW_COLS.map((h) => (
                    <th key={h} className="px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-2 py-1.5 font-medium max-w-[90px] truncate">{row.DWG}</td>
                    <td className="px-2 py-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">{row.Entity_Type}</span>
                    </td>
                    <td className="px-2 py-1.5 max-w-[80px] truncate text-muted-foreground">{row.BLOCK}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{row.Layer}</td>
                    <td className="px-2 py-1.5 font-mono text-teal-400">{row.Attribute_Tag}</td>
                    <td className="px-2 py-1.5 max-w-[130px] truncate text-foreground font-medium">{row.Attribute_Value}</td>
                    <td className="px-2 py-1.5 max-w-[130px] truncate text-muted-foreground">{row.Raw_Text}</td>
                    <td className="px-2 py-1.5"><TypeBadge type={row.Detected_Type} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rawRows.length > 20 && (
              <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t border-border">
                Showing 20 of {rawRows.length.toLocaleString()} rows — full data in downloaded CSV
              </div>
            )}
          </div>
        </div>
      )}

      {/* Column reference */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">CSV columns: </span>
        <span className="font-mono">DWG · HANDLE · Entity_Type · BLOCK · Layer · X · Y · Attribute_Tag · Attribute_Value · Raw_Text · Detected_Type</span>
      </div>
    </div>
  );
}

// ── Status icon ───────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: FileStatus }) {
  if (status === "pending") return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
  if (status === "processing") return <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />;
  if (status === "done") return (
    <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
  return (
    <svg className="w-5 h-5 text-destructive shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ── Excel → DXF ───────────────────────────────────────────────────────────────

interface ExcelToDxfProps {
  folderHandle: FileSystemDirectoryHandle | null;
  setFolderHandle: (h: FileSystemDirectoryHandle | null) => void;
}

interface DwgResult {
  dwg: string;
  status: "pending" | "processing" | "done" | "error";
  replacements: number;
  error?: string;
  outputName?: string;
  oleWarning?: boolean;  // true if DXF had embedded OLE objects
}

function ExcelToDxf({ folderHandle, setFolderHandle }: ExcelToDxfProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedExcelResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [dwgResults, setDwgResults] = useState<DwgResult[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const isCsv = file.name.match(/\.csv$/i);
    const isExcel = file.name.match(/\.xlsx?$/i);
    if (!isCsv && !isExcel) {
      setParseError("Please upload a .csv, .xlsx, or .xls file.");
      return;
    }
    setParseError("");
    setIsParsing(true);
    setFileName(file.name);
    setParsed(null);
    setDwgResults([]);
    setAllDone(false);

    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const result = parseRawExportCsv(text);
          setParsed(result);
          if (result.errors.length > 0 && result.totalChanges === 0) {
            setParseError(result.errors.join(" "));
          }
        } catch (err: any) {
          setParseError("Failed to read CSV file: " + err.message);
        }
        setIsParsing(false);
      };
      reader.readAsText(file, "utf-8");
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        try {
          const result = parseRawExport(buffer);
          setParsed(result);
          if (result.errors.length > 0 && result.totalChanges === 0) {
            setParseError(result.errors.join(" "));
          }
        } catch (err: any) {
          setParseError("Failed to read Excel file: " + err.message);
        }
        setIsParsing(false);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleApply = async () => {
    if (!parsed || !folderHandle) return;
    setIsApplying(true);
    setAllDone(false);

    const initial: DwgResult[] = parsed.dwgNames.map((dwg) => ({
      dwg, status: "pending", replacements: 0,
    }));
    setDwgResults(initial);

    let allSuccess = true;
    for (let i = 0; i < parsed.dwgNames.length; i++) {
      const dwg = parsed.dwgNames[i];
      const patches = parsed.byDwg.get(dwg)!;

      setDwgResults((prev) =>
        prev.map((r) => r.dwg === dwg ? { ...r, status: "processing" } : r)
      );

      try {
        const originalDxf = await readDxfFromFolder(folderHandle, dwg + ".dxf");
        const hasOle = dxfHasOleObjects(originalDxf);
        const { patched, replacements } = patchDxfContent(originalDxf, patches);
        const outName = await writeUpdatedDxf(folderHandle, dwg, patched);
        setDwgResults((prev) =>
          prev.map((r) => r.dwg === dwg
            ? { ...r, status: "done", replacements, outputName: outName, oleWarning: hasOle }
            : r
          )
        );
      } catch (err: any) {
        allSuccess = false;
        setDwgResults((prev) =>
          prev.map((r) => r.dwg === dwg
            ? { ...r, status: "error", error: err.message }
            : r
          )
        );
      }
    }

    setIsApplying(false);
    setAllDone(allSuccess);

    // Auto-write CDE_Import.lsp so user can convert patched DXF → DWG immediately
    if (allSuccess && folderHandle) {
      try {
        await writeTextToFolder(folderHandle, "CDE_Import.lsp", CDE_IMPORT_LSP);
      } catch { /* non-critical */ }
    }
  };

  const reset = () => {
    setParsed(null);
    setFileName("");
    setParseError("");
    setDwgResults([]);
    setAllDone(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const folderName = folderHandle ? (folderHandle as any).name : null;
  const needsFolder = parsed && parsed.totalChanges > 0 && !folderHandle;
  const canApply = parsed && parsed.totalChanges > 0 && !!folderHandle && !isApplying;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold mb-1">Write Changes Back to DXF</h2>
        <p className="text-sm text-muted-foreground">
          Edit <strong>Attribute_Value</strong> cells in <strong>RAW_EXPORT.csv</strong> (open in Excel, save as CSV), then upload it here.
          The app patches the values directly into your original DXF files — <strong>same filename, no copies</strong>.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm space-y-2">
        <div className="font-semibold text-foreground mb-1">How it works</div>
        <div className="grid grid-cols-1 gap-1.5 text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold shrink-0">1.</span>
            <span>Drop DXF files → click <strong className="text-foreground">Extract</strong> → download <strong className="text-foreground">RAW_EXPORT.csv</strong></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold shrink-0">2.</span>
            <span>Open CSV in Excel, edit <strong className="text-foreground">Attribute_Value</strong> column, save as <strong className="text-foreground">.csv</strong></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold shrink-0">3.</span>
            <span>Select the folder with your <strong className="text-foreground">original .dxf files</strong>, then drop the edited CSV here and click <strong className="text-foreground">Apply Changes</strong></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold shrink-0">4.</span>
            <span>The app overwrites the <strong className="text-foreground">original .dxf files</strong> in-place — open them directly in your CAD application, no rename needed</span>
          </div>
        </div>
      </div>

      {/* OLE Warning */}
      <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm flex gap-3">
        <span className="text-yellow-400 text-lg shrink-0">⚠</span>
        <div className="text-yellow-300 space-y-1">
          <div className="font-semibold">If the DXF contains embedded Excel (OLE) objects:</div>
          <div className="text-yellow-300/80">
            After write-back, AutoCAD may launch a blank Excel window. Fix: Open the affected file in AutoCAD,
            run <strong className="text-yellow-200">AUDIT</strong> → "Fix errors? Yes" → save.
            Or use <strong className="text-yellow-200">WBLOCK</strong> to export a clean copy.
            Alternatively, use the <strong className="text-yellow-200">Fix DXF (OLE)</strong> tab to strip OLE objects before write-back.
          </div>
        </div>
      </div>

      {/* Step 1: Folder selection */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Step 1 — Original DXF Folder
        </div>
        {folderHandle ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            <span className="text-sm font-medium text-green-300">📂 {folderName}</span>
            <button
              onClick={() => setFolderHandle(null)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Change
            </button>
          </div>
        ) : folderApiSupported ? (
          <button
            onClick={async () => {
              try {
                const h = await (window as any).showDirectoryPicker({ mode: "readwrite" });
                setFolderHandle(h);
              } catch {}
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-primary/50 text-primary text-sm font-medium hover:bg-primary/5 transition-colors w-full justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            Select Folder with Original DXF Files
          </button>
        ) : (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
            Folder access requires Chrome or Edge browser.
          </div>
        )}
      </div>

      {/* Step 2: Upload Excel */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Step 2 — Upload Edited RAW_EXPORT.xlsx
        </div>

        {!parsed && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
            />
            {isParsing ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Reading file...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-sm">Drop RAW_EXPORT.csv here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">.csv only</span>
                </div>
              </div>
            )}
          </div>
        )}

        {parseError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {parseError}
          </div>
        )}

        {parsed && parsed.totalChanges > 0 && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/25">
              <svg className="w-5 h-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{fileName}</div>
                <div className="text-xs text-muted-foreground">
                  {parsed.totalChanges} entities across {parsed.dwgNames.length} drawing{parsed.dwgNames.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Change
              </button>
            </div>

            {/* DWG list */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Drawings to update
              </div>
              <div className="divide-y divide-border">
                {parsed.dwgNames.map((dwg) => {
                  const patches = parsed.byDwg.get(dwg)!;
                  const result = dwgResults.find((r) => r.dwg === dwg);
                  return (
                    <div key={dwg} className="flex items-center gap-3 px-3 py-2.5">
                      {result ? (
                        <>
                          {result.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                          {result.status === "processing" && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
                          {result.status === "done" && (
                            <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {result.status === "error" && (
                            <svg className="w-4 h-4 text-destructive shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </>
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium font-mono truncate">{dwg}.dxf</div>
                        {result?.status === "done" && (
                          <div className="space-y-0.5">
                            <div className="text-xs text-green-400">
                              {result.replacements} values updated — file replaced in-place
                            </div>
                            {result.oleWarning && (
                              <div className="text-xs text-yellow-400 font-medium">
                                ⚠ This file contains embedded OLE objects — use WBLOCK in AutoCAD to create a clean copy
                              </div>
                            )}
                          </div>
                        )}
                        {result?.status === "error" && (
                          <div className="text-xs text-destructive">{result.error}</div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {patches.size} change{patches.size !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {parsed.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs space-y-1">
                {parsed.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}

            {needsFolder && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Please select the folder with original DXF files above before applying.
              </div>
            )}

            {allDone && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/30 overflow-hidden">
                <div className="p-3 text-green-300 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  DXF files updated — replaced in-place inside <strong>{folderName}</strong>.
                </div>
                {folderHandle && (
                  <div className="px-3 pb-3 pt-0 border-t border-green-500/20 mt-1">
                    <div className="text-xs text-green-400/80 font-medium mb-1">To write changes back to DWG files:</div>
                    <div className="text-xs text-green-300/70 space-y-0.5">
                      <div>AutoCAD → <code className="bg-black/30 px-1 rounded">APPLOAD</code> → <code className="bg-black/30 px-1 rounded">CDE_Import.lsp</code> (already saved in folder) → command: <code className="bg-black/30 px-1 rounded">CDE_IMPORT</code></div>
                      <div className="text-green-500/60">All DXF files will be converted back to DWG — no additional steps required</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleApply}
                disabled={!canApply}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isApplying ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating DXF Files...</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Apply Changes to DXF Files
                  </>
                )}
              </button>
              <button
                onClick={reset}
                disabled={isApplying}
                className="px-5 py-2.5 border border-border rounded-lg font-medium text-sm hover:bg-muted/50 transition-colors disabled:opacity-40"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── OLE Remover ──────────────────────────────────────────────────────────────

interface OleFileEntry {
  file: File;
  status: "pending" | "processing" | "done" | "error";
  removed?: number;
  error?: string;
}

function OleRemover() {
  const [entries, setEntries] = useState<OleFileEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const newFiles = Array.from(files).filter((f) =>
      f.name.toLowerCase().endsWith(".dxf") &&
      !entries.some((e) => e.file.name === f.name)
    );
    if (!newFiles.length) return;
    setEntries((prev) => [
      ...prev,
      ...newFiles.map((f) => ({ file: f, status: "pending" as const })),
    ]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    const pending = entries.filter((e) => e.status === "pending");

    for (const entry of pending) {
      setEntries((prev) =>
        prev.map((e) => e.file.name === entry.file.name ? { ...e, status: "processing" } : e)
      );
      try {
        const text = await entry.file.text();
        const { cleaned, removed } = removeOleFromDxf(text);
        const blob = new Blob([cleaned], { type: "application/dxf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = entry.file.name;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        // Small delay between files so browser doesn't block multiple downloads
        await new Promise((r) => setTimeout(r, 400));
        setEntries((prev) =>
          prev.map((e) =>
            e.file.name === entry.file.name ? { ...e, status: "done", removed } : e
          )
        );
      } catch (err: any) {
        setEntries((prev) =>
          prev.map((e) =>
            e.file.name === entry.file.name ? { ...e, status: "error", error: err.message } : e
          )
        );
      }
    }
    setIsProcessing(false);
  };

  const reset = () => { setEntries([]); };
  const pendingCount = entries.filter((e) => e.status === "pending").length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Info banner */}
      <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/10 text-sm text-orange-300 space-y-1">
        <div className="font-semibold text-orange-200">🔧 OLE Object Remover</div>
        <div>If your DXF files are hanging AutoCAD or automatically opening Excel, they contain embedded OLE objects. This tool removes them and downloads a clean DXF.</div>
        <div className="text-orange-400/80 text-xs">The cleaned file will be downloaded with the same filename. Open it normally in AutoCAD.</div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/20"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".dxf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <div className="text-4xl mb-3">📂</div>
        <div className="text-sm font-medium text-foreground">Drop affected DXF files here</div>
        <div className="text-xs text-muted-foreground mt-1">or click to browse — multiple files supported</div>
      </div>

      {/* File list */}
      {entries.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Files ({entries.length})
          </div>
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.file.name} className="flex items-center gap-3 px-3 py-2.5">
                {entry.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                {entry.status === "processing" && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
                {entry.status === "done" && (
                  <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {entry.status === "error" && (
                  <svg className="w-4 h-4 text-destructive shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium font-mono truncate">{entry.file.name}</div>
                  {entry.status === "done" && (
                    <div className="text-xs text-green-400">
                      {entry.removed} OLE object{entry.removed !== 1 ? "s" : ""} removed — downloaded
                    </div>
                  )}
                  {entry.status === "error" && (
                    <div className="text-xs text-destructive">{entry.error}</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {(entry.file.size / 1024).toFixed(0)} KB
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {entries.length > 0 && (
        <div className="flex gap-3 justify-end">
          <button
            onClick={reset}
            disabled={isProcessing}
            className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
          >
            Reset
          </button>
          <button
            onClick={handleProcess}
            disabled={isProcessing || pendingCount === 0}
            className="px-6 py-2 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-400 text-white disabled:opacity-50 transition-colors"
          >
            {isProcessing
              ? "Processing…"
              : `Remove OLE & Download (${pendingCount} file${pendingCount !== 1 ? "s" : ""})`}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
