import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Routes, Route } from "react-router-dom";
import Codex from "./Codex.jsx";
import Places from "./Places.jsx";
import SnapDebug from "./SnapDebug.jsx";
import PortraitBand from "./PortraitBand.jsx";
import WritePanel from "./WritePanel.jsx";
import LeftPanel from "./LeftPanel.jsx";
import StoryMap from "./StoryMap.jsx";
import ProcessChapterPanel from "./ProcessChapterPanel.jsx";
import UpdateCodexPanel from "./UpdateCodexPanel.jsx";
import ImportPanel from "./ImportPanel.jsx";
import { supabase, STORY_ID, WORLD_ID, TIMES, MODES, CSS, selFull, panelLbl, fullBtn, dropBase, dropItem, fetchChapters, fetchScenes, fetchBeats, fetchCharacters, fetchGroups, fetchPlaces } from "./constants.js";

// ── charMatchesInProse ────────────────────────────────────────────────────────
// Returns true if char's name, first name (if multi-word), or any alias appears
// in prose with word boundaries (case-insensitive).
function charMatchesInProse(char, prose) {
  const terms = [char.name];
  const firstName = char.name.split(' ')[0];
  if (firstName !== char.name) terms.push(firstName);
  for (const alias of (char.aliases || [])) {
    if (alias) terms.push(alias);
  }
  return terms.some(term => {
    try {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return re.test(prose);
    } catch { return false; }
  });
}

