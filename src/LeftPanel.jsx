import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { TIMES, MODES, selFull, fetchScenes } from "./constants.js";

function LocItem({ loc, allLocs, collapsedGroups, toggleGroup, onSelect, depth = 0 }) {
  const children = allLocs.filter(l => l.parent_id === loc.id);
  const hasChildren = children.length > 0;
  const isCollapsed = !!collapsedGroups[loc.id];
  const indent = 12 + depth * 14;

  if (!hasChildren) {
    return (
      <div
        style={{ padding:`6px 12px 6px ${indent}px`, fontSize:12, cursor:"pointer", fontFamily:"sans-serif", color:"#1a2a3a" }}
        onMouseEnter={e => e.currentTarget.style.background="rgba(0,0,0,0.05)"}
        onMouseLeave={e => e.currentTarget.style.background="transparent"}
        onClick={() => onSelect(loc)}>
        {loc.name}
      </div>
    );
  }

  return (
    <div>
      <div
        style={{ padding:`8px 12px 4px ${indent}px`, fontSize: 13 - depth, fontWeight:600, color:"#444", fontFamily:"sans-serif", cursor:"pointer", display:"flex", alignItems:"center", gap:6, userSelect:"none", borderTop: depth === 0 ? "1px solid rgba(0,0,0,0.06)" : "none" }}
        onMouseEnter={e => e.currentTarget.style.background="rgba(0,0,0,0.04)"}
        onMouseLeave={e => e.currentTarget.style.background="transparent"}
        onClick={() => onSelect(loc)}>
        <span style={{ fontSize:10, flexShrink:0, padding:"0 4px" }}
          onClick={e => { e.stopPropagation(); toggleGroup(loc.id); }}>
          {isCollapsed ? "›" : "▾"}
        </span>
        <span>{loc.name}</span>
      </div>
      {!isCollapsed && children.map(child => (
        <LocItem key={child.id} loc={child} allLocs={allLocs}
          collapsedGroups={collapsedGroups} toggleGroup={toggleGroup}
          onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function LeftPanel({
  leftPanelRef, allLocs,
  location, setLocation, locationId, setLocationId,
  mode, setMode, timeOfDay, setTimeOfDay, chapters, selCh, selSc,
  phase, charRef, openCharDrop, loadChapter, scenes, proseRef, directiveRef,
  onOpenImport,
}) {
  const [showLocDrop, setShowLocDrop] = useState(false);
  const [locDropPos, setLocDropPos]   = useState(null);
  const locBtnRef  = useRef(null);
  const locDropRef = useRef(null);

  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem("locDropCollapsed") || "{}"); } catch { return {}; }
  });
  const toggleGroup = name => setCollapsedGroups(prev => {
    const next = { ...prev, [name]: !prev[name] };
    localStorage.setItem("locDropCollapsed", JSON.stringify(next));
    return next;
  });

  // Close on outside click
  useEffect(() => {
    if (!showLocDrop) return;
    const h = e => {
      if (locDropRef.current && !locDropRef.current.contains(e.target) &&
          locBtnRef.current && !locBtnRef.current.contains(e.target))
        setShowLocDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showLocDrop]);

  const openLocDrop = () => {
    const r = locBtnRef.current.getBoundingClientRect();
    setLocDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    setShowLocDrop(p => !p);
  };

  const topLevel = allLocs.filter(l => !l.parent_id);
  const handleLocSelect = loc => { setLocation(loc.name); setLocationId(loc.id); setShowLocDrop(false); };

  const locDropdown = showLocDrop ? createPortal(
    <div ref={locDropRef} style={{ position:"fixed", top: locDropPos?.top ?? 0, left: locDropPos?.left ?? 0, width: locDropPos?.width ?? 204, zIndex:9999, background:"#ffffff", border:"1px solid rgba(0,0,0,0.15)", borderRadius:6, boxShadow:"0 4px 20px rgba(0,0,0,0.15)", maxHeight: Math.min(400, window.innerHeight - (locDropPos?.top ?? 0) - 8), overflowY:"auto" }}>
      {topLevel.map(loc => (
        <LocItem key={loc.id} loc={loc} allLocs={allLocs}
          collapsedGroups={collapsedGroups} toggleGroup={toggleGroup}
          onSelect={handleLocSelect} depth={0} />
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={leftPanelRef} style={{ width:220, flexShrink:0, background:"#f5f2ec", borderRight:"1px solid rgba(0,0,0,0.12)", display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>

      {/* codex link + write button */}
      <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid rgba(0,0,0,0.12)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", gap:8 }}>
          <Link to="/codex" style={{ fontSize:11, color:"#8B6914", fontFamily:"sans-serif", textDecoration:"none", letterSpacing:"0.04em", padding:"5px 4px", cursor:"pointer" }}>← Codex</Link>
          <Link to="/map" style={{ fontSize:11, color:"#8B6914", fontFamily:"sans-serif", textDecoration:"none", letterSpacing:"0.04em", padding:"5px 4px", cursor:"pointer" }}>Map</Link>
        </div>
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
          style={{ fontSize:11, color:"#8B6914", fontFamily:"sans-serif", background:"none", border:"none", padding:"5px 4px", cursor:"pointer", letterSpacing:"0.04em" }}>
          Write →
        </button>
      </div>

      {/* + character */}
      <div ref={charRef} style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid rgba(0,0,0,0.12)" }}>
        <button onClick={openCharDrop} style={{ width:"100%", background:"#ffffff", border:"1px solid rgba(0,0,0,0.18)", borderRadius:4, color:"#1a2a3a", fontSize:12, fontFamily:"sans-serif", cursor:"pointer", padding:"5px 0" }}>
          + character
        </button>
      </div>

      {/* chapter nav */}
      <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid rgba(0,0,0,0.12)" }}>
        <select
          style={{ ...selFull, color:"#1a2a3a" }}
          value={selCh || ""}
          onChange={e => {
            const ch = chapters.find(c => c.id === e.target.value);
            if (ch) loadChapter(ch);
          }}
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
        <button ref={locBtnRef} onClick={openLocDrop}
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

      {/* narrative mode */}
      <div style={{ padding:"8px", flexShrink:0 }}>
        <select
          style={{ ...selFull, color:"#1a2a3a" }}
          value={mode}
          onChange={e => setMode(e.target.value)}
        >
          {MODES.map(m => (
            <option key={m.key} value={m.key} style={{ background:"#ffffff", color:"#000000" }}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* import — pinned to bottom */}
      <div style={{ marginTop:"auto", padding:"6px 8px", borderTop:"1px solid rgba(0,0,0,0.12)", flexShrink:0 }}>
        <button
          onClick={onOpenImport}
          style={{ width:"100%", background:"none", border:"none", color:"#888", fontSize:10, fontFamily:"sans-serif", cursor:"pointer", padding:"4px 2px", letterSpacing:"0.08em", textTransform:"uppercase", textAlign:"center", opacity:0.55 }}
          onMouseEnter={e => { e.currentTarget.style.opacity="1"; e.currentTarget.style.color="#8B6914"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity="0.55"; e.currentTarget.style.color="#888"; }}
        >
          ↑ Pipeline
        </button>
      </div>

      {locDropdown}
    </div>
  );
}
