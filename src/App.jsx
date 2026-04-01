import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
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
  @keyframes pulse-amber { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  .spin { display:inline-block; width:11px; height:11px; border:2px solid rgba(201,168,108,0.25); border-top-color:#c9a86c; border-radius:50%; animation:spin 0.7s linear infinite; vertical-align:middle; }
  select optgroup { color:#c9a86c; font-size:10px; font-family:sans-serif; letter-spacing:0.08em; font-style:normal; }
  select option { color:#ffffff; font-family:sans-serif; font-size:12px; }
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
    .from("beats").select("id, sequence_number, type, directive, emotional_register, tags, prose_text, snap_location_id, snap_time_of_day, snap_scene_mode, snap_active_character_ids, snap_pov_character_id")
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
  const [chapters,           setChapters]           = useState([]);
  const [scenes,             setScenes]             = useState([]);
  const [scenesWithBeats,    setScenesWithBeats]    = useState([]);
  const [allScenesByChapter, setAllScenesByChapter] = useState({});
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
  const [povCharacterId, setPovCharacterId] = useState(null);
  const [directive,      setDirective]      = useState("");
  const [generating,     setGenerating]     = useState(false);
  const [pendingProse,   setPendingProse]   = useState(null); // { prose, directive, sceneId, sceneState }
  const [uncertainChars, setUncertainChars] = useState({}); // { charId: true }
  const [editingBeatId,  setEditingBeatId]  = useState(null);
  const [editingText,    setEditingText]    = useState("");
  const [activeBeatId,   setActiveBeatId]   = useState(null);
  const prevActiveBeatIdRef = useRef(null);
  const leftPanelRef  = useRef(null);
  const charRef       = useRef(null);
  const charDropRef   = useRef(null);
  const taRef         = useRef(null);
  const directiveRef  = useRef(null);
  const proseRef      = useRef(null);
  const beatClickRef      = useRef(null);
  const beatRefs          = useRef({});
  const candidateBeatRef  = useRef(null);
  const snapDebounceRef   = useRef(null);
  const observerRef       = useRef(null);
  const scrollContainerRef = useRef(null);

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

        // Preload scene lists for all chapters (no beats — just metadata for the combined nav select)
        const allScenesArrays = await Promise.all(chs.map(ch => fetchScenes(ch.id)));
        const sceneMap = {};
        chs.forEach((ch, i) => { sceneMap[ch.id] = allScenesArrays[i]; });
        setAllScenesByChapter(sceneMap);

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
          setPovCharacterId(state.pov_character_id || null);
        } else {
          await loadChapter(chs[0]);
        }

      } catch(e) { setErr(e.message); setPhase("error"); }
    })();
  }, [loadChapter]);

  const onCombinedSelect = useCallback(async e => {
    const sceneId = e.target.value;
    if (!sceneId) return;
    const ch = chapters.find(c => (allScenesByChapter[c.id] || []).some(s => s.id === sceneId));
    if (!ch) return;
    if (ch.id !== selCh) {
      await loadChapter(ch, sceneId);
      setTimeout(() => document.getElementById(sceneId)?.scrollIntoView({ behavior:"smooth" }), 100);
    } else {
      setSelSc(sceneId);
      document.getElementById(sceneId)?.scrollIntoView({ behavior:"smooth" });
    }
  }, [chapters, allScenesByChapter, selCh, loadChapter]);

  const addChar    = c => { if (!sceneChars.find(x => x.id === c.id)) setSceneChars(p => [...p, c]); setShowChar(false); };
  const removeChar = id => {
    setSceneChars(p => p.filter(c => c.id !== id));
    setUncertainChars(p => { const n = { ...p }; delete n[id]; return n; });
  };
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
        pov_character_id:     povCharacterId,
        updated_at:           new Date().toISOString(),
      }, { onConflict: "story_id" });
    }, 1000);
    return () => clearTimeout(timer);
  }, [selCh, selSc, location, locationId, timeOfDay, mode, sceneChars, povCharacterId]);

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
      setPendingProse({ prose: result.prose || "", directive, sceneId: selSc, sceneState: result.scene_state || null });
    } catch (e) {
      alert("Generation failed: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const acceptProse = async () => {
    if (!pendingProse) return;
    const { prose, directive: beatDirective, sceneId, sceneState } = pendingProse;

    // Save beat — capture inserted id for snap update
    const currentSwb = scenesWithBeats.find(s => s.scene.id === sceneId);
    const maxSeq = currentSwb?.beats?.length
      ? Math.max(...currentSwb.beats.map(b => b.sequence_number))
      : 0;
    const { data: inserted } = await supabase.from("beats").insert({
      scene_id:        sceneId,
      sequence_number: maxSeq + 1,
      type:            "moment",
      directive:       beatDirective,
      prose_text:      prose,
    }).select("id").single();
    const beatId = inserted?.id;

    const freshBeats = await fetchBeats(sceneId);
    setScenesWithBeats(prev => prev.map(s => s.scene.id === sceneId ? { ...s, beats: freshBeats } : s));

    // Resolve post-update state values locally (setState is async — compute here for snap)
    let snapLocationId  = locationId;
    let snapLocation    = location;
    let snapTimeOfDay   = timeOfDay;
    let snapMode        = mode;
    let snapChars       = [...sceneChars];

    // Apply scene_state updates
    if (sceneState) {
      // Location
      if (sceneState.location) {
        const { data: matched } = await supabase
          .from("places")
          .select("id, name")
          .ilike("name", sceneState.location)
          .limit(1)
          .single();
        if (matched) {
          snapLocationId = matched.id;
          snapLocation   = matched.name;
          setLocation(matched.name);
          setLocationId(matched.id);
        }
      }
      // Time of day
      if (sceneState.time_of_day) {
        snapTimeOfDay = sceneState.time_of_day;
        setTimeOfDay(sceneState.time_of_day);
      }
      // Mode
      if (sceneState.mode) {
        snapMode = sceneState.mode;
        setMode(sceneState.mode);
      }
      // Characters entered
      if (sceneState.characters?.entered?.length) {
        const additions = sceneState.characters.entered
          .map(name => allChars.find(c => c.name.toLowerCase() === name.toLowerCase()))
          .filter(c => c && !snapChars.find(p => p.id === c.id));
        if (additions.length) {
          snapChars = [...snapChars, ...additions];
          setSceneChars(snapChars);
        }
      }
      // Characters exited
      if (sceneState.characters?.exited?.length) {
        const clearExits  = sceneState.characters.exited.filter(x => x.confidence === "clear").map(x => x.name.toLowerCase());
        const uncertainEx = sceneState.characters.exited.filter(x => x.confidence === "uncertain");
        if (clearExits.length) {
          snapChars = snapChars.filter(c => !clearExits.includes(c.name.toLowerCase()));
          setSceneChars(snapChars);
        }
        if (uncertainEx.length) {
          setUncertainChars(prev => {
            const next = { ...prev };
            uncertainEx.forEach(x => {
              const match = snapChars.find(c => c.name.toLowerCase() === x.name.toLowerCase());
              if (match) next[match.id] = true;
            });
            return next;
          });
        }
      }
    }

    // Flush scene_state immediately (don't wait for debounce)
    await supabase.from("scene_state").upsert({
      story_id:             STORY_ID,
      current_chapter_id:   selCh,
      current_scene_id:     sceneId,
      location_text:        snapLocation,
      location_id:          snapLocationId,
      time_of_day:          snapTimeOfDay,
      scene_mode:           snapMode,
      active_character_ids: snapChars.map(c => c.id),
      pov_character_id:     povCharacterId,
      updated_at:           new Date().toISOString(),
    }, { onConflict: "story_id" });

    // Stamp resolved snapshot onto the beat
    if (beatId) {
      await supabase.from("beats").update({
        snap_location_id:          snapLocationId,
        snap_time_of_day:          snapTimeOfDay,
        snap_scene_mode:           snapMode,
        snap_active_character_ids: snapChars.map(c => c.id),
        snap_pov_character_id:     povCharacterId,
      }).eq("id", beatId);
    }

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

  // Clear active beat when scene changes
  useEffect(() => { setActiveBeatId(null); }, [selSc]);

  // Load snap state from a beat into the UI
  const loadBeatSnap = (beat) => {
    const hasSnap = beat.snap_location_id || beat.snap_time_of_day ||
                    beat.snap_scene_mode || beat.snap_active_character_ids?.length ||
                    beat.snap_pov_character_id;
    if (!hasSnap) return;
    if (beat.snap_active_character_ids?.length) {
      const chars = beat.snap_active_character_ids.map(id => allChars.find(c => c.id === id)).filter(Boolean);
      setSceneChars(chars);
    }
    if (beat.snap_location_id) {
      const loc = allLocs.find(l => l.id === beat.snap_location_id);
      if (loc) { setLocation(loc.name); setLocationId(loc.id); }
    }
    if (beat.snap_time_of_day) setTimeOfDay(beat.snap_time_of_day);
    if (beat.snap_scene_mode)  setMode(beat.snap_scene_mode);
    setPovCharacterId(beat.snap_pov_character_id ?? null);
  };

  // Scroll-driven snap: on scroll, find the beat closest to center and apply its snap
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const beats = scenesWithBeats.flatMap(s => s.beats);
    if (!beats.length) return;

    let timer = null;
    const handleScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const containerRect = container.getBoundingClientRect();
        const centerY = containerRect.top + containerRect.height / 2;
        let closest = null;
        let closestDist = Infinity;
        beats.forEach(b => {
          const el = beatRefs.current[b.id];
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const dist = Math.abs((rect.top + rect.height / 2) - centerY);
          if (dist < closestDist) { closestDist = dist; closest = b; }
        });
        if (!closest) return;
        if (closest.snap_active_character_ids?.length) {
          const snapChars = allChars.filter(c => closest.snap_active_character_ids.includes(c.id));
          setSceneChars(snapChars);
        }
        if (closest.snap_scene_mode) setMode(closest.snap_scene_mode);
        if (closest.snap_time_of_day) setTimeOfDay(closest.snap_time_of_day);
        if (closest.snap_location_id) {
          const snapPlace = allLocs.find(l => l.id === closest.snap_location_id);
          if (snapPlace) { setLocationId(snapPlace.id); setLocation(snapPlace.name); }
        }
      }, 300);
    };

    container.addEventListener('scroll', handleScroll);
    return () => { container.removeEventListener('scroll', handleScroll); clearTimeout(timer); };
  }, [scenesWithBeats, allChars, allLocs]);

  // Write-back snap columns whenever UI state changes while a beat is active.
  // Skip the first effect firing when activeBeatId itself changes (that's the snap load).
  useEffect(() => {
    if (!activeBeatId) return;
    if (activeBeatId !== prevActiveBeatIdRef.current) {
      prevActiveBeatIdRef.current = activeBeatId;
      return;
    }
    supabase.from("beats").update({
      snap_location_id:          locationId,
      snap_time_of_day:          timeOfDay,
      snap_scene_mode:           mode,
      snap_active_character_ids: sceneChars.map(c => c.id),
      snap_pov_character_id:     povCharacterId,
    }).eq("id", activeBeatId);
  }, [activeBeatId, sceneChars, locationId, timeOfDay, mode, povCharacterId]);

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
        <div style={{ height:240, flexShrink:0, borderBottom:"1px solid var(--border)", display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 16px", overflowX:"auto", gap:10, backgroundImage:`url("https://gjvegoinppbpfusttycs.supabase.co/storage/v1/object/public/Wescrafter%20Images/safeharbor_bg_silver_anchor_evening.png")`, backgroundSize:"cover", backgroundPosition:"center", backgroundRepeat:"no-repeat" }}>
          {/* portraits */}
          {sceneChars.length === 0 ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text4)", fontStyle:"italic", fontSize:13, fontFamily:"sans-serif" }}>
              No characters in scene
            </div>
          ) : (
            sceneChars.map(c => {
              const color = c.link_color || "#7a6e62";
              const isPov = c.id === povCharacterId;
              const isUncertain = !!uncertainChars[c.id];
              let longPressTimer = null;
              const togglePov = () => setPovCharacterId(prev => prev === c.id ? null : c.id);
              return (
                <div key={c.id} title={`${c.name}${isUncertain ? " · may have left" : ""} · right-click to set POV · double-click to remove`}
                  onDoubleClick={() => removeChar(c.id)}
                  onContextMenu={e => { e.preventDefault(); togglePov(); }}
                  onTouchStart={() => { longPressTimer = setTimeout(togglePov, 500); }}
                  onTouchEnd={() => clearTimeout(longPressTimer)}
                  onTouchMove={() => clearTimeout(longPressTimer)}
                  style={{ flexShrink:1, flexBasis:160, minWidth:80, display:"flex", flexDirection:"column", cursor:"pointer", position:"relative" }}>
                  {isUncertain && (
                    <div style={{ position:"absolute", top:6, right:6, width:10, height:10, borderRadius:"50%", background:"#e8a020", zIndex:2, boxShadow:"0 0 0 2px var(--bg2)", animation:"pulse-amber 1.6s ease-in-out infinite" }} />
                  )}
                  {c.portrait_url
                    ? <img src={c.portrait_url} alt={c.name} style={{ width:"100%", height:215, objectFit:"cover", objectPosition:"top", borderBottom:`3px solid ${color}`, display:"block" }} />
                    : <div style={{ width:"100%", height:215, background:color+"22", borderBottom:`3px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:44, color, fontFamily:"sans-serif", fontWeight:"bold" }}>{c.name[0]}</div>
                  }
                  <div style={{ height:3, background: isPov ? "var(--gold)" : "transparent", borderRadius:2, marginTop:2 }} />
                  <div style={{ fontSize:10, fontFamily:"sans-serif", color, textAlign:"center", padding:"4px 4px 0", lineHeight:1.3 }}>{c.name}</div>
                </div>
              );
            })
          )}
        </div>

        {/* ── BOTTOM ROW ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* LEFT PANEL */}
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

          {/* MAIN AREA */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* PROSE AREA */}
            <div ref={el => { proseRef.current = el; scrollContainerRef.current = el; }} style={{ flex:1, overflowY:"auto", padding:"24px 32px" }}>
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
                          <div key={b.id} ref={el => { beatRefs.current[b.id] = el; }} data-beat-id={b.id} style={{ marginTop: i > 0 ? "1.5em" : 0, borderLeft: activeBeatId === b.id ? "2px solid rgba(184,148,72,0.4)" : "2px solid transparent", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingLeft: 10, paddingBottom: "1.2rem", marginBottom: "1.2rem", transition:"border-color 0.15s" }}>
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
                                  onClick={() => {
                                    clearTimeout(beatClickRef.current);
                                    beatClickRef.current = setTimeout(() => {
                                      setActiveBeatId(b.id);
                                      const snapChars = allChars?.filter(c => b.snap_active_character_ids?.includes(c.id));
                                      if (snapChars && snapChars.length > 0) setSceneChars(snapChars);
                                      if (b.snap_scene_mode) setMode(b.snap_scene_mode);
                                      if (b.snap_time_of_day) setTimeOfDay(b.snap_time_of_day);
                                      const snapPlace = allLocs?.find(l => l.id === b.snap_location_id);
                                      if (snapPlace) { setLocationId(snapPlace.id); setLocation(snapPlace.name); }
                                      if (b.snap_pov_character_id) setPovCharacterId(b.snap_pov_character_id);
                                    }, 220);
                                  }}
                                  onDoubleClick={() => {
                                    clearTimeout(beatClickRef.current);
                                    setEditingBeatId(b.id);
                                    setEditingText(b.prose_text);
                                  }}
                                  style={{ cursor:"text", display:"block" }}
                                  title="Click to load snap · Double-click to edit"
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