// ── ProseViewer ───────────────────────────────────────────────────────────────
function ProseViewer() {
  const [chapters,           setChapters]           = useState([]);
  const [scenes,             setScenes]             = useState([]);
  const [scenesWithBeats,    setScenesWithBeats]    = useState([]);
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
  const [directive,      setDirective]      = useState(() => sessionStorage.getItem("directive") || "");
  const [generating,     setGenerating]     = useState(false);
  const [pendingProse,   setPendingProse]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("pendingProse") || "null"); } catch { return null; }
  });
  const [uncertainChars, setUncertainChars] = useState({}); // { charId: true }
  const [dismissedPills, setDismissedPills] = useState(new Set());
  const [editingBeatId,        setEditingBeatId]        = useState(null);
  const [editingText,          setEditingText]          = useState("");
  const [processChapterOpen,   setProcessChapterOpen]   = useState(false);
  const [updateCodexOpen,      setUpdateCodexOpen]      = useState(false);
  const [importOpen,           setImportOpen]           = useState(false);
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
  const pendingProseRef            = useRef(null);

  // ── Name highlighting ─────────────────────────────────────────────────────
  // Build a sorted list of { text, color } entries from characters (name + aliases)
  // and places. Longest entries first so multi-word names match before first names.
  const nameEntries = useMemo(() => {
    const groupColor = Object.fromEntries(allGroups.map(g => [g.id, g.link_color]));
    const entries = [];
    for (const char of allChars) {
      const color = (char.group_id && groupColor[char.group_id]) || char.link_color;
      if (!color) continue;
      const names = [char.name, ...(char.aliases || [])].filter(n => n?.trim().length > 1);
      for (const n of names) entries.push({ text: n.trim(), color });
    }
    for (const loc of allLocs) {
      if (loc.name?.trim().length > 2) entries.push({ text: loc.name.trim(), color: "#5a7a6a" });
    }
    return entries.sort((a, b) => b.text.length - a.text.length);
  }, [allChars, allGroups, allLocs]);

  const highlightNames = useCallback((text) => {
    if (!text || !nameEntries.length) return text;
    const esc = nameEntries.map(e => e.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`\\b(${esc.join("|")})\\b`, "gi");
    const parts = [];
    let last = 0, m;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const entry = nameEntries.find(e => e.text.toLowerCase() === m[0].toLowerCase());
      parts.push(<span key={m.index} style={{ color: entry.color }}>{m[0]}</span>);
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length ? parts : text;
  }, [nameEntries]);

  // ── Pill suggestions ─────────────────────────────────────────────────────
  const TIME_KEYWORD_MAP = [
    { keywords: ["dawn", "sunrise", "first light"], value: "Dawn" },
    { keywords: ["morning", "good morning", "woke", "waking", "breakfast"], value: "Morning" },
    { keywords: ["midday", "noon", "lunch"], value: "Noon" },
    { keywords: ["afternoon"], value: "Afternoon" },
    { keywords: ["dusk", "sunset"], value: "Evening" },
    { keywords: ["evening", "supper"], value: "Evening" },
    { keywords: ["night", "midnight", "dark", "late"], value: "Night" },
  ];

  const pillSuggestions = useMemo(() => {
    if (!directive.trim()) return [];
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordMatch = (pattern, text) => {
      try { return new RegExp(`\\b${esc(pattern)}\\b`, 'i').test(text); } catch { return false; }
    };
    const pills = [];

    // Character pills — name/alias in directive but character not in portrait band
    for (const char of allChars) {
      if (sceneChars.find(c => c.id === char.id)) continue;
      const terms = [char.name, ...(char.aliases || [])].filter(Boolean);
      if (terms.some(t => wordMatch(t, directive))) {
        pills.push({ type: 'char', id: char.id, label: char.name, char });
      }
    }

    // Location pills — place name in directive but not current location
    for (const loc of allLocs) {
      if (loc.id === locationId) continue;
      if (wordMatch(loc.name, directive)) {
        pills.push({ type: 'loc', id: loc.id, label: loc.name, loc });
      }
    }

    // Time pills — time keyword in directive but differs from current time of day
    const addedTimes = new Set();
    for (const { keywords, value } of TIME_KEYWORD_MAP) {
      if (addedTimes.has(value)) continue;
      if (value.toLowerCase() === timeOfDay.toLowerCase()) continue;
      if (keywords.some(kw => wordMatch(kw, directive))) {
        addedTimes.add(value);
        pills.push({ type: 'time', id: `time:${value}`, label: value, value });
      }
    }

    return pills.filter(p => !dismissedPills.has(p.id));
  }, [directive, allChars, allLocs, sceneChars, locationId, timeOfDay, dismissedPills]);

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

  // Write snap_active_character_ids to beats. If a specific beat is active, update only that
  // beat. If no beat is active, union-add or remove the char from every beat in the current scene
  // so that clicking any beat later doesn't blow away the manual char change.
  const writeCharSnap = async (updatedIds, removedId = null) => {
    console.log("writeCharSnap firing, targetBeatId:", activeBeatId, "updatedIds:", updatedIds);
    const targetBeatId = activeBeatId;
    if (targetBeatId) {
      await supabase.from("beats").update({
        snap_active_character_ids: updatedIds
      }).eq("id", targetBeatId);
      setScenesWithBeats(prev => prev.map(sw => ({
        ...sw,
        beats: sw.beats.map(b => b.id === targetBeatId
          ? { ...b, snap_active_character_ids: updatedIds }
          : b)
      })));
    } else if (selSc) {
      const sceneBeats = scenesWithBeats.find(sw => sw.scene.id === selSc)?.beats ?? [];
      if (sceneBeats.length) {
        await Promise.all(sceneBeats.map(b => {
          const existing = b.snap_active_character_ids ?? [];
          const next = removedId
            ? existing.filter(id => id !== removedId)
            : existing.includes(updatedIds[updatedIds.length - 1])
              ? existing
              : [...existing, updatedIds[updatedIds.length - 1]];
          return supabase.from("beats").update({ snap_active_character_ids: next }).eq("id", b.id);
        }));
        setScenesWithBeats(prev => prev.map(sw => sw.scene.id !== selSc ? sw : {
          ...sw,
          beats: sw.beats.map(b => {
            const existing = b.snap_active_character_ids ?? [];
            const next = removedId
              ? existing.filter(id => id !== removedId)
              : existing.includes(updatedIds[updatedIds.length - 1])
                ? existing
                : [...existing, updatedIds[updatedIds.length - 1]];
            return { ...b, snap_active_character_ids: next };
          })
        }));
      }
    }
  };

  const addChar    = async c => {
    console.log("addChar fired", c.id);
    if (sceneChars.find(x => x.id === c.id)) { setShowChar(false); return; }
    const updatedChars = [...sceneChars, c];
    setSceneChars(updatedChars);
    setShowChar(false);
    saveSceneState(updatedChars.map(ch => ch.id));
    await writeCharSnap(updatedChars.map(ch => ch.id));
  };
  const removeChar = async id => {
    const updatedChars = sceneChars.filter(c => c.id !== id);
    setSceneChars(updatedChars);
    setUncertainChars(p => { const n = { ...p }; delete n[id]; return n; });
    saveSceneState(updatedChars.map(c => c.id));
    await writeCharSnap(updatedChars.map(c => c.id), id);
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

    // Apply pill suggestions — compute effective state before API call
    let effectiveChars = [...sceneChars];
    let effectiveLoc   = location;
    let effectiveLocId = locationId;
    let effectiveTime  = timeOfDay;
    for (const pill of pillSuggestions) {
      if (pill.type === 'char') {
        if (!effectiveChars.find(c => c.id === pill.char.id)) effectiveChars.push(pill.char);
      } else if (pill.type === 'loc') {
        effectiveLoc   = pill.loc.name;
        effectiveLocId = pill.loc.id;
      } else if (pill.type === 'time') {
        effectiveTime  = pill.value;
      }
    }
    if (effectiveChars.length !== sceneChars.length) setSceneChars(effectiveChars);
    if (effectiveLoc !== location) { setLocation(effectiveLoc); setLocationId(effectiveLocId); }
    if (effectiveTime !== timeOfDay) setTimeOfDay(effectiveTime);

    try {
      // Last 4 scenes of prose context
      const last4 = scenesWithBeats.slice(-4);
      const proseContext = last4.map(({ scene, beats }) =>
        `[${scene.title}]\n${beats.map(b => b.prose_text || "").filter(Boolean).join("\n\n")}`
      ).join("\n\n---\n\n");

      // Identify adjacent chapters for context
      const currentChapter = chapters.find(c => c.id === selCh);
      const currentSeq     = currentChapter?.sequence_number ?? 0;
      const prevChapter    = chapters.find(c => c.sequence_number === currentSeq - 1);
      const olderChapters  = chapters.filter(c => c.sequence_number === currentSeq - 2 || c.sequence_number === currentSeq - 3);

      // Previous chapter prose — fetch scenes then beats sequentially
      const fetchPrevChapterProse = async () => {
        if (!prevChapter) return "";
        const { data: prevScenes } = await supabase
          .from("scenes").select("id, sequence_number")
          .eq("chapter_id", prevChapter.id).order("sequence_number");
        if (!prevScenes?.length) return "";
        const { data: prevBeats } = await supabase
          .from("beats").select("prose_text, sequence_number, scene_id")
          .in("scene_id", prevScenes.map(s => s.id)).order("sequence_number");
        if (!prevBeats?.length) return "";
        const sceneSeq = Object.fromEntries(prevScenes.map(s => [s.id, s.sequence_number]));
        return prevBeats
          .sort((a, b) => sceneSeq[a.scene_id] - sceneSeq[b.scene_id] || a.sequence_number - b.sequence_number)
          .map(b => b.prose_text || "").filter(Boolean).join("\n\n");
      };

      // All parallel fetches
      const charIds = effectiveChars.map(c => c.id);
      let charSel = "id, name, role, species, age, occupation, physical_appearance, personality, backstory_summary, gender, pronouns, voice_notes";
      if (mode === "intimate") charSel += ", character_erotic(appearance_detail, intimacy_behavior, sensory_cues, unique_biology)";
      if (mode === "combat")   charSel += ", combat_profile";

      const [
        { data: chData },
        { data: pmData },
        { data: charData },
        { data: olderChData },
        { data: relsData },
        prevChapterProse,
      ] = await Promise.all([
        supabase.from("chapters").select("context_summary").eq("id", selCh).single(),
        supabase.from("app_settings").select("value").eq("key", `prompt_modifier_${mode}`).single(),
        effectiveChars.length
          ? supabase.from("characters").select(charSel).in("id", charIds)
          : Promise.resolve({ data: null }),
        olderChapters.length
          ? supabase.from("chapters").select("sequence_number, title, context_summary").in("id", olderChapters.map(c => c.id))
          : Promise.resolve({ data: [] }),
        charIds.length
          ? supabase.from("relationships")
              .select("character_a_id, character_b_id, status, intimacy_level, tension_level, trust_level, dynamic_notes")
              .or(`character_a_id.in.(${charIds.join(",")}),character_b_id.in.(${charIds.join(",")})`)
          : Promise.resolve({ data: [] }),
        fetchPrevChapterProse(),
      ]);

      const sceneCharsWithData = (charData || effectiveChars).map(c => {
        const { character_erotic, ...rest } = c;
        if (character_erotic) {
          const erotic = Array.isArray(character_erotic) ? character_erotic[0] : character_erotic;
          return erotic ? { ...rest, erotic } : rest;
        }
        return rest;
      });

      // chapter summaries as objects so the edge function can label them by title
      const chapterSummaries = (olderChData || [])
        .sort((a, b) => a.sequence_number - b.sequence_number)
        .filter(c => c.context_summary)
        .map(c => ({ title: c.title, context_summary: c.context_summary }));

      // enrich relationships with character names for readability in the prompt
      const charNameMap = Object.fromEntries(sceneCharsWithData.map(c => [c.id, c.name]));
      const enrichedRelationships = (relsData || []).map(r => ({
        ...r,
        character_a_name: charNameMap[r.character_a_id] || null,
        character_b_name: charNameMap[r.character_b_id] || null,
      })).filter(r => r.character_a_name && r.character_b_name);

      const response = await fetch("https://gjvegoinppbpfusttycs.supabase.co/functions/v1/generate-prose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directive,
          proseContext,
          characters:            sceneCharsWithData,
          location:              effectiveLoc,
          timeOfDay:             effectiveTime,
          sceneMode:             mode,
          chapterSummary:        chData?.context_summary || "",
          chapterSummaries,
          previousChapterProse:  prevChapterProse,
          relationships:         enrichedRelationships,
          promptModifier:        pmData?.value || "",
          povCharacterName:      allChars.find(c => c.id === povCharacterId)?.name || "Zep",
        }),
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setPendingProse({ prose: result.prose || "", directive, sceneId: selSc, _key: Date.now() });
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
    setTimeout(() => {
      proseRef.current?.scrollTo({ top: proseRef.current.scrollHeight, behavior: "smooth" });
      taRef.current?.focus();
    }, 120);
  };

  const saveBeatProse = async (beatId, text) => {
    setEditingBeatId(null);
    const proseChars = allChars.filter(c => charMatchesInProse(c, text));
    const updatePayload = { prose_text: text };
    if (proseChars.length) {
      const { data: beatRow } = await supabase.from("beats").select("snap_active_character_ids").eq("id", beatId).single();
      const existing = new Set(beatRow?.snap_active_character_ids || []);
      proseChars.forEach(c => existing.add(c.id));
      updatePayload.snap_active_character_ids = [...existing];
    }
    await supabase.from("beats").update(updatePayload).eq("id", beatId);
    setScenesWithBeats(prev => prev.map(sw => ({
      ...sw,
      beats: sw.beats.map(b => b.id === beatId ? { ...b, ...updatePayload } : b),
    })));
  };

  const handleStartNewChapter = async () => {
    const maxSeq = chapters.length > 0 ? Math.max(...chapters.map(c => c.sequence_number)) : 0;
    const { data: ch, error: e1 } = await supabase
      .from("chapters")
      .insert({ story_id: STORY_ID, sequence_number: maxSeq + 1, title: "New Chapter" })
      .select("id, sequence_number, title")
      .single();
    if (e1) throw e1;
    const { data: sc, error: e2 } = await supabase
      .from("scenes")
      .insert({ chapter_id: ch.id, sequence_number: 1, title: "Scene 1" })
      .select("id")
      .single();
    if (e2) throw e2;
    const { error: e3 } = await supabase
      .from("beats")
      .insert({ scene_id: sc.id, sequence_number: 1, type: "moment", prose_text: "", directive: "" });
    if (e3) throw e3;
    setChapters(prev => [...prev, ch]);
    await loadChapter(ch);
  };

  // Clear active beat when scene changes
  useEffect(() => { setActiveBeatId(null); }, [selSc]);

  // Persist pending prose and directive across navigation
  useEffect(() => {
    if (pendingProse) sessionStorage.setItem("pendingProse", JSON.stringify(pendingProse));
    else sessionStorage.removeItem("pendingProse");
  }, [pendingProse]);
  useEffect(() => {
    if (directive) sessionStorage.setItem("directive", directive);
    else { sessionStorage.removeItem("directive"); setDismissedPills(new Set()); }
  }, [directive]);

  // Scroll pending prose block into view only when new prose first arrives (not on every edit)
  useEffect(() => {
    if (pendingProse) setTimeout(() => pendingProseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [pendingProse?._key]);

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
    if (beat.snap_char_positions) setCharPositions(beat.snap_char_positions);
    if (beat.snap_location_id) {
      const loc = allLocs.find(l => l.id === beat.snap_location_id);
      if (loc) { setLocation(loc.name); setLocationId(loc.id); }
    }
    if (beat.snap_time_of_day) setTimeOfDay(beat.snap_time_of_day);
    if (beat.snap_scene_mode)  setMode(beat.snap_scene_mode);
    setPovCharacterId(beat.snap_pov_character_id ?? null);
  };


  // Write-back snap columns whenever UI state changes while a beat is active.
  // Skip only when activeBeatId itself just changed (snap load). State edits on same beat always save.
  useEffect(() => {
    if (!activeBeatId) return;
    const beatJustChanged = activeBeatId !== prevActiveBeatIdRef.current;
    prevActiveBeatIdRef.current = activeBeatId;
    if (beatJustChanged) return;
    const snapUpdate = {
      snap_location_id:          locationId,
      snap_time_of_day:          timeOfDay,
      snap_scene_mode:           mode,
      snap_active_character_ids: sceneChars.map(c => c.id),
      snap_pov_character_id:     povCharacterId,
      snap_char_positions:       charPositions,
    };
    supabase.from("beats").update(snapUpdate).eq("id", activeBeatId);
    setScenesWithBeats(prev => prev.map(sw => ({
      ...sw,
      beats: sw.beats.map(b => b.id === activeBeatId ? { ...b, ...snapUpdate } : b),
    })));
  }, [activeBeatId, sceneChars, locationId, timeOfDay, mode, povCharacterId, charPositions]);

  const currentParentId = locStack.length ? locStack[locStack.length - 1] : null;
  const visibleLocs = allLocs
    .filter(l => (l.parent_id ?? null) === currentParentId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const openCharDrop = e => {
    const r = e.currentTarget.getBoundingClientRect();
    setCharDropPos({ top: r.bottom + 4, left: r.left });
    setShowChar(p => !p);
  };

  const [openGroups, setOpenGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem("charDropOpenGroups") || "{}"); } catch { return {}; }
  });
  const toggleGroup = name => setOpenGroups(prev => {
    const next = { ...prev, [name]: !prev[name] };
    localStorage.setItem("charDropOpenGroups", JSON.stringify(next));
    return next;
  });

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
            onMouseEnter={e => e.currentTarget.style.background="rgba(0,0,0,0.05)"}
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
      const dropTop = charDropPos?.top ?? 0;
      const maxHeight = Math.min(500, window.innerHeight - dropTop - 8);
      return (
        <div ref={charDropRef} style={{ position:"fixed", top: dropTop, left: charDropPos?.left ?? 0, zIndex:9999, background:"#ffffff", border:"1px solid rgba(0,0,0,0.15)", borderRadius:6, minWidth:220, maxHeight, overflowY:"auto", boxShadow:"0 4px 20px rgba(0,0,0,0.15)" }}>
          {available.length === 0
            ? <div style={{ padding:"8px 12px", fontSize:12, color:"#888", fontStyle:"italic", fontFamily:"sans-serif" }}>All characters added</div>
            : <>
                {grouped.map(g => {
                  const isOpen = !!openGroups[g.name];
                  return (
                    <div key={g.name}>
                      <div
                        style={{ padding:"6px 10px 4px", fontSize:12, color:"#888", fontFamily:"sans-serif", letterSpacing:"0.04em", textTransform:"uppercase", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", userSelect:"none" }}
                        onMouseEnter={e => e.currentTarget.style.color="#1a2a3a"}
                        onMouseLeave={e => e.currentTarget.style.color="#888"}
                        onClick={() => toggleGroup(g.name)}>
                        <span>{isOpen ? "▾" : "›"} {g.name}</span>
                        <span
                          style={{ fontSize:11, marginRight:2, padding:"0 4px" }}
                          onClick={e => { e.stopPropagation(); g.chars.forEach(c => addChar(c)); }}
                          title="Add all">+</span>
                      </div>
                      {isOpen && g.chars.map(charRow)}
                    </div>
                  );
                })}
                {ungrouped.length > 0 && (
                  <div>
                    {grouped.length > 0 && <div style={{ padding:"6px 10px 2px", fontSize:12, color:"#888", fontFamily:"sans-serif", letterSpacing:"0.04em", textTransform:"uppercase" }}>Other</div>}
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
            allLocs={allLocs}
            location={location}
            setLocation={setLocation}
            locationId={locationId}
            setLocationId={setLocationId}
            mode={mode}
            setMode={setMode}
            timeOfDay={timeOfDay}
            setTimeOfDay={setTimeOfDay}
            chapters={chapters}
            selCh={selCh}
            selSc={selSc}
            phase={phase}
            charRef={charRef}
            openCharDrop={openCharDrop}
            loadChapter={loadChapter}
            scenes={scenes}
            proseRef={proseRef}
            directiveRef={directiveRef}
            onOpenImport={() => setImportOpen(true)}
          />

          {/* MAIN AREA */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* PROSE AREA */}
            <div ref={el => { proseRef.current = el; scrollContainerRef.current = el; }} style={{ flex:1, overflowY:"auto", padding:"24px 32px", background:"#ffffff" }}>
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
                  <h2 style={{ fontSize:14, color:"#8B6914", fontFamily:"sans-serif", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:16, marginTop:32, paddingBottom:8, borderBottom:"1px solid rgba(0,0,0,0.12)" }}>
                    {scene.sequence_number}. {scene.title}
                  </h2>
                  {beats.length === 0
                    ? <div style={{ color:"var(--text4)", fontStyle:"italic", fontSize:13, fontFamily:"sans-serif" }}>No beats for this scene yet.</div>
                    : <div style={{ fontSize:20, lineHeight:2.0, color:"#1a2a3a", fontFamily:"Georgia, serif", whiteSpace:"pre-wrap", textAlign:"left" }}>
                        {beats.filter(b => b.prose_text).map((b, i, arr) => {
                          const prev = arr[i - 1];
                          const stateChanged = i > 0 && prev && (
                            JSON.stringify(b.snap_active_character_ids?.slice().sort()) !==
                            JSON.stringify(prev.snap_active_character_ids?.slice().sort()) ||
                            b.snap_location_id !== prev.snap_location_id ||
                            b.snap_time_of_day !== prev.snap_time_of_day ||
                            b.snap_scene_mode !== prev.snap_scene_mode
                          );
                          return (
                          <div key={b.id} ref={el => { beatRefs.current[b.id] = el; }} data-beat-id={b.id} style={{ marginTop: i > 0 ? "1.5em" : 0, borderLeft: activeBeatId === b.id ? "2px solid rgba(139,105,20,0.5)" : "2px solid transparent", borderBottom: "1px solid rgba(0,0,0,0.08)", paddingLeft: 10, paddingBottom: "2rem", marginBottom: "2rem", transition:"border-color 0.15s" }}>
                            {stateChanged && (
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                                <div style={{ height:1, flex:1, background:"rgba(0,0,0,0.12)" }}/>
                                <span style={{ fontSize:10, color:"#8B6914", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", opacity:0.7, flexShrink:0 }}>scene shift</span>
                                <div style={{ height:1, flex:1, background:"rgba(0,0,0,0.12)" }}/>
                              </div>
                            )}
                            {<span
                                  onClick={() => {
                                    setActiveBeatId(b.id);
                                    loadBeatSnap(b);
                                  }}
                                  onDoubleClick={() => {
                                    clearTimeout(beatClickRef.current);
                                    setEditingBeatId(b.id);
                                    setEditingText(b.prose_text);
                                  }}
                                  style={{ cursor:"text", display:"block" }}
                                  title="Double-click to edit"
                                >
                                  {highlightNames(b.prose_text)}
                                </span>
                            }
                            <div style={{ display:"flex", justifyContent:"flex-end" }}>
                              <button
                                style={{ background:"none", border:"none", color:"#999", fontSize:11, fontFamily:"sans-serif", cursor:"pointer", padding:"2px 8px", opacity:0.4 }}
                                onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                                onMouseLeave={e => e.currentTarget.style.opacity = "0.4"}
                                onClick={async e => {
                                  e.stopPropagation();
                                  const existingIds = new Set(beats.map(x => x.id));
                                  const beatsAfter = beats
                                    .filter(x => x.sequence_number > b.sequence_number)
                                    .sort((x, y) => y.sequence_number - x.sequence_number);
                                  for (const ab of beatsAfter) {
                                    await supabase.from("beats").update({ sequence_number: ab.sequence_number + 1 }).eq("id", ab.id);
                                  }
                                  const { error } = await supabase.from("beats").insert({
                                    scene_id: scene.id,
                                    sequence_number: b.sequence_number + 1,
                                    type: "moment",
                                    directive: "",
                                    prose_text: "",
                                    snap_location_id: b.snap_location_id,
                                    snap_time_of_day: b.snap_time_of_day,
                                    snap_scene_mode: b.snap_scene_mode,
                                    snap_active_character_ids: b.snap_active_character_ids,
                                    snap_pov_character_id: b.snap_pov_character_id,
                                  });
                                  if (error) { console.error("insert beat error:", error); return; }
                                  const freshBeats = await fetchBeats(scene.id);
                                  setScenesWithBeats(prev => prev.map(s => s.scene.id === scene.id ? { ...s, beats: freshBeats } : s));
                                  const newBeat = freshBeats.find(x => !existingIds.has(x.id));
                                  if (newBeat) { setEditingBeatId(newBeat.id); setEditingText(""); }
                                }}
                              >+ beat</button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                  }
                </div>
              ))}
              {phase==="ready" && (generating || (pendingProse && pendingProse.sceneId === selSc)) && (
                <div ref={pendingProseRef} style={{ marginTop:32, borderTop:"1px solid rgba(0,0,0,0.12)", paddingTop:24 }}>
                  {generating && !pendingProse
                    ? <div style={{ display:"flex", alignItems:"center", gap:10, color:"#888", fontFamily:"sans-serif", fontSize:13, fontStyle:"italic" }}>
                        <span className="spin" /> Generating…
                      </div>
                    : <>
                        <textarea
                          value={pendingProse.prose}
                          onChange={e => setPendingProse(p => ({ ...p, prose: e.target.value }))}
                          style={{ width:"100%", background:"#ffffff", color:"#1a2a3a", border:"1px solid var(--border2)", borderRadius:4, fontSize:20, lineHeight:2.0, fontFamily:"Georgia, serif", padding:"12px 16px", resize:"none", outline:"none", boxSizing:"border-box", minHeight:200 }}
                          rows={Math.max(6, (pendingProse.prose.match(/\n/g)||[]).length + 3)}
                        />
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

            {/* ── Pill suggestion strip ── */}
            {pillSuggestions.length > 0 && (
              <div style={{ flexShrink:0, padding:"3px 10px 2px", background:"#f0ece4", borderTop:"1px solid rgba(0,0,0,0.06)", display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                {pillSuggestions.map(pill => {
                  const isChar = pill.type === 'char';
                  const isLoc  = pill.type === 'loc';
                  const bg     = isChar ? "rgba(139,105,20,0.08)"  : isLoc ? "rgba(90,122,106,0.08)"  : "rgba(60,90,130,0.08)";
                  const bdr    = isChar ? "rgba(139,105,20,0.35)"  : isLoc ? "rgba(90,122,106,0.35)"  : "rgba(60,90,130,0.35)";
                  const clr    = isChar ? "#8B6914"                : isLoc ? "#4a6a5a"                : "#3a5a80";
                  const prefix = isChar ? "+"                      : isLoc ? "\u2192"                 : "\u25f7";
                  return (
                    <button
                      key={pill.id}
                      onClick={() => setDismissedPills(prev => new Set([...prev, pill.id]))}
                      title="Click to dismiss"
                      style={{ background:bg, border:`1px solid ${bdr}`, borderRadius:20, color:clr, fontSize:11, fontFamily:"sans-serif", padding:"2px 9px 2px 7px", cursor:"pointer", letterSpacing:"0.02em", lineHeight:1.5, flexShrink:0 }}
                    >
                      {prefix} {pill.label}
                    </button>
                  );
                })}
              </div>
            )}

            <WritePanel
              directive={directive}
              setDirective={setDirective}
              generate={generate}
              generating={generating}
              taRef={taRef}
              directiveRef={directiveRef}
              wordCount={scenesWithBeats.flatMap(({ beats }) => beats).reduce((n, b) => n + (b.prose_text?.trim() ? b.prose_text.trim().split(/\s+/).length : 0), 0)}
              highlightNames={highlightNames}
            />
          </div>
        </div>
      </div>
      {charDropdown}
      {processChapterOpen && selCh && (() => {
        const ch = chapters.find(c => c.id === selCh);
        return ch ? (
          <ProcessChapterPanel
            chapterId={ch.id}
            chapterTitle={ch.title}
            onClose={() => setProcessChapterOpen(false)}
          />
        ) : null;
      })()}
      {updateCodexOpen && selCh && (() => {
        const ch = chapters.find(c => c.id === selCh);
        return ch ? (
          <UpdateCodexPanel
            chapterId={ch.id}
            chapterTitle={ch.title}
            onClose={() => setUpdateCodexOpen(false)}
          />
        ) : null;
      })()}
      {importOpen && selCh && (() => {
        const ch = chapters.find(c => c.id === selCh);
        return ch ? (
          <ImportPanel
            chapterId={ch.id}
            chapterTitle={ch.title}
            onOpenCaptureEvents={() => setProcessChapterOpen(true)}
            onOpenUpdateCodex={() => setUpdateCodexOpen(true)}
            onStartNewChapter={handleStartNewChapter}
            onSceneBreaksDone={async ({ chapter_title }) => {
              setChapters(prev => prev.map(c => c.id === ch.id ? { ...c, title: chapter_title } : c));
              await loadChapter({ id: ch.id, title: chapter_title });
            }}
            onClose={() => setImportOpen(false)}
          />
        ) : null;
      })()}
      {editingBeatId && createPortal(
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,12,28,0.96)", display:"flex", flexDirection:"column", padding:"40px 60px" }}>
          <textarea
            value={editingText}
            onChange={e => setEditingText(e.target.value)}
            autoFocus
            style={{ flex:1, width:"100%", background:"#0d1b2e", color:"#c8e0ff", border:"1px solid #3b7fd4", borderRadius:6, fontSize:16, lineHeight:2.0, fontFamily:"Georgia, serif", padding:"24px 32px", resize:"none", outline:"none" }}
          />
          <div style={{ display:"flex", gap:12, marginTop:16, justifyContent:"flex-end" }}>
            <button
              onClick={() => {
                if (!window.confirm("Delete this beat?")) return;
                const beatId = editingBeatId;
                supabase.from("beats").delete().eq("id", beatId).then(() => {
                  setScenesWithBeats(prev => prev.map(s => ({
                    ...s, beats: s.beats.filter(x => x.id !== beatId),
                  })));
                  setEditingBeatId(null);
                });
              }}
              style={{ background:"none", border:"1px solid #552222", borderRadius:4, color:"#cc6666", fontSize:12, fontFamily:"sans-serif", padding:"6px 16px", cursor:"pointer" }}>
              Delete
            </button>
            <button
              onClick={() => setEditingBeatId(null)}
              style={{ background:"none", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text4)", fontSize:12, fontFamily:"sans-serif", padding:"6px 16px", cursor:"pointer" }}>
              Cancel
            </button>
            <button
              onClick={() => saveBeatProse(editingBeatId, editingText)}
              style={{ background:"var(--gold2)", border:"1px solid var(--gold)", borderRadius:4, color:"#1a1410", fontSize:12, fontFamily:"sans-serif", padding:"6px 20px", cursor:"pointer", fontWeight:"bold" }}>
              Save
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProseViewer />} />
      <Route path="/codex" element={<Codex />} />
      <Route path="/places" element={<Places />} />
      <Route path="/debug" element={<SnapDebug />} />
      <Route path="/map" element={<StoryMap />} />
    </Routes>
  );
}
