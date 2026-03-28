import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabase.js";

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
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg2); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
`;

const S = {
  app:      { height:"100vh", background:"var(--bg)", color:"var(--text)", display:"flex", flexDirection:"column" },
  nav:      { background:"var(--bg2)", borderBottom:"1px solid var(--border)", padding:"0 16px", height:48, display:"flex", alignItems:"center", gap:12, flexShrink:0 },
  navLink:  { fontSize:12, color:"var(--text3)", fontFamily:"sans-serif", textDecoration:"none", flexShrink:0, letterSpacing:"0.04em" },
  vdiv:     { width:1, height:22, background:"var(--border)", flexShrink:0 },
  logo:     { fontSize:13, fontWeight:"bold", color:"var(--gold)", letterSpacing:"0.07em", fontFamily:"sans-serif", flexShrink:0 },
  title:    { fontSize:12, color:"var(--text3)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase" },
  body:     { flex:1, display:"flex", overflow:"hidden" },
  // sidebar
  sidebar:  { width:280, flexShrink:0, borderRight:"1px solid var(--border)", overflowY:"auto", background:"var(--bg2)", padding:"12px 0" },
  grpLbl:   { fontSize:10, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", padding:"14px 14px 5px" },
  charRow:  { display:"flex", alignItems:"center", gap:9, padding:"6px 14px", cursor:"grab", fontFamily:"sans-serif", fontSize:13 },
  // main panel
  main:     { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
  crumb:    { background:"var(--bg3)", borderBottom:"1px solid var(--border)", padding:"0 20px", height:40, display:"flex", alignItems:"center", gap:6, flexShrink:0, flexWrap:"wrap" },
  crumbBtn: { background:"none", border:"none", cursor:"pointer", color:"var(--text3)", fontSize:12, fontFamily:"sans-serif", padding:"2px 4px" },
  crumbSep: { color:"var(--text4)", fontSize:11 },
  crumbCur: { color:"var(--gold)", fontSize:12, fontFamily:"sans-serif", padding:"2px 4px" },
  content:  { flex:1, overflowY:"auto", padding:"20px 28px 60px" },
  // location list
  locItem:  { display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:5, cursor:"pointer", marginBottom:4, border:"1px solid transparent" },
  locName:  { fontSize:14, color:"var(--text)", fontFamily:"sans-serif" },
  locType:  { fontSize:10, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.07em", textTransform:"uppercase", background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:3, padding:"1px 6px" },
  locArrow: { marginLeft:"auto", color:"var(--text4)", fontSize:12 },
  // detail
  detWrap:  { marginTop:28, paddingTop:24, borderTop:"1px solid var(--border)" },
  detName:  { fontSize:22, color:"var(--gold)", fontWeight:"normal", marginBottom:6 },
  detAtm:   { fontSize:14, color:"var(--text3)", fontStyle:"italic", lineHeight:1.7, marginBottom:16 },
  detDesc:  { fontSize:15, lineHeight:1.8, color:"var(--text)", marginBottom:20 },
  secLbl:   { fontSize:10, color:"var(--gold2)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 },
  // occupants
  occZone:  { minHeight:60, borderRadius:6, border:"1px dashed var(--border2)", padding:"12px 14px", display:"flex", flexWrap:"wrap", gap:10, alignItems:"flex-start" },
  occChip:  { display:"flex", alignItems:"center", gap:7, background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:20, padding:"4px 10px 4px 4px", fontFamily:"sans-serif", fontSize:12 },
  occRole:  { fontSize:10, color:"var(--text4)", letterSpacing:"0.06em", textTransform:"uppercase" },
  occX:     { background:"none", border:"none", cursor:"pointer", color:"var(--text4)", fontSize:11, padding:"0 0 0 4px", lineHeight:1 },
  // role picker
  rolePick: { display:"flex", alignItems:"center", gap:8, background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:6, padding:"8px 12px", flexWrap:"wrap" },
  roleBtn:  { background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text3)", fontSize:11, fontFamily:"sans-serif", cursor:"pointer", padding:"3px 9px" },
  msg:      { color:"var(--text4)", fontStyle:"italic", fontSize:13, padding:"24px 0", fontFamily:"sans-serif" },
  err:      { background:"#1a1210", border:"1px solid #3a2020", borderRadius:5, padding:"14px 18px", color:"#c07060", fontSize:13, fontFamily:"sans-serif", lineHeight:1.6 },
};

const ROLES = ["owner", "worker", "resident", "regular", "visitor"];
const PRESENCE = { regular: 70, visitor: 30 };

export default function Places() {
  const [data,      setData]      = useState({ continents:[], regions:[], settlements:[], locations:[] });
  const [chars,     setChars]     = useState([]);
  const [trail,     setTrail]     = useState([]);
  const [selected,  setSelected]  = useState(null); // { level, id, name, ...rest }
  const [occupants, setOccupants] = useState([]);
  const [phase,     setPhase]     = useState("loading");
  const [err,       setErr]       = useState("");
  const [dragOver,  setDragOver]  = useState(false);
  const [dropChar,  setDropChar]  = useState(null); // { id, name } pending role assignment
  const [dropRole,  setDropRole]  = useState("regular");

  const draggingChar = { id: null, name: null };

  useEffect(() => {
    (async () => {
      try {
        const [
          { data: continents,  error: e1 },
          { data: regions,     error: e2 },
          { data: settlements, error: e3 },
          { data: locations,   error: e4 },
          { data: characters,  error: e5 },
        ] = await Promise.all([
          supabase.from("continents").select("id, name"),
          supabase.from("regions").select("id, name, continent_id"),
          supabase.from("settlements").select("id, name, description, atmosphere, region_id"),
          supabase.from("locations").select("id, name, description, atmosphere, settlement_id, parent_location_id, location_type"),
          supabase.from("characters").select("id, name, portrait_url, link_color, character_group").order("name"),
        ]);
        for (const e of [e1, e2, e3, e4, e5]) if (e) throw e;
        setData({
          continents:  continents  || [],
          regions:     regions     || [],
          settlements: settlements || [],
          locations:   locations   || [],
        });
        setChars(characters || []);
        setPhase("ready");
      } catch(e) { setErr(e.message); setPhase("error"); }
    })();
  }, []);

  const fetchOccupants = useCallback(async (locationId) => {
    const { data } = await supabase
      .from("location_characters")
      .select("id, role, presence_chance, character_id, characters(id, name, portrait_url, link_color)")
      .eq("location_id", locationId);
    setOccupants(data || []);
  }, []);

  const selectItem = useCallback((item, level, newTrail) => {
    setSelected({ ...item, level });
    setDropChar(null);
    fetchOccupants(item.id);
    if (newTrail !== undefined) setTrail(newTrail);
  }, [fetchOccupants]);

  const getChildren = (level, id) => {
    if (level === null)         return data.continents.map(c => ({ ...c, level:"continent" }));
    if (level === "continent")  return data.regions.filter(r => r.continent_id === id).map(r => ({ ...r, level:"region" }));
    if (level === "region")     return data.settlements.filter(s => s.region_id === id).map(s => ({ ...s, level:"settlement" }));
    if (level === "settlement") return data.locations.filter(l => l.settlement_id === id && !l.parent_location_id).map(l => ({ ...l, level:"location" }));
    if (level === "location")   return data.locations.filter(l => l.parent_location_id === id).map(l => ({ ...l, level:"location" }));
    return [];
  };

  const hasChildren = (item) => getChildren(item.level, item.id).length > 0;

  const currentLevel = trail.length ? trail[trail.length - 1].level : null;
  const currentId    = trail.length ? trail[trail.length - 1].id    : null;
  const listItems    = getChildren(currentLevel, currentId);
  const canDrillDown = selected && hasChildren(selected);

  const pushTrail = (item, level) => {
    const entry = { level, id: item.id, name: item.name };
    const newTrail = [...trail, entry];
    selectItem(item, level, newTrail);
  };

  const jumpTrail = (idx) => {
    if (idx === -1) { setTrail([]); setSelected(null); setOccupants([]); return; }
    const newTrail = trail.slice(0, idx + 1);
    const entry = newTrail[newTrail.length - 1];
    // find full item
    const allItems = [...data.continents, ...data.regions, ...data.settlements, ...data.locations];
    const item = allItems.find(i => i.id === entry.id) || { id: entry.id, name: entry.name };
    selectItem(item, entry.level, newTrail);
  };

  // ── Drag handlers ──
  const onCharDragStart = (e, char) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("charId",   char.id);
    e.dataTransfer.setData("charName", char.name);
  };

  const onDetDragOver = (e) => {
    if (!selected || selected.level === "continent" || selected.level === "region") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  };

  const onDetDragLeave = () => setDragOver(false);

  const onDetDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const charId   = e.dataTransfer.getData("charId");
    const charName = e.dataTransfer.getData("charName");
    if (!charId || !selected) return;
    setDropChar({ id: charId, name: charName });
    setDropRole("regular");
  };

  const confirmDrop = async () => {
    if (!dropChar || !selected) return;
    const presence = PRESENCE[dropRole] ?? 100;
    await supabase.from("location_characters").insert({
      location_id:      selected.id,
      character_id:     dropChar.id,
      role:             dropRole,
      presence_chance:  presence,
    });
    setDropChar(null);
    fetchOccupants(selected.id);
  };

  const removeOccupant = async (lcId) => {
    await supabase.from("location_characters").delete().eq("id", lcId);
    setOccupants(prev => prev.filter(o => o.id !== lcId));
  };

  // ── Grouped chars for sidebar ──
  const charGroups = chars.reduce((acc, c) => {
    const g = c.character_group || "Ungrouped";
    if (!acc[g]) acc[g] = [];
    acc[g].push(c);
    return acc;
  }, {});

  const isDroppable = selected && selected.level === "location";

  return (
    <>
      <style>{CSS}</style>
      <div style={S.app}>

        {/* nav */}
        <div style={S.nav}>
          <Link to="/" style={S.navLink}>← Story</Link>
          <div style={S.vdiv} />
          <div style={S.logo}>Safe Harbor</div>
          <div style={S.vdiv} />
          <Link to="/codex" style={S.navLink}>Codex</Link>
          <div style={S.vdiv} />
          <span style={S.title}>Places</span>
        </div>

        <div style={S.body}>
          {/* character sidebar */}
          <div style={S.sidebar}>
            <div style={S.grpLbl}>Characters</div>
            {Object.entries(charGroups).map(([grp, members]) => (
              <div key={grp}>
                <div style={{ fontSize:9, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", padding:"10px 14px 3px", opacity:0.7 }}>{grp}</div>
                {members.map(c => {
                  const color = c.link_color || "#7a6e62";
                  return (
                    <div key={c.id}
                      draggable
                      onDragStart={e => onCharDragStart(e, c)}
                      style={{ ...S.charRow, color }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {c.portrait_url
                        ? <img src={c.portrait_url} alt={c.name} style={{ width:24, height:24, borderRadius:"50%", objectFit:"cover", border:`1.5px solid ${color}`, flexShrink:0 }} />
                        : <div style={{ width:24, height:24, borderRadius:"50%", background:color+"22", border:`1.5px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color, fontFamily:"sans-serif", fontWeight:"bold", flexShrink:0 }}>{c.name[0]}</div>
                      }
                      {c.name}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* main panel */}
          <div style={S.main}>
            {/* breadcrumb */}
            <div style={S.crumb}>
              <button style={S.crumbBtn} onClick={() => jumpTrail(-1)}>World</button>
              {trail.map((t, i) => (
                <span key={t.id} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={S.crumbSep}>›</span>
                  {i < trail.length - 1
                    ? <button style={S.crumbBtn} onClick={() => jumpTrail(i)}>{t.name}</button>
                    : <span style={S.crumbCur}>{t.name}</span>
                  }
                </span>
              ))}
            </div>

            <div style={S.content}>
              {phase === "loading" && <div style={S.msg}>Loading…</div>}
              {phase === "error"   && <div style={S.err}>{err}</div>}
              {phase === "ready"   && (
                <>
                  {/* location list */}
                  {listItems.length === 0
                    ? <div style={S.msg}>Nothing here yet.</div>
                    : listItems.map(item => {
                        const isSelected = selected?.id === item.id;
                        return (
                          <div key={item.id}
                            style={{ ...S.locItem, background: isSelected ? "var(--bg4)" : "var(--bg3)", borderColor: isSelected ? "var(--border2)" : "transparent" }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg4)"; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg3)"; }}
                            onClick={() => selectItem(item, item.level, undefined)}>
                            <div style={{ flex:1 }}>
                              <span style={S.locName}>{item.name}</span>
                              {item.location_type && <span style={{ ...S.locType, marginLeft:8 }}>{item.location_type}</span>}
                            </div>
                            {hasChildren(item) && <span style={S.locArrow}>›</span>}
                          </div>
                        );
                      })
                  }

                  {/* detail panel */}
                  {selected && (
                    <div style={S.detWrap}
                      onDragOver={onDetDragOver}
                      onDragLeave={onDetDragLeave}
                      onDrop={onDetDrop}>

                      <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:4 }}>
                        <div style={S.detName}>{selected.name}</div>
                        {selected.location_type && <span style={S.locType}>{selected.location_type}</span>}
                        {canDrillDown && getChildren(selected.level, selected.id).length > 0 && (
                          <button onClick={() => pushTrail(selected, selected.level)}
                            style={{ marginLeft:"auto", background:"none", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text3)", fontSize:11, fontFamily:"sans-serif", cursor:"pointer", padding:"3px 10px" }}>
                            Enter →
                          </button>
                        )}
                      </div>

                      {selected.atmosphere && <div style={S.detAtm}>{selected.atmosphere}</div>}
                      {selected.description && <div style={S.detDesc}>{selected.description}</div>}

                      {/* occupants — only for settlement/location/room */}
                      {isDroppable && (
                        <div style={{ marginTop:16 }}>
                          <div style={S.secLbl}>Occupants</div>
                          <div style={{
                            ...S.occZone,
                            borderColor: dragOver ? "var(--gold2)" : "var(--border2)",
                            background:  dragOver ? "#c9a86c11"   : "transparent",
                          }}>
                            {occupants.length === 0 && !dropChar && (
                              <div style={{ color:"var(--text4)", fontStyle:"italic", fontSize:12, fontFamily:"sans-serif" }}>
                                Drop a character here to add them
                              </div>
                            )}
                            {occupants.map(o => {
                              const c = o.characters;
                              if (!c) return null;
                              const color = c.link_color || "#7a6e62";
                              return (
                                <div key={o.id} style={S.occChip}>
                                  {c.portrait_url
                                    ? <img src={c.portrait_url} alt={c.name} style={{ width:24, height:24, borderRadius:"50%", objectFit:"cover", border:`1.5px solid ${color}` }} />
                                    : <div style={{ width:24, height:24, borderRadius:"50%", background:color+"22", border:`1.5px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color, fontFamily:"sans-serif", fontWeight:"bold" }}>{c.name[0]}</div>
                                  }
                                  <div>
                                    <div style={{ color, fontSize:12, fontFamily:"sans-serif" }}>{c.name}</div>
                                    <div style={S.occRole}>
                                      {o.role}{(o.role === "regular" || o.role === "visitor") && o.presence_chance != null ? ` · ${o.presence_chance}%` : ""}
                                    </div>
                                  </div>
                                  <button style={S.occX} onClick={() => removeOccupant(o.id)}>✕</button>
                                </div>
                              );
                            })}

                            {/* inline role picker after drop */}
                            {dropChar && (
                              <div style={S.rolePick}>
                                <span style={{ fontSize:12, color:"var(--text3)", fontFamily:"sans-serif" }}>{dropChar.name} —</span>
                                {ROLES.map(r => (
                                  <button key={r} onClick={() => setDropRole(r)} style={{
                                    ...S.roleBtn,
                                    borderColor: dropRole === r ? "var(--gold2)" : "var(--border2)",
                                    color:       dropRole === r ? "var(--gold)"  : "var(--text3)",
                                  }}>{r}</button>
                                ))}
                                <button onClick={confirmDrop} style={{ ...S.roleBtn, color:"var(--gold)", borderColor:"var(--gold2)" }}>Add</button>
                                <button onClick={() => setDropChar(null)} style={S.roleBtn}>✕</button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
