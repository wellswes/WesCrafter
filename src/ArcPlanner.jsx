import { useState, useEffect, useRef } from "react";
import { supabase, STORY_ID, WORLD_ID, selFull } from "./constants.js";

// ── Design tokens — exact write page values ───────────────────────────────
const A    = "#8B6914";               // amber accent
const BG_L = "#f5f2ec";               // sidebar / panel bg
const BG_C = "#ffffff";               // content bg
const TXT  = "#1a2a3a";               // primary text
const TXT2 = "#444";                  // secondary text
const TXT3 = "#888";                  // muted text
const BDR  = "rgba(0,0,0,0.12)";      // section divider
const BDR2 = "rgba(0,0,0,0.18)";      // control border
const FF   = "sans-serif";

// Status palette — all work on light bg
const ST = {
  waiting:    { color:"#888",    bg:"#88888810", bdr:"#88888840" },
  available:  { color:A,         bg:"#8B691410", bdr:"#8B691440" },
  in_chapter: { color:"#2a6a94", bg:"#2a6a9410", bdr:"#2a6a9440" },
  complete:   { color:"#3a7a4a", bg:"#3a7a4a10", bdr:"#3a7a4a40" },
};
const DEP_LABEL = { sequenced:"SEQ", cross_arc:"X-ARC", float:"FLOAT" };

function arcColor(arc, chars, groups) {
  if (arc.character_ids?.length) {
    const ch = chars.find(c => c.id === arc.character_ids[0]);
    if (ch?.group_id) { const g = groups.find(g => g.id === ch.group_id); if (g?.link_color) return g.link_color; }
    if (ch?.link_color) return ch.link_color;
  }
  return arc.color || TXT3;
}

// Small reusable badge
function Badge({ color, children }) {
  return (
    <span style={{ display:"inline-block", fontSize:9, letterSpacing:"0.05em", padding:"1px 5px", borderRadius:3,
      background: color + "18", color, border:`1px solid ${color}44`, marginRight:3, fontFamily:FF }}>
      {children}
    </span>
  );
}

// Character chip
function CharChip({ char, groups }) {
  const g = char.group_id ? groups.find(x => x.id === char.group_id) : null;
  const col = g?.link_color || char.link_color || TXT3;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 6px", borderRadius:10, fontSize:10,
      background:col+"15", border:`1px solid ${col}40`, color:col, marginRight:3, marginBottom:2, fontFamily:FF }}>
      {char.portrait_url
        ? <img src={char.portrait_url} style={{ width:11, height:11, borderRadius:"50%", objectFit:"cover" }} alt="" />
        : <span style={{ fontSize:9 }}>{char.name[0]}</span>}
      {char.name}
    </span>
  );
}

// ── Section label (matches panelLbl from constants) ───────────────────────
const Lbl = ({ children }) => (
  <div style={{ fontSize:10, color:TXT3, fontFamily:FF, letterSpacing:"0.1em", textTransform:"uppercase",
    marginBottom:4, marginTop:12 }}>{children}</div>
);

// ── Control button (matches write page "+ character" button) ──────────────
const CtlBtn = ({ onClick, children, style }) => (
  <button onClick={onClick}
    style={{ width:"100%", background:BG_C, border:`1px solid ${BDR2}`, borderRadius:4, color:TXT,
      fontSize:12, fontFamily:FF, cursor:"pointer", padding:"5px 8px", textAlign:"left", ...style }}>
    {children}
  </button>
);

