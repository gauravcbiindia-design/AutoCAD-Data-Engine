export default function Workflow() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0b1624" }}>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,119,182,0.10) 0%, transparent 65%)",
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
          style={{ fontSize: "4.5vw", fontWeight: 700, color: "#e2ecf5", lineHeight: 1.1 }}
        >
          Three Steps to
          <span style={{ color: "#00b4d8" }}> Structured Data</span>
        </div>
        <div className="flex items-center gap-[0vw]" style={{ width: "80vw" }}>
          <div className="flex flex-col items-center text-center" style={{ flex: 1 }}>
            <div
              className="font-display flex items-center justify-center rounded-full mb-[2vh]"
              style={{
                width: "8vw",
                height: "8vw",
                fontSize: "4vw",
                fontWeight: 700,
                color: "#0b1624",
                background: "linear-gradient(135deg, #00b4d8, #0077b6)",
              }}
            >
              1
            </div>
            <div
              className="font-display mb-[1vh]"
              style={{ fontSize: "2.2vw", color: "#e2ecf5", fontWeight: 600 }}
            >
              Convert
            </div>
            <div
              className="font-body"
              style={{ fontSize: "1.5vw", color: "#7a9ab8", fontWeight: 300, lineHeight: 1.6, maxWidth: "18vw" }}
            >
              Use the free ODA File Converter to convert DWG files to DXF format.
            </div>
          </div>
          <div
            className="shrink-0"
            style={{
              width: "6vw",
              height: "0.2vh",
              background: "linear-gradient(to right, #0077b6, #00b4d8)",
              position: "relative",
              top: "-3vh",
            }}
          />
          <div
            className="shrink-0 font-display"
            style={{ fontSize: "2vw", color: "#00b4d8", position: "relative", top: "-3vh" }}
          >
            &rsaquo;
          </div>
          <div className="flex flex-col items-center text-center" style={{ flex: 1 }}>
            <div
              className="font-display flex items-center justify-center rounded-full mb-[2vh]"
              style={{
                width: "8vw",
                height: "8vw",
                fontSize: "4vw",
                fontWeight: 700,
                color: "#0b1624",
                background: "linear-gradient(135deg, #00b4d8, #0077b6)",
              }}
            >
              2
            </div>
            <div
              className="font-display mb-[1vh]"
              style={{ fontSize: "2.2vw", color: "#e2ecf5", fontWeight: 600 }}
            >
              Drop or Select
            </div>
            <div
              className="font-body"
              style={{ fontSize: "1.5vw", color: "#7a9ab8", fontWeight: 300, lineHeight: 1.6, maxWidth: "18vw" }}
            >
              Drag-drop DXF files or select an entire folder — batch processing included.
            </div>
          </div>
          <div
            className="shrink-0"
            style={{
              width: "6vw",
              height: "0.2vh",
              background: "linear-gradient(to right, #0077b6, #00b4d8)",
              position: "relative",
              top: "-3vh",
            }}
          />
          <div
            className="shrink-0 font-display"
            style={{ fontSize: "2vw", color: "#00b4d8", position: "relative", top: "-3vh" }}
          >
            &rsaquo;
          </div>
          <div className="flex flex-col items-center text-center" style={{ flex: 1 }}>
            <div
              className="font-display flex items-center justify-center rounded-full mb-[2vh]"
              style={{
                width: "8vw",
                height: "8vw",
                fontSize: "4vw",
                fontWeight: 700,
                color: "#0b1624",
                background: "linear-gradient(135deg, #2dc653, #1a8a3a)",
              }}
            >
              3
            </div>
            <div
              className="font-display mb-[1vh]"
              style={{ fontSize: "2.2vw", color: "#e2ecf5", fontWeight: 600 }}
            >
              Download Excel
            </div>
            <div
              className="font-body"
              style={{ fontSize: "1.5vw", color: "#7a9ab8", fontWeight: 300, lineHeight: 1.6, maxWidth: "18vw" }}
            >
              Two structured workbooks ready for engineering review and project delivery.
            </div>
          </div>
        </div>
        <div
          className="mt-[5vh] rounded-2xl px-[3vw] py-[2vh] text-center"
          style={{ background: "rgba(0,180,216,0.10)", border: "1px solid rgba(0,180,216,0.25)" }}
        >
          <div className="font-body" style={{ fontSize: "1.6vw", color: "#a8c8e0" }}>
            Works in Chrome and Edge — no installation required. Runs entirely in the browser.
          </div>
        </div>
      </div>
    </div>
  );
}
