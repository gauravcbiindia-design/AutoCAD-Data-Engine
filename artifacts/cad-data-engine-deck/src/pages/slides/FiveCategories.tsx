export default function FiveCategories() {
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
      <div className="relative z-10 flex h-full flex-col px-[8vw] py-[7vh]">
        <div
          className="font-body tracking-[0.2em] uppercase mb-[1vh]"
          style={{ fontSize: "1.2vw", color: "#00b4d8", fontWeight: 500 }}
        >
          Intelligence Built In
        </div>
        <div
          className="font-display tracking-tight mb-[4vh]"
          style={{ fontSize: "4.2vw", fontWeight: 700, color: "#e2ecf5", lineHeight: 1.1 }}
        >
          5 Engineering Categories
          <span style={{ color: "#00b4d8" }}> — Auto-Classified</span>
        </div>
        <div className="grid grid-cols-5 gap-[1.5vw] flex-1" style={{ maxHeight: "58vh" }}>
          <div
            className="rounded-2xl px-[1.5vw] py-[2.5vh] flex flex-col justify-between"
            style={{ background: "rgba(45,198,83,0.10)", border: "1px solid rgba(45,198,83,0.30)" }}
          >
            <div>
              <div className="font-display" style={{ fontSize: "1.8vw", color: "#2dc653", fontWeight: 700, letterSpacing: "0.05em" }}>
                LINE
              </div>
              <div className="font-body mt-[1.5vh]" style={{ fontSize: "1.3vw", color: "#a8c8e0", fontWeight: 300, lineHeight: 1.5 }}>
                Pipe and process line numbers — extracted complete and split into filterable tokens.
              </div>
            </div>
            <div className="font-body" style={{ fontSize: "1.2vw", color: "#2dc653", opacity: 0.7 }}>
              e.g. 6"-P-2101-A1A
            </div>
          </div>
          <div
            className="rounded-2xl px-[1.5vw] py-[2.5vh] flex flex-col justify-between"
            style={{ background: "rgba(0,180,216,0.10)", border: "1px solid rgba(0,180,216,0.30)" }}
          >
            <div>
              <div className="font-display" style={{ fontSize: "1.8vw", color: "#00b4d8", fontWeight: 700, letterSpacing: "0.05em" }}>
                INSTRUMENT
              </div>
              <div className="font-body mt-[1.5vh]" style={{ fontSize: "1.3vw", color: "#a8c8e0", fontWeight: 300, lineHeight: 1.5 }}>
                Instrument tags with full attribute pairing — TOP/BOTTOM, FUNCTN, tag patterns.
              </div>
            </div>
            <div className="font-body" style={{ fontSize: "1.2vw", color: "#00b4d8", opacity: 0.7 }}>
              e.g. PI-2101
            </div>
          </div>
          <div
            className="rounded-2xl px-[1.5vw] py-[2.5vh] flex flex-col justify-between"
            style={{ background: "rgba(180,100,255,0.10)", border: "1px solid rgba(180,100,255,0.30)" }}
          >
            <div>
              <div className="font-display" style={{ fontSize: "1.8vw", color: "#b46fff", fontWeight: 700, letterSpacing: "0.05em" }}>
                EQUIPMENT
              </div>
              <div className="font-body mt-[1.5vh]" style={{ fontSize: "1.3vw", color: "#a8c8e0", fontWeight: 300, lineHeight: 1.5 }}>
                Vessels, pumps, compressors, heat exchangers — identified by block name patterns.
              </div>
            </div>
            <div className="font-body" style={{ fontSize: "1.2vw", color: "#b46fff", opacity: 0.7 }}>
              e.g. V-101, P-201A
            </div>
          </div>
          <div
            className="rounded-2xl px-[1.5vw] py-[2.5vh] flex flex-col justify-between"
            style={{ background: "rgba(255,200,50,0.10)", border: "1px solid rgba(255,200,50,0.30)" }}
          >
            <div>
              <div className="font-display" style={{ fontSize: "1.8vw", color: "#f5c518", fontWeight: 700, letterSpacing: "0.05em" }}>
                OPC
              </div>
              <div className="font-body mt-[1.5vh]" style={{ fontSize: "1.3vw", color: "#a8c8e0", fontWeight: 300, lineHeight: 1.5 }}>
                Off-page connectors and tie-ins detected by block name — links drawings together.
              </div>
            </div>
            <div className="font-body" style={{ fontSize: "1.2vw", color: "#f5c518", opacity: 0.7 }}>
              OPC / Tie-in tags
            </div>
          </div>
          <div
            className="rounded-2xl px-[1.5vw] py-[2.5vh] flex flex-col justify-between"
            style={{ background: "rgba(255,140,50,0.10)", border: "1px solid rgba(255,140,50,0.30)" }}
          >
            <div>
              <div className="font-display" style={{ fontSize: "1.8vw", color: "#ff8c32", fontWeight: 700, letterSpacing: "0.05em" }}>
                TEXT REVIEW
              </div>
              <div className="font-body mt-[1.5vh]" style={{ fontSize: "1.3vw", color: "#a8c8e0", fontWeight: 300, lineHeight: 1.5 }}>
                Unclassified text flagged for manual review — nothing is silently discarded.
              </div>
            </div>
            <div className="font-body" style={{ fontSize: "1.2vw", color: "#ff8c32", opacity: 0.7 }}>
              Notes, labels, misc
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
