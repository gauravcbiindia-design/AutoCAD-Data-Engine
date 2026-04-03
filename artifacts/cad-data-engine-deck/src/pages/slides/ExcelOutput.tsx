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
          One Structured
          <span style={{ color: "#00b4d8" }}> CSV Export</span>
        </div>
        <div className="grid grid-cols-2 gap-[3vw] flex-1" style={{ maxHeight: "60vh" }}>
          {/* Left: RAW_EXPORT.csv */}
          <div
            className="rounded-2xl px-[3vw] py-[3vh] flex flex-col justify-between"
            style={{ background: "rgba(0,119,182,0.15)", border: "1px solid rgba(0,180,216,0.30)" }}
          >
            <div>
              <div
                className="font-display mb-[0.5vh]"
                style={{ fontSize: "2.2vw", color: "#00b4d8", fontWeight: 700 }}
              >
                RAW_EXPORT.csv
              </div>
              <div
                className="font-body mb-[2.5vh]"
                style={{ fontSize: "1.4vw", color: "#7a9ab8", fontWeight: 300 }}
              >
                Every extracted entity — open in Excel and filter by category instantly.
              </div>
              <div className="flex flex-col gap-[1.2vh]">
                {[
                  { label: "Detected_Type", desc: "Category for each row — filter to any type in one click" },
                  { label: "Full_Tag", desc: "Reconstructed tag (e.g. TT-2411) — fill blanks to update DXF" },
                  { label: "Context_Tag", desc: "Nearest instrument/line — links TEXT rows to their drawing context" },
                  { label: "Attribute_Value", desc: "Edit this column, upload CSV → changes written back to DXF" },
                  { label: "Drawing_Name", desc: "Source DXF file tagged on every row for traceability" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-[1vw]">
                    <div className="w-[0.6vw] h-[0.6vw] rounded-full shrink-0 mt-[0.8vh]" style={{ background: "#00b4d8" }} />
                    <span className="font-body" style={{ fontSize: "1.35vw", color: "#a8c8e0" }}>
                      <span style={{ color: "#00b4d8", fontWeight: 600 }}>{item.label}</span>
                      {" — "}{item.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div
              className="font-body mt-[2vh] px-[1.5vw] py-[1.2vh] rounded-lg"
              style={{ fontSize: "1.2vw", color: "#00b4d8", background: "rgba(0,180,216,0.10)", border: "1px solid rgba(0,180,216,0.2)" }}
            >
              Primary engineering deliverable — CSV, universal, no macros needed
            </div>
          </div>

          {/* Right: DXF writeback */}
          <div
            className="rounded-2xl px-[3vw] py-[3vh] flex flex-col justify-between"
            style={{ background: "rgba(45,198,83,0.08)", border: "1px solid rgba(45,198,83,0.25)" }}
          >
            <div>
              <div
                className="font-display mb-[0.5vh]"
                style={{ fontSize: "2.2vw", color: "#2dc653", fontWeight: 700 }}
              >
                DXF Write-Back
              </div>
              <div
                className="font-body mb-[2.5vh]"
                style={{ fontSize: "1.4vw", color: "#7a9ab8", fontWeight: 300 }}
              >
                Edit the CSV — upload it back — changes applied to the original DXF.
              </div>
              <div className="flex flex-col gap-[1.2vh]">
                {[
                  "Edit Attribute_Value cells in Excel",
                  "Save CSV and upload via Apply Changes",
                  "Corrected DXF downloaded instantly",
                  "Changing Full_Tag does NOT affect DXF",
                  "Batch update multiple drawings at once",
                ].map((txt) => (
                  <div key={txt} className="flex items-center gap-[1vw]">
                    <div className="w-[0.6vw] h-[0.6vw] rounded-full shrink-0" style={{ background: "#2dc653" }} />
                    <span className="font-body" style={{ fontSize: "1.35vw", color: "#a8c8e0" }}>{txt}</span>
                  </div>
                ))}
              </div>
            </div>
            <div
              className="font-body mt-[2vh] px-[1.5vw] py-[1.2vh] rounded-lg"
              style={{ fontSize: "1.2vw", color: "#2dc653", background: "rgba(45,198,83,0.08)", border: "1px solid rgba(45,198,83,0.2)" }}
            >
              Round-trip: DXF → CSV → Edit → Updated DXF
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
