import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Routes, Route, Link } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import Codex from "./Codex.jsx";
import Places from "./Places.jsx";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const STORY_ID = "ca821271-2bca-4b3c-bdf7-7224e0b4e8b3";
const TIMES = ["Dawn","Morning","Noon","Afternoon","Evening","Night","Midnight"];
const MODES = [
  { key:"narrative", label:"Narrative", color:"#7a6e62" },
  { key:"intimate",  label:"Intimate",  color:"#D4537E" },
  { key:"combat",    label:"Combat",    color:"#cc2200" },
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  :root {
    --bg:#0f0d0b; --bg2:#1a1612; --bg3:#16130f; --bg4:#25201a;
    --border:#2e2820; --border2:#3a3028;
    --gold:#c9a86c; --gold2:#a8884c;
    --text:#ffffff; --text2:#ffffff; --text3:#cccccc; --text4:#aaaaaa;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { background: var(--bg); font-family: Georgia, serif; color: var(--text); text-align: left; }
  select { appearance: none; }
  select:focus, button:focus, textarea:focus { outline: 2px solid var(--gold2); outline-offset: 1px; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg2); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { display:inline-block; width:11px; height:11px; border:2px solid rgba(201,168,108,0.25); border-top-color:#c9a86c; border-radius:50%; animation:spin 0.7s linear infinite; vertical-align:middle; }
`;

// ── Supabase queries ──────────────────────────────────────────────────────────
const fetchChapters = async () => {
  const { data } = await supabase
    .from("chapters").select("id, sequence_number, title")
    .eq("story_id", STORY_ID).order("sequence_number", { ascending: true });
  return data || [];
};
const fetchScenes = async (chapterId) => {
  const { data } = await supabase
    .from("scenes").select("id, sequence_number, title, mood")
    .eq("chapter_id", chapterId).order("sequence_number", { ascending: true });
  return data || [];
};
const fetchBeats = async (sceneId) => {
  const { data } = await supabase
    .from("beats").select("id, sequence_number, type, directive, emotional_register, tags, prose_text")
    .eq("scene_id", sceneId).order("sequence_number", { ascending: true });
  return data || [];
};
const fetchCharacters = async () => {
  const { data } = await supabase
    .from("characters").select("id, name, portrait_url, character_group, character_groups(link_color)").order("name");
  return (data || []).map(c => ({ ...c, link_color: c.character_groups?.link_color || "#7a6e62" }));
};
const fetchGroups = async () => {
  const { data } = await supabase
    .from("character_groups").select("id, name, sort_order").order("sort_order");
  return data || [];
};
const WORLD_ID = "96f993ca-19eb-4698-b0f7-e8ee94d7e8fc";
const fetchPlaces = async () => {
  const { data } = await supabase.from("places").select("id, name, place_type, parent_id").eq("world_id", WORLD_ID).order("name");
  return data || [];
};

// ── Shared style atoms ────────────────────────────────────────────────────────
const selFull = {
  width:"100%", background:"var(--bg4)", color:"var(--text)",
  border:"1px solid var(--border2)", borderRadius:4,
  padding:"5px 24px 5px 8px", fontSize:12, fontFamily:"sans-serif", cursor:"pointer",
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%237a6e62'/%3E%3C/svg%3E")`,
  backgroundRepeat:"no-repeat", backgroundPosition:"right 7px center",
};
const panelLbl = {
  fontSize:10, color:"var(--text4)", fontFamily:"sans-serif",
  letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:5, display:"block",
};
const fullBtn = {
  width:"100%", textAlign:"left", background:"var(--bg4)", color:"var(--text)",
  border:"1px solid var(--border2)", borderRadius:4, padding:"5px 8px",
  fontSize:12, fontFamily:"sans-serif", cursor:"pointer", display:"flex",
  alignItems:"center", justifyContent:"space-between", gap:4,
};
const dropBase = {
  position:"absolute", top:"calc(100% + 3px)", left:0, right:0, zIndex:50,
  background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:6,
  boxShadow:"0 4px 20px #00000070", overflow:"hidden",
};
const dropItem = {
  padding:"7px 10px", fontSize:12, cursor:"pointer",
  color:"var(--text)", fontFamily:"sans-serif",
};

// ── ProseViewer ───────────────────────────────────────────────────────────────
function ProseViewer() {
  const [chapters,        setChapters]        = useState([]);
  const [scenes,          setScenes]          = useState([]);
  const [scenesWithBeats, setScenesWithBeats] = useState([]);
  const [selCh,           setSelCh]           = useState(null);
  const [selSc,           setSelSc]           = useState(null);
  const [phase,           setPhase]           = useState("loading");
  const [storyTitle,      setStoryTitle]      = useState("");
  const [err,             setErr]             = useState("");
  const [allChars,        setAllChars]        = useState([]);
  const [allGroups,       setAllGroups]       = useState([]);
  const [allLocs,         setAllLocs]         = useState([]);
  const [sceneChars,      setSceneChars]      = useState([]);
  const [location,        setLocation]        = useState("Thorncliff Manor");
  const [locationId,      setLocationId]      = useState(null);
  const [timeOfDay,       setTimeOfDay]       = useState("Evening");
  const [mode,            setMode]            = useState("narrative");
  const [showLoc,         setShowLoc]         = useState(false);
  const [locStack,        setLocStack]        = useState([]);
  const [showMode,        setShowMode]        = useState(false);
  const [showChar,        setShowChar]        = useState(false);
  const [charDropPos,     setCharDropPos]     = useState(null);
  const [povCharId,      setPovCharId]      = useState(null); // null = default Zep
  const [directive,      setDirective]      = useState("");
  const [generating,     setGenerating]     = useState(false);
  const [pendingProse,   setPendingProse]   = useState(null); // { prose, directive, sceneId }
  const [editingBeatId,  setEditingBeatId]  = useState(null);
  const [editingText,    setEditingText]    = useState("");
  const leftPanelRef  = useRef(null);
  const charRef       = useRef(null);
  const charDropRef   = useRef(null);
  const taRef         = useRef(null);
  const directiveRef  = useRef(null);
  const proseRef      = useRef(null);

  // close loc/char dropdowns on outside click
  useEffect(() => {
    const h = e => {
      if (leftPanelRef.current && !leftPanelRef.current.contains(e.target)) {
        setShowLoc(false); setLocStack([]);
      }
      if (charRef.current && !charRef.current.contains(e.target) &&
          charDropRef.current && !charDropRef.current.contains(e.target)) setShowChar(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const loadChapter = useCallback(async (ch, targetSceneId = null) => {
    setSelCh(ch.id); setSelSc(null);
    setScenes([]); setScenesWithBeats([]); setPhase("loading");
    try {
      const scs = await fetchScenes(ch.id);
      setScenes(scs);
      if (scs.length) {
        const scId = (targetSceneId && scs.find(s => s.id === targetSceneId))
          ? targetSceneId : scs[0].id;
        setSelSc(scId);
        const swb = await Promise.all(scs.map(async sc => ({ scene: sc, beats: await fetchBeats(sc.id) })));
        setScenesWithBeats(swb);
      }
      setPhase("ready");
    } catch(e) { setErr(e.message); setPhase("error"); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [chs, chars, grps, locs, { data: story }, { data: state }] = await Promise.all([
          fetchChapters(), fetchCharacters(), fetchGroups(), fetchPlaces(),
          supabase.from("stories").select("title").eq("id", STORY_ID).single(),
          supabase.from("scene_state").select("*").eq("story_id", STORY_ID).single(),
        ]);
        if (story?.title) setStoryTitle(story.title);
        setAllChars(chars); setAllGroups(grps); setAllLocs(locs);
        if (!chs.length) { setPhase("ready"); return; }
        setChapters(chs);

        if (state) {
          if (state.location_text) setLocation(state.location_text);
          if (state.location_id)   setLocationId(state.location_id);
          if (state.time_of_day)   setTimeOfDay(state.time_of_day);
          if (state.scene_mode)    setMode(state.scene_mode);
          const targetCh = chs.find(c => c.id === state.current_chapter_id) || chs[0];
          await loadChapter(targetCh, state.current_scene_id);
          if (state.active_character_ids?.length) {
            setSceneChars(chars.filter(c => state.active_character_ids.includes(c.id)));
          }
        } else {
          await loadChapter(chs[0]);
        }

      } catch(e) { setErr(e.message); setPhase("error"); }
    })();
  }, [loadChapter]);

  const onChapter = useCallback(async e => {
    const ch = chapters.find(c => c.id === e.target.value);
    if (ch) await loadChapter(ch);
  }, [chapters, loadChapter]);

  const onScene = useCallback(e => {
    const id = e.target.value;
    setSelSc(id);
    document.getElementById(id)?.scrollIntoView({ behavior:"smooth" });
  }, []);

  const addChar    = c => { if (!sceneChars.find(x => x.id === c.id)) setSceneChars(p => [...p, c]); setShowChar(false); };
  const removeChar = id => setSceneChars(p => p.filter(c => c.id !== id));
  const available  = allChars.filter(c => !sceneChars.find(x => x.id === c.id));

  useEffect(() => {
    if (!selCh) return;
    const timer = setTimeout(async () => {
      await supabase.from("scene_state").upsert({
        story_id:             STORY_ID,
        current_chapter_id:   selCh,
        current_scene_id:     selSc,
        location_text:        location,
        location_id:          locationId,
        time_of_day:          timeOfDay,
        scene_mode:           mode,
        active_character_ids: sceneChars.map(c => c.id),
        updated_at:           new Date().toISOString(),
      }, { onConflict: "story_id" });
    }, 1000);
    return () => clearTimeout(timer);
  }, [selCh, selSc, location, locationId, timeOfDay, mode, sceneChars]);

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

  const generate = async () => {
    if (!directive.trim() || generating) return;
    setGenerating(true);
    try {
      // Last 4 scenes of prose context
      const last4 = scenesWithBeats.slice(-4);
      const proseContext = last4.map(({ scene, beats }) =>
        `[${scene.title}]\n${beats.map(b => b.prose_text || "").filter(Boolean).join("\n\n")}`
      ).join("\n\n---\n\n");

      // Chapter summary + prompt modifier in parallel
      const [{ data: chData }, { data: pmData }] = await Promise.all([
        supabase.from("chapters").select("context_summary").eq("id", selCh).single(),
        supabase.from("app_settings").select("value").eq("key", `prompt_modifier_${mode}`).single(),
      ]);

      // Character details — fetch extra fields for intimate/combat
      let sceneCharsWithData = sceneChars;
      if (sceneChars.length) {
        let sel = "id, name, role, species, age, occupation, physical_appearance, personality, backstory_summary";
        if (mode === "intimate") sel += ", erotic_profile";
        if (mode === "combat")   sel += ", combat_profile";
        const { data: charData } = await supabase.from("characters").select(sel).in("id", sceneChars.map(c => c.id));
        if (charData) sceneCharsWithData = charData;
      }

      const response = await fetch("https://gjvegoinppbpfusttycs.supabase.co/functions/v1/generate-prose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directive,
          proseContext,
          characters:     sceneCharsWithData,
          location,
          timeOfDay,
          sceneMode:      mode,
          chapterSummary: chData?.context_summary || "",
          promptModifier: pmData?.value || "",
        }),
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setPendingProse({ prose: result.prose || "", directive, sceneId: selSc });
    } catch (e) {
      alert("Generation failed: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const acceptProse = async () => {
    if (!pendingProse) return;
    const { prose, directive: beatDirective, sceneId } = pendingProse;
    const currentSwb = scenesWithBeats.find(s => s.scene.id === sceneId);
    const maxSeq = currentSwb?.beats?.length
      ? Math.max(...currentSwb.beats.map(b => b.sequence_number))
      : 0;
    await supabase.from("beats").insert({
      scene_id:        sceneId,
      sequence_number: maxSeq + 1,
      type:            "moment",
      directive:       beatDirective,
      prose_text:      prose,
    });
    const freshBeats = await fetchBeats(sceneId);
    setScenesWithBeats(prev => prev.map(s => s.scene.id === sceneId ? { ...s, beats: freshBeats } : s));
    setPendingProse(null);
    setDirective("");
    if (taRef.current) { taRef.current.value = ""; taRef.current.style.height = ""; }
    setTimeout(() => proseRef.current?.scrollTo({ top: proseRef.current.scrollHeight, behavior: "smooth" }), 80);
  };

  const saveBeatProse = async (beatId, text) => {
    setEditingBeatId(null);
    await supabase.from("beats").update({ prose_text: text }).eq("id", beatId);
    setScenesWithBeats(prev => prev.map(sw => ({
      ...sw,
      beats: sw.beats.map(b => b.id === beatId ? { ...b, prose_text: text } : b),
    })));
  };

  const currentParentId = locStack.length ? locStack[locStack.length - 1] : null;
  const visibleLocs = allLocs
    .filter(l => (l.parent_id ?? null) === currentParentId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const openCharDrop = e => {
    const r = e.currentTarget.getBoundingClientRect();
    setCharDropPos({ top: r.bottom + 4, left: r.left });
    setShowChar(p => !p);
  };

  const charDropdown = showChar ? createPortal(
    (() => {
      const groupNames = new Set(allGroups.map(g => g.name));
      const grouped = allGroups
        .map(g => ({ name: g.name, chars: available.filter(c => c.character_group === g.name) }))
        .filter(g => g.chars.length > 0);
      const ungrouped = available.filter(c => !groupNames.has(c.character_group));
      const charRow = c => {
        const color = c.link_color || "#7a6e62";
        return (
          <div key={c.id}
            style={{ padding:"5px 10px", fontSize:12, cursor:"pointer", fontFamily:"sans-serif", display:"flex", alignItems:"center", gap:7 }}
            onMouseEnter={e => e.currentTarget.style.background="var(--bg4)"}
            onMouseLeave={e => e.currentTarget.style.background="transparent"}
            onClick={() => addChar(c)}>
            {c.portrait_url
              ? <img src={c.portrait_url} style={{ width:20, height:20, borderRadius:"50%", objectFit:"cover", border:`1px solid ${color}`, flexShrink:0 }} alt={c.name} />
              : <div style={{ width:20, height:20, borderRadius:"50%", background:color+"22", border:`1px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color, fontFamily:"sans-serif", flexShrink:0 }}>{c.name[0]}</div>
            }
            <span style={{ color }}>{c.name}</span>
          </div>
        );
      };
      return (
        <div ref={charDropRef} style={{ position:"fixed", top: charDropPos?.top ?? 0, left: charDropPos?.left ?? 0, zIndex:9999, background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:6, minWidth:220, maxHeight:500, overflowY:"auto", boxShadow:"0 4px 20px #00000070" }}>
          {available.length === 0
            ? <div style={{ padding:"8px 12px", fontSize:12, color:"var(--text4)", fontStyle:"italic", fontFamily:"sans-serif" }}>All characters added</div>
            : <>
                {grouped.map(g => (
                  <div key={g.name}>
                    <div
                      style={{ padding:"6px 10px 2px", fontSize:9, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}
                      onMouseEnter={e => e.currentTarget.style.color="var(--text)"}
                      onMouseLeave={e => e.currentTarget.style.color="var(--text4)"}
                      onClick={() => g.chars.forEach(c => addChar(c))}>
                      <span>{g.name}</span>
                      <span style={{ fontSize:11, marginRight:2 }}>+</span>
                    </div>
                    {g.chars.map(charRow)}
                  </div>
                ))}
                {ungrouped.length > 0 && (
                  <div>
                    {grouped.length > 0 && <div style={{ padding:"6px 10px 2px", fontSize:9, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase" }}>Other</div>}
                    {ungrouped.map(charRow)}
                  </div>
                )}
              </>
          }
        </div>
      );
    })(),
    document.body
  ) : null;

  return (
    <>
      <style>{CSS}</style>
      <div style={{ height:"100vh", background:"var(--bg)", color:"var(--text)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* ── PORTRAIT BAND — full width ── */}
        <div style={{ height:200, flexShrink:0, background:"var(--bg2)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 16px", overflowX:"auto", gap:10 }}>
          {/* portraits */}
          {sceneChars.length === 0 ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text4)", fontStyle:"italic", fontSize:13, fontFamily:"sans-serif" }}>
              No characters in scene
            </div>
          ) : (
            sceneChars.map(c => {
              const color = c.link_color || "#7a6e62";
              const isPov = povCharId ? c.id === povCharId : c.name === "Zep";
              const borderColor = isPov ? "var(--gold)" : color;
              return (
                <div key={c.id} title={`${c.name} · double-click to remove`}
                  onDoubleClick={() => removeChar(c.id)}
                  style={{ flexShrink:1, flexBasis:160, minWidth:80, display:"flex", flexDirection:"column", cursor:"pointer" }}>
                  {c.portrait_url
                    ? <img src={c.portrait_url} alt={c.name} style={{ width:"100%", height:175, objectFit:"cover", objectPosition:"top", borderBottom:`3px solid ${borderColor}`, display:"block" }} />
                    : <div style={{ width:"100%", height:175, background:color+"22", borderBottom:`3px solid ${borderColor}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:44, color, fontFamily:"sans-serif", fontWeight:"bold" }}>{c.name[0]}</div>
                  }
                  <div style={{ fontSize:10, fontFamily:"sans-serif", color, textAlign:"center", padding:"4px 4px 0", lineHeight:1.3 }}>{c.name}</div>
                </div>
              );
            })
          )}
        </div>

        {/* ── BOTTOM ROW ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* LEFT PANEL */}
          <div ref={leftPanelRef} style={{ width:220, flexShrink:0, background:"var(--bg2)", borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {showLoc ? (
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
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
                <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:6 }}>
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
                    style={{ width:"100%", textAlign:"center", fontSize:12, color:"#1a1410", fontFamily:"sans-serif", padding:"6px 0", background:"var(--gold2)", border:"1px solid var(--gold)", borderRadius:4, cursor:"pointer", fontWeight:"bold", letterSpacing:"0.03em" }}>
                    ✍ Write
                  </button>
                  <Link to="/codex" style={{ display:"block", width:"100%", textAlign:"center", fontSize:11, color:"var(--text4)", fontFamily:"sans-serif", textDecoration:"none", letterSpacing:"0.05em", padding:"5px 0", background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4 }}>Codex ↗</Link>
                </div>

                {/* + character */}
                <div ref={charRef} style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid var(--border)" }}>
                  <button onClick={openCharDrop} style={{ width:"100%", background:"none", border:"1px dashed var(--border2)", borderRadius:4, color:"var(--text4)", fontSize:11, fontFamily:"sans-serif", cursor:"pointer", padding:"5px 0" }}>
                    + character
                  </button>
                </div>

                {/* chapter + scene */}
                <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:6 }}>
                  <select style={selFull} value={selCh||""} onChange={onChapter} disabled={phase==="loading"}>
                    {chapters.map(c => <option key={c.id} value={c.id}>{c.sequence_number}. {c.title}</option>)}
                  </select>
                  <select style={selFull} value={selSc||""} onChange={onScene} disabled={phase==="loading"||!scenes.length}>
                    {scenes.map(s => <option key={s.id} value={s.id}>{s.sequence_number}. {s.title}</option>)}
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

          {/* MAIN AREA */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* PROSE AREA */}
            <div ref={proseRef} style={{ flex:1, overflowY:"auto", padding:"24px 32px" }}>
              {phase==="loading" && (
                <div style={{ color:"var(--text4)", fontStyle:"italic", fontSize:13, padding:"48px 0", textAlign:"center", fontFamily:"sans-serif" }}>Loading…</div>
              )}
              {phase==="error" && (
                <div style={{ background:"#1a1210", border:"1px solid #3a2020", borderRadius:5, padding:"14px 18px", color:"#c07060", fontSize:13, fontFamily:"sans-serif", lineHeight:1.6 }}>
                  <strong>Could not connect to database.</strong><br />{err}<br />
                  <span style={{ opacity:.7, fontSize:12 }}>Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.</span>
                </div>
              )}
              {phase==="ready" && scenesWithBeats.length === 0 && (
                <div style={{ color:"var(--text4)", fontStyle:"italic", fontSize:13, padding:"48px 0", textAlign:"center", fontFamily:"sans-serif" }}>No scenes for this chapter.</div>
              )}
              {phase==="ready" && scenesWithBeats.map(({ scene, beats }) => (
                <div key={scene.id} id={scene.id}>
                  <h2 style={{ fontSize:14, color:"var(--gold)", fontFamily:"sans-serif", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:16, marginTop:32, paddingBottom:8, borderBottom:"1px solid var(--border)" }}>
                    {scene.sequence_number}. {scene.title}
                  </h2>
                  {beats.length === 0
                    ? <div style={{ color:"var(--text4)", fontStyle:"italic", fontSize:13, fontFamily:"sans-serif" }}>No beats for this scene yet.</div>
                    : <div style={{ fontSize:16, lineHeight:2.0, color:"#ffffff", fontFamily:"Georgia, serif", whiteSpace:"pre-wrap", textAlign:"left" }}>
                        {beats.filter(b => b.prose_text).map((b, i) => (
                          <div key={b.id} style={{ marginTop: i > 0 ? "1.5em" : 0 }}>
                            {editingBeatId === b.id
                              ? <textarea
                                  value={editingText}
                                  onChange={e => setEditingText(e.target.value)}
                                  onBlur={() => saveBeatProse(b.id, editingText)}
                                  onKeyDown={e => { if (e.key === "Escape") setEditingBeatId(null); }}
                                  autoFocus
                                  style={{ width:"100%", background:"var(--bg3)", color:"#ffffff", border:"1px solid var(--gold2)", borderRadius:4, fontSize:16, lineHeight:2.0, fontFamily:"Georgia, serif", padding:"8px 12px", resize:"vertical", minHeight:120, whiteSpace:"pre-wrap", boxSizing:"border-box" }}
                                />
                              : <span
                                  onClick={() => { setEditingBeatId(b.id); setEditingText(b.prose_text); }}
                                  style={{ cursor:"text", display:"block" }}
                                  title="Click to edit"
                                >
                                  {b.prose_text}
                                </span>
                            }
                          </div>
                        ))}
                      </div>
                  }
                </div>
              ))}
              {/* PENDING / GENERATING BLOCK */}
              {phase==="ready" && (generating || (pendingProse && pendingProse.sceneId === selSc)) && (
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
            </div>

            {/* INPUT BAR */}
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
          </div>
        </div>
      </div>
      {charDropdown}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProseViewer />} />
      <Route path="/codex" element={<Codex />} />
      <Route path="/places" element={<Places />} />
    </Routes>
  );
}
