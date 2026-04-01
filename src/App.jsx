import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Routes, Route } from "react-router-dom";
import Codex from "./Codex.jsx";
import Places from "./Places.jsx";
import PortraitBand from "./PortraitBand.jsx";
import WritePanel from "./WritePanel.jsx";
import LeftPanel from "./LeftPanel.jsx";
import { supabase, STORY_ID, WORLD_ID, TIMES, MODES, CSS, selFull, panelLbl, fullBtn, dropBase, dropItem, fetchChapters, fetchScenes, fetchBeats, fetchCharacters, fetchGroups, fetchPlaces } from "./constants.js";

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
  const [charPositions,   setCharPositions]   = useState({}); // { [charId]: { x, y, z, scale } }
  const [selectedCharId,  setSelectedCharId]  = useState(null);
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
  const bandRef                    = useRef(null);

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
    setScenes([]); setScenesWithBeats([]); setCharPositions({}); setPhase("loading");
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

  const saveSceneState = async (overrideCharIds) => {
    if (!selCh) return;
    await supabase.from("scene_state").upsert({
      story_id:             STORY_ID,
      current_chapter_id:   selCh,
      current_scene_id:     selSc,
      location_text:        location,
      location_id:          locationId,
      time_of_day:          timeOfDay,
      scene_mode:           mode,
      active_character_ids: overrideCharIds ?? sceneChars.map(c => c.id),
      pov_character_id:     povCharacterId,
      updated_at:           new Date().toISOString(),
    }, { onConflict: "story_id" });
  };

  const addChar    = c => { if (!sceneChars.find(x => x.id === c.id)) { setSceneChars(p => [...p, c]); } setShowChar(false); };
  const removeChar = id => {
    const updatedChars = sceneChars.filter(c => c.id !== id);
    setSceneChars(updatedChars);
    setUncertainChars(p => { const n = { ...p }; delete n[id]; return n; });
    if (activeBeatId) {
      const updatedIds = updatedChars.map(c => c.id);
      supabase.from("beats").update({ snap_active_character_ids: updatedIds }).eq("id", activeBeatId);
      setScenesWithBeats(prev => prev.map(sw => ({
        ...sw,
        beats: sw.beats.map(b => b.id === activeBeatId ? { ...b, snap_active_character_ids: updatedIds } : b),
      })));
    }
    saveSceneState(updatedChars.map(c => c.id));
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

  // Remove charPositions for characters no longer in scene
  useEffect(() => {
    setCharPositions(prev => {
      const ids = new Set(sceneChars.map(c => c.id));
      return Object.fromEntries(Object.entries(prev).filter(([k]) => ids.has(k)));
    });
  }, [sceneChars]);

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
  // Skip only when activeBeatId itself just changed (snap load). State edits on same beat always save.
  useEffect(() => {
    if (!activeBeatId) return;
    const beatJustChanged = activeBeatId !== prevActiveBeatIdRef.current;
    prevActiveBeatIdRef.current = activeBeatId;
    if (beatJustChanged) return;
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
        <PortraitBand
          sceneChars={sceneChars}
          charPositions={charPositions}
          setCharPositions={setCharPositions}
          selectedCharId={selectedCharId}
          setSelectedCharId={setSelectedCharId}
          povCharacterId={povCharacterId}
          setPovCharacterId={setPovCharacterId}
          uncertainChars={uncertainChars}
          removeChar={removeChar}
          bandRef={bandRef}
        />

        {/* ── BOTTOM ROW ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* LEFT PANEL */}
          <LeftPanel
            leftPanelRef={leftPanelRef}
            showLoc={showLoc}
            setShowLoc={setShowLoc}
            locStack={locStack}
            setLocStack={setLocStack}
            visibleLocs={visibleLocs}
            allLocs={allLocs}
            location={location}
            setLocation={setLocation}
            locationId={locationId}
            setLocationId={setLocationId}
            showMode={showMode}
            setShowMode={setShowMode}
            mode={mode}
            setMode={setMode}
            timeOfDay={timeOfDay}
            setTimeOfDay={setTimeOfDay}
            chapters={chapters}
            allScenesByChapter={allScenesByChapter}
            selSc={selSc}
            onCombinedSelect={onCombinedSelect}
            phase={phase}
            charRef={charRef}
            openCharDrop={openCharDrop}
            loadChapter={loadChapter}
            scenes={scenes}
            proseRef={proseRef}
            directiveRef={directiveRef}
          />

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
                              ? <div>
                                  <textarea
                                    value={editingText}
                                    onChange={e => setEditingText(e.target.value)}
                                    onBlur={() => saveBeatProse(b.id, editingText)}
                                    onKeyDown={e => { if (e.key === "Escape") setEditingBeatId(null); }}
                                    autoFocus
                                    style={{ width:"100%", background:"var(--bg3)", color:"#ffffff", border:"1px solid var(--gold2)", borderRadius:4, fontSize:16, lineHeight:2.0, fontFamily:"Georgia, serif", padding:"8px 12px", resize:"vertical", minHeight:120, whiteSpace:"pre-wrap", boxSizing:"border-box" }}
                                  />
                                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:6 }}>
                                    <button
                                      onMouseDown={async e => {
                                        e.preventDefault();
                                        if (!window.confirm("Delete this beat?")) return;
                                        await supabase.from("beats").delete().eq("id", b.id);
                                        setScenesWithBeats(prev => prev.map(s =>
                                          s.scene.id === b.scene_id
                                            ? { ...s, beats: s.beats.filter(x => x.id !== b.id) }
                                            : s
                                        ));
                                        setEditingBeatId(null);
                                      }}
                                      style={{ background:"none", border:"1px solid #552222", color:"#cc6666", borderRadius:4, fontSize:11, fontFamily:"sans-serif", padding:"4px 12px", cursor:"pointer", marginTop:6 }}>
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              : <span
                                  onClick={() => {
                                    clearTimeout(beatClickRef.current);
                                    beatClickRef.current = setTimeout(() => {
                                      setActiveBeatId(b.id);
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

            <WritePanel
              directive={directive}
              setDirective={setDirective}
              generate={generate}
              generating={generating}
              taRef={taRef}
              directiveRef={directiveRef}
            />
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
