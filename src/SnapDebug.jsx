import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  supabase, STORY_ID,
  fetchChapters, fetchScenes, fetchBeats, fetchCharacters, fetchPlaces,
} from "./constants.js";

const S = {
  page:   { background:"#0f0d0b", minHeight:"100vh", padding:"24px 32px", fontFamily:"sans-serif", color:"#ccc", fontSize:13 },
  head:   { display:"flex", alignItems:"center", gap:16, marginBottom:20 },
  back:   { color:"#c9a86c", textDecoration:"none", fontSize:12 },
  title:  { color:"#fff", fontSize:15, fontWeight:600 },
  select: { background:"#1a1612", color:"#ccc", border:"1px solid #3a3028", borderRadius:4, padding:"4px 8px", fontSize:12, fontFamily:"sans-serif" },
  table:  { width:"100%", borderCollapse:"collapse", fontSize:12 },
  th:     { textAlign:"left", padding:"6px 10px", color:"#7a6e62", borderBottom:"1px solid #2e2820", whiteSpace:"nowrap" },
  td:     { padding:"6px 10px", borderBottom:"1px solid #1e1c18", verticalAlign:"top", color:"#ccc" },
  empty:  { color:"#7a6e62", fontStyle:"italic" },
};

export default function SnapDebug() {
  const [chapters, setChapters]   = useState([]);
  const [selCh, setSelCh]         = useState("");
  const [rows, setRows]           = useState([]);
  const [chars, setChars]         = useState([]);
  const [places, setPlaces]       = useState([]);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    fetchChapters().then(setChapters);
    fetchCharacters().then(setChars);
    fetchPlaces().then(setPlaces);
  }, []);

  useEffect(() => {
    if (!selCh) { setRows([]); return; }
    setLoading(true);
    (async () => {
      const scenes = await fetchScenes(selCh);
      const beatArrays = await Promise.all(scenes.map(s => fetchBeats(s.id)));
      const built = [];
      scenes.forEach((s, i) => {
        beatArrays[i].forEach(b => {
          built.push({ scene: s, beat: b });
        });
      });
      setRows(built);
      setLoading(false);
    })();
  }, [selCh]);

  const charName  = id => chars.find(c => c.id === id)?.name ?? id;
  const placeName = id => places.find(p => p.id === id)?.name ?? id;

  return (
    <div style={S.page}>
      <div style={S.head}>
        <Link to="/" style={S.back}>← Back</Link>
        <span style={S.title}>Snap Debug</span>
        <select style={S.select} value={selCh} onChange={e => setSelCh(e.target.value)}>
          <option value="">— pick a chapter —</option>
          {chapters.map(c => (
            <option key={c.id} value={c.id}>
              Ch {c.sequence_number}: {c.title}
            </option>
          ))}
        </select>
        {loading && <span style={{ color:"#7a6e62" }}>Loading…</span>}
      </div>

      {rows.length > 0 && (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Scene</th>
              <th style={S.th}>Beat #</th>
              <th style={S.th}>Location</th>
              <th style={S.th}>Time</th>
              <th style={S.th}>Mode</th>
              <th style={S.th}>POV</th>
              <th style={S.th}>Characters</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ scene, beat }) => {
              const b = beat;
              const hasSnap = b.snap_location_id || b.snap_time_of_day || b.snap_scene_mode ||
                              b.snap_active_character_ids?.length || b.snap_pov_character_id;
              return (
                <tr key={b.id} style={{ opacity: hasSnap ? 1 : 0.4 }}>
                  <td style={S.td}>{scene.title || `Scene ${scene.sequence_number}`}</td>
                  <td style={{ ...S.td, color:"#7a6e62" }}>{b.sequence_number}</td>
                  <td style={S.td}>{b.snap_location_id ? placeName(b.snap_location_id) : <span style={S.empty}>—</span>}</td>
                  <td style={S.td}>{b.snap_time_of_day || <span style={S.empty}>—</span>}</td>
                  <td style={S.td}>{b.snap_scene_mode  || <span style={S.empty}>—</span>}</td>
                  <td style={S.td}>{b.snap_pov_character_id ? charName(b.snap_pov_character_id) : <span style={S.empty}>—</span>}</td>
                  <td style={S.td}>
                    {b.snap_active_character_ids?.length
                      ? b.snap_active_character_ids.map(id => charName(id)).join(", ")
                      : <span style={S.empty}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {!loading && selCh && rows.length === 0 && (
        <div style={{ color:"#7a6e62", fontStyle:"italic" }}>No beats found for this chapter.</div>
      )}
    </div>
  );
}
