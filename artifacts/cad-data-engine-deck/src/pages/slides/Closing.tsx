const base = import.meta.env.BASE_URL;

export default function Closing() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0b1624" }}>
      <img
        src={`${base}hero.png`}
        crossOrigin="anonymous"
        alt="Engineering workspace"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.2 }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(11,22,36,0.95) 0%, rgba(11,22,36,0.80) 50%, rgba(0,55,100,0.75) 100%)",
        }}
      />
      <div
        className="absolute left-0 top-0 bottom-0 w-[0.5vw]"
        style={{ background: "linear-gradient(to bottom, #00b4d8, #0077b6)" }}
      />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-[8vw] py-[8vh] text-center">
        <div
          className="w-[7vw] h-[7vw] rounded-2xl flex items-center justify-center mb-[3vh]"
          style={{ background: "linear-gradient(135deg, #0077b6, #023e8a)", boxShadow: "0 0 40px rgba(0,119,182,0.4)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#00b4d8" strokeWidth="1.8" className="w-[55%] h-[55%]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <div
          className="font-display tracking-tight mb-[1.5vh]"
          style={{ fontSize: "6vw", fontWeight: 700, color: "#e2ecf5" }}
        >
          CAD Data Engine
        </div>
        <div
          className="font-body mb-[4vh]"
          style={{ fontSize: "2vw", color: "#00b4d8", fontWeight: 300 }}
        >
          Precision. Automation. Engineering-Grade Output.
        </div>
        <div
          className="w-[20vw] h-[0.2vh] mb-[4vh]"
          style={{ background: "linear-gradient(to right, transparent, #00b4d8, transparent)" }}
        />
        <div
          className="font-display mb-[0.5vh]"
          style={{ fontSize: "2.5vw", color: "#e2ecf5", fontWeight: 600 }}
        >
          Gaurav Bharti
        </div>
        <div
          className="font-body mb-[4vh]"
          style={{ fontSize: "1.7vw", color: "#7a9ab8", fontWeight: 300, letterSpacing: "0.08em" }}
        >
          Sr. Process Designer
        </div>
        <div
          className="font-body"
          style={{ fontSize: "1.3vw", color: "#3a5a78", letterSpacing: "0.05em" }}
        >
          © 2026 Gaurav Bharti (G. Bharti) — Proprietary Software. All rights reserved.
        </div>
      </div>
    </div>
  );
}
