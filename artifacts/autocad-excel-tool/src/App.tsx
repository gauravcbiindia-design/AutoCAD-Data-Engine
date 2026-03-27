import { useState, useRef } from "react";
import { exportBatchToExcel, type FileParsedResult } from "@/lib/excelExport";
import { parseDxf } from "@/lib/dxfParser";
import { parseExcelFile, generateDxf, downloadDxf, type ImportedExcelData } from "@/lib/excelToDxf";

type Tab = "dxf-to-excel" | "excel-to-dxf";

type FileStatus = "pending" | "processing" | "done" | "error";

interface FileEntry {
  file: File;
  status: FileStatus;
  result?: FileParsedResult;
  error?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dxf-to-excel");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
            <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">AutoCAD ↔ Excel Tool</h1>
            <p className="text-xs text-muted-foreground">Extract blocks, attributes & text from DXF files</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6">
          <nav className="flex gap-1 pt-2">
            {[
              { id: "dxf-to-excel" as Tab, label: "DXF → Excel", icon: "⬇️" },
              { id: "excel-to-dxf" as Tab, label: "Excel → DXF", icon: "⬆️" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary bg-background"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === "dxf-to-excel" ? <DxfToExcel /> : <ExcelToDxf />}
      </main>
    </div>
  );
}

// ─── DXF → Excel (Batch) ─────────────────────────────────────────────────────

function DxfToExcel() {
  const [isDragging, setIsDragging] = useState(false);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".dxf"));
    if (arr.length === 0) return;
    const newEntries: FileEntry[] = arr.map((file) => ({ file, status: "pending" }));
    setEntries((prev) => {
      const existing = new Set(prev.map((e) => e.file.name));
      return [...prev, ...newEntries.filter((e) => !existing.has(e.file.name))];
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeEntry = (name: string) => {
    setEntries((prev) => prev.filter((e) => e.file.name !== name));
  };

  const processAll = async () => {
    setIsProcessing(true);
    const updated = [...entries];

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === "done") continue;
      updated[i] = { ...updated[i], status: "processing" };
      setEntries([...updated]);

      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          try {
            const data = parseDxf(content);
            updated[i] = {
              ...updated[i],
              status: "done",
              result: { fileName: updated[i].file.name, data },
            };
          } catch (err: any) {
            updated[i] = {
              ...updated[i],
              status: "error",
              error: err.message,
            };
          }
          setEntries([...updated]);
          resolve();
        };
        reader.readAsText(updated[i].file);
      });
    }

    setIsProcessing(false);
  };

  const handleExport = () => {
    const done = entries.filter((e) => e.status === "done" && e.result);
    if (done.length === 0) return;
    const results = done.map((e) => e.result!);
    const name = done.length === 1
      ? done[0].file.name.replace(/\.dxf$/i, "") + "-data.xlsx"
      : `batch-${done.length}-files-data.xlsx`;
    exportBatchToExcel(results, name);
  };

  const reset = () => {
    setEntries([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const doneCount = entries.filter((e) => e.status === "done").length;
  const errorCount = entries.filter((e) => e.status === "error").length;
  const totalBlocks = entries.filter((e) => e.result).reduce((s, e) => s + (e.result?.data.blocks.length ?? 0), 0);
  const totalTexts = entries.filter((e) => e.result).reduce((s, e) => s + (e.result?.data.texts.length ?? 0), 0);
  const hasFiles = entries.length > 0;
  const allDone = hasFiles && entries.every((e) => e.status === "done" || e.status === "error");
  const pendingCount = entries.filter((e) => e.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Batch Extract Data from DXF Files</h2>
        <p className="text-sm text-muted-foreground">
          Upload one or more AutoCAD DXF files. All block attributes and text annotations are extracted and combined into a single Excel file.
        </p>
      </div>

      {/* Upload Zone */}
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
        <input
          ref={fileRef}
          type="file"
          accept=".dxf"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="font-medium text-sm">
            {hasFiles ? "Drop more DXF files to add them" : "Drop DXF files here"}
          </p>
          <p className="text-xs text-muted-foreground">or click to browse — multiple files supported</p>
          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">.dxf files only</span>
        </div>
      </div>

      {/* File List */}
      {hasFiles && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Files ({entries.length})
            </h3>
            {!allDone && (
              <button
                onClick={() => setEntries([])}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.file.name} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/20 transition-colors">
                {/* Status icon */}
                <div className="shrink-0">
                  {entry.status === "pending" && (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40" />
                  )}
                  {entry.status === "processing" && (
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  {entry.status === "done" && (
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {entry.status === "error" && (
                    <svg className="w-5 h-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>

                {/* File name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.file.name}</p>
                  {entry.status === "done" && entry.result && (
                    <p className="text-xs text-muted-foreground">
                      {entry.result.data.blocks.length} blocks · {entry.result.data.texts.length} text entities · {entry.result.data.layers.length} layers
                    </p>
                  )}
                  {entry.status === "error" && (
                    <p className="text-xs text-destructive">{entry.error}</p>
                  )}
                  {entry.status === "pending" && (
                    <p className="text-xs text-muted-foreground">{(entry.file.size / 1024).toFixed(0)} KB · Waiting...</p>
                  )}
                  {entry.status === "processing" && (
                    <p className="text-xs text-primary">Parsing...</p>
                  )}
                </div>

                {/* Remove button */}
                {!isProcessing && (
                  <button
                    onClick={() => removeEntry(entry.file.name)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Progress bar when processing */}
          {isProcessing && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Processing files...</span>
                <span>{doneCount + errorCount} / {entries.length}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${((doneCount + errorCount) / entries.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Summary when done */}
          {allDone && doneCount > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Files Processed", value: doneCount, icon: "📄" },
                { label: "Total Blocks", value: totalBlocks, icon: "🔲" },
                { label: "Total Text Entities", value: totalTexts, icon: "📝" },
              ].map((stat) => (
                <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
                  <div className="text-xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            {!allDone && pendingCount > 0 && (
              <button
                onClick={processAll}
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing {pendingCount} file{pendingCount !== 1 ? "s" : ""}...
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

            {doneCount > 0 && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export {doneCount} File{doneCount !== 1 ? "s" : ""} to Excel
              </button>
            )}

            {!isProcessing && (
              <button
                onClick={reset}
                className="px-5 py-2.5 border border-border rounded-lg font-medium text-sm hover:bg-muted/50 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {errorCount > 0 && (
            <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
              {errorCount} file{errorCount !== 1 ? "s" : ""} failed to parse. Check they are valid DXF files.
            </div>
          )}
        </div>
      )}

      {/* Feature cards when empty */}
      {!hasFiles && (
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              title: "Batch Processing",
              desc: "Upload dozens of DXF files at once. Each file is parsed and all data is combined into one Excel workbook.",
              icon: "📦",
            },
            {
              title: "Block Attributes",
              desc: "All INSERT entities with attribute tags and values. Each tag becomes its own column, sorted by file and block name.",
              icon: "🔲",
            },
            {
              title: "Text & Annotations",
              desc: "All TEXT and MTEXT entities with content, layer, position, and height — sorted by file and layer.",
              icon: "📝",
            },
            {
              title: "Summary Sheet",
              desc: "An automatic summary sheet lists every file with counts of blocks, text entities, and layers found.",
              icon: "📊",
            },
          ].map((item) => (
            <div key={item.title} className="bg-card border border-border rounded-xl p-5">
              <div className="text-2xl mb-2">{item.icon}</div>
              <h3 className="font-semibold mb-1">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Excel → DXF ─────────────────────────────────────────────────────────────

function ExcelToDxf() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsed, setParsed] = useState<ImportedExcelData | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx") && !file.name.toLowerCase().endsWith(".xls")) {
      setError("Please upload a valid .xlsx or .xls file.");
      return;
    }
    setError("");
    setIsProcessing(true);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      try {
        const data = parseExcelFile(buffer);
        setParsed(data);
      } catch (err: any) {
        setError("Failed to parse Excel file: " + err.message);
      }
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleExport = () => {
    if (!parsed) return;
    const dxf = generateDxf(parsed);
    const base = fileName.replace(/\.(xlsx|xls)$/i, "");
    downloadDxf(dxf, `${base}-output.dxf`);
  };

  const reset = () => {
    setParsed(null);
    setFileName("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Generate DXF from Excel</h2>
        <p className="text-sm text-muted-foreground">
          Upload an Excel file (exported from this tool or matching the format) to generate a DXF file with block insertions and text.
        </p>
      </div>

      {/* Format Guide */}
      {!parsed && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong>Expected Excel format:</strong> The file should have sheets named{" "}
          <span className="font-mono bg-blue-100 px-1 rounded">Blocks &amp; Attributes</span> and/or{" "}
          <span className="font-mono bg-blue-100 px-1 rounded">Text &amp; Annotations</span> — exactly as exported by the DXF → Excel tab.
        </div>
      )}

      {/* Upload Zone */}
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
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />
          {isProcessing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Parsing Excel file...</p>
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
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">.xlsx / .xls files only</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {parsed && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Block Insertions", value: parsed.blocks.length, icon: "🔲" },
              { label: "Text Entities", value: parsed.texts.length, icon: "📝" },
            ].map((stat) => (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-5 text-center">
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {parsed.errors.length > 0 && (
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm space-y-1">
              <strong>Warnings:</strong>
              <ul className="list-disc pl-4">
                {parsed.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-3">DXF Output Preview</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {parsed.blocks.length} INSERT entities will be written
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                {parsed.texts.length} TEXT/MTEXT entities will be written
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                AutoCAD 2000 format (AC1015) — compatible with most CAD software
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download DXF File
            </button>
            <button
              onClick={reset}
              className="px-5 py-2.5 border border-border rounded-lg font-medium text-sm hover:bg-muted/50 transition-colors"
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
