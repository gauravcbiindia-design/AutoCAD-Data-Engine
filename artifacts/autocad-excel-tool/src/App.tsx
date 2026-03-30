import { useState, useRef, useEffect } from "react";
import { parseDxf } from "@/lib/dxfParser";
import {
  extractEngineeringData,
  mergeAndPostProcess,
  type ExtractionResult,
} from "@/lib/engineeringExtractor";
import { exportRaw, exportClean, exportBatchToExcel, type FileParsedResult } from "@/lib/excelExport";
import { parseExcelFile, generateDxf, downloadDxf, type ImportedExcelData } from "@/lib/excelToDxf";

type Tab = "extract" | "excel-to-dxf";

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
      style={{ background: "#0a0a0a" }}
    >
      <img
        src="/cover.png"
        alt="CAD Data Engine"
        className="w-full h-full object-cover absolute inset-0"
        style={{ objectPosition: "center" }}
      />
      <div className="relative z-10 flex flex-col items-center gap-6" style={{ marginTop: "52%" }}>
        <button
          onClick={handleEnter}
          className="group flex items-center gap-3 px-10 py-4 rounded-xl font-bold text-base tracking-wide transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #c8102e 0%, #8b0000 100%)",
            color: "#fff",
            boxShadow: "0 0 32px rgba(200,16,46,0.5), 0 4px 24px rgba(0,0,0,0.6)",
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Launch CAD Data Engine
        </button>
      </div>
    </div>
  );
}

type FileStatus = "pending" | "processing" | "done" | "error";

interface FileEntry {
  file: File;
  status: FileStatus;
  result?: FileParsedResult;
  error?: string;
  blockCount?: number;
  textCount?: number;
}

// ── App shell ─────────────────────────────────────────────────────────────────

