import { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import Codex from "./Codex.jsx";
import Places from "./Places.jsx";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const STORY_ID = "ca821271-2bca-4b3c-bdf7-7224e0b4e8b3";
const CODEX_URL = "/codex"; // update once codex is deployed
const TIMES = ["Dawn","Morning","Noon","Afternoon","Evening","Night","Midnight"];

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
  select:focus, button:focus { outline: 2px solid var(--gold2); outline-offset: 1px; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg2); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
  .chip:hover .chip-x { opacity: 1 !important; }
`;

// ── Supabase queries ──────────────────────────────────────────────────────────
const fetchChapters = async () => {
  const { data } = await supabase
    .from("chapters")
    .select("id, sequence_number, title")
    .eq("story_id", STORY_ID)
    .order("sequence_number", { ascending: true });
  return data || [];
};

const fetchScenes = async (chapterId) => {
  const { data } = await supabase
    .from("scenes")
    .select("id, sequence_number, title, mood")
    .eq("chapter_id", chapterId)
    .order("sequence_number", { ascending: true });
  return data || [];
};

const fetchBeats = async (sceneId) => {
  const { data } = await supabase
    .from("beats")
    .select("id, sequence_number, type, directive, emotional_register, tags, prose_text")
    .eq("scene_id", sceneId)
    .order("sequence_number", { ascending: true });
  return data || [];
};

const fetchCharacters = async () => {
  const { data } = await supabase
    .from("characters")
    .select("id, name, portrait_url, character_groups(link_color)")
    .order("name");
  return (data || []).map(c => ({
    ...c,
    link_color: c.character_groups?.link_color || "#7a6e62"
  }));
};

const fetchLocations = async () => {
  const { data } = await supabase
    .from("settlements")
    .select("id, name")
    .order("name");
  return data || [];
};

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  app:    { minHeight:"100vh", background:"var(--bg)", color:"var(--text)", display:"flex", flexDirection:"column" },
  nav:    { background:"var(--bg2)", borderBottom:"1px solid var(--border)", padding:"0 16px", height:48, display:"flex", alignItems:"center", gap:10, flexShrink:0 },
  logo:   { fontSize:13, fontWeight:"bold", color:"var(--gold)", letterSpacing:"0.07em", fontFamily:"sans-serif", flexShrink:0, whiteSpace:"nowrap" },
  vdiv:   { width:1, height:22, background:"var(--border)", flexShrink:0 },
  dWrap:  { display:"flex", alignItems:"center", gap:6, minWidth:0, flex:1 },
  lbl:    { fontSize:10, color:"var(--text3)", fontFamily:"sans-serif", letterSpacing:"0.08em", textTransform:"uppercase", flexShrink:0 },
  sel:    { background:"var(--bg4)", color:"var(--text)", border:"1px solid var(--border2)", borderRadius:4, padding:"4px 24px 4px 8px", fontSize:12, fontFamily:"sans-serif", cursor:"pointer", minWidth:0, flex:1, backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%237a6e62'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 7px center" },
  codexBtn:{ marginLeft:"auto", flexShrink:0, fontSize:11, fontFamily:"sans-serif", color:"var(--text3)", background:"none", border:"1px solid var(--border)", borderRadius:4, padding:"3px 9px", cursor:"pointer", letterSpacing:"0.05em", textDecoration:"none", display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap" },
  stateBar:{ background:"var(--bg3)", borderBottom:"1px solid var(--border)", padding:"0 16px", minHeight:48, display:"flex", alignItems:"center", gap:0, flexShrink:0, flexWrap:"wrap" },
  locBtn: { background:"none", border:"none", cursor:"pointer", padding:"4px 10px", color:"var(--gold)", fontSize:13, fontFamily:"sans-serif", display:"flex", alignItems:"center", gap:5, flexShrink:0, borderRight:"1px solid var(--border)", height:48 },
  locDropWrap:{ position:"relative", flexShrink:0 },
  locDrop:{ position:"absolute", top:"calc(100% + 2px)", left:0, background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:6, zIndex:50, minWidth:200, boxShadow:"0 4px 20px #00000070", overflow:"hidden" },
  locSec: { fontSize:10, color:"var(--text4)", letterSpacing:"0.1em", textTransform:"uppercase", padding:"8px 12px 4px", fontFamily:"sans-serif" },
  locItem:{ padding:"7px 12px", fontSize:13, cursor:"pointer", color:"var(--text)", fontFamily:"sans-serif" },
  timeItem:{ padding:"6px 12px", fontSize:12, cursor:"pointer", color:"var(--text3)", fontFamily:"sans-serif", fontStyle:"italic" },
  charZone:{ display:"flex", alignItems:"center", gap:7, flex:1, padding:"6px 10px", flexWrap:"wrap", minHeight:48 },
  addBtn: { background:"none", border:"1px dashed var(--border2)", borderRadius:4, color:"var(--text4)", fontSize:11, fontFamily:"sans-serif", cursor:"pointer", padding:"3px 8px", flexShrink:0 },
  charDrop:{ position:"absolute", top:"calc(100% + 4px)", left:0, background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:6, zIndex:50, minWidth:180, maxHeight:260, overflowY:"auto", boxShadow:"0 4px 20px #00000070" },
  charItem:{ padding:"6px 10px", fontSize:12, cursor:"pointer", color:"var(--text)", fontFamily:"sans-serif", display:"flex", alignItems:"center", gap:7 },
  body:   { flex:1, padding:"24px 20px 60px", maxWidth:840, width:"100%", margin:"0 auto" },
  scHdr:  { marginBottom:22, paddingBottom:12, borderBottom:"1px solid var(--border)" },
  chLbl:  { fontSize:10, color:"var(--text3)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 },
  scTtl:  { fontSize:21, color:"var(--gold)", fontWeight:"normal", marginBottom:4 },
  scMeta: { fontSize:12, color:"var(--text4)", fontFamily:"sans-serif" },
  card:   { background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"15px 17px", marginBottom:11 },
  bNum:   { fontSize:10, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:7 },
  bDir:   { fontSize:15, lineHeight:1.7, color:"#d8cec4", marginBottom:9 },
  bReg:   { fontSize:12, color:"var(--text3)", fontStyle:"italic", marginBottom:7, fontFamily:"sans-serif" },
  tags:   { display:"flex", flexWrap:"wrap", gap:4 },
  tag:    { fontSize:10, background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:3, padding:"2px 6px", color:"var(--text3)", fontFamily:"sans-serif" },
  msg:    { color:"var(--text4)", fontStyle:"italic", fontSize:13, padding:"48px 0", textAlign:"center", fontFamily:"sans-serif" },
  err:    { background:"#1a1210", border:"1px solid #3a2020", borderRadius:5, padding:"14px 18px", color:"#c07060", fontSize:13, fontFamily:"sans-serif", marginTop:24, lineHeight:1.6 },
};

// ── Character chip ────────────────────────────────────────────────────────────
function CharChip({ char, onRemove }) {
  const color = char.link_color || "#7a6e62";
  return (
    <div className="chip"
      title={`${char.name} · double-click to remove`}
      onDoubleClick={() => onRemove(char.id)}
      style={{ position:"relative", cursor:"pointer", flexShrink:0 }}>
      {char.portrait_url
        ? <img src={char.portrait_url} alt={char.name}
            style={{ width:32, height:32, borderRadius:"50%", objectFit:"cover", border:`2px solid ${color}`, display:"block" }} />
        : <div style={{ width:32, height:32, borderRadius:"50%", background:color+"22", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color, fontFamily:"sans-serif", fontWeight:"bold" }}>
            {char.name[0]}
          </div>
      }
      <span className="chip-x" style={{ position:"absolute", top:-3, right:-3, background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:"50%", width:14, height:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"var(--text3)", opacity:0, transition:"opacity 0.15s", pointerEvents:"none" }}>✕</span>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function ProseViewer() {
  const [chapters,      setChapters]      = useState([]);
  const [scenes,        setScenes]        = useState([]);
  const [scenesWithBeats, setScenesWithBeats] = useState([]);
  const [selCh,         setSelCh]         = useState(null);
  const [selSc,         setSelSc]         = useState(null);
  const [chMeta,        setChMeta]        = useState(null);
  const [phase,         setPhase]         = useState("loading");
  const [storyTitle,    setStoryTitle]    = useState("");
  const [err,       setErr]       = useState("");
  const [allChars,  setAllChars]  = useState([]);
  const [allLocs,   setAllLocs]   = useState([]);
  const [sceneChars,setSceneChars]= useState([]);
  const [location,  setLocation]  = useState("Thorncliff Manor");
  const [timeOfDay, setTimeOfDay] = useState("Evening");
  const [showLoc,   setShowLoc]   = useState(false);
  const [showChar,  setShowChar]  = useState(false);
  const locRef  = useRef(null);
  const charRef = useRef(null);

  // close dropdowns on outside click
  useEffect(() => {
    const h = e => {
      if (locRef.current  && !locRef.current.contains(e.target))  setShowLoc(false);
      if (charRef.current && !charRef.current.contains(e.target)) setShowChar(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const loadChapter = useCallback(async (ch) => {
    setSelCh(ch.id); setChMeta(ch); setSelSc(null);
    setScenes([]); setScenesWithBeats([]); setPhase("loading");
    try {
      const scs = await fetchScenes(ch.id);
      setScenes(scs);
      if (scs.length) {
        setSelSc(scs[0].id);
        const swb = await Promise.all(scs.map(async sc => ({ scene: sc, beats: await fetchBeats(sc.id) })));
        setScenesWithBeats(swb);
      }
      setPhase("ready");
    } catch(e) { setErr(e.message); setPhase("error"); }
  }, []);

  // initial load
  useEffect(() => {
    (async () => {
      try {
        const [chs, chars, locs, { data: story }] = await Promise.all([
          fetchChapters(), fetchCharacters(), fetchLocations(),
          supabase.from("stories").select("title").eq("id", STORY_ID).single(),
        ]);
        if (story?.title) setStoryTitle(story.title);
        setAllChars(chars);
        setAllLocs(locs);
        if (!chs.length) { setPhase("ready"); return; }
        setChapters(chs);
        await loadChapter(chs[0]);
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
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const addChar    = c => { if (!sceneChars.find(x => x.id === c.id)) setSceneChars(p => [...p, c]); setShowChar(false); };
  const removeChar = id => setSceneChars(p => p.filter(c => c.id !== id));
  const available  = allChars.filter(c => !sceneChars.find(x => x.id === c.id));

  return (
    <>
      <style>{CSS}</style>
      <div style={S.app}>

        {/* nav */}
        <div style={S.nav}>
          <div style={{ display:"flex", flexDirection:"column", lineHeight:1.2 }}>
            <span style={{ fontSize:11, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase" }}>Story</span>
            <span style={{ fontSize:15, color:"var(--gold)", fontFamily:"Georgia, serif" }}>{storyTitle || "Safe Harbor"}</span>
          </div>
          <div style={S.vdiv} />
          <div style={S.dWrap}>
            <span style={S.lbl}>Ch.</span>
            <select style={S.sel} value={selCh||""} onChange={onChapter} disabled={phase==="loading"}>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.sequence_number}. {c.title}</option>)}
            </select>
          </div>
          <div style={S.vdiv} />
          <div style={S.dWrap}>
            <span style={S.lbl}>Scene</span>
            <select style={S.sel} value={selSc||""} onChange={onScene} disabled={phase==="loading"||!scenes.length}>
              {scenes.map(s => <option key={s.id} value={s.id}>{s.sequence_number}. {s.title}</option>)}
            </select>
          </div>
          <a href={CODEX_URL} style={S.codexBtn}>Codex ↗</a>
        </div>

        {/* scene state bar */}
        <div style={S.stateBar}>
          <div ref={locRef} style={S.locDropWrap}>
            <button style={S.locBtn} onClick={() => setShowLoc(p => !p)}>
              <span>📍</span>
              <span>{location}</span>
              <span style={{fontSize:11, color:"var(--text3)"}}>· {timeOfDay}</span>
              <span style={{fontSize:10, color:"var(--text4)"}}>▾</span>
            </button>
            {showLoc && (
              <div style={S.locDrop}>
                <div style={S.locSec}>Location</div>
                {allLocs.length === 0
                  ? <div style={{padding:"8px 12px", fontSize:12, color:"var(--text4)", fontStyle:"italic", fontFamily:"sans-serif"}}>No locations yet</div>
                  : allLocs.map(l => (
                    <div key={l.id} style={S.locItem}
                      onMouseEnter={e => e.currentTarget.style.background="var(--bg4)"}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}
                      onClick={() => { setLocation(l.name); setShowLoc(false); }}>
                      {l.name}
                    </div>
                  ))
                }
                <div style={{borderTop:"1px solid var(--border)", padding:"6px 10px"}}>
                  <input placeholder="Type location…"
                    style={{background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text)", fontSize:12, padding:"4px 8px", width:"100%", fontFamily:"sans-serif", outline:"none"}}
                    onKeyDown={e => { if (e.key==="Enter" && e.target.value.trim()) { setLocation(e.target.value.trim()); setShowLoc(false); }}} />
                </div>
                <div style={{borderTop:"1px solid var(--border)"}} />
                <div style={S.locSec}>Time of Day</div>
                {TIMES.map(t => (
                  <div key={t} style={{...S.timeItem, color:t===timeOfDay?"var(--gold)":"var(--text3)", fontWeight:t===timeOfDay?"bold":"normal"}}
                    onMouseEnter={e => e.currentTarget.style.background="var(--bg4)"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}
                    onClick={() => { setTimeOfDay(t); setShowLoc(false); }}>
                    {t}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{width:1, height:36, background:"var(--border)", flexShrink:0}} />

          <div style={S.charZone}>
            {sceneChars.map(c => <CharChip key={c.id} char={c} onRemove={removeChar} />)}
            <div ref={charRef} style={{position:"relative", flexShrink:0}}>
              <button style={S.addBtn} onClick={() => setShowChar(p => !p)}>+ character</button>
              {showChar && (
                <div style={S.charDrop}>
                  {available.length === 0
                    ? <div style={{padding:"8px 12px", fontSize:12, color:"var(--text4)", fontStyle:"italic", fontFamily:"sans-serif"}}>All characters added</div>
                    : available.map(c => {
                      const color = c.link_color || "#7a6e62";
                      return (
                        <div key={c.id} style={S.charItem}
                          onMouseEnter={e => e.currentTarget.style.background="var(--bg4)"}
                          onMouseLeave={e => e.currentTarget.style.background="transparent"}
                          onClick={() => addChar(c)}>
                          {c.portrait_url
                            ? <img src={c.portrait_url} style={{width:22, height:22, borderRadius:"50%", objectFit:"cover", border:`1px solid ${color}`}} />
                            : <div style={{width:22, height:22, borderRadius:"50%", background:color+"22", border:`1px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color, fontFamily:"sans-serif"}}>{c.name[0]}</div>
                          }
                          <span style={{color, fontFamily:"sans-serif", fontSize:13}}>{c.name}</span>
                        </div>
                      );
                    })
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {/* body */}
        <div style={S.body}>
          {phase==="loading" && <div style={S.msg}>Loading…</div>}
          {phase==="error" && (
            <div style={S.err}>
              <strong>Could not connect to database.</strong><br />{err}<br />
              <span style={{opacity:.7, fontSize:12}}>Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.</span>
            </div>
          )}
          {phase==="ready" && scenesWithBeats.length === 0 && <div style={S.msg}>No scenes for this chapter.</div>}
          {phase==="ready" && scenesWithBeats.length > 0 && (
            <>
              {scenesWithBeats.map(({ scene, beats }) => (
                <div key={scene.id} id={scene.id}>
                  <h2 style={{ fontSize:14, color:"var(--gold)", fontFamily:"sans-serif", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:16, marginTop:32, paddingBottom:8, borderBottom:"1px solid var(--border)" }}>
                    {scene.sequence_number}. {scene.title}
                  </h2>
                  {beats.length === 0
                    ? <div style={S.msg}>No beats for this scene yet.</div>
                    : <div style={{ fontSize:16, lineHeight:2.0, color:"#ffffff", fontFamily:"Georgia, serif", whiteSpace:"pre-wrap", textAlign:"left" }}>
                        {beats.map(b => b.prose_text || "").filter(Boolean).join("\n\n")}
                      </div>
                  }
                </div>
              ))}
            </>
          )}
        </div>
      </div>
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