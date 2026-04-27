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
import ArcPlanner from "./ArcPlanner.jsx";
import SpriteStudio from "./SpriteStudio.jsx";
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
  const [weather,         setWeather]         = useState(() => localStorage.getItem("weather") || "");
  const [season,          setSeason]          = useState(() => localStorage.getItem("season") || "");
  const [snapOutfitTags,  setSnapOutfitTags]  = useState({});
  const [wardrobeMap,     setWardrobeMap]     = useState({});
  const [mode,            setMode]            = useState("narrative");
  const [showLoc,         setShowLoc]         = useState(false);
  const [locStack,        setLocStack]        = useState([]);
  const [showMode,        setShowMode]        = useState(false);
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
  const [planOpen,             setPlanOpen]             = useState(false);
  const [planDraft,            setPlanDraft]            = useState("");
  const [planPos,              setPlanPos]              = useState({ x: 440, y: 80 });
  const planDragRef        = useRef(null);
  const planPanelRef       = useRef(null);
  const planScrollDebounce = useRef(null);
  const [activeBeatId,   setActiveBeatId]   = useState(null);
  const prevActiveBeatIdRef = useRef(null);
  const leftPanelRef  = useRef(null);
  const taRef         = useRef(null);
  const directiveRef  = useRef(null);
  const proseRef      = useRef(null);
  const beatClickRef      = useRef(null);
  const editTextareaRef   = useRef(null);
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
  const OUTFIT_KEYWORD_MAP = [
    { keywords: ["ready for bed", "goes to bed", "nightgown", "sleepwear"], tag: "sleepwear" },
    { keywords: ["hits the road", "travel", "riding", "on the road"],       tag: "travel" },
    { keywords: ["into town", "market", "village", "town"],                  tag: "town" },
    { keywords: ["dressed up", "formal", "gown", "dressup"],                 tag: "dressup" },
  ];

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

    // Outfit pills — keyword triggers for outfit_tag snap
    const addedOutfits = new Set();
    for (const { keywords, tag } of OUTFIT_KEYWORD_MAP) {
      if (addedOutfits.has(tag)) continue;
      if (keywords.some(kw => {
        try { return new RegExp(`\\b${esc(kw)}\\b`, 'i').test(directive); } catch { return false; }
      })) {
        addedOutfits.add(tag);
        pills.push({ type: 'outfit', id: `outfit:${tag}`, label: tag, tag });
      }
    }

    return pills.filter(p => p.type === 'outfit' || !dismissedPills.has(p.id));
  }, [directive, allChars, allLocs, sceneChars, locationId, timeOfDay, snapOutfitTags, dismissedPills]);

  // close loc/char dropdowns on outside click
  useEffect(() => {
    const h = e => {
      if (leftPanelRef.current && !leftPanelRef.current.contains(e.target)) {
        setShowLoc(false); setLocStack([]);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Apply saved size directly to DOM so React's style prop doesn't overwrite resize-handle changes
  useEffect(() => {
    if (!planOpen || !planPanelRef.current) return;
    try {
      const saved = JSON.parse(localStorage.getItem("planPopupLayout") || "null");
      planPanelRef.current.style.width  = (saved?.width  ?? 600) + "px";
      planPanelRef.current.style.height = (saved?.height ?? 320) + "px";
    } catch {
      planPanelRef.current.style.width  = "600px";
      planPanelRef.current.style.height = "320px";
    }
  }, [planOpen]);

  const closePlan = () => {
    if (planPanelRef.current) {
      localStorage.setItem("planPopupLayout", JSON.stringify({
        x: planPos.x, y: planPos.y,
        width:  planPanelRef.current.offsetWidth,
        height: planPanelRef.current.offsetHeight,
      }));
    }
    setPlanOpen(false);
  };

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
    if (sceneChars.find(x => x.id === c.id)) return;
    const updatedChars = [...sceneChars, c];
    setSceneChars(updatedChars);
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

  const createBlankBeat = async () => {
    if (!selSc) return;
    const currentSwb = scenesWithBeats.find(sw => sw.scene.id === selSc);
    if (!currentSwb) return;
    const beats = currentSwb.beats;

    const sourceBeat = activeBeatId
      ? beats.find(b => b.id === activeBeatId)
      : beats.length > 0 ? beats[beats.length - 1] : null;

    const insertAfterSeq = sourceBeat ? sourceBeat.sequence_number : 0;

    const beatsAfter = beats
      .filter(b => b.sequence_number > insertAfterSeq)
      .sort((a, b) => b.sequence_number - a.sequence_number);
    for (const b of beatsAfter) {
      await supabase.from("beats").update({ sequence_number: b.sequence_number + 1 }).eq("id", b.id);
    }

    const existingIds = new Set(beats.map(b => b.id));
    const { error } = await supabase.from("beats").insert({
      scene_id: selSc,
      sequence_number: insertAfterSeq + 1,
      type: "moment",
      directive: "",
      prose_text: "",
      snap_location_id:          sourceBeat?.snap_location_id ?? locationId,
      snap_time_of_day:          sourceBeat?.snap_time_of_day ?? timeOfDay,
      snap_weather:              sourceBeat?.snap_weather ?? (weather || null),
      snap_season:               sourceBeat?.snap_season ?? (season || null),
      snap_outfit_tags:          sourceBeat?.snap_outfit_tags ?? (Object.values(snapOutfitTags).some(t => t.length) ? snapOutfitTags : null),
      snap_scene_mode:           sourceBeat?.snap_scene_mode ?? mode,
      snap_active_character_ids: sourceBeat?.snap_active_character_ids ?? sceneChars.map(c => c.id),
      snap_pov_character_id:     sourceBeat?.snap_pov_character_id ?? povCharacterId,
    });
    if (error) { console.error("createBlankBeat error:", error); return; }

    const freshBeats = await fetchBeats(selSc);
    setScenesWithBeats(prev => prev.map(sw => sw.scene.id === selSc ? { ...sw, beats: freshBeats } : sw));
    const newBeat = freshBeats.find(b => !existingIds.has(b.id));
    if (newBeat) { setEditingBeatId(newBeat.id); setEditingText(""); }
  };

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
          locationId:            locationId || null,
          timeOfDay:             effectiveTime,
          sceneMode:             mode,
          chapterSummary:        chData?.context_summary || "",
          chapterSummaries,
          previousChapterProse:  prevChapterProse,
          relationships:         enrichedRelationships,
          promptModifier:        pmData?.value || "",
          povCharacterName:      allChars.find(c => c.id === povCharacterId)?.name || "Zep",
          outfitTags:            (() => {
            const map = {};
            for (const c of effectiveChars) {
              const tags = snapOutfitTags[c.id];
              if (tags && tags.length > 0) map[c.id] = tags;
            }
            return Object.keys(map).length ? map : null;
          })(),
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

  useEffect(() => {
    if (editingBeatId && editTextareaRef.current) {
      const el = editTextareaRef.current;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [editingBeatId]);

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

  const handleOutfitTagToggle = (charId, shortcode) => {
    setSnapOutfitTags(prev => {
      const current = prev[charId] || [];
      const next = current.includes(shortcode)
        ? current.filter(t => t !== shortcode)
        : [...current, shortcode];
      return { ...prev, [charId]: next };
    });
  };

  const handleWeatherChange = (v) => {
    setWeather(v);
    localStorage.setItem("weather", v);
    if (activeBeatId) {
      supabase.from("beats").update({ snap_weather: v || null }).eq("id", activeBeatId);
      setScenesWithBeats(prev => prev.map(sw => ({
        ...sw,
        beats: sw.beats.map(b => b.id === activeBeatId ? { ...b, snap_weather: v || null } : b),
      })));
    }
  };

  const handleSeasonChange = (v) => {
    setSeason(v);
    localStorage.setItem("season", v);
    if (activeBeatId) {
      supabase.from("beats").update({ snap_season: v || null }).eq("id", activeBeatId);
      setScenesWithBeats(prev => prev.map(sw => ({
        ...sw,
        beats: sw.beats.map(b => b.id === activeBeatId ? { ...b, snap_season: v || null } : b),
      })));
    }
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

  // Fetch wardrobe items (prompt_shortcode only) for active characters
  useEffect(() => {
    const charIds = sceneChars.map(c => c.id);
    if (!charIds.length) { setWardrobeMap({}); return; }
    (async () => {
      const { data: ctrs } = await supabase
        .from("containers").select("id, character_id").in("character_id", charIds);
      if (!ctrs?.length) { setWardrobeMap({}); return; }
      const { data: rawItems } = await supabase
        .from("items").select("id, name, prompt_shortcode, container_id")
        .in("container_id", ctrs.map(c => c.id)).not("prompt_shortcode", "is", null);
      const ctrToChar = Object.fromEntries(ctrs.map(c => [c.id, c.character_id]));
      const map = {};
      for (const item of rawItems || []) {
        const charId = ctrToChar[item.container_id];
        if (!charId) continue;
        (map[charId] ??= []).push({ id: item.id, name: item.name, prompt_shortcode: item.prompt_shortcode });
      }
      setWardrobeMap(map);
    })();
  }, [sceneChars]);

  // Load snap state from a beat into the UI
  const loadBeatSnap = (beat) => {
    console.log("loadBeatSnap beat:", beat.id, "snap_active_character_ids:", beat.snap_active_character_ids);
    const hasSnap = beat.snap_location_id || beat.snap_time_of_day ||
                    beat.snap_weather || beat.snap_season ||
                    beat.snap_scene_mode || beat.snap_active_character_ids?.length ||
                    beat.snap_pov_character_id ||
                    (beat.snap_outfit_tags && Object.keys(beat.snap_outfit_tags).length);
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
    if (beat.snap_weather)     setWeather(beat.snap_weather);
    if (beat.snap_season)      setSeason(beat.snap_season);
    setSnapOutfitTags(beat.snap_outfit_tags || {});
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
    if (sceneChars.length === 0) return;
    const snapUpdate = {
      snap_location_id:          locationId,
      snap_time_of_day:          timeOfDay,
      snap_weather:              weather || null,
      snap_season:               season || null,
      snap_outfit_tags:          Object.values(snapOutfitTags).some(t => t.length) ? snapOutfitTags : null,
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
  }, [activeBeatId, sceneChars, locationId, timeOfDay, weather, season, snapOutfitTags, mode, povCharacterId, charPositions]);

  const currentParentId = locStack.length ? locStack[locStack.length - 1] : null;
  const visibleLocs = allLocs
    .filter(l => (l.parent_id ?? null) === currentParentId)
    .sort((a, b) => a.name.localeCompare(b.name));


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
          wardrobeMap={wardrobeMap}
          snapOutfitTags={snapOutfitTags}
          onOutfitTagToggle={handleOutfitTagToggle}
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
            weather={weather}
            setWeather={handleWeatherChange}
            season={season}
            setSeason={handleSeasonChange}
            chapters={chapters}
            selCh={selCh}
            selSc={selSc}
            phase={phase}
            allChars={allChars}
            allGroups={allGroups}
            sceneChars={sceneChars}
            addChar={addChar}
            loadChapter={loadChapter}
            scenes={scenes}
            proseRef={proseRef}
            directiveRef={directiveRef}
            onOpenImport={() => setImportOpen(true)}
            onOpenPlan={() => {
              const ch = chapters.find(c => c.id === selCh);
              setPlanDraft(ch?.chapter_plan || "");
              try {
                const saved = JSON.parse(localStorage.getItem("planPopupLayout") || "null");
                setPlanPos(saved ? { x: saved.x, y: saved.y } : { x: Math.round((window.innerWidth + 220) / 2 - 300), y: 80 });
              } catch {
                setPlanPos({ x: Math.round((window.innerWidth + 220) / 2 - 300), y: 80 });
              }
              setPlanOpen(true);
            }}
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
                        {beats.filter(b => b.prose_text || b.id === editingBeatId).map((b, i, arr) => {
                          const prev = arr[i - 1];
                          const stateChanged = i > 0 && prev && (
                            JSON.stringify(b.snap_active_character_ids?.slice().sort()) !==
                            JSON.stringify(prev.snap_active_character_ids?.slice().sort()) ||
                            b.snap_location_id !== prev.snap_location_id ||
                            b.snap_time_of_day !== prev.snap_time_of_day ||
                            b.snap_weather !== prev.snap_weather ||
                            b.snap_season !== prev.snap_season ||
                            JSON.stringify(b.snap_outfit_tags) !== JSON.stringify(prev.snap_outfit_tags) ||
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
                            {editingBeatId === b.id
                              ? <textarea
                                  ref={editTextareaRef}
                                  value={editingText}
                                  autoFocus
                                  onChange={e => {
                                    setEditingText(e.target.value);
                                    e.target.style.height = "auto";
                                    e.target.style.height = e.target.scrollHeight + "px";
                                  }}
                                  style={{ width:"100%", background:"transparent", border:"none", outline:"none", resize:"none", overflow:"hidden", fontSize:20, lineHeight:2.0, fontFamily:"Georgia, serif", color:"#1a2a3a", padding:0, margin:0, display:"block", boxSizing:"border-box" }}
                                />
                              : <span
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
                                    snap_weather: b.snap_weather,
                                    snap_season: b.snap_season,
                                    snap_outfit_tags: b.snap_outfit_tags,
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
                            disabled={generating}
                            onClick={acceptProse}
                            autoFocus
                            style={{ background:"var(--gold2)", border:"1px solid var(--gold)", borderRadius:4, color:"#1a1410", fontSize:12, fontFamily:"sans-serif", padding:"6px 20px", cursor: generating ? "not-allowed" : "pointer", fontWeight:"bold", opacity: generating ? 0.5 : 1 }}>
                            Accept
                          </button>
                          <button
                            onClick={() => setPendingProse(null)}
                            style={{ background:"none", border:"1px solid #552222", borderRadius:4, color:"#cc6666", fontSize:12, fontFamily:"sans-serif", padding:"6px 16px", cursor:"pointer" }}>
                            Discard
                          </button>
                        </div>
                      </>
                  }
                </div>
              )}
              {editingBeatId && !pendingProse && (
                <div style={{ position:"sticky", bottom:0, padding:"10px 0", display:"flex", gap:10, justifyContent:"flex-end", zIndex:10, pointerEvents:"none" }}>
                  <button
                    onClick={() => saveBeatProse(editingBeatId, editingText)}
                    style={{ pointerEvents:"auto", background:"var(--gold2)", border:"1px solid var(--gold)", borderRadius:4, color:"#1a1410", fontSize:12, fontFamily:"sans-serif", padding:"6px 20px", cursor:"pointer", fontWeight:"bold", boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
                    Save
                  </button>
                  <button
                    onClick={() => setEditingBeatId(null)}
                    style={{ pointerEvents:"auto", background:"#ffffff", border:"1px solid #552222", borderRadius:4, color:"#cc6666", fontSize:12, fontFamily:"sans-serif", padding:"6px 16px", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* ── Pill suggestion strip ── */}
            {pillSuggestions.length > 0 && (
              <div style={{ flexShrink:0, padding:"3px 10px 2px", background:"#f0ece4", borderTop:"1px solid rgba(0,0,0,0.06)", display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                {pillSuggestions.map(pill => {
                  if (pill.type === 'outfit') {
                    const isActive = Object.values(snapOutfitTags).some(tags => tags.includes(pill.tag));
                    return (
                      <button
                        key={pill.id}
                        onClick={() => setSnapOutfitTags(prev => {
                          const next = { ...prev };
                          for (const c of sceneChars) {
                            const cur = next[c.id] || [];
                            next[c.id] = isActive ? cur.filter(t => t !== pill.tag) : cur.includes(pill.tag) ? cur : [...cur, pill.tag];
                          }
                          return next;
                        })}
                        title={isActive ? "Click to clear outfit tag" : "Click to set outfit tag"}
                        style={{ background: isActive ? "rgba(100,70,140,0.15)" : "rgba(100,70,140,0.06)", border:`1px solid rgba(100,70,140,${isActive ? "0.55" : "0.28"})`, borderRadius:20, color: isActive ? "#7040a0" : "#8a60b0", fontSize:11, fontFamily:"sans-serif", padding:"2px 9px 2px 7px", cursor:"pointer", letterSpacing:"0.02em", lineHeight:1.5, flexShrink:0, fontWeight: isActive ? 600 : 400 }}
                      >
                        {isActive ? "\u2713" : "\u29bf"} {pill.label}
                      </button>
                    );
                  }
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
              createBlankBeat={createBlankBeat}
              taRef={taRef}
              directiveRef={directiveRef}
              wordCount={scenesWithBeats.flatMap(({ beats }) => beats).reduce((n, b) => n + (b.prose_text?.trim() ? b.prose_text.trim().split(/\s+/).length : 0), 0)}
              highlightNames={highlightNames}
            />
          </div>
        </div>
      </div>
      {planOpen && createPortal(
        <>
          <div onClick={closePlan}
            style={{ position:"fixed", inset:0, zIndex:400 }} />
          <div
            ref={planPanelRef}
            onClick={e => e.stopPropagation()}
            style={{ position:"fixed", top:planPos.y, left:planPos.x, zIndex:401, background:"#ffffff", border:"1px solid rgba(0,0,0,0.12)", borderRadius:6, padding:"16px 20px", minWidth:280, minHeight:180, boxShadow:"0 4px 24px rgba(0,0,0,0.18)", resize:"both", overflow:"hidden", display:"flex", flexDirection:"column" }}>
            <div
              onMouseDown={e => {
                e.preventDefault();
                planDragRef.current = { sx: e.clientX, sy: e.clientY, ox: planPos.x, oy: planPos.y };
                const onMove = ev => {
                  const d = planDragRef.current;
                  if (!d) return;
                  setPlanPos({ x: d.ox + ev.clientX - d.sx, y: d.oy + ev.clientY - d.sy });
                };
                const onUp = () => {
                  planDragRef.current = null;
                  document.removeEventListener("mousemove", onMove);
                  document.removeEventListener("mouseup", onUp);
                };
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
              }}
              style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexShrink:0, cursor:"move", userSelect:"none" }}>
              <span style={{ fontSize:10, color:"#8B6914", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase" }}>
                {chapters.find(c => c.id === selCh)?.title || "Chapter Plan"}
              </span>
              <button onClick={closePlan}
                style={{ background:"none", border:"none", color:"#888", fontSize:16, cursor:"pointer", lineHeight:1, padding:"0 2px" }}>×</button>
            </div>
            <textarea
              autoFocus
              ref={el => { if (el) el.scrollTop = parseInt(localStorage.getItem("chapterPlanScroll") || "0", 10); }}
              value={planDraft}
              onChange={e => setPlanDraft(e.target.value)}
              onScroll={e => {
                const top = e.target.scrollTop;
                clearTimeout(planScrollDebounce.current);
                planScrollDebounce.current = setTimeout(() => {
                  localStorage.setItem("chapterPlanScroll", top);
                }, 200);
              }}
              onBlur={async () => {
                if (!selCh) return;
                await supabase.from("chapters").update({ chapter_plan: planDraft || null }).eq("id", selCh);
                setChapters(prev => prev.map(c => c.id === selCh ? { ...c, chapter_plan: planDraft || null } : c));
              }}
              placeholder="Add chapter plan..."
              style={{ flex:1, width:"100%", background:"#fafafa", border:"1px solid rgba(0,0,0,0.18)", borderRadius:4, padding:"10px 12px", fontSize:14, fontFamily:"Georgia, serif", lineHeight:1.7, color:"#1a2a3a", resize:"none", outline:"none", boxSizing:"border-box" }}
            />
          </div>
        </>,
        document.body
      )}
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
      <Route path="/arc" element={<ArcPlanner />} />
      <Route path="/sprites" element={<SpriteStudio />} />
    </Routes>
  );
}
