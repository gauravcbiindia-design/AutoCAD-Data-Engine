export default function FilterGuide() {
  const categories = [
    { label: "LINE_NUMBER", color: "#2dc653", bg: "rgba(45,198,83,0.12)", example: "6\"-N-602-2209-B1A-H" },
    { label: "INSTRUMENTS", color: "#00b4d8", bg: "rgba(0,180,216,0.12)", example: "TT-2411, PI-2101" },
    { label: "EQUIPMENT",   color: "#b46fff", bg: "rgba(180,100,255,0.12)", example: "V-101, P-201A" },
    { label: "COMPONENTS",  color: "#14b8a6", bg: "rgba(20,184,166,0.12)", example: "GATE, BALL, CHECK" },
    { label: "OPC",         color: "#f5c518", bg: "rgba(245,197,24,0.12)", example: "FROM / TO tags" },
    { label: "ALARM",       color: "#f87171", bg: "rgba(248,113,113,0.12)", example: "H, L, HH, LL, HHH" },
    { label: "INTERLOCK",   color: "#f472b6", bg: "rgba(244,114,182,0.12)", example: "Z, I, IL, ESD" },
    { label: "NOTE",        color: "#fb923c", bg: "rgba(251,146,60,0.12)", example: "General Notes text" },
    { label: "TEXT",        color: "#94a3b8", bg: "rgba(148,163,184,0.12)", example: "MIN., NNF, CONN." },
    { label: "SPEC",        color: "#a78bfa", bg: "rgba(167,139,250,0.12)", example: "A2A, D1D, B1A-H" },
  ];

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0b1624" }}>
      <div
        className="absolute top-0 right-0"
        style={{
          width: "40vw", height: "40vh",
          background: "radial-gradient(ellipse at 100% 0%, rgba(0,180,216,0.08) 0%, transparent 65%)",
        }}
      />
      <div
        className="absolute left-0 top-0 bottom-0 w-[0.5vw]"
        style={{ background: "linear-gradient(to bottom, #00b4d8, #0077b6)" }}
      />

      <div className="relative z-10 flex h-full flex-col px-[6vw] py-[5vh]">
        <div
          className="font-body tracking-[0.2em] uppercase mb-[0.5vh]"
          style={{ fontSize: "1.1vw", color: "#00b4d8", fontWeight: 500 }}
        >
          Working with CSV
        </div>
        <div
          className="font-display tracking-tight mb-[3vh]"
          style={{ fontSize: "3.8vw", fontWeight: 700, color: "#e2ecf5", lineHeight: 1.1 }}
        >
          How to Filter the
          <span style={{ color: "#00b4d8" }}> RAW_EXPORT.csv</span>
        </div>

        <div className="flex gap-[3vw] flex-1" style={{ minHeight: 0 }}>
          {/* Left: step-by-step */}
          <div className="flex flex-col gap-[1.5vh]" style={{ flex: "0 0 34vw" }}>
            {[
              { n: "1", title: "Open in Excel", desc: "File → Open → RAW_EXPORT.csv. Excel reads it with UTF-8 BOM automatically." },
              { n: "2", title: "Enable Filter", desc: "Click any cell in Row 1 → Data tab → Filter. Dropdown arrows appear on every column header." },
              { n: "3", title: "Filter by Detected_Type", desc: "Click the Detected_Type dropdown → uncheck (Select All) → tick only the category you need (e.g. INSTRUMENTS)." },
              { n: "4", title: "Use Full_Tag column", desc: "Full_Tag shows the reconstructed instrument tag (TT-2411). Fill blank BOTTOM cells here to update DXF later." },
              { n: "5", title: "Use Context_Tag column", desc: "For TEXT / NOTE rows, Context_Tag shows the nearest instrument or line number — tells you where that text belongs on the drawing." },
            ].map((s) => (
              <div key={s.n} className="flex items-start gap-[1.2vw]">
                <div
                  className="font-display flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: "2.8vw", height: "2.8vw", fontSize: "1.3vw",
                    fontWeight: 700, color: "#0b1624",
                    background: "linear-gradient(135deg, #00b4d8, #0077b6)",
                  }}
                >
                  {s.n}
                </div>
                <div>
                  <div className="font-display" style={{ fontSize: "1.35vw", color: "#e2ecf5", fontWeight: 600 }}>
                    {s.title}
                  </div>
                  <div className="font-body" style={{ fontSize: "1.1vw", color: "#7a9ab8", fontWeight: 300, lineHeight: 1.5 }}>
                    {s.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: category reference */}
          <div className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
            <div
              className="font-body mb-[1.5vh]"
              style={{ fontSize: "1.1vw", color: "#00b4d8", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}
            >
              Detected_Type — Quick Reference
            </div>
            <div className="grid grid-cols-2 gap-[0.8vw]" style={{ flex: 1 }}>
              {categories.map((c) => (
                <div
                  key={c.label}
                  className="rounded-xl px-[1.2vw] py-[0.9vh] flex flex-col justify-center"
                  style={{ background: c.bg, border: `1px solid ${c.color}40` }}
                >
                  <div className="font-display" style={{ fontSize: "1.1vw", color: c.color, fontWeight: 700, letterSpacing: "0.05em" }}>
                    {c.label}
                  </div>
                  <div className="font-body" style={{ fontSize: "0.95vw", color: "#7a9ab8", fontWeight: 300 }}>
                    {c.example}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-[1.5vh] rounded-xl px-[1.5vw] py-[1vh]"
              style={{ background: "rgba(0,180,216,0.08)", border: "1px solid rgba(0,180,216,0.2)" }}
            >
              <div className="font-body" style={{ fontSize: "1.05vw", color: "#a8c8e0" }}>
                <span style={{ color: "#00b4d8", fontWeight: 600 }}>Pro tip:</span> After filtering, copy visible rows only (Ctrl+C) to a new sheet for a clean category-specific report.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