function App() {
  const [showCover, setShowCover] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("extract");

  if (showCover) return <CoverPage onEnter={() => setShowCover(false)} />;

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Glass Hero Header ─────────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden"
        style={{ minHeight: 200 }}
      >
        {/* Cover image full-bleed background */}
        <img
          src="/cover.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center 30%" }}
        />
        {/* Dark gradient scrim so text is readable */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,0,0,0.72) 0%, rgba(10,0,0,0.55) 60%, rgba(0,0,0,0.78) 100%)",
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
                background: "linear-gradient(135deg, #c8102e 0%, #7b0000 100%)",
                boxShadow: "0 0 20px rgba(200,16,46,0.5)",
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
                Bulk extract blocks, attributes & classified text from AutoCAD drawings · Export to structured Excel
              </p>
            </div>

            {/* Feature pills */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              {["Block Attributes", "Smart Classification", "Drawing-wise Sort", "Dual Excel Export"].map((pill) => (
                <span
                  key={pill}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(200,16,46,0.22)",
                    border: "1px solid rgba(200,16,46,0.4)",
                    color: "#ff7070",
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
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-5 py-2 text-sm font-medium rounded-lg transition-all duration-150"
                style={
                  activeTab === tab.id
                    ? {
                        background: "rgba(200,16,46,0.85)",
                        color: "#fff",
                        boxShadow: "0 0 16px rgba(200,16,46,0.4)",
                        border: "1px solid rgba(200,16,46,0.6)",
                      }
                    : {
                        background: "rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.7)",
                        border: "1px solid rgba(255,255,255,0.12)",
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
        {activeTab === "extract" ? <BulkExtractor /> : <ExcelToDxf />}
      </main>
    </div>
  );
}

// ── Bulk DXF Extractor ────────────────────────────────────────────────────────

function BulkExtractor() {
  const [isDragging, setIsDragging] = useState(false);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".dxf"));
    if (arr.length === 0) return;
    setResult(null);
    setEntries((prev) => {
      const existing = new Set(prev.map((e) => e.file.name));
      const fresh: FileEntry[] = arr
        .filter((f) => !existing.has(f.name))
        .map((file) => ({ file, status: "pending" }));
      return [...prev, ...fresh];
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeEntry = (name: string) => {
    setEntries((prev) => prev.filter((e) => e.file.name !== name));
    setResult(null);
  };

  const processAll = async () => {
    setIsProcessing(true);
    setResult(null);
    const updated = [...entries];
    const perFile: { dwgName: string; rawRows: any[]; cleanRows: any[] }[] = [];

    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: "processing" };
      setEntries([...updated]);

      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          try {
            const parsed = parseDxf(content);
            const dwgName = updated[i].file.name.replace(/\.dxf$/i, "");
            const { rawRows, cleanRows } = extractEngineeringData(dwgName, parsed);

            updated[i] = {
              ...updated[i],
              status: "done",
              result: { fileName: updated[i].file.name, data: parsed },
              blockCount: parsed.blocks.length,
              textCount: parsed.texts.length,
            };
            perFile.push({ dwgName, rawRows, cleanRows });
          } catch (err: any) {
            updated[i] = { ...updated[i], status: "error", error: err.message };
          }
          setEntries([...updated]);
          resolve();
        };
        reader.readAsText(updated[i].file);
      });
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
  const hasFiles = entries.length > 0;
  const allDone = hasFiles && entries.every((e) => e.status === "done" || e.status === "error");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Bulk Engineering Data Extraction</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Upload multiple DXF files. The tool extracts block attributes and classifies text into engineering fields
            (TAG, Line_Number, Instrument_Type, Size, Spec, etc.), removes garbage, detects duplicates, and exports
            two Excel files — a raw backup and a clean sorted dataset.
          </p>
        </div>
      </div>

      {/* DWG notice */}
      <div className="flex items-start gap-3 p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <span>
          <strong>DWG files:</strong> Convert to DXF first using the free{" "}
          <strong>ODA File Converter</strong> (opendesign.com) — it batch-converts entire folders in one click.
          Then drop all DXF files here.
        </span>
      </div>

      {/* Upload zone */}
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

      {/* File list */}
      {hasFiles && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Files ({entries.length})
            </h3>
            {!isProcessing && (
              <button onClick={() => { setEntries([]); setResult(null); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                Clear all
              </button>
            )}
          </div>

          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.file.name} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/20 transition-colors">
                <StatusIcon status={entry.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.file.name.replace(/\.dxf$/i, "")}</p>
                  {entry.status === "done" && (
                    <p className="text-xs text-muted-foreground">
                      {entry.blockCount} blocks · {entry.textCount} text entities
                    </p>
                  )}
                  {entry.status === "error" && <p className="text-xs text-destructive">{entry.error}</p>}
                  {entry.status === "pending" && (
                    <p className="text-xs text-muted-foreground">{(entry.file.size / 1024).toFixed(0)} KB · Waiting</p>
                  )}
                  {entry.status === "processing" && <p className="text-xs text-primary animate-pulse">Extracting...</p>}
                </div>
                {!isProcessing && (
                  <button onClick={() => removeEntry(entry.file.name)}
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
              <button onClick={processAll} disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Extracting {pendingCount} file{pendingCount !== 1 ? "s" : ""}...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Extract {pendingCount} File{pendingCount !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            )}

            {result && (
              <>
                <button onClick={() => exportRaw(result, `RAW_BULK_EXPORT_${new Date().toISOString().slice(0,10)}.xlsx`)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  RAW_BULK_EXPORT.xlsx
                </button>
                <button onClick={() => exportClean(result, `CLEAN_SORTED_OUTPUT_${new Date().toISOString().slice(0,10)}.xlsx`)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  CLEAN_SORTED_OUTPUT.xlsx
                </button>
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
            { icon: "🏗️", title: "Engineering Column Structure", desc: "Outputs DWG, HANDLE, BLOCK, TAG, Line_Number, Instrument_Type, Size, Spec, Insulation, Tracing, Service, Status." },
            { icon: "🧠", title: "Smart Text Classification", desc: "Automatically detects instrument tags, line numbers, sizes, specs and filters out notes, revisions, titles and garbage." },
            { icon: "📄", title: "Two Output Files", desc: "RAW_BULK_EXPORT preserves everything untouched. CLEAN_SORTED_OUTPUT is deduplicated, classified, and sorted by DWG → Line → TAG." },
            { icon: "🔍", title: "Duplicate Detection", desc: "Identifies and flags duplicate records across drawings. Duplicates appear in a separate sheet for review." },
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

// ── Results Panel ─────────────────────────────────────────────────────────────

function ResultsPanel({ result, doneCount }: { result: ExtractionResult; doneCount: number }) {
  const { stats, cleanRows } = result;

  // Instrument type summary
  const instrMap = new Map<string, number>();
  cleanRows.forEach((r) => {
    if (r.Instrument_Type) instrMap.set(r.Instrument_Type, (instrMap.get(r.Instrument_Type) || 0) + 1);
  });
  const topInstrs = [...instrMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Preview first 8 clean rows
  const preview = cleanRows.slice(0, 8);

  return (
    <div className="space-y-5 border border-border rounded-xl p-5 bg-card">
      <h3 className="font-semibold text-base">Extraction Results</h3>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Drawings", value: doneCount, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Raw Entities", value: stats.totalEntities, color: "text-gray-700", bg: "bg-gray-50" },
          { label: "Block Rows", value: stats.blockRows, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Text Rows", value: stats.textRows, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Clean Rows", value: cleanRows.length, color: "text-green-600", bg: "bg-green-50" },
          { label: "Filtered Out", value: stats.filteredOut, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Duplicates", value: stats.duplicates, color: stats.duplicates > 0 ? "text-red-600" : "text-gray-400", bg: stats.duplicates > 0 ? "bg-red-50" : "bg-gray-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Instrument types found */}
      {topInstrs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Instrument Types Detected
          </h4>
          <div className="flex flex-wrap gap-2">
            {topInstrs.map(([type, count]) => (
              <span key={type} className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                {type} <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px]">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Clean data preview */}
      {preview.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            CLEAN_SORTED_OUTPUT Preview (first {preview.length} rows)
          </h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {["DWG", "HANDLE", "BLOCK", "TAG", "Line_Number", "Instrument_Type", "Size", "Spec", "Service", "Status", "Detected_Type"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((row, i) => (
                  <tr key={i} className={`hover:bg-muted/20 transition-colors ${row.Duplicate === "YES" ? "bg-red-50" : ""}`}>
                    <td className="px-3 py-2 font-medium max-w-[120px] truncate">{row.DWG}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{row.HANDLE}</td>
                    <td className="px-3 py-2 font-mono">{row.BLOCK}</td>
                    <td className="px-3 py-2 font-semibold text-primary">{row.TAG}</td>
                    <td className="px-3 py-2">{row.Line_Number}</td>
                    <td className="px-3 py-2 max-w-[150px] truncate">{row.Instrument_Type}</td>
                    <td className="px-3 py-2">{row.Size}</td>
                    <td className="px-3 py-2">{row.Spec}</td>
                    <td className="px-3 py-2">{row.Service}</td>
                    <td className="px-3 py-2">
                      {row.Status && (
                        <span className="px-1.5 py-0.5 bg-muted rounded text-xs">{row.Status}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        row.Detected_Type === "BLOCK_ATTRIB" ? "bg-purple-100 text-purple-700" :
                        row.Detected_Type === "INSTRUMENT_TAG" ? "bg-blue-100 text-blue-700" :
                        row.Detected_Type === "LINE_NUMBER" ? "bg-green-100 text-green-700" :
                        "bg-muted text-muted-foreground"
                      }`}>{row.Detected_Type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cleanRows.length > 8 && (
              <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t border-border">
                Showing 8 of {cleanRows.length} clean rows — full data in downloaded Excel
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground border-t border-border pt-3">
        ✅ HANDLE integrity preserved · Data sorted by DWG → Line_Number → Instrument_Type → TAG → HANDLE · Duplicates flagged
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

function ExcelToDxf() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsed, setParsed] = useState<ImportedExcelData | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) { setError("Please upload a valid .xlsx or .xls file."); return; }
    setError(""); setIsProcessing(true); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      try { setParsed(parseExcelFile(buffer)); }
      catch (err: any) { setError("Failed to parse Excel file: " + err.message); }
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleExport = () => {
    if (!parsed) return;
    const dxf = generateDxf(parsed);
    downloadDxf(dxf, fileName.replace(/\.xlsx?$/i, "") + "-output.dxf");
  };

  const reset = () => { setParsed(null); setFileName(""); setError(""); if (fileRef.current) fileRef.current.value = ""; };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Generate DXF from Excel</h2>
        <p className="text-sm text-muted-foreground">
          Upload an Excel file (from the DXF → Excel tab) to generate a DXF file with block insertions and text entities.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        Expected sheets: <span className="font-mono bg-blue-100 px-1 rounded">Blocks & Attributes</span> and/or{" "}
        <span className="font-mono bg-blue-100 px-1 rounded">Text & Annotations</span>
      </div>

      {!parsed && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
          {isProcessing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Parsing Excel...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Drop your Excel file here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">.xlsx / .xls only</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
      )}

      {parsed && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Block Insertions", value: parsed.blocks.length, icon: "🔲" },
              { label: "Text Entities", value: parsed.texts.length, icon: "📝" },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-5 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-3xl font-bold">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          {parsed.errors.length > 0 && (
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
              {parsed.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleExport}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download DXF
            </button>
            <button onClick={reset}
              className="px-5 py-2.5 border border-border rounded-lg font-medium text-sm hover:bg-muted/50 transition-colors">
              Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
