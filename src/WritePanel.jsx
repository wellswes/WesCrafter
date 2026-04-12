const TEXT = { fontSize:13, fontFamily:"sans-serif", lineHeight:1.6, padding:"6px 10px", textAlign:"left" };

export default function WritePanel({ directive, setDirective, generate, generating, taRef, directiveRef, wordCount }) {
  return (
    <div style={{ flexShrink:0, background:"#f0ece4", borderTop:"1px solid rgba(0,0,0,0.12)", padding:"4px 8px", display:"flex", gap:8, alignItems:"flex-end" }}>

      {/* Input wrapper */}
      <div style={{ flex:1, position:"relative", background:"#ffffff", border:"1px solid rgba(0,0,0,0.18)", borderRadius:4, minHeight:34, maxHeight:120, overflow:"hidden" }}>

        {/* Placeholder shown when empty */}
        {!directive && (
          <div style={{ position:"absolute", top:0, left:0, pointerEvents:"none", color:"rgba(0,0,0,0.32)", userSelect:"none", ...TEXT }}>
            Write a directive…
          </div>
        )}

        <textarea
          ref={el => { taRef.current = el; directiveRef.current = el; }}
          rows={1}
          value={directive}
          onChange={e => setDirective(e.target.value)}
          onInput={e => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
          style={{
            position:"relative", display:"block", width:"100%", boxSizing:"border-box",
            margin:0,
            background:"transparent",
            color:"#1a2a3a",
            border:"none",
            appearance:"none", WebkitAppearance:"none",
            resize:"none", outline:"none",
            minHeight:34, maxHeight:120, overflow:"hidden",
            ...TEXT,
          }}
        />
      </div>

      <button
        onClick={generate}
        disabled={!directive.trim() || generating}
        style={{ flexShrink:0, background: directive.trim() && !generating ? "var(--gold2)" : "var(--bg4)", border:`1px solid ${directive.trim() && !generating ? "var(--gold)" : "var(--border2)"}`, borderRadius:4, color: directive.trim() && !generating ? "#1a1410" : "var(--text4)", fontSize:12, fontFamily:"sans-serif", padding:"6px 14px", cursor: directive.trim() && !generating ? "pointer" : "not-allowed", opacity: generating ? 0.7 : 1, minWidth:80, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
        {generating ? <><span className="spin" />&nbsp;Generating</> : "Generate"}
      </button>

      {wordCount > 0 && (
        <span style={{ flexShrink:0, fontSize:10, fontFamily:"sans-serif", color:"#8a7a6a", letterSpacing:"0.03em", alignSelf:"center" }}>
          {wordCount >= 1000 ? `${Math.round(wordCount / 1000)}k` : wordCount}w
        </span>
      )}
    </div>
  );
}
