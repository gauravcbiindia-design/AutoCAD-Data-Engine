const base = import.meta.env.BASE_URL;

export default function TitleSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0b1624" }}>
      <img
        src={`${base}hero.png`}
        crossOrigin="anonymous"
        alt="Engineering workspace"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.35 }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(11,22,36,0.92) 0%, rgba(11,22,36,0.70) 50%, rgba(0,77,130,0.55) 100%)",
        }}
      />
      <div
        className="absolute left-0 top-0 bottom-0 w-[0.5vw]"
        style={{ background: "linear-gradient(to bottom, #00b4d8, #0077b6)" }}
      />
      <div className="relative z-10 flex h-full flex-col justify-between px-[8vw] py-[8vh]">
        <div className="flex items-center gap-[1.2vw]">
          <div
            className="w-[3.5vw] h-[3.5vw] rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #0077b6, #023e8a)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#00b4d8" strokeWidth="2" className="w-[60%] h-[60%]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <span
            className="tracking-[0.22em] uppercase font-body"
            style={{ fontSize: "1.3vw", color: "#00b4d8", fontWeight: 500 }}
          >
            CAD Data Engine
          </span>
        </div>
        <div>
          <div
            className="font-display tracking-tight leading-none"
            style={{ fontSize: "7vw", fontWeight: 700, color: "#e2ecf5" }}
          >
            Bulk Engineering
          </div>
          <div
            className="font-display tracking-tight leading-none"
            style={{ fontSize: "7vw", fontWeight: 700, color: "#00b4d8" }}
          >
            Data Extraction
          </div>
          <div
            className="mt-[2.5vh] font-body"
            style={{ fontSize: "2vw", color: "#a8c8e0", fontWeight: 300, maxWidth: "55vw", lineHeight: 1.5 }}
          >
            Automated extraction of block attributes and engineering data from AutoCAD DXF drawings — structured, classified, export-ready.
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-body" style={{ fontSize: "1.8vw", color: "#e2ecf5", fontWeight: 500 }}>
              Gaurav Bharti
            </div>
            <div className="font-body" style={{ fontSize: "1.4vw", color: "#7a9ab8", fontWeight: 300 }}>
              Sr. Process Designer
            </div>
          </div>
          <div className="font-body" style={{ fontSize: "1.2vw", color: "#4a6a88" }}>
            © 2026 Gaurav Bharti
          </div>
        </div>
      </div>
    </div>
  );
}
