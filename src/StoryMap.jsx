import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase, STORY_ID, WORLD_ID } from "./constants.js";

function initials(name) {
  return name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";
}

function CharDot({ char }) {
  const color = char.link_color || "#888";
  return (
    <span title={char.name} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 20, height: 20, borderRadius: "50%",
      background: char.portrait_url ? "transparent" : color,
      border: `1px solid ${color}`,
      overflow: "hidden", flexShrink: 0,
      fontSize: 8, fontFamily: "sans-serif", color: "#fff", fontWeight: "bold",
      marginLeft: 2,
    }}>
      {char.portrait_url
        ? <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initials(char.name)
      }
    </span>
  );
}

function BeatRow({ beat, charMap, locMap }) {
  const hasSnap = beat.snap_location_id || beat.snap_time_of_day ||
    beat.snap_scene_mode || beat.snap_active_character_ids?.length ||
    beat.snap_pov_character_id;
  const chars = (beat.snap_active_character_ids || [])
    .map(id => charMap[id]).filter(Boolean);
  const povChar = beat.snap_pov_character_id ? charMap[beat.snap_pov_character_id] : null;
  const preview = beat.prose_text ? beat.prose_text.slice(0, 80) + (beat.prose_text.length > 80 ? "…" : "") : "";
  const locationName = beat.snap_location_id ? locMap[beat.snap_location_id] : null;

  return (
    <div style={{
      padding: "5px 12px 5px 48px",
      borderBottom: "1px solid rgba(255,255,255,0.03)",
      fontSize: 12, fontFamily: "sans-serif",
    }}>
      {/* prose line */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ color: "var(--text4)", minWidth: 20, fontSize: 11, flexShrink: 0 }}>{beat.sequence_number}</span>
        <span style={{ color: preview ? "var(--text3)" : "#555", fontStyle: preview ? "normal" : "italic" }}>
          {preview || "no prose"}
        </span>
      </div>
      {/* state line */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, paddingLeft: 28, flexWrap: "wrap" }}>
        {!hasSnap ? (
          <span style={{ fontSize: 9, color: "#555", border: "1px solid #333", borderRadius: 3, padding: "1px 4px" }}>no snap</span>
        ) : (
          <>
            {/* characters */}
            {chars.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                {chars.map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <CharDot char={c} />
                    <span style={{
                      fontSize: 10, color: c.id === beat.snap_pov_character_id ? "var(--gold)" : "#999",
                      fontWeight: c.id === beat.snap_pov_character_id ? 600 : 400,
                    }}>{c.name}{c.id === beat.snap_pov_character_id ? " (POV)" : ""}</span>
                  </div>
                ))}
                {povChar && !chars.find(c => c.id === povChar.id) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <CharDot char={povChar} />
                    <span style={{ fontSize: 10, color: "var(--gold)", fontWeight: 600 }}>{povChar.name} (POV)</span>
                  </div>
                )}
              </div>
            )}
            {/* location */}
            {locationName && (
              <span style={{ fontSize: 10, color: "#7a9e8a" }}>📍 {locationName}</span>
            )}
            {/* time */}
            {beat.snap_time_of_day && (
              <span style={{ fontSize: 10, color: "#7a8a9e" }}>{beat.snap_time_of_day}</span>
            )}
            {/* mode */}
            {beat.snap_scene_mode && (
              <span style={{ fontSize: 10, color: "#9e7a7a", textTransform: "capitalize" }}>{beat.snap_scene_mode}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SceneRow({ scene, beats, charMap, locMap }) {
  const [open, setOpen] = useState(false);
  const beatCount = beats.length;

  return (
    <div>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 12px 5px 28px",
          cursor: "pointer", userSelect: "none",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          fontSize: 12, color: "#c0b89a", fontFamily: "sans-serif",
        }}
      >
        <span style={{ color: "#444", fontSize: 10, width: 10 }}>{open ? "▾" : "▸"}</span>
        <span style={{ minWidth: 20, color: "var(--text4)", fontSize: 11 }}>{scene.sequence_number}</span>
        <span style={{ flex: 1 }}>{scene.title}</span>
        <span style={{ color: "#555", fontSize: 10 }}>{beatCount} beat{beatCount !== 1 ? "s" : ""}</span>
      </div>
      {open && beats.map(b => <BeatRow key={b.id} beat={b} charMap={charMap} locMap={locMap} />)}
    </div>
  );
}

