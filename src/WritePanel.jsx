export default function WritePanel({ directive, setDirective, generate, generating, pendingProse, setPendingProse, acceptProse, selSc, taRef, directiveRef }) {
  return (
    <>
      {(generating || (pendingProse && pendingProse.sceneId === selSc)) && (
        <div style={{ marginTop:32, borderTop:"1px solid var(--border)", paddingTop:24 }}>
          {generating && !pendingProse
            ? <div style={{ display:"flex", alignItems:"center", gap:10, color:"var(--text4)", fontFamily:"sans-serif", fontSize:13, fontStyle:"italic" }}>
                <span className="spin" /> Generating…
              </div>
            : <>
                <div style={{ fontSize:16, lineHeight:2.0, color:"#c8c0b0", fontFamily:"Georgia, serif", whiteSpace:"pre-wrap", textAlign:"left", opacity:0.85 }}>
                  {pendingProse.prose}
                </div>
                <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"flex-end" }}>
                  <button
                    onClick={() => setPendingProse(null)}
                    style={{ background:"none", border:"1px solid #552222", borderRadius:4, color:"#cc6666", fontSize:12, fontFamily:"sans-serif", padding:"6px 16px", cursor:"pointer" }}>
                    Discard
                  </button>
                  <button
                    disabled={generating}
                    onClick={generate}
                    style={{ background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text3)", fontSize:12, fontFamily:"sans-serif", padding:"6px 16px", cursor: generating ? "not-allowed" : "pointer", opacity: generating ? 0.5 : 1 }}>
                    Regenerate
                  </button>
                  <button
                    disabled={generating}
                    onClick={acceptProse}
                    style={{ background:"var(--gold2)", border:"1px solid var(--gold)", borderRadius:4, color:"#1a1410", fontSize:12, fontFamily:"sans-serif", padding:"6px 20px", cursor: generating ? "not-allowed" : "pointer", fontWeight:"bold", opacity: generating ? 0.5 : 1 }}>
                    Accept
                  </button>
                </div>
              </>
          }
        </div>
      )}
      <div style={{ flexShrink:0, background:"var(--bg3)", borderTop:"1px solid var(--border)", padding:"10px 16px", display:"flex", gap:10, alignItems:"flex-end" }}>
        <textarea ref={el => { taRef.current = el; directiveRef.current = el; }} placeholder="Write a directive…" rows={1}
          value={directive}
          onChange={e => setDirective(e.target.value)}
          onInput={e => { e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight, 120)+"px"; }}
          onKeyDown={e => { if (e.key==="Enter" && (e.metaKey||e.ctrlKey)) generate(); }}
          style={{ flex:1, background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text)", fontSize:13, fontFamily:"sans-serif", lineHeight:1.6, padding:"6px 10px", resize:"none", outline:"none", minHeight:34, maxHeight:120, overflow:"auto" }} />
        <button
          onClick={generate}
          disabled={!directive.trim() || generating}
          style={{ flexShrink:0, background: directive.trim() && !generating ? "var(--gold2)" : "var(--bg4)", border:`1px solid ${directive.trim() && !generating ? "var(--gold)" : "var(--border2)"}`, borderRadius:4, color: directive.trim() && !generating ? "#1a1410" : "var(--text4)", fontSize:12, fontFamily:"sans-serif", padding:"6px 14px", cursor: directive.trim() && !generating ? "pointer" : "not-allowed", opacity: generating ? 0.7 : 1, minWidth:80, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          {generating ? <><span className="spin" />&nbsp;Generating</> : "Generate"}
        </button>
      </div>
    </>
  );
}
