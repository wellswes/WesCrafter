import { Link } from "react-router-dom";
import { TIMES, MODES, selFull, fullBtn, fetchScenes } from "./constants.js";

export default function LeftPanel({
  leftPanelRef, showLoc, setShowLoc, locStack, setLocStack, visibleLocs, allLocs,
  location, setLocation, locationId, setLocationId, showMode, setShowMode,
  mode, setMode, timeOfDay, setTimeOfDay, chapters, allScenesByChapter, selSc,
  onCombinedSelect, phase, charRef, openCharDrop, loadChapter, scenes, proseRef, directiveRef,
}) {
  const buildStackToParent = (parentId) => {
    const stack = [];
    let current = parentId;
    while (current) {
      stack.unshift(current);
      const place = allLocs.find(l => l.id === current);
      current = place?.parent_id ?? null;
    }
    return stack;
  };

  const openLocPicker = () => {
    const sel = allLocs.find(l => l.id === locationId);
    setLocStack(sel?.parent_id ? buildStackToParent(sel.parent_id) : []);
    setShowLoc(true);
  };

  return (
    <div ref={leftPanelRef} style={{ width:220, flexShrink:0, background:"var(--bg2)", borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>

      {showLoc ? (
        <div style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", zIndex:500, background:"var(--bg)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {locStack.length > 0 && (
            <div
              onClick={() => setLocStack(p => p.slice(0, -1))}
              style={{ padding:"8px 12px", cursor:"pointer", color:"var(--gold)", fontFamily:"sans-serif", fontSize:12, borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              ← Back
            </div>
          )}
          <div style={{ overflowY:"auto", flex:1 }}>
            {visibleLocs.map(l => {
              const kids = allLocs.some(x => x.parent_id === l.id);
              return (
                <div
                  key={l.id}
                  onClick={() => {
                    setLocation(l.name);
                    setLocationId(l.id);
                    if (kids) {
                      setLocStack(p => [...p, l.id]);
                    } else {
                      setShowLoc(false);
                      setLocStack([]);
                    }
                  }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--bg4)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}
                  style={{ padding:"8px 12px", cursor:"pointer", color:"var(--text)", fontFamily:"sans-serif", fontSize:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>{l.name}</span>
                  {kids && <span style={{ color:"var(--text4)" }}>›</span>}
                </div>
              );
            })}
          </div>
        </div>
      ) : showMode ? (
        /* ── inline mode picker ── */
        <>
          <div style={{ padding:"6px 8px", flexShrink:0, borderBottom:"1px solid var(--border)" }}>
            <button
              onClick={() => setShowMode(false)}
              style={{ width:"100%", background:"none", border:"none", color:"var(--text4)", fontSize:11, fontFamily:"sans-serif", cursor:"pointer", textAlign:"left", padding:"3px 2px" }}>
              ✕ Cancel
            </button>
          </div>
          <div style={{ flex:1, overflowY:"auto" }}>
            {MODES.map(m => (
              <div key={m.key}
                style={{ padding:"7px 10px", fontSize:12, cursor:"pointer", fontFamily:"sans-serif", display:"flex", alignItems:"center", gap:8, color: mode===m.key ? m.color : "var(--text)" }}
                onMouseEnter={e => e.currentTarget.style.background="var(--bg4)"}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}
                onClick={() => { setMode(m.key); setShowMode(false); }}>
                <span style={{ width:7, height:7, borderRadius:"50%", flexShrink:0, display:"inline-block", background:m.color }} />
                {m.label}
              </div>
            ))}
          </div>
        </>
      ) : (
        /* ── normal controls ── */
        <>
          {/* codex link + write button */}
          <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <Link to="/codex" style={{ fontSize:11, color:"var(--gold2)", fontFamily:"sans-serif", textDecoration:"none", letterSpacing:"0.04em", padding:"5px 4px", cursor:"pointer" }}>← Codex</Link>
            <button
              onClick={async () => {
                if (!chapters.length) return;
                const lastCh = chapters[chapters.length - 1];
                const scs = await fetchScenes(lastCh.id);
                const lastSc = scs[scs.length - 1];
                await loadChapter(lastCh, lastSc?.id);
                setTimeout(() => proseRef.current?.scrollTo({ top: proseRef.current.scrollHeight, behavior:"smooth" }), 200);
                setTimeout(() => directiveRef.current?.focus(), 300);
              }}
              style={{ fontSize:11, color:"var(--gold)", fontFamily:"sans-serif", background:"none", border:"none", padding:"5px 4px", cursor:"pointer", letterSpacing:"0.04em" }}>
              Write →
            </button>
          </div>

          {/* + character */}
          <div ref={charRef} style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid var(--border)" }}>
            <button onClick={openCharDrop} style={{ width:"100%", background:"none", border:"1px dashed var(--border2)", borderRadius:4, color:"var(--text4)", fontSize:11, fontFamily:"sans-serif", cursor:"pointer", padding:"5px 0" }}>
              + character
            </button>
          </div>

          {/* combined chapter + scene nav */}
          <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid var(--border)" }}>
            <select style={{ ...selFull, color:"var(--gold)" }} value={selSc||""} onChange={onCombinedSelect} disabled={phase==="loading"}>
              {chapters.map(ch => (
                <optgroup key={ch.id} label={`${ch.sequence_number}. ${ch.title.toUpperCase()}`}>
                  {(allScenesByChapter[ch.id] || []).map(s => (
                    <option key={s.id} value={s.id} style={{ color:"var(--text)", paddingLeft:8 }}>
                      {"\u00a0\u00a0"}{s.sequence_number}. {s.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* location + time */}
          <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:6 }}>
            <button style={fullBtn} onClick={openLocPicker}>
              <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{location}</span>
              <span style={{ fontSize:9, color:"var(--text4)", flexShrink:0 }}>▾</span>
            </button>
            <select style={selFull} value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)}>
              {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* mode */}
          <div style={{ padding:"8px", flexShrink:0 }}>
            {(() => {
              const m = MODES.find(m => m.key === mode) || MODES[0];
              return (
                <button style={fullBtn} onClick={() => setShowMode(true)}>
                  <span style={{ display:"flex", alignItems:"center", gap:7, overflow:"hidden" }}>
                    <span style={{ width:7, height:7, borderRadius:"50%", flexShrink:0, display:"inline-block", background:m.color }} />
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:m.color }}>{m.label}</span>
                  </span>
                  <span style={{ fontSize:9, color:"var(--text4)", flexShrink:0 }}>▾</span>
                </button>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