export default function ArcPlanner() {
  const [arcs,     setArcs]     = useState([]);
  const [beats,    setBeats]    = useState([]);
  const [deps,     setDeps]     = useState([]);
  const [chars,    setChars]    = useState([]);
  const [groups,   setGroups]   = useState([]);
  const [chapters, setChapters] = useState([]);
  const [lore,     setLore]     = useState([]);

  const [selChapId, setSelChapId] = useState(null);
  const [events,    setEvents]    = useState([]);
  const [evChars,   setEvChars]   = useState([]);
  const [evLore,    setEvLore]    = useState([]);

  const [sideTab,   setSideTab]   = useState("arcs");
  const [collapsed, setCollapsed] = useState({});
  const [showDone,  setShowDone]  = useState(false);
  const [detail,    setDetail]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [editField, setEditField] = useState(null);

  const [chapterPlanText,  setChapterPlanText]  = useState("");
  const [planFocused,      setPlanFocused]      = useState(false);
  const [incompleteWarn,   setIncompleteWarn]   = useState(null);
  const planRef = useRef(null);

  const [drag,    setDrag]    = useState(null);
  const [dropOn,  setDropOn]  = useState(null);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [
        { data: arcsD }, { data: charsD }, { data: groupsD },
        { data: chapsD }, { data: loreD },
      ] = await Promise.all([
        supabase.from("arcs").select("*").eq("story_id", STORY_ID).order("sort_order"),
        supabase.from("characters").select("id,name,portrait_url,group_id,link_color").order("name"),
        supabase.from("character_groups").select("id,name,link_color"),
        supabase.from("chapters").select("id,title,sequence_number,status,chapter_plan").eq("story_id", STORY_ID).order("sequence_number"),
        supabase.from("lore_entries").select("id,title,category,tags,body_text").eq("world_id", WORLD_ID),
      ]);
      setArcs(arcsD || []); setChars(charsD || []); setGroups(groupsD || []);
      setChapters(chapsD || []); setLore(loreD || []);
      const arcIds = (arcsD || []).map(a => a.id);
      if (arcIds.length) {
        const [{ data: beatsD }, { data: depsD }] = await Promise.all([
          supabase.from("arc_beats").select("*").in("arc_id", arcIds).order("sort_order"),
          supabase.from("beat_dependencies").select("*"),
        ]);
        setBeats(beatsD || []); setDeps(depsD || []);
      }
      setLoading(false);
      const def = (chapsD || []).at(-1);
      if (def) setSelChapId(def.id);
    })();
  }, []);

  useEffect(() => {
    const chap = chapters.find(c => c.id === selChapId);
    setChapterPlanText(chap?.chapter_plan || "");
    setPlanFocused(false);
  }, [selChapId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!planRef.current) return;
    planRef.current.style.height = "auto";
    planRef.current.style.height = planRef.current.scrollHeight + "px";
  }, [chapterPlanText, planFocused]);

  useEffect(() => {
    if (!selChapId) return;
    setIncompleteWarn(null);
    (async () => {
      const selChap = chapters.find(c => c.id === selChapId);
      const prevChap = selChap?.sequence_number
        ? chapters.find(c => c.sequence_number === selChap.sequence_number - 1)
        : null;
      if (prevChap) {
        const { data: prevEvs } = await supabase.from("chapter_plan")
          .select("id").eq("chapter_id", prevChap.id).neq("status", "complete").limit(1);
        if (prevEvs?.length) {
          setIncompleteWarn({ title: prevChap.title, seqNum: prevChap.sequence_number });
        }
      }

      const { data: evD } = await supabase.from("chapter_plan").select("*").eq("chapter_id", selChapId).order("sort_order");
      const evs = evD || [];
      setEvents(evs);
      if (!evs.length) { setEvChars([]); setEvLore([]); return; }
      const ids = evs.map(e => e.id);
      const [{ data: ecD }, { data: elD }] = await Promise.all([
        supabase.from("chapter_plan_characters").select("chapter_plan_id,character_id").in("chapter_plan_id", ids),
        supabase.from("chapter_plan_lore").select("chapter_plan_id,lore_entry_id").in("chapter_plan_id", ids),
      ]);
      setEvChars(ecD || []); setEvLore(elD || []);
    })();
  }, [selChapId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────
  const blockingTitles = id =>
    deps.filter(d => d.beat_id === id)
        .filter(d => beats.find(b => b.id === d.requires_beat_id)?.status !== "complete")
        .map(d => beats.find(b => b.id === d.requires_beat_id)?.title || "?");

  const recommended = beats.filter(b => b.status === "available" && deps.some(d => d.beat_id === b.id));
  const evCharsFor  = id => evChars.filter(ec => ec.chapter_plan_id === id).map(ec => chars.find(c => c.id === ec.character_id)).filter(Boolean);
  const evLoreFor   = id => evLore.filter(el => el.chapter_plan_id === id).map(el => lore.find(l => l.id === el.lore_entry_id)).filter(Boolean);

  // ── DB actions ────────────────────────────────────────────────────────────
  const dropBeat = async beat => {
    if (!selChapId || events.find(e => e.beat_id === beat.id)) return;
    const selChap = chapters.find(c => c.id === selChapId);
    const chapterCompleted = selChap?.sequence_number ?? null;
    const maxSort = events.length ? Math.max(...events.map(e => e.sort_order || 0)) : -1;
    const { data } = await supabase.from("chapter_plan")
      .insert({ chapter_id: selChapId, beat_id: beat.id, title: beat.title, notes: "", status: "planned", sort_order: maxSort + 1 })
      .select("*").single();
    if (data) {
      setEvents(p => [...p, data]);
      console.log("[dropBeat] updating arc_beat", beat.id, "status: in_chapter, chapter_completed:", chapterCompleted);
      const { error } = await supabase.from("arc_beats")
        .update({ status: "in_chapter", chapter_completed: chapterCompleted })
        .eq("id", beat.id);
      if (error) console.error("[dropBeat] arc_beats update failed:", error);
      setBeats(p => p.map(b => b.id === beat.id ? { ...b, status: "in_chapter", chapter_completed: chapterCompleted } : b));
    }
  };

  const dropLoreOnEv = async (evId, loreId) => {
    if (evLore.find(el => el.chapter_plan_id === evId && el.lore_entry_id === loreId)) return;
    await supabase.from("chapter_plan_lore").insert({ chapter_plan_id: evId, lore_entry_id: loreId });
    setEvLore(p => [...p, { chapter_plan_id: evId, lore_entry_id: loreId }]);
  };

  const setEvStatus = async (ev, status) => {
    const { error } = await supabase.from("chapter_plan").update({ status }).eq("id", ev.id);
    if (error) { alert("Failed to update status: " + error.message); return; }
    setEvents(p => p.map(e => e.id === ev.id ? { ...e, status } : e));
    if (status === "complete" && ev.beat_id) {
      const selChap = chapters.find(c => c.id === selChapId);
      await supabase.from("arc_beats").update({ status: "complete", chapter_completed: selChap?.sequence_number ?? null }).eq("id", ev.beat_id);
      const updated = beats.map(b => b.id === ev.beat_id ? { ...b, status: "complete" } : b);
      setBeats(updated);
      const nowAvail = updated.filter(b => b.status === "waiting" && b.id !== ev.beat_id).filter(b => {
        const bd = deps.filter(d => d.beat_id === b.id);
        return bd.length && bd.every(d => updated.find(x => x.id === d.requires_beat_id)?.status === "complete");
      });
      if (nowAvail.length) {
        await Promise.all(nowAvail.map(b => supabase.from("arc_beats").update({ status: "available" }).eq("id", b.id)));
        setBeats(p => p.map(b => nowAvail.find(x => x.id === b.id) ? { ...b, status: "available" } : b));
      }
    }
  };

  const deleteEv = async ev => {
    await supabase.from("chapter_plan").delete().eq("id", ev.id);
    setEvents(p => p.filter(e => e.id !== ev.id));
    setEvChars(p => p.filter(ec => ec.chapter_plan_id !== ev.id));
    setEvLore(p => p.filter(el => el.chapter_plan_id !== ev.id));
    if (ev.beat_id) {
      await supabase.from("arc_beats").update({ status: "available" }).eq("id", ev.beat_id);
      setBeats(p => p.map(b => b.id === ev.beat_id ? { ...b, status: "available" } : b));
    }
  };

  const saveEvField = async (evId, field, value) => {
    await supabase.from("chapter_plan").update({ [field]: value }).eq("id", evId);
    setEvents(p => p.map(e => e.id === evId ? { ...e, [field]: value } : e));
    setEditField(null);
  };

  const saveChapterPlan = async (text) => {
    if (!selChapId) return;
    await supabase.from("chapters").update({ chapter_plan: text }).eq("id", selChapId);
    setChapters(p => p.map(c => c.id === selChapId ? { ...c, chapter_plan: text } : c));
  };

  const removeEvFromScene = async ev => {
    await supabase.from("chapter_plan").delete().eq("id", ev.id);
    setEvents(p => p.filter(e => e.id !== ev.id));
    setEvChars(p => p.filter(ec => ec.chapter_plan_id !== ev.id));
    setEvLore(p => p.filter(el => el.chapter_plan_id !== ev.id));
    if (ev.beat_id) {
      await supabase.from("arc_beats").update({ chapter_completed: null, status: "available" }).eq("id", ev.beat_id);
      setBeats(p => p.map(b => b.id === ev.beat_id ? { ...b, chapter_completed: null, status: "available" } : b));
    }
    setDetail(null);
  };

  const completeArcBeat = async ev => {
    if (!ev.beat_id) return;
    await supabase.from("arc_beats").update({ status: "complete" }).eq("id", ev.beat_id);
    setBeats(p => p.map(b => b.id === ev.beat_id ? { ...b, status: "complete" } : b));
    await supabase.from("chapter_plan").update({ status: "complete" }).eq("id", ev.id);
    setEvents(p => p.map(e => e.id === ev.id ? { ...e, status: "complete" } : e));
  };

  const deleteArcBeat = async ev => {
    if (!window.confirm("Delete this event permanently?")) return;
    if (ev.beat_id) {
      await supabase.from("arc_beats").delete().eq("id", ev.beat_id);
      setBeats(p => p.filter(b => b.id !== ev.beat_id));
    }
    await supabase.from("chapter_plan").delete().eq("id", ev.id);
    setEvents(p => p.filter(e => e.id !== ev.id));
    setEvChars(p => p.filter(ec => ec.chapter_plan_id !== ev.id));
    setEvLore(p => p.filter(el => el.chapter_plan_id !== ev.id));
    setDetail(null);
  };

  const reorderArcBeat = async (beatId, targetId, arcId) => {
    const sorted = beats.filter(b => b.arc_id === arcId).sort((a, b) => (a.sort_order||0)-(b.sort_order||0));
    const fi = sorted.findIndex(b => b.id === beatId), ti = sorted.findIndex(b => b.id === targetId);
    if (fi < 0 || ti < 0 || fi === ti) return;
    const r = [...sorted]; const [m] = r.splice(fi, 1); r.splice(ti, 0, m);
    const upd = r.map((b, i) => ({ id: b.id, sort_order: i }));
    await Promise.all(upd.map(u => supabase.from("arc_beats").update({ sort_order: u.sort_order }).eq("id", u.id)));
    const map = Object.fromEntries(upd.map(u => [u.id, u.sort_order]));
    setBeats(p => p.map(b => map[b.id] !== undefined ? { ...b, sort_order: map[b.id] } : b));
  };

  const reorderEv = async (fromId, toId) => {
    const fi = events.findIndex(e => e.id === fromId), ti = events.findIndex(e => e.id === toId);
    if (fi < 0 || ti < 0 || fi === ti) return;
    const r = [...events]; const [m] = r.splice(fi, 1); r.splice(ti, 0, m);
    const upd = r.map((e, i) => ({ id: e.id, sort_order: i }));
    await Promise.all(upd.map(u => supabase.from("chapter_plan").update({ sort_order: u.sort_order }).eq("id", u.id)));
    setEvents(r.map((e, i) => ({ ...e, sort_order: i })));
  };

  // ── Drag ──────────────────────────────────────────────────────────────────
  const onBeatDragStart = (e, beat)  => { setDrag({ type:"beat", id:beat.id, data:beat, srcArc:beat.arc_id }); e.dataTransfer.effectAllowed="move"; };
  const onLoreDragStart = (e, entry) => { setDrag({ type:"lore", id:entry.id, data:entry }); e.dataTransfer.effectAllowed="copy"; };
  const onEvDragStart   = (e, ev)    => { setDrag({ type:"event", id:ev.id, data:ev }); e.dataTransfer.effectAllowed="move"; };

  const onWorkspaceDrop = async e => {
    e.preventDefault(); setDropOn(null);
    if (drag?.type === "beat") await dropBeat(drag.data);
    setDrag(null);
  };
  const onEvDrop = async (e, targetId) => {
    e.preventDefault(); e.stopPropagation(); setDropOn(null);
    if (!drag) return;
    if (drag.type === "lore") await dropLoreOnEv(targetId, drag.id);
    else if (drag.type === "event" && drag.id !== targetId) await reorderEv(drag.id, targetId);
    setDrag(null);
  };
  const onArcBeatDrop = async (e, targetId, arcId) => {
    e.preventDefault(); e.stopPropagation(); setDropOn(null);
    if (drag?.type === "beat" && drag.srcArc === arcId) await reorderArcBeat(drag.id, targetId, arcId);
    setDrag(null);
  };

  // ── Beat card ─────────────────────────────────────────────────────────────
  const renderBeat = (beat, inArc = true) => {
    const av = beat.status === "available";
    const wt = beat.status === "waiting";
    const st = ST[beat.status] || ST.waiting;
    const blk = wt ? blockingTitles(beat.id) : [];
    const isDropTarget = dropOn === beat.id && drag?.srcArc === beat.arc_id;
    return (
      <div key={beat.id}
        style={{ margin:"3px 8px 3px 20px", padding:"6px 8px", borderRadius:4,
          background: wt ? BG_L : BG_C,
          border:`1px solid ${isDropTarget ? A : BDR2}`,
          opacity: wt ? 0.55 : 1,
          cursor: av ? "grab" : "default",
          fontFamily:FF }}
        draggable={av}
        onDragStart={av ? e => onBeatDragStart(e, beat) : undefined}
        onDragOver={inArc ? e => { e.preventDefault(); setDropOn(beat.id); } : undefined}
        onDragLeave={inArc ? () => setDropOn(null) : undefined}
        onDrop={inArc ? e => onArcBeatDrop(e, beat.id, beat.arc_id) : undefined}
        onClick={() => setDetail({ type:"beat", id:beat.id })}
        title={wt && blk.length ? `Blocked by: ${blk.join(", ")}` : undefined}
      >
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          {wt && <span style={{ fontSize:9, color:TXT3 }}>🔒</span>}
          <span style={{ flex:1, fontSize:12, color: wt ? TXT3 : TXT, fontWeight: av ? 500 : 400 }}>{beat.title}</span>
          <Badge color={st.color}>{DEP_LABEL[beat.dependency_type] || beat.dependency_type}</Badge>
        </div>
      </div>
    );
  };

  // ── Event card ────────────────────────────────────────────────────────────
  const renderEvent = ev => {
    const evC      = evCharsFor(ev.id);
    const evL      = evLoreFor(ev.id);
    const evBeat   = ev.beat_id ? beats.find(b => b.id === ev.beat_id) : null;
    const evArc    = evBeat ? arcs.find(a => a.id === evBeat.arc_id) : null;
    const evCol    = evArc ? arcColor(evArc, chars, groups) : TXT3;
    const done     = ev.status === "complete";
    const isLoreOver = dropOn === ev.id && (drag?.type === "lore" || drag?.type === "event");
    const editT    = editField?.evId === ev.id && editField?.field === "title";
    const editN    = editField?.evId === ev.id && editField?.field === "notes";

    return (
      <div key={ev.id}
        style={{ background: done ? "#3a7a4a08" : BG_C,
          border:`1px solid ${isLoreOver ? A : done ? "rgba(58,122,74,0.3)" : BDR}`,
          borderRadius:4, marginBottom:8, padding:"8px 10px", cursor:"grab", fontFamily:FF }}
        draggable
        onDragStart={e => onEvDragStart(e, ev)}
        onDragOver={e => { e.preventDefault(); setDropOn(ev.id); }}
        onDragLeave={() => setDropOn(null)}
        onDrop={e => onEvDrop(e, ev.id)}
        onClick={() => setDetail({ type:"event", id:ev.id })}
      >
        {/* Top line: checkbox + arc pill + title + × */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
          <input type="checkbox" checked={done}
            onChange={e => { e.stopPropagation(); setEvStatus(ev, done ? "planned" : "complete"); }}
            onClick={e => e.stopPropagation()}
            style={{ flexShrink:0, cursor:"pointer", accentColor:"#3a7a4a", width:13, height:13, margin:0 }} />
          {evArc && <Badge color={evCol}>{evArc.title}</Badge>}
          {editT
            ? <input autoFocus defaultValue={ev.title}
                style={{ flex:1, background:BG_C, border:`1px solid ${BDR2}`, borderRadius:3, color:TXT, fontSize:12, padding:"2px 5px", fontFamily:FF, outline:"none" }}
                onBlur={e => saveEvField(ev.id, "title", e.target.value)}
                onKeyDown={e => { if (e.key==="Enter") e.target.blur(); if (e.key==="Escape") setEditField(null); }}
                onClick={e => e.stopPropagation()} />
            : <span style={{ flex:1, fontSize:12, fontWeight:500, color:done?TXT3:TXT,
                textDecoration:done?"line-through":"none", cursor:"text" }}
                onDoubleClick={e => { e.stopPropagation(); setEditField({ evId:ev.id, field:"title" }); }}>
                {ev.title || "Untitled"}
              </span>
          }
          <button style={{ background:"none", border:"none", color:TXT3, fontSize:13, cursor:"pointer", lineHeight:1, padding:"0 2px", flexShrink:0 }}
            onClick={e => { e.stopPropagation(); if (window.confirm("Remove this event from the arc?")) deleteEv(ev); }}>×</button>
        </div>

        {/* Notes */}
        {editN
          ? <textarea autoFocus defaultValue={ev.notes || ""}
              style={{ width:"100%", background:BG_C, border:`1px solid ${BDR2}`, borderRadius:3, color:TXT, fontSize:12, padding:"5px 7px", fontFamily:FF, outline:"none", resize:"vertical", lineHeight:1.6, boxSizing:"border-box", marginBottom:5 }}
              rows={3}
              onBlur={e => saveEvField(ev.id, "notes", e.target.value)}
              onClick={e => e.stopPropagation()} />
          : ev.notes
            ? <div style={{ fontSize:12, color:TXT2, lineHeight:1.5, marginBottom:6, cursor:"text" }}
                onDoubleClick={e => { e.stopPropagation(); setEditField({ evId:ev.id, field:"notes" }); }}>
                {ev.notes}
              </div>
            : <div style={{ fontSize:11, color:TXT3, fontStyle:"italic", marginBottom:4, opacity:0.6, cursor:"text" }}
                onDoubleClick={e => { e.stopPropagation(); setEditField({ evId:ev.id, field:"notes" }); }}>
                Double-click to add notes…
              </div>
        }

        {/* Chips */}
        {(evC.length > 0 || evL.length > 0) && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:2 }}>
            {evC.map(c => <CharChip key={c.id} char={c} groups={groups} />)}
            {evL.map(l => <Badge key={l.id} color="#2a6a94">{l.title}</Badge>)}
          </div>
        )}
      </div>
    );
  };

  // ── Detail panel content ──────────────────────────────────────────────────
  const detailBeat   = detail?.type==="beat"  ? beats.find(b => b.id===detail.id)   : null;
  const detailArc    = detailBeat ? arcs.find(a => a.id===detailBeat.arc_id) : null;
  const detailBeatEv = detailBeat ? events.find(e => e.beat_id === detailBeat.id)   : null;
  const detailEv     = detail?.type==="event" ? events.find(e => e.id===detail.id)  : null;
  const detailEvBeat = detailEv?.beat_id ? beats.find(b => b.id===detailEv.beat_id) : null;

  // ── Lore by category ─────────────────────────────────────────────────────
  const loreGroups = {};
  for (const l of lore) { const k = l.category || "Uncategorized"; (loreGroups[k] = loreGroups[k]||[]).push(l); }

  if (loading) return (
    <div style={{ height:"100vh", background:BG_L, display:"flex", alignItems:"center",
      justifyContent:"center", color:TXT3, fontFamily:FF, fontSize:13, gap:8 }}>
      Loading…
    </div>
  );

  return (
    <div style={{ height:"100vh", background:BG_L, color:TXT, display:"flex",
      flexDirection:"column", overflow:"hidden", fontFamily:FF }}>

      {/* ── Left sidebar ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        <div style={{ width:280, flexShrink:0, background:BG_L, borderRight:`1px solid ${BDR}`,
          display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Nav row — mirrors write page top row */}
          <div style={{ padding:"8px", flexShrink:0, borderBottom:`1px solid ${BDR}`,
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", gap:8 }}>
              <a href="/" style={{ fontSize:13, color:A, fontFamily:FF, textDecoration:"none",
                letterSpacing:"0.04em", padding:"5px 4px" }}>← Write</a>
              <a href="/codex" style={{ fontSize:13, color:A, fontFamily:FF, textDecoration:"none",
                letterSpacing:"0.04em", padding:"5px 4px" }}>Codex</a>
            </div>
            <span style={{ fontSize:12, color:TXT2, fontFamily:FF, padding:"5px 4px",
              letterSpacing:"0.04em" }}>Arc Planner</span>
          </div>

          {/* Tab toggle */}
          <div style={{ display:"flex", borderBottom:`1px solid ${BDR}`, flexShrink:0 }}>
            {["arcs","lore"].map(t => (
              <button key={t} onClick={() => setSideTab(t)}
                style={{ flex:1, padding:"8px 0", background:"none", border:"none",
                  borderBottom: sideTab===t ? `2px solid ${A}` : "2px solid transparent",
                  color: sideTab===t ? A : TXT3, fontSize:11, fontFamily:FF,
                  letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer",
                  userSelect:"none", transition:"color 0.1s" }}>
                {t}
              </button>
            ))}
          </div>

          {/* Sidebar scroll */}
          <div style={{ flex:1, overflowY:"auto" }}>
            {sideTab === "arcs" && (
              <>
                {/* Recommended */}
                {recommended.length > 0 && (
                  <div style={{ padding:"6px 8px 8px", borderBottom:`1px solid ${BDR}` }}>
                    <div style={{ fontSize:10, color:A, letterSpacing:"0.08em", textTransform:"uppercase",
                      fontFamily:FF, padding:"2px 4px 4px" }}>● Ready to pull in</div>
                    {recommended.map(b => renderBeat(b, false))}
                  </div>
                )}

                {/* Arcs */}
                {arcs.map(arc => {
                  const col = arcColor(arc, chars, groups);
                  const arcBeatsArr = beats.filter(b => b.arc_id===arc.id).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
                  const visible = showDone ? arcBeatsArr : arcBeatsArr.filter(b => b.status!=="complete");
                  const isCol = collapsed[arc.id];
                  return (
                    <div key={arc.id} style={{ borderBottom:`1px solid ${BDR}` }}>
                      <div
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px 8px 12px",
                          cursor:"pointer", userSelect:"none", borderLeft:`3px solid ${col}`,
                          background:"transparent" }}
                        onClick={() => setCollapsed(p => ({ ...p, [arc.id]: !p[arc.id] }))}>
                        <span style={{ flex:1, fontSize:12, fontWeight:600, color:col }}>{arc.title}</span>
                        <span style={{ fontSize:10, color:TXT3 }}>{isCol ? "›" : "▾"}</span>
                      </div>
                      {!isCol && (
                        <>
                          {visible.map(b => renderBeat(b))}
                          {visible.length===0 && (
                            <div style={{ padding:"4px 10px 8px 20px", fontSize:11, color:TXT3, fontStyle:"italic" }}>
                              {arcBeatsArr.length ? "All complete" : "No beats"}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                <div style={{ padding:"8px" }}>
                  <CtlBtn onClick={() => setShowDone(p => !p)}>
                    {showDone ? "Hide completed" : "Show completed"}
                  </CtlBtn>
                </div>
              </>
            )}

            {sideTab === "lore" && (
              <>
                {Object.entries(loreGroups).map(([cat, entries]) => (
                  <div key={cat} style={{ borderBottom:`1px solid ${BDR}`, paddingBottom:4 }}>
                    <div style={{ fontSize:10, color:TXT3, letterSpacing:"0.08em", textTransform:"uppercase",
                      fontFamily:FF, padding:"6px 12px 2px" }}>{cat}</div>
                    {entries.map(l => (
                      <div key={l.id} draggable onDragStart={e => onLoreDragStart(e, l)}
                        style={{ margin:"2px 8px", padding:"6px 8px", borderRadius:4,
                          border:`1px solid ${BDR2}`, background:BG_C, cursor:"grab", fontSize:12 }}>
                        <div style={{ fontWeight:500, color:TXT, marginBottom:l.tags?.length?2:0 }}>{l.title}</div>
                        {l.tags?.length > 0 && (
                          <div>{l.tags.slice(0,3).map(t => <Badge key={t} color={TXT3}>{t}</Badge>)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                {lore.length===0 && (
                  <div style={{ padding:"20px", fontSize:12, color:TXT3, fontStyle:"italic", textAlign:"center" }}>
                    No lore entries
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Main workspace ── */}
        <div style={{ flex:1, background:BG_C, display:"flex", flexDirection:"column", overflow:"hidden" }}
          onDragOver={e => e.preventDefault()}
          onDrop={onWorkspaceDrop}>

          {/* Chapter header — same bg as left panel, same border treatment */}
          <div style={{ padding:"8px", flexShrink:0, borderBottom:`1px solid ${BDR}`,
            background:BG_L, display:"flex", alignItems:"center", gap:8 }}>
            <select value={selChapId||""} onChange={e => setSelChapId(e.target.value)}
              style={{ ...selFull, flex:1, maxWidth:360, color:TXT }}>
              {chapters.map(c => (
                <option key={c.id} value={c.id} style={{ background:BG_C, color:"#000" }}>
                  {c.sequence_number ? `Ch. ${c.sequence_number} — ` : ""}{c.title}
                  {c.status==="planned" ? " (planned)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Incomplete events warning */}
          {incompleteWarn && (
            <div style={{ background:"#8B691412", borderBottom:`1px solid #8B691430`,
              padding:"8px 16px", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
              <span style={{ flex:1, fontSize:12, color:A, fontFamily:FF }}>
                Ch. {incompleteWarn.seqNum} — {incompleteWarn.title} has incomplete events. Review before continuing?
              </span>
              <button onClick={() => setIncompleteWarn(null)}
                style={{ background:"none", border:"none", color:TXT3, fontSize:13, cursor:"pointer", lineHeight:1, padding:"0 2px", flexShrink:0 }}>×</button>
            </div>
          )}

          {/* Events */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
            {/* Chapter plan */}
            <textarea
              ref={planRef}
              rows={1}
              value={chapterPlanText}
              onChange={e => setChapterPlanText(e.target.value)}
              onFocus={() => setPlanFocused(true)}
              onBlur={e => { setPlanFocused(false); saveChapterPlan(e.target.value); }}
              placeholder="Add chapter plan…"
              style={{ display:"block", width:"100%", boxSizing:"border-box", resize:"none", overflow:"hidden",
                fontFamily:FF, fontSize:12, lineHeight:1.6, color:TXT, outline:"none",
                padding: planFocused || chapterPlanText ? "6px 8px" : "2px 8px",
                border: planFocused ? `1px solid ${BDR2}` : "1px solid transparent",
                borderRadius:3, background: planFocused ? BG_C : "transparent",
                marginBottom: planFocused || chapterPlanText ? 12 : 4,
                opacity: planFocused || chapterPlanText ? 1 : 0.4 }} />

            {events.length===0 && (
              <div style={{ border:`2px dashed ${drag?.type==="beat" ? A : BDR2}`, borderRadius:5,
                padding:"24px", textAlign:"center", color: drag?.type==="beat" ? A : TXT3,
                fontSize:12, transition:"all 0.15s" }}>
                Drop beats here to plan this chapter
              </div>
            )}
            {events.map(renderEvent)}
            {events.length > 0 && drag?.type==="beat" && (
              <div style={{ border:`2px dashed ${A}`, borderRadius:5, padding:"14px",
                textAlign:"center", color:A, fontSize:12, marginTop:4 }}>
                Drop to add beat
              </div>
            )}
          </div>
        </div>

        {/* ── Right detail panel ── */}
        {detail && (
          <div style={{ width:272, flexShrink:0, background:BG_L, borderLeft:`1px solid ${BDR}`,
            display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Header */}
            <div style={{ padding:"8px 10px", borderBottom:`1px solid ${BDR}`, flexShrink:0,
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:10, color:TXT3, letterSpacing:"0.08em", textTransform:"uppercase" }}>
                {detail.type==="beat" ? "Beat" : "Event"}
              </span>
              {(detail.type === "beat" && !detailBeatEv) && (
                <button style={{ background:"none", border:"none", color:TXT3, fontSize:14,
                  cursor:"pointer", lineHeight:1, padding:"0 2px" }}
                  onClick={() => setDetail(null)}>×</button>
              )}
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"12px 12px" }}>

              {detailBeat && (
                <>
                  <div style={{ fontSize:13, fontWeight:600, color:TXT, marginBottom:6 }}>{detailBeat.title}</div>
                  {detailArc && <Badge color={arcColor(detailArc, chars, groups)}>{detailArc.title}</Badge>}
                  <Badge color={ST[detailBeat.status]?.color||TXT3}>{detailBeat.status}</Badge>

                  <Lbl>Dependency Type</Lbl>
                  <div style={{ fontSize:12, color:TXT2 }}>{DEP_LABEL[detailBeat.dependency_type] || detailBeat.dependency_type}</div>

                  {deps.filter(d => d.beat_id===detailBeat.id).length > 0 && (
                    <>
                      <Lbl>Depends On</Lbl>
                      {deps.filter(d => d.beat_id===detailBeat.id).map(dep => {
                        const rb = beats.find(b => b.id===dep.requires_beat_id);
                        return (
                          <div key={dep.id} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                            <span style={{ fontSize:10, color: rb?.status==="complete"?"#3a7a4a":"#a04040" }}>
                              {rb?.status==="complete" ? "✓" : "○"}
                            </span>
                            <span style={{ fontSize:12, color:TXT2, flex:1 }}>{rb?.title||"?"}</span>
                            <Badge color={TXT3}>{dep.dependency_strength}</Badge>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {detailBeat.notes && (
                    <>
                      <Lbl>Notes</Lbl>
                      <div style={{ fontSize:12, color:TXT2, lineHeight:1.6 }}>{detailBeat.notes}</div>
                    </>
                  )}

                  {detailArc?.character_ids?.length > 0 && (
                    <>
                      <Lbl>Characters</Lbl>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:2 }}>
                        {detailArc.character_ids.map(cid => {
                          const c = chars.find(x => x.id===cid);
                          return c ? <CharChip key={cid} char={c} groups={groups} /> : null;
                        })}
                      </div>
                    </>
                  )}

                  {detailBeatEv && (
                    <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:6 }}>
                      <button
                        onClick={() => removeEvFromScene(detailBeatEv)}
                        style={{ background:BG_C, border:`1px solid ${BDR2}`, borderRadius:4, color:TXT2,
                          fontSize:12, fontFamily:FF, cursor:"pointer", padding:"6px 10px", textAlign:"left" }}>
                        Remove from Scene
                      </button>
                      <button
                        onClick={() => completeArcBeat(detailBeatEv)}
                        style={{ background:"#3a7a4a10", border:"1px solid #3a7a4a40", borderRadius:4, color:"#3a7a4a",
                          fontSize:12, fontFamily:FF, cursor:"pointer", padding:"6px 10px", textAlign:"left" }}>
                        Complete
                      </button>
                      <button
                        onClick={() => deleteArcBeat(detailBeatEv)}
                        style={{ background:"none", border:"1px solid rgba(160,60,60,0.35)", borderRadius:4, color:"#a03c3c",
                          fontSize:12, fontFamily:FF, cursor:"pointer", padding:"6px 10px", textAlign:"left" }}>
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}

              {detailEv && (
                <>
                  <div style={{ fontSize:13, fontWeight:600, color:TXT, marginBottom:6 }}>{detailEv.title||"Untitled"}</div>

                  {detailEvBeat && (() => {
                    const arc = arcs.find(a => a.id===detailEvBeat.arc_id);
                    const col = arc ? arcColor(arc, chars, groups) : TXT3;
                    return (
                      <>
                        <Lbl>Fulfills Beat</Lbl>
                        <div style={{ fontSize:12, color:TXT2, marginBottom:4 }}>{detailEvBeat.title}</div>
                        {arc && <Badge color={col}>{arc.title}</Badge>}
                        {deps.filter(d => d.beat_id===detailEvBeat.id).length > 0 && (
                          <>
                            <Lbl>Beat Dependencies</Lbl>
                            {deps.filter(d => d.beat_id===detailEvBeat.id).map(dep => {
                              const rb = beats.find(b => b.id===dep.requires_beat_id);
                              return (
                                <div key={dep.id} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                                  <span style={{ fontSize:10, color:rb?.status==="complete"?"#3a7a4a":"#a04040" }}>
                                    {rb?.status==="complete" ? "✓" : "○"}
                                  </span>
                                  <span style={{ fontSize:12, color:TXT2, flex:1 }}>{rb?.title||"?"}</span>
                                  <Badge color={TXT3}>{dep.dependency_strength}</Badge>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </>
                    );
                  })()}

                  {detailEv.notes && (
                    <>
                      <Lbl>Notes</Lbl>
                      <div style={{ fontSize:12, color:TXT2, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{detailEv.notes}</div>
                    </>
                  )}

                  {evCharsFor(detailEv.id).length > 0 && (
                    <>
                      <Lbl>Characters</Lbl>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:2 }}>
                        {evCharsFor(detailEv.id).map(c => <CharChip key={c.id} char={c} groups={groups} />)}
                      </div>
                    </>
                  )}

                  {evLoreFor(detailEv.id).length > 0 && (
                    <>
                      <Lbl>Attached Lore</Lbl>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:2 }}>
                        {evLoreFor(detailEv.id).map(l => <Badge key={l.id} color="#2a6a94">{l.title}</Badge>)}
                      </div>
                    </>
                  )}

                  {/* Action buttons */}
                  <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:6 }}>
                    <button
                      onClick={() => removeEvFromScene(detailEv)}
                      style={{ background:BG_C, border:`1px solid ${BDR2}`, borderRadius:4, color:TXT2,
                        fontSize:12, fontFamily:FF, cursor:"pointer", padding:"6px 10px", textAlign:"left" }}>
                      Remove from Scene
                    </button>
                    <button
                      onClick={() => completeArcBeat(detailEv)}
                      style={{ background:"#3a7a4a10", border:"1px solid #3a7a4a40", borderRadius:4, color:"#3a7a4a",
                        fontSize:12, fontFamily:FF, cursor:"pointer", padding:"6px 10px", textAlign:"left" }}>
                      Complete
                    </button>
                    <button
                      onClick={() => deleteArcBeat(detailEv)}
                      style={{ background:"none", border:"1px solid rgba(160,60,60,0.35)", borderRadius:4, color:"#a03c3c",
                        fontSize:12, fontFamily:FF, cursor:"pointer", padding:"6px 10px", textAlign:"left" }}>
                      Delete
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
