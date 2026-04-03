export default function Workflow() {
  const steps = [
    {
      n: "1",
      title: "Convert",
      desc: "Use the free ODA File Converter to convert DWG files to DXF format.",
      color: "linear-gradient(135deg, #00b4d8, #0077b6)",
    },
    {
      n: "2",
      title: "Drop or Select",
      desc: "Drag-drop DXF files or select an entire folder — batch processing included.",
      color: "linear-gradient(135deg, #00b4d8, #0077b6)",
    },
    {
      n: "3",
      title: "Download CSV",
      desc: "RAW_EXPORT.csv contains all 9 categories. Open in Excel — filter by Detected_Type in one click.",
      color: "linear-gradient(135deg, #2dc653, #1a8a3a)",
    },
    {
      n: "4",
      title: "Write Back",
      desc: "Edit Attribute_Value in CSV, upload it → corrected DXF downloaded instantly.",
      color: "linear-gradient(135deg, #f5c518, #c8a010)",
    },
  ];

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0b1624" }}>
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(0,119,182,0.10) 0%, transparent 65%)",
        }}
      />
      <div
        className="absolute left-0 top-0 bottom-0 w-[0.5vw]"
        style={{ background: "linear-gradient(to bottom, #00b4d8, #0077b6)" }}
      />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-[8vw] py-[7vh]">
        <div
          className="font-body tracking-[0.2em] uppercase mb-[1vh]"
          style={{ fontSize: "1.2vw", color: "#00b4d8", fontWeight: 500 }}
        >
          How It Works
        </div>
        <div
          className="font-display tracking-tight mb-[5vh] text-center"
          style={{ fontSize: "4.2vw", fontWeight: 700, color: "#e2ecf5", lineHeight: 1.1 }}
        >
          Four Steps to
          <span style={{ color: "#00b4d8" }}> Structured Data</span>
        </div>

        <div className="flex items-center gap-0" style={{ width: "84vw" }}>
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center" style={{ flex: 1 }}>
              <div className="flex flex-col items-center text-center" style={{ flex: 1 }}>
                <div
                  className="font-display flex items-center justify-center rounded-full mb-[2vh]"
                  style={{
                    width: "7vw", height: "7vw", fontSize: "3.5vw",
                    fontWeight: 700, color: "#0b1624", background: s.color,
                  }}
                >
                  {s.n}
                </div>
                <div
                  className="font-display mb-[1vh]"
                  style={{ fontSize: "2vw", color: "#e2ecf5", fontWeight: 600 }}
                >
                  {s.title}
                </div>
                <div
                  className="font-body"
                  style={{ fontSize: "1.25vw", color: "#7a9ab8", fontWeight: 300, lineHeight: 1.6, maxWidth: "16vw" }}
                >
                  {s.desc}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="flex items-center shrink-0" style={{ position: "relative", top: "-3vh" }}>
                  <div style={{ width: "4vw", height: "0.2vh", background: "linear-gradient(to right, #0077b6, #00b4d8)" }} />
                  <div className="font-display" style={{ fontSize: "2vw", color: "#00b4d8" }}>&rsaquo;</div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div
          className="mt-[5vh] rounded-2xl px-[3vw] py-[1.8vh] text-center"
          style={{ background: "rgba(0,180,216,0.10)", border: "1px solid rgba(0,180,216,0.25)" }}
        >
          <div className="font-body" style={{ fontSize: "1.5vw", color: "#a8c8e0" }}>
            Works in <span style={{ color: "#00b4d8" }}>Chrome</span> and <span style={{ color: "#00b4d8" }}>Edge</span> — no installation required. Runs entirely in the browser.
          </div>
        </div>
      </div>
    </div>
  );
}
