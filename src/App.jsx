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
const fetchLocations = async () => {
  const { data } = await supabase.from("settlements").select("id, name").order("name");
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
  const [timeOfDay,       setTimeOfDay]       = useState("Evening");
  const [mode,            setMode]            = useState("narrative");
  const [showLoc,         setShowLoc]         = useState(false);
  const [showChar,        setShowChar]        = useState(false);
  const [charDropPos,     setCharDropPos]     = useState(null);
  const locRef        = useRef(null);
  const charRef       = useRef(null);
  const charDropRef   = useRef(null);
  const taRef         = useRef(null);

  // close dropdowns on outside click
  useEffect(() => {
    const h = e => {
      if (locRef.current  && !locRef.current.contains(e.target))  setShowLoc(false);
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
          fetchChapters(), fetchCharacters(), fetchGroups(), fetchLocations(),
          supabase.from("stories").select("title").eq("id", STORY_ID).single(),
          supabase.from("scene_state").select("*").eq("story_id", STORY_ID).single(),
        ]);
        if (story?.title) setStoryTitle(story.title);
        setAllChars(chars); setAllGroups(grps); setAllLocs(locs);
        if (!chs.length) { setPhase("ready"); return; }
        setChapters(chs);

        if (state) {
          if (state.location_text) setLocation(state.location_text);
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
        time_of_day:          timeOfDay,
        scene_mode:           mode,
        active_character_ids: sceneChars.map(c => c.id),
        updated_at:           new Date().toISOString(),
      }, { onConflict: "story_id" });
    }, 1000);
    return () => clearTimeout(timer);
  }, [selCh, selSc, location, timeOfDay, mode, sceneChars]);

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
                    <div style={{ padding:"6px 10px 2px", fontSize:9, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase" }}>{g.name}</div>
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

  const currentMode = MODES.find(m => m.key === mode) || MODES[0];

  return (
    <>
      <style>{CSS}</style>
      <div style={{ height:"100vh", background:"var(--bg)", color:"var(--text)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* ── PORTRAIT BAND — full width ── */}
        <div style={{ height:200, flexShrink:0, background:"var(--bg2)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"flex-end", padding:"0 16px", overflowX:"auto", gap:10 }}>
          {/* portraits */}
          {sceneChars.length === 0 ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text4)", fontStyle:"italic", fontSize:13, fontFamily:"sans-serif" }}>
              No characters in scene
            </div>
          ) : (
            sceneChars.map(c => {
              const color = c.link_color || "#7a6e62";
              return (
                <div key={c.id} title={`${c.name} · double-click to remove`}
                  onDoubleClick={() => removeChar(c.id)}
                  style={{ flexShrink:0, width:160, display:"flex", flexDirection:"column", cursor:"pointer" }}>
                  {c.portrait_url
                    ? <img src={c.portrait_url} alt={c.name} style={{ width:160, height:175, objectFit:"cover", objectPosition:"top", borderBottom:`3px solid ${color}`, display:"block" }} />
                    : <div style={{ width:160, height:175, background:color+"22", borderBottom:`3px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:44, color, fontFamily:"sans-serif", fontWeight:"bold" }}>{c.name[0]}</div>
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
          <div style={{ width:220, flexShrink:0, background:"var(--bg2)", borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", overflowY:"auto" }}>

            {/* codex link */}
            <div style={{ padding:"8px", flexShrink:0, borderBottom:"1px solid var(--border)" }}>
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
              <div ref={locRef} style={{ position:"relative" }}>
                <button style={fullBtn} onClick={() => setShowLoc(p => !p)}>
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{location}</span>
                  <span style={{ fontSize:9, color:"var(--text4)", flexShrink:0 }}>▾</span>
                </button>
                {showLoc && (
                  <div style={dropBase}>
                    {allLocs.length === 0
                      ? <div style={{ padding:"8px 10px", fontSize:12, color:"var(--text4)", fontStyle:"italic", fontFamily:"sans-serif" }}>No locations yet</div>
                      : allLocs.map(l => (
                        <div key={l.id} style={dropItem}
                          onMouseEnter={e => e.currentTarget.style.background="var(--bg4)"}
                          onMouseLeave={e => e.currentTarget.style.background="transparent"}
                          onClick={() => { setLocation(l.name); setShowLoc(false); }}>
                          {l.name}
                        </div>
                      ))
                    }
                    <div style={{ borderTop:"1px solid var(--border)", padding:"6px 8px" }}>
                      <input placeholder="Type location…"
                        style={{ background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text)", fontSize:12, padding:"4px 8px", width:"100%", fontFamily:"sans-serif", outline:"none" }}
                        onKeyDown={e => { if (e.key==="Enter" && e.target.value.trim()) { setLocation(e.target.value.trim()); setShowLoc(false); }}} />
                    </div>
                  </div>
                )}
              </div>
              <select style={selFull} value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)}>
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* mode */}
            <div style={{ padding:"8px", flexShrink:0, display:"flex", flexDirection:"column", gap:2 }}>
              {MODES.map(m => (
                <button key={m.key} onClick={() => setMode(m.key)} style={{
                  display:"flex", alignItems:"center", gap:7,
                  background: mode===m.key ? "var(--bg4)" : "none",
                  border: mode===m.key ? `1px solid ${m.color}55` : "1px solid transparent",
                  borderRadius:4, padding:"4px 7px", cursor:"pointer",
                  fontFamily:"sans-serif", fontSize:12,
                  color: mode===m.key ? m.color : "var(--text4)",
                  textAlign:"left", width:"100%",
                }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", flexShrink:0, display:"inline-block", background: mode===m.key ? m.color : "var(--text4)" }} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* MAIN AREA */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* PROSE AREA */}
            <div style={{ flex:1, overflowY:"auto", padding:"24px 32px" }}>
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
                        {beats.map(b => b.prose_text || "").filter(Boolean).join("\n\n")}
                      </div>
                  }
                </div>
              ))}
            </div>

            {/* INPUT BAR */}
            <div style={{ flexShrink:0, background:"var(--bg3)", borderTop:"1px solid var(--border)", padding:"10px 16px", display:"flex", gap:10, alignItems:"flex-end" }}>
              <textarea ref={taRef} placeholder="Write a directive…" rows={1}
                onInput={e => { e.target.style.height="auto"; e.target.style.height=`${e.target.scrollHeight}px`; }}
                style={{ flex:1, background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text)", fontSize:13, fontFamily:"sans-serif", lineHeight:1.6, padding:"6px 10px", resize:"none", outline:"none", minHeight:34, maxHeight:120, overflow:"auto" }} />
              <button disabled style={{ flexShrink:0, background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text4)", fontSize:12, fontFamily:"sans-serif", padding:"6px 14px", cursor:"not-allowed", opacity:0.5 }}>
                Generate
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
