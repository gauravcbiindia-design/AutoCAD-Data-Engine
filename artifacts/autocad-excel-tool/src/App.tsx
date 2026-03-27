import { useState, useRef } from "react";
import { exportToExcel } from "@/lib/excelExport";
import { parseDxf, type ParsedDxfData } from "@/lib/dxfParser";
import { parseExcelFile, generateDxf, downloadDxf, type ImportedExcelData } from "@/lib/excelToDxf";

type Tab = "dxf-to-excel" | "excel-to-dxf";

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

// ─── DXF → Excel ─────────────────────────────────────────────────────────────

function DxfToExcel() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedDxfData | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".dxf")) {
      setError("Please upload a valid .dxf file.");
      return;
    }
    setError("");
    setIsProcessing(true);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const data = parseDxf(content);
        setParsed(data);
      } catch (err: any) {
        setError("Failed to parse DXF file: " + err.message);
      }
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleExport = () => {
    if (!parsed) return;
    const base = fileName.replace(/\.dxf$/i, "");
    exportToExcel(parsed, `${base}-data.xlsx`);
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
        <h2 className="text-xl font-semibold mb-1">Extract Data from DXF File</h2>
        <p className="text-sm text-muted-foreground">
          Upload an AutoCAD DXF file to extract all block insertions with attributes and text annotations, then export to Excel.
        </p>
      </div>

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
            accept=".dxf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />
          {isProcessing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Parsing DXF file...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Drop your DXF file here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">.dxf files only</span>
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
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Block Insertions", value: parsed.blocks.length, icon: "🔲" },
              { label: "Text / Annotations", value: parsed.texts.length, icon: "📝" },
              { label: "Layers", value: parsed.layers.length, icon: "📚" },
            ].map((stat) => (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-5 text-center">
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Blocks Preview */}
          {parsed.blocks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Blocks & Attributes Preview
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Block Name", "Layer", "X", "Y", "Attributes"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsed.blocks.slice(0, 10).map((b, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-medium">{b.blockName}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{b.layer}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{b.x.toFixed(2)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{b.y.toFixed(2)}</td>
                        <td className="px-4 py-2.5">
                          {b.attributes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {b.attributes.slice(0, 3).map((a, j) => (
                                <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono">
                                  <span className="font-semibold">{a.tag}:</span>{a.value}
                                </span>
                              ))}
                              {b.attributes.length > 3 && (
                                <span className="text-xs text-muted-foreground">+{b.attributes.length - 3} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.blocks.length > 10 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-t border-border">
                    Showing 10 of {parsed.blocks.length} blocks — all will be exported to Excel
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Text Preview */}
          {parsed.texts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Text & Annotations Preview
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Type", "Content", "Layer", "X", "Y"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsed.texts.slice(0, 10).map((t, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.type === "MTEXT" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 max-w-xs truncate">{t.content}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{t.layer}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{t.x.toFixed(2)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{t.y.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.texts.length > 10 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-t border-border">
                    Showing 10 of {parsed.texts.length} text entities — all will be exported
                  </div>
                )}
              </div>
            </div>
          )}

          {parsed.errors.length > 0 && (
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
              <strong>Warnings:</strong> {parsed.errors.join("; ")}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to Excel (.xlsx)
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

      {/* What gets exported */}
      {!parsed && !isProcessing && (
        <div className="grid grid-cols-2 gap-4 mt-2">
          {[
            {
              title: "Block Attributes",
              desc: "All INSERT entities with their attribute tags and values, sorted by block name and layer.",
              icon: "🔲",
            },
            {
              title: "Text & Annotations",
              desc: "All TEXT and MTEXT entities with content, position, layer and height — sorted by layer.",
              icon: "📝",
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
