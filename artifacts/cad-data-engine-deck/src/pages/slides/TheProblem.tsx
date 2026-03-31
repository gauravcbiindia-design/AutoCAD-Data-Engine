export default function TheProblem() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0b1624" }}>
      <div
        className="absolute top-0 right-0 w-[45vw] h-full"
        style={{
          background: "radial-gradient(ellipse at 80% 50%, rgba(0,119,182,0.15) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute left-0 top-0 bottom-0 w-[0.5vw]"
        style={{ background: "linear-gradient(to bottom, #00b4d8, #0077b6)" }}
      />
      <div className="relative z-10 flex h-full flex-col justify-center px-[8vw] py-[8vh]">
        <div
          className="font-body tracking-[0.2em] uppercase mb-[2vh]"
          style={{ fontSize: "1.2vw", color: "#00b4d8", fontWeight: 500 }}
        >
          The Challenge
        </div>
        <div
          className="font-display tracking-tight mb-[5vh]"
          style={{ fontSize: "5vw", fontWeight: 700, color: "#e2ecf5", lineHeight: 1.1 }}
        >
          Manual DXF Data Extraction
          <br />
          <span style={{ color: "#00b4d8" }}>Is Costly and Error-Prone</span>
        </div>
        <div className="grid gap-[2vh]" style={{ maxWidth: "72vw" }}>
          <div
            className="flex items-start gap-[2vw] rounded-xl px-[2.5vw] py-[2vh]"
            style={{ background: "rgba(0,119,182,0.12)", border: "1px solid rgba(0,180,216,0.2)" }}
          >
            <div style={{ fontSize: "2.5vw", color: "#e05c5c", fontWeight: 700, lineHeight: 1 }}>01</div>
            <div>
              <div className="font-display" style={{ fontSize: "2vw", color: "#e2ecf5", fontWeight: 600 }}>
                Hours of Manual Copy-Paste
              </div>
              <div className="font-body mt-[0.5vh]" style={{ fontSize: "1.5vw", color: "#7a9ab8", fontWeight: 300 }}>
                Engineers spend hours extracting block attributes by hand from dozens of drawings.
              </div>
            </div>
          </div>
          <div
            className="flex items-start gap-[2vw] rounded-xl px-[2.5vw] py-[2vh]"
            style={{ background: "rgba(0,119,182,0.12)", border: "1px solid rgba(0,180,216,0.2)" }}
          >
            <div style={{ fontSize: "2.5vw", color: "#e05c5c", fontWeight: 700, lineHeight: 1 }}>02</div>
            <div>
              <div className="font-display" style={{ fontSize: "2vw", color: "#e2ecf5", fontWeight: 600 }}>
                Inconsistent Data Structure
              </div>
              <div className="font-body mt-[0.5vh]" style={{ fontSize: "1.5vw", color: "#7a9ab8", fontWeight: 300 }}>
                No standard format — different engineers produce different spreadsheet layouts.
              </div>
            </div>
          </div>
          <div
            className="flex items-start gap-[2vw] rounded-xl px-[2.5vw] py-[2vh]"
            style={{ background: "rgba(0,119,182,0.12)", border: "1px solid rgba(0,180,216,0.2)" }}
          >
            <div style={{ fontSize: "2.5vw", color: "#e05c5c", fontWeight: 700, lineHeight: 1 }}>03</div>
            <div>
              <div className="font-display" style={{ fontSize: "2vw", color: "#e2ecf5", fontWeight: 600 }}>
                Critical Data Lost in Translation
              </div>
              <div className="font-body mt-[0.5vh]" style={{ fontSize: "1.5vw", color: "#7a9ab8", fontWeight: 300 }}>
                Instruments, OPC tags, line numbers — misclassified or missed entirely in manual extraction.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
