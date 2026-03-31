export default function ExcelOutput() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0b1624" }}>
      <div
        className="absolute top-0 left-0 right-0 h-[50vh]"
        style={{
          background: "radial-gradient(ellipse at 30% 0%, rgba(0,180,216,0.10) 0%, transparent 60%)",
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
          Output
        </div>
        <div
          className="font-display tracking-tight mb-[4vh]"
          style={{ fontSize: "4.2vw", fontWeight: 700, color: "#e2ecf5", lineHeight: 1.1 }}
        >
          Two Structured
          <span style={{ color: "#00b4d8" }}> Excel Workbooks</span>
        </div>
        <div className="grid grid-cols-2 gap-[3vw] flex-1" style={{ maxHeight: "58vh" }}>
          <div
            className="rounded-2xl px-[3vw] py-[3vh] flex flex-col justify-between"
            style={{ background: "rgba(0,119,182,0.15)", border: "1px solid rgba(0,180,216,0.30)" }}
          >
            <div>
              <div
                className="font-display mb-[1vh]"
                style={{ fontSize: "2.2vw", color: "#00b4d8", fontWeight: 700 }}
              >
                ENGINEER_DATA.xlsx
              </div>
              <div
                className="font-body mb-[2.5vh]"
                style={{ fontSize: "1.5vw", color: "#7a9ab8", fontWeight: 300 }}
              >
                Structured, classified engineering data — ready for handover.
              </div>
              <div className="flex flex-col gap-[1.2vh]">
                <div className="flex items-center gap-[1vw]">
                  <div className="w-[0.6vw] h-[0.6vw] rounded-full shrink-0" style={{ background: "#2dc653" }} />
                  <span className="font-body" style={{ fontSize: "1.5vw", color: "#a8c8e0" }}>
                    ENGINEER_VISIBLE_DATA — all 5 categories
                  </span>
                </div>
                <div className="flex items-center gap-[1vw]">
                  <div className="w-[0.6vw] h-[0.6vw] rounded-full shrink-0" style={{ background: "#2dc653" }} />
                  <span className="font-body" style={{ fontSize: "1.5vw", color: "#a8c8e0" }}>
                    LINE_TOKENS — filterable pipe token breakdown
                  </span>
                </div>
                <div className="flex items-center gap-[1vw]">
                  <div className="w-[0.6vw] h-[0.6vw] rounded-full shrink-0" style={{ background: "#2dc653" }} />
                  <span className="font-body" style={{ fontSize: "1.5vw", color: "#a8c8e0" }}>
                    TEXT_REVIEW — unclassified items for manual check
                  </span>
                </div>
                <div className="flex items-center gap-[1vw]">
                  <div className="w-[0.6vw] h-[0.6vw] rounded-full shrink-0" style={{ background: "#2dc653" }} />
                  <span className="font-body" style={{ fontSize: "1.5vw", color: "#a8c8e0" }}>
                    DRAWING_META — source file and stats per drawing
                  </span>
                </div>
              </div>
            </div>
            <div
              className="font-body mt-[2vh] px-[1.5vw] py-[1.2vh] rounded-lg"
              style={{ fontSize: "1.3vw", color: "#00b4d8", background: "rgba(0,180,216,0.10)", border: "1px solid rgba(0,180,216,0.2)" }}
            >
              Primary engineering deliverable
            </div>
          </div>
          <div
            className="rounded-2xl px-[3vw] py-[3vh] flex flex-col justify-between"
            style={{ background: "rgba(45,198,83,0.08)", border: "1px solid rgba(45,198,83,0.25)" }}
          >
            <div>
              <div
                className="font-display mb-[1vh]"
                style={{ fontSize: "2.2vw", color: "#2dc653", fontWeight: 700 }}
              >
                RAW_EXPORT.xlsx
              </div>
              <div
                className="font-body mb-[2.5vh]"
                style={{ fontSize: "1.5vw", color: "#7a9ab8", fontWeight: 300 }}
              >
                Unfiltered raw extraction — every entity, every attribute.
              </div>
              <div className="flex flex-col gap-[1.2vh]">
                <div className="flex items-center gap-[1vw]">
                  <div className="w-[0.6vw] h-[0.6vw] rounded-full shrink-0" style={{ background: "#00b4d8" }} />
                  <span className="font-body" style={{ fontSize: "1.5vw", color: "#a8c8e0" }}>
                    All block entities with every attribute field
                  </span>
                </div>
                <div className="flex items-center gap-[1vw]">
                  <div className="w-[0.6vw] h-[0.6vw] rounded-full shrink-0" style={{ background: "#00b4d8" }} />
                  <span className="font-body" style={{ fontSize: "1.5vw", color: "#a8c8e0" }}>
                    Complete text entities from all drawing layers
                  </span>
                </div>
                <div className="flex items-center gap-[1vw]">
                  <div className="w-[0.6vw] h-[0.6vw] rounded-full shrink-0" style={{ background: "#00b4d8" }} />
                  <span className="font-body" style={{ fontSize: "1.5vw", color: "#a8c8e0" }}>
                    Source drawing filename tagged on every row
                  </span>
                </div>
                <div className="flex items-center gap-[1vw]">
                  <div className="w-[0.6vw] h-[0.6vw] rounded-full shrink-0" style={{ background: "#00b4d8" }} />
                  <span className="font-body" style={{ fontSize: "1.5vw", color: "#a8c8e0" }}>
                    Audit trail and data verification reference
                  </span>
                </div>
              </div>
            </div>
            <div
              className="font-body mt-[2vh] px-[1.5vw] py-[1.2vh] rounded-lg"
              style={{ fontSize: "1.3vw", color: "#2dc653", background: "rgba(45,198,83,0.08)", border: "1px solid rgba(45,198,83,0.2)" }}
            >
              Complete audit and verification record
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
