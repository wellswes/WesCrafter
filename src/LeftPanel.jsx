import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { TIMES, MODES, WEATHERS, SEASONS, selFull, fetchScenes } from "./constants.js";

// ── Shared flyout constants ───────────────────────────────────────────────────
const COL_W   = 168;
const GOLD    = "#8B6914";
const GOLD_BG = "rgba(139,105,20,0.09)";
const ITEM_H  = 31;

// ── CascadeLoc ────────────────────────────────────────────────────────────────
function CascadeLoc({ allLocs, locationId, onSelect, onClose, anchorRef }) {
  const [hoveredPath, setHoveredPath] = useState([]);
  const menuRef = useRef(null);

  const valdris      = allLocs.find(l => l.place_type === "continent");
  const coastalReach = valdris ? allLocs.find(l => l.parent_id === valdris.id) : null;
  const rootParentId = coastalReach?.id ?? (valdris?.id ?? null);

  const childrenOf = id => allLocs.filter(l => l.parent_id === id);

  const columns = [childrenOf(rootParentId)];
  for (let i = 0; i < hoveredPath.length; i++) {
    const kids = childrenOf(hoveredPath[i].id);
    if (!kids.length) break;
    columns.push(kids);
  }

  const colTop = (colIdx, itemCount) => {
    const rawTop = colIdx === 0
      ? (anchorRef.current?.getBoundingClientRect().top ?? 100)
      : (hoveredPath[colIdx - 1]?.y ?? 100);
    const estH = Math.min(360, itemCount * ITEM_H + 8);
    return Math.max(8, Math.min(rawTop, window.innerHeight - estH - 8));
  };

  const anchorLeft = anchorRef.current
    ? anchorRef.current.getBoundingClientRect().right + 3
    : 223;

  useEffect(() => {
    const h = e => {
      if (menuRef.current   && menuRef.current.contains(e.target))   return;
      if (anchorRef.current && anchorRef.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div ref={menuRef} style={{ position:"fixed", inset:0, zIndex:9999, pointerEvents:"none" }}>
      {columns.map((items, colIdx) => {
        const top  = colTop(colIdx, items.length);
        const maxH = window.innerHeight - top - 8;
        const left = anchorLeft + colIdx * (COL_W + 2);
        return (
          <div key={colIdx} style={{
            position:"absolute", top, left,
            width:COL_W, background:"#fff",
            border:"1px solid rgba(0,0,0,0.15)", borderRadius:4,
            boxShadow:"0 4px 16px rgba(0,0,0,0.13)",
            maxHeight:maxH, overflowY:"auto",
            pointerEvents:"auto",
          }}>
            {items.map(loc => {
              const hasKids = allLocs.some(l => l.parent_id === loc.id);
              const active  = hoveredPath[colIdx]?.id === loc.id;
              const sel     = loc.id === locationId;
              return (
                <div key={loc.id}
                  onMouseEnter={e => {
                    const y = e.currentTarget.getBoundingClientRect().top;
                    setHoveredPath(p => [...p.slice(0, colIdx), { id: loc.id, y }]);
                  }}
                  onClick={e => { e.stopPropagation(); onSelect(loc); }}
                  style={{ display:"flex", alignItems:"center", padding:"6px 8px 6px 10px", gap:4,
                    fontSize:12, fontFamily:"sans-serif", cursor:"pointer", userSelect:"none",
                    color: (active || sel) ? GOLD : "#1a2a3a",
                    background: active ? GOLD_BG : "transparent",
                    fontWeight: sel ? 600 : 400 }}>
                  <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{loc.name}</span>
                  {hasKids && <span style={{ fontSize:10, color: active ? GOLD : "#aaa", flexShrink:0 }}>›</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>,
    document.body
  );
}

// ── CascadeCharPicker ─────────────────────────────────────────────────────────
// Two-column cascading flyout: groups → characters.
// Clicking a character adds them but keeps the flyout open.
// Close on outside click or Escape.
function CascadeCharPicker({ allChars, allGroups, sceneChars, addChar, onClose, anchorRef }) {
  const [hoveredGroup, setHoveredGroup] = useState(null); // { name, y }
  const menuRef = useRef(null);

  // Escape to close
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // Outside click to close
  useEffect(() => {
    const h = e => {
      if (menuRef.current   && menuRef.current.contains(e.target))   return;
      if (anchorRef.current && anchorRef.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groupNames = new Set(allGroups.map(g => g.name));
  const groupItems = [
    ...allGroups
      .map(g => ({ name: g.name, link_color: g.link_color, chars: allChars.filter(c => c.character_group === g.name) }))
      .filter(g => g.chars.length > 0),
    ...(allChars.filter(c => !groupNames.has(c.character_group)).length
      ? [{ name: "Other", link_color: "#7a6e62", chars: allChars.filter(c => !groupNames.has(c.character_group)) }]
      : []),
  ];

  const anchorRight = anchorRef.current
    ? anchorRef.current.getBoundingClientRect().right + 3
    : 223;

  const col0Top = () => {
    const rawTop = anchorRef.current?.getBoundingClientRect().top ?? 100;
    const estH = Math.min(360, groupItems.length * ITEM_H + 8);
    return Math.max(8, Math.min(rawTop, window.innerHeight - estH - 8));
  };

  const charsForHovered = hoveredGroup
    ? (groupItems.find(g => g.name === hoveredGroup.name)?.chars ?? [])
    : [];

  const col1Top = () => {
    const rawTop = hoveredGroup?.y ?? 100;
    const estH = Math.min(480, charsForHovered.length * ITEM_H + 8);
    return Math.max(8, Math.min(rawTop, window.innerHeight - estH - 8));
  };

  const isActive = c => !!sceneChars.find(x => x.id === c.id);

  const t0 = col0Top();
  const t1 = col1Top();

  return createPortal(
    <div ref={menuRef} style={{ position:"fixed", inset:0, zIndex:9999, pointerEvents:"none" }}>

      {/* Column 0: groups */}
      <div style={{
        position:"absolute", top:t0, left:anchorRight,
        width:COL_W, background:"#fff",
        border:"1px solid rgba(0,0,0,0.15)", borderRadius:4,
        boxShadow:"0 4px 16px rgba(0,0,0,0.13)",
        maxHeight:window.innerHeight - t0 - 8, overflowY:"auto",
        pointerEvents:"auto",
      }}>
        {groupItems.map(g => {
          const hovered = hoveredGroup?.name === g.name;
          return (
            <div key={g.name}
              onMouseEnter={e => {
                const y = e.currentTarget.getBoundingClientRect().top;
                setHoveredGroup({ name: g.name, y });
              }}
              style={{ display:"flex", alignItems:"center", padding:"6px 8px 6px 10px", gap:4,
                fontSize:12, fontFamily:"sans-serif", cursor:"pointer", userSelect:"none",
                color: hovered ? GOLD : "#1a2a3a",
                background: hovered ? GOLD_BG : "transparent" }}>
              <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.name}</span>
              <span style={{ fontSize:10, color: hovered ? GOLD : "#aaa", flexShrink:0 }}>›</span>
            </div>
          );
        })}
      </div>

      {/* Column 1: characters in hovered group */}
      {hoveredGroup && charsForHovered.length > 0 && (
        <div style={{
          position:"absolute", top:t1, left:anchorRight + COL_W + 2,
          width:COL_W + 20, background:"#fff",
          border:"1px solid rgba(0,0,0,0.15)", borderRadius:4,
          boxShadow:"0 4px 16px rgba(0,0,0,0.13)",
          maxHeight:window.innerHeight - t1 - 8, overflowY:"auto",
          pointerEvents:"auto",
        }}>
          {charsForHovered.map(c => {
            const active = isActive(c);
            const color  = c.link_color || "#7a6e62";
            return (
              <div key={c.id}
                onClick={() => { if (!active) addChar(c); }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = GOLD_BG; }}
                onMouseLeave={e => { e.currentTarget.style.background = active ? "rgba(139,105,20,0.05)" : "transparent"; }}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 8px 5px 10px",
                  fontSize:12, fontFamily:"sans-serif", userSelect:"none",
                  cursor: active ? "default" : "pointer",
                  background: active ? "rgba(139,105,20,0.05)" : "transparent" }}>
                {c.portrait_url
                  ? <img src={c.portrait_url} style={{ width:18, height:18, borderRadius:"50%", objectFit:"cover", border:`1px solid ${color}`, flexShrink:0 }} alt={c.name} />
                  : <div style={{ width:18, height:18, borderRadius:"50%", background:color+"22", border:`1px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color, fontFamily:"sans-serif", flexShrink:0 }}>{c.name[0]}</div>
                }
                <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  color: active ? GOLD : color }}>{c.name}</span>
                {active && <span style={{ fontSize:11, color:GOLD, flexShrink:0 }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>,
    document.body
  );
}

// ── LeftPanel ─────────────────────────────────────────────────────────────────
export default function LeftPanel({
  leftPanelRef, allLocs,
  location, setLocation, locationId, setLocationId,
  mode, setMode, timeOfDay, setTimeOfDay, weather, setWeather, season, setSeason,
  chapters, selCh, selSc,
  phase, allChars, allGroups, sceneChars, addChar, loadChapter, scenes, proseRef, directiveRef,
  onOpenImport, onOpenPlan,
}) {
  const [showLocDrop,  setShowLocDrop]  = useState(false);
  const [showCharDrop, setShowCharDrop] = useState(false);
  const locBtnRef  = useRef(null);
  const charBtnRef = useRef(null);

  const handleLocSelect = loc => { setLocation(loc.name); setLocationId(loc.id); setShowLocDrop(false); };

  return (
    <div ref={leftPanelRef} style={{ width:220, flexShrink:0, background:"#f5f2ec", borderRight:"1px solid rgba(0,0,0,0.12)", display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>

      {/* nav: ← Codex | Plan | Write → */}
      <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid rgba(0,0,0,0.12)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <Link to="/codex" style={{ fontSize:13, color:"#8B6914", fontFamily:"sans-serif", textDecoration:"none", letterSpacing:"0.04em", padding:"5px 4px", cursor:"pointer" }}>← Codex</Link>
        <button onClick={onOpenPlan}
          style={{ fontSize:13, color:"#8B6914", fontFamily:"sans-serif", background:"none", border:"none", padding:"5px 4px", cursor:"pointer", letterSpacing:"0.04em" }}>
          Plan
        </button>
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
          style={{ fontSize:13, color:"#8B6914", fontFamily:"sans-serif", background:"none", border:"none", padding:"5px 4px", cursor:"pointer", letterSpacing:"0.04em" }}>
          Write →
        </button>
      </div>

      {/* + character */}
      <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid rgba(0,0,0,0.12)" }}>
        <button ref={charBtnRef} onClick={() => setShowCharDrop(p => !p)}
          style={{ width:"100%", background:"#ffffff", border:"1px solid rgba(0,0,0,0.18)", borderRadius:4,
            color:"#1a2a3a", fontSize:12, fontFamily:"sans-serif", cursor:"pointer", padding:"5px 0",
            display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
          + character
          {sceneChars.length > 0 && (
            <span style={{ fontSize:10, color:GOLD, fontWeight:600 }}>({sceneChars.length})</span>
          )}
        </button>
      </div>

      {/* chapter nav */}
      <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid rgba(0,0,0,0.12)" }}>
        <select
          style={{ ...selFull, color:"#1a2a3a" }}
          value={selCh || ""}
          onChange={e => { const ch = chapters.find(c => c.id === e.target.value); if (ch) loadChapter(ch); }}
          disabled={phase === "loading"}
        >
          {chapters.map(ch => (
            <option key={ch.id} value={ch.id} style={{ background:"#ffffff", color:"#000000" }}>
              {ch.sequence_number}. {ch.title}
            </option>
          ))}
        </select>
      </div>

      {/* location */}
      <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid rgba(0,0,0,0.12)" }}>
        <button ref={locBtnRef} onClick={() => setShowLocDrop(p => !p)}
          style={{ ...selFull, display:"flex", alignItems:"center", justifyContent:"space-between", color:"#1a2a3a", cursor:"pointer", border:"1px solid rgba(0,0,0,0.18)", background:"#ffffff", textAlign:"left" }}>
          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{location || "Select location…"}</span>
          <span style={{ fontSize:9, color:"#888", flexShrink:0, marginLeft:4 }}>▾</span>
        </button>
      </div>

      {/* time of day */}
      <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid rgba(0,0,0,0.12)" }}>
        <select style={{ ...selFull, color:"#1a2a3a" }} value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)}>
          {TIMES.map(t => <option key={t} value={t} style={{ background:"#ffffff", color:"#000000" }}>{t}</option>)}
        </select>
      </div>

      {/* weather */}
      <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid rgba(0,0,0,0.12)" }}>
        <select style={{ ...selFull, color: weather ? "#1a2a3a" : "#888" }} value={weather} onChange={e => setWeather(e.target.value)}>
          <option value="" style={{ background:"#ffffff", color:"#888" }}>Weather…</option>
          {WEATHERS.map(w => <option key={w} value={w} style={{ background:"#ffffff", color:"#000000" }}>{w}</option>)}
        </select>
      </div>

      {/* season */}
      <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid rgba(0,0,0,0.12)" }}>
        <select style={{ ...selFull, color: season ? "#1a2a3a" : "#888" }} value={season} onChange={e => setSeason(e.target.value)}>
          <option value="" style={{ background:"#ffffff", color:"#888" }}>Season…</option>
          {SEASONS.map(s => <option key={s} value={s} style={{ background:"#ffffff", color:"#000000" }}>{s}</option>)}
        </select>
      </div>

      {/* narrative mode */}
      <div style={{ padding:"8px", flexShrink:0 }}>
        <select style={{ ...selFull, color:"#1a2a3a" }} value={mode} onChange={e => setMode(e.target.value)}>
          {MODES.map(m => (
            <option key={m.key} value={m.key} style={{ background:"#ffffff", color:"#000000" }}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* pipeline — pinned to bottom */}
      <div style={{ marginTop:"auto", padding:"6px 8px", borderTop:"1px solid rgba(0,0,0,0.12)", flexShrink:0 }}>
        <button onClick={onOpenImport}
          style={{ width:"100%", background:"none", border:"none", color:"#888", fontSize:10, fontFamily:"sans-serif", cursor:"pointer", padding:"4px 2px", letterSpacing:"0.08em", textTransform:"uppercase", textAlign:"center", opacity:0.55 }}
          onMouseEnter={e => { e.currentTarget.style.opacity="1"; e.currentTarget.style.color="#8B6914"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity="0.55"; e.currentTarget.style.color="#888"; }}>
          ↑ Pipeline
        </button>
      </div>

      {showLocDrop && (
        <CascadeLoc
          allLocs={allLocs}
          locationId={locationId}
          onSelect={handleLocSelect}
          onClose={() => setShowLocDrop(false)}
          anchorRef={locBtnRef}
        />
      )}

      {showCharDrop && (
        <CascadeCharPicker
          allChars={allChars}
          allGroups={allGroups}
          sceneChars={sceneChars}
          addChar={addChar}
          onClose={() => setShowCharDrop(false)}
          anchorRef={charBtnRef}
        />
      )}
    </div>
  );
}