function ChapterRow({ chapter, sceneMap, beatMap, charMap, locMap }) {
  const [open, setOpen] = useState(false);
  const scenes = sceneMap[chapter.id] || [];
  const totalBeats = scenes.reduce((n, s) => n + (beatMap[s.id] || []).length, 0);

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px",
          cursor: "pointer", userSelect: "none",
          fontSize: 13, color: "var(--gold)", fontFamily: "sans-serif", fontWeight: 600,
        }}
      >
        <span style={{ color: "#666", fontSize: 11, width: 10 }}>{open ? "▾" : "▸"}</span>
        <span style={{ minWidth: 24, color: "var(--gold2)", fontSize: 12 }}>{chapter.sequence_number}.</span>
        <span style={{ flex: 1 }}>{chapter.title}</span>
        <span style={{ color: "#666", fontSize: 11, fontWeight: 400 }}>{totalBeats} beat{totalBeats !== 1 ? "s" : ""}</span>
      </div>
      {open && scenes.map(s => (
        <SceneRow key={s.id} scene={s} beats={beatMap[s.id] || []} charMap={charMap} locMap={locMap} />
      ))}
    </div>
  );
}

export default function StoryMap() {
  const [chapters, setChapters] = useState([]);
  const [sceneMap, setSceneMap] = useState({});   // chapter_id → scenes[]
  const [beatMap,  setBeatMap]  = useState({});   // scene_id   → beats[]
  const [charMap,  setCharMap]  = useState({});   // char_id    → char
  const [locMap,   setLocMap]   = useState({});   // loc_id     → name
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      const { data: chs } = await supabase.from("chapters").select("id,sequence_number,title").eq("story_id", STORY_ID).order("sequence_number");
      const chapterIds = (chs || []).map(c => c.id);

      const [{ data: scs }, { data: chars }, { data: locs }] = await Promise.all([
        chapterIds.length
          ? supabase.from("scenes").select("id,chapter_id,sequence_number,title").in("chapter_id", chapterIds).order("sequence_number")
          : Promise.resolve({ data: [] }),
        supabase.from("characters").select("id,name,portrait_url,link_color").eq("world_id", WORLD_ID).order("name"),
        supabase.from("places").select("id,name").eq("world_id", WORLD_ID),
      ]);

      const sm = {};
      for (const s of scs || []) {
        if (!sm[s.chapter_id]) sm[s.chapter_id] = [];
        sm[s.chapter_id].push(s);
      }

      const sceneIds = (scs || []).map(s => s.id);
      const { data: bts } = sceneIds.length
        ? await supabase.from("beats").select("id,scene_id,sequence_number,prose_text,snap_location_id,snap_time_of_day,snap_scene_mode,snap_active_character_ids,snap_pov_character_id").in("scene_id", sceneIds).order("sequence_number")
        : { data: [] };

      const bm = {};
      for (const b of bts || []) {
        if (!bm[b.scene_id]) bm[b.scene_id] = [];
        bm[b.scene_id].push(b);
      }

      const cm = {};
      for (const c of chars || []) cm[c.id] = c;

      const lm = {};
      for (const l of locs || []) lm[l.id] = l.name;

      setChapters(chs || []);
      setSceneMap(sm);
      setBeatMap(bm);
      setCharMap(cm);
      setLocMap(lm);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
          <Link to="/" style={{ fontSize: 11, color: "var(--gold2)", fontFamily: "sans-serif", textDecoration: "none", letterSpacing: "0.04em" }}>← Back</Link>
          <span style={{ fontSize: 16, fontFamily: "sans-serif", color: "var(--gold)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Story Map</span>
        </div>
        {loading
          ? <div style={{ color: "var(--text4)", fontFamily: "sans-serif", fontSize: 13 }}>Loading…</div>
          : chapters.length === 0
            ? <div style={{ color: "var(--text4)", fontFamily: "sans-serif", fontSize: 13 }}>No chapters found.</div>
            : <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                {chapters.map(ch => (
                  <ChapterRow key={ch.id} chapter={ch} sceneMap={sceneMap} beatMap={beatMap} charMap={charMap} locMap={locMap} />
                ))}
              </div>
        }
      </div>
    </div>
  );
}
