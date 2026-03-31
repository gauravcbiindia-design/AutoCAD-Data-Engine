export default function TheSolution() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0b1624" }}>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(0,180,216,0.12) 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute left-0 top-0 bottom-0 w-[0.5vw]"
        style={{ background: "linear-gradient(to bottom, #00b4d8, #0077b6)" }}
      />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-[8vw] py-[7vh] text-center">
        <div
          className="font-body tracking-[0.2em] uppercase mb-[2vh]"
          style={{ fontSize: "1.2vw", color: "#00b4d8", fontWeight: 500 }}
        >
          Introducing
        </div>
        <div
          className="font-display tracking-tight mb-[1.5vh]"
          style={{ fontSize: "6.5vw", fontWeight: 700, color: "#e2ecf5", lineHeight: 1.05 }}
        >
          CAD Data Engine
        </div>
        <div
          className="font-body mb-[5vh]"
          style={{ fontSize: "2vw", color: "#00b4d8", fontWeight: 300, maxWidth: "65vw" }}
        >
          One tool. All drawings. Structured engineering data — in seconds.
        </div>
        <div className="grid grid-cols-3 gap-[2.5vw]" style={{ width: "78vw" }}>
          <div
            className="rounded-2xl px-[2vw] py-[3vh] text-left"
            style={{ background: "rgba(0,119,182,0.15)", border: "1px solid rgba(0,180,216,0.25)" }}
          >
            <div
              className="font-display mb-[1vh]"
              style={{ fontSize: "3vw", color: "#2dc653", fontWeight: 700 }}
            >
              Batch
            </div>
            <div className="font-body" style={{ fontSize: "1.5vw", color: "#a8c8e0", fontWeight: 300, lineHeight: 1.5 }}>
              Process dozens of DXF files in one operation — no file-by-file clicking.
            </div>
          </div>
          <div
            className="rounded-2xl px-[2vw] py-[3vh] text-left"
            style={{ background: "rgba(0,119,182,0.15)", border: "1px solid rgba(0,180,216,0.25)" }}
          >
            <div
              className="font-display mb-[1vh]"
              style={{ fontSize: "3vw", color: "#2dc653", fontWeight: 700 }}
            >
              Classify
            </div>
            <div className="font-body" style={{ fontSize: "1.5vw", color: "#a8c8e0", fontWeight: 300, lineHeight: 1.5 }}>
              Every entity auto-sorted into 5 engineering categories — no guesswork.
            </div>
          </div>
          <div
            className="rounded-2xl px-[2vw] py-[3vh] text-left"
            style={{ background: "rgba(0,119,182,0.15)", border: "1px solid rgba(0,180,216,0.25)" }}
          >
            <div
              className="font-display mb-[1vh]"
              style={{ fontSize: "3vw", color: "#2dc653", fontWeight: 700 }}
            >
              Export
            </div>
            <div className="font-body" style={{ fontSize: "1.5vw", color: "#a8c8e0", fontWeight: 300, lineHeight: 1.5 }}>
              Two structured Excel workbooks, ready for engineering review and handover.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
