export default function FiveCategories() {
  const categories = [
    { label: "LINE_NUMBER",  color: "#2dc653",  bg: "rgba(45,198,83,0.10)",   border: "rgba(45,198,83,0.30)",   example: "6\"-N-602-2209-B1A-H",  desc: "Pipe & process line numbers — full format including insulation suffix." },
    { label: "INSTRUMENTS",  color: "#00b4d8",  bg: "rgba(0,180,216,0.10)",   border: "rgba(0,180,216,0.30)",   example: "TT-2411, PI-2101, PG",   desc: "Instrument tags via TOP/BOTTOM, FUNCTN, or block name detection." },
    { label: "EQUIPMENT",    color: "#b46fff",  bg: "rgba(180,100,255,0.10)", border: "rgba(180,100,255,0.30)", example: "V-101, P-201A, K-301",   desc: "Vessels, pumps, compressors, HX — identified by block name patterns." },
    { label: "COMPONENTS",  color: "#14b8a6",  bg: "rgba(20,184,166,0.10)",  border: "rgba(20,184,166,0.30)",  example: "GATE, BALL, CHECK valve", desc: "In-line valve bodies and fittings." },
    { label: "OPC",          color: "#f5c518",  bg: "rgba(245,197,24,0.10)",  border: "rgba(245,197,24,0.30)",  example: "FROM / TO connector tags", desc: "Off-page connectors & tie-ins — links drawings together." },
    { label: "ALARM",        color: "#f87171",  bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.30)", example: "H, L, HH, LL, HHH, LLL",  desc: "Alarm set-point indicators on instrument bubbles." },
    { label: "INTERLOCK",    color: "#f472b6",  bg: "rgba(244,114,182,0.10)", border: "rgba(244,114,182,0.30)", example: "Z, I, IL, ESD, SIS",       desc: "Safety interlock and shutdown system references." },
    { label: "SPEC",         color: "#a78bfa",  bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.30)", example: "A2A, D1D, B1A-H",         desc: "Piping specification codes including class & insulation." },
    { label: "NOTE / TEXT",  color: "#fb923c",  bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.30)",  example: "General Notes, MIN., NNF",  desc: "Free text — spatially linked to nearest instrument or line via Context_Tag." },
  ];

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0b1624" }}>
      <div
        className="absolute bottom-0 left-0 right-0 h-[40vh]"
        style={{
          background: "radial-gradient(ellipse at 50% 100%, rgba(0,119,182,0.12) 0%, transparent 70%)",
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
          Intelligence Built In
        </div>
        <div
          className="font-display tracking-tight mb-[2.5vh]"
          style={{ fontSize: "3.8vw", fontWeight: 700, color: "#e2ecf5", lineHeight: 1.1 }}
        >
          9 Engineering Categories
          <span style={{ color: "#00b4d8" }}> — Auto-Classified</span>
        </div>

        <div className="grid gap-[0.9vw]" style={{ gridTemplateColumns: "repeat(3, 1fr)", flex: 1, alignContent: "start" }}>
          {categories.map((c) => (
            <div
              key={c.label}
              className="rounded-xl px-[1.4vw] py-[1.5vh] flex flex-col justify-between"
              style={{ background: c.bg, border: `1px solid ${c.border}` }}
            >
              <div>
                <div className="font-display" style={{ fontSize: "1.4vw", color: c.color, fontWeight: 700, letterSpacing: "0.05em" }}>
                  {c.label}
                </div>
                <div className="font-body mt-[0.6vh]" style={{ fontSize: "1.05vw", color: "#a8c8e0", fontWeight: 300, lineHeight: 1.5 }}>
                  {c.desc}
                </div>
              </div>
              <div className="font-body mt-[0.8vh]" style={{ fontSize: "0.95vw", color: c.color, opacity: 0.75 }}>
                {c.example}
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-[2vh] rounded-xl px-[2vw] py-[1vh]"
          style={{ background: "rgba(0,180,216,0.07)", border: "1px solid rgba(0,180,216,0.2)" }}
        >
          <span className="font-body" style={{ fontSize: "1.1vw", color: "#7a9ab8" }}>
            Filter <span style={{ color: "#00b4d8", fontWeight: 600 }}>Detected_Type</span> column in the exported CSV to view any single category instantly.&nbsp;
            <span style={{ color: "#2dc653" }}>Full_Tag</span> gives the reconstructed tag.&nbsp;
            <span style={{ color: "#f5c518" }}>Context_Tag</span> links free text to its nearest instrument or line.
          </span>
        </div>
      </div>
    </div>
  );
}
