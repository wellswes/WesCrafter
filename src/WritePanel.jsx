export default function WritePanel({ directive, setDirective, generate, generating, taRef, directiveRef }) {
  return (
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
  );
}
