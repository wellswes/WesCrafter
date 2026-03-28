import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabase.js";

const WORLD_ID = "96f993ca-19eb-4698-b0f7-e8ee94d7e8fc";

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
  app:       { height:"100vh", background:"var(--bg)", color:"var(--text)", display:"flex", flexDirection:"column" },
  nav:       { background:"var(--bg2)", borderBottom:"1px solid var(--border)", padding:"0 16px", height:48, display:"flex", alignItems:"center", gap:12, flexShrink:0 },
  back:      { fontSize:12, color:"var(--text3)", fontFamily:"sans-serif", textDecoration:"none", flexShrink:0, letterSpacing:"0.04em" },
  vdiv:      { width:1, height:22, background:"var(--border)", flexShrink:0 },
  logo:      { fontSize:13, fontWeight:"bold", color:"var(--gold)", letterSpacing:"0.07em", fontFamily:"sans-serif", flexShrink:0 },
  title:     { fontSize:12, color:"var(--text3)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase" },
  body:      { flex:1, display:"flex", overflow:"hidden" },
  sidebar:   { width:220, flexShrink:0, borderRight:"1px solid var(--border)", overflowY:"auto", background:"var(--bg2)", padding:"12px 0" },
  grpHeader: { display:"flex", alignItems:"center", gap:6, padding:"14px 14px 5px", cursor:"grab", userSelect:"none" },
  grpLbl:    { fontSize:10, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", flex:1 },
  grpArrow:  { fontSize:9, color:"var(--text4)", fontFamily:"sans-serif", flexShrink:0 },
  charRow:   { display:"flex", alignItems:"center", gap:9, padding:"6px 14px", cursor:"pointer", fontFamily:"sans-serif", fontSize:13 },
  panel:     { flex:1, overflowY:"auto", padding:"0 48px 40px 0" },
  name:      { fontSize:28, color:"var(--gold)", fontWeight:"normal", marginBottom:4 },
  meta:      { fontSize:12, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.05em", marginBottom:16 },
  secLbl:    { fontSize:10, color:"var(--gold2)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 },
  secBody:   { fontSize:15, lineHeight:1.8, color:"var(--text)", marginBottom:24, textAlign:"left" },
  msg:       { color:"var(--text4)", fontStyle:"italic", fontSize:13, padding:"24px 0", textAlign:"left", fontFamily:"sans-serif" },
  err:       { background:"#1a1210", border:"1px solid #3a2020", borderRadius:5, padding:"14px 18px", color:"#c07060", fontSize:13, fontFamily:"sans-serif", lineHeight:1.6 },
};

const TABS = ["Core", "Erotic", "Combat"];

const CORE_FIELDS = [
  { key:"physical_appearance", label:"Appearance" },
  { key:"personality",         label:"Personality" },
  { key:"backstory_summary",   label:"Backstory" },
  { key:"age",                 label:"Age" },
  { key:"occupation",          label:"Occupation" },
  { key:"species",             label:"Species" },
];

const EROTIC_FIELDS = [
  { key:"appearance_detail",  label:"Appearance Detail" },
  { key:"body_attributes",    label:"Body Attributes" },
  { key:"intimacy_behavior",  label:"Intimacy Behavior" },
  { key:"heat_notes",         label:"Heat Notes" },
  { key:"sensory_cues",       label:"Sensory Cues" },
  { key:"unique_biology",     label:"Unique Biology" },
];

const COMBAT_FIELDS = [
  { key:"archetype",        label:"Archetype" },
  { key:"abilities",        label:"Abilities" },
  { key:"spells",           label:"Spells" },
  { key:"stats",            label:"Stats" },
  { key:"fighting_style",   label:"Fighting Style" },
  { key:"equipment_notes",  label:"Equipment Notes" },
];

function FieldList({ data, fields }) {
  if (!data) return <div style={S.msg}>No data yet.</div>;
  const entries = fields.filter(f => data[f.key] != null && data[f.key] !== "");
  if (!entries.length) return <div style={S.msg}>No data yet.</div>;
  return (
    <>
      {entries.map(f => (
        <div key={f.key}>
          <div style={S.secLbl}>{f.label}</div>
          <div style={S.secBody}>{String(data[f.key])}</div>
        </div>
      ))}
    </>
  );
}

function DetailPanel({ char }) {
  const [tab,     setTab]     = useState("Core");
  const [erotic,  setErotic]  = useState(undefined); // undefined = not yet loaded
  const [combat,  setCombat]  = useState(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTab("Core");
    setErotic(undefined);
    setCombat(undefined);
    setLoading(true);
    Promise.all([
      supabase.from("character_erotic").select("*").eq("character_id", char.id).single(),
      supabase.from("character_combat").select("*").eq("character_id", char.id).single(),
    ]).then(([{ data: e }, { data: c }]) => {
      setErotic(e || null);
      setCombat(c || null);
      setLoading(false);
    });
  }, [char.id]);

  const color = char.link_color || "#7a6e62";
  const meta  = [char.character_group, char.role, char.species].filter(Boolean).join(" · ");

  return (
    <div style={{ display:"flex", gap:28, alignItems:"flex-start" }}>
      {/* left column — sticky portrait */}
      <div style={{ width:320, flexShrink:0, position:"sticky", top:0 }}>
        {char.portrait_url
          ? <img src={char.portrait_url} alt={char.name} style={{ width:"100%", height:"auto", objectFit:"cover", borderRadius:8, border:`3px solid ${color}`, display:"block" }} />
          : <div style={{ width:"100%", aspectRatio:"1", borderRadius:8, background:color+"22", border:`3px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:80, color, fontFamily:"sans-serif", fontWeight:"bold" }}>{char.name[0]}</div>
        }
      </div>

      {/* right column */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={S.name}>{char.name}</div>
        {meta && <div style={S.meta}>{meta}</div>}

        {/* tab bar */}
        <div style={{ display:"flex", gap:0, borderBottom:"1px solid var(--border)", marginBottom:24 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background:"none", border:"none", cursor:"pointer",
              padding:"8px 16px 7px",
              fontSize:10, fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase",
              color: t === tab ? "var(--gold)" : "var(--text4)",
              borderBottom: t === tab ? "2px solid var(--gold)" : "2px solid transparent",
              marginBottom:-1,
            }}>{t}</button>
          ))}
        </div>

        {/* tab content */}
        {loading
          ? <div style={S.msg}>Loading…</div>
          : tab === "Core"   ? <FieldList data={char}   fields={CORE_FIELDS} />
          : tab === "Erotic" ? <FieldList data={erotic} fields={EROTIC_FIELDS} />
          :                    <FieldList data={combat} fields={COMBAT_FIELDS} />
        }
      </div>
    </div>
  );
}

export default function Codex() {
  const [characters,  setCharacters]  = useState([]);
  const [allGroups,   setAllGroups]   = useState([]);
  const [groupOrder,  setGroupOrder]  = useState([]);
  const [collapsed,   setCollapsed]   = useState(new Set());
  const [selected,    setSelected]    = useState(null);
  const [phase,       setPhase]       = useState("loading");
  const [err,         setErr]         = useState("");
  const [dragOverGrp, setDragOverGrp] = useState(null);

  const draggingCharId  = useRef(null);
  const draggingGrpName = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: chars, error: e1 }, { data: grps, error: e2 }] = await Promise.all([
          supabase
            .from("characters")
            .select("id, name, role, species, age, occupation, portrait_url, link_color, physical_appearance, personality, backstory_summary, group_id, character_group")
            .eq("world_id", WORLD_ID)
            .order("name"),
          supabase
            .from("character_groups")
            .select("id, name, link_color")
            .order("name"),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        const charList = chars || [];
        setCharacters(charList);
        setAllGroups(grps || []);
        const namesFromChars = [...new Set(charList.map(c => c.character_group || "Ungrouped"))];
        setGroupOrder(namesFromChars);
        if (charList.length) setSelected(charList[0]);
        setPhase("ready");
      } catch(e) { setErr(e.message); setPhase("error"); }
    })();
  }, []);

  const groupMap = characters.reduce((acc, c) => {
    const g = c.character_group || "Ungrouped";
    if (!acc[g]) acc[g] = [];
    acc[g].push(c);
    return acc;
  }, {});

  const toggleCollapse = (name) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const onCharDragStart = (e, charId) => {
    draggingCharId.current  = charId;
    draggingGrpName.current = null;
    e.dataTransfer.effectAllowed = "move";
  };

  const onGrpDragStart = (e, grpName) => {
    draggingGrpName.current = grpName;
    draggingCharId.current  = null;
    e.dataTransfer.effectAllowed = "move";
    e.stopPropagation();
  };

  const onDragOver = (e, grpName) => {
    e.preventDefault();
    if (draggingCharId.current || (draggingGrpName.current && draggingGrpName.current !== grpName)) {
      e.dataTransfer.dropEffect = "move";
      setDragOverGrp(grpName);
    }
  };

  const onDragLeave = () => setDragOverGrp(null);

  const onDrop = async (e, targetGrpName) => {
    e.preventDefault();
    setDragOverGrp(null);

    if (draggingCharId.current) {
      const charId = draggingCharId.current;
      draggingCharId.current = null;
      const targetGroup = allGroups.find(g => g.name === targetGrpName);
      if (!targetGroup) return;
      const char = characters.find(c => c.id === charId);
      if (!char || char.character_group === targetGrpName) return;
      setCharacters(prev => prev.map(c =>
        c.id === charId ? { ...c, group_id: targetGroup.id, character_group: targetGrpName } : c
      ));
      if (selected?.id === charId)
        setSelected(prev => ({ ...prev, group_id: targetGroup.id, character_group: targetGrpName }));
      await supabase.from("characters").update({ group_id: targetGroup.id, character_group: targetGrpName }).eq("id", charId);
      return;
    }

    if (draggingGrpName.current && draggingGrpName.current !== targetGrpName) {
      const src = draggingGrpName.current;
      draggingGrpName.current = null;
      setGroupOrder(prev => {
        const next = [...prev];
        const srcIdx = next.indexOf(src);
        const tgtIdx = next.indexOf(targetGrpName);
        if (srcIdx === -1 || tgtIdx === -1) return prev;
        next.splice(srcIdx, 1);
        next.splice(tgtIdx, 0, src);
        return next;
      });
    }
  };

  const onDragEnd = () => {
    draggingCharId.current  = null;
    draggingGrpName.current = null;
    setDragOverGrp(null);
  };

  const orderedGroups = groupOrder.filter(name => groupMap[name]);

  return (
    <>
      <style>{CSS}</style>
      <div style={S.app}>

        {/* nav */}
        <div style={S.nav}>
          <Link to="/" style={S.back}>← Story</Link>
          <div style={S.vdiv} />
          <div style={S.logo}>Safe Harbor</div>
          <div style={S.vdiv} />
          <span style={S.title}>Character Codex</span>
        </div>

        <div style={S.body}>
          {/* sidebar */}
          <div style={S.sidebar}>
            {phase === "loading" && <div style={{...S.msg, padding:"24px 14px"}}>Loading…</div>}
            {phase === "error"   && <div style={{...S.err, margin:12}}>{err}</div>}
            {phase === "ready"   && orderedGroups.map(grpName => {
              const chars      = groupMap[grpName] || [];
              const isCollapsed = collapsed.has(grpName);
              const isDragOver  = dragOverGrp === grpName;
              return (
                <div key={grpName}
                  onDragOver={e => onDragOver(e, grpName)}
                  onDragLeave={onDragLeave}
                  onDrop={e => onDrop(e, grpName)}
                  style={{ outline: isDragOver ? "1px solid var(--gold2)" : "1px solid transparent", borderRadius:4, margin:"0 4px" }}>
                  <div draggable onDragStart={e => onGrpDragStart(e, grpName)} onDragEnd={onDragEnd}
                    style={S.grpHeader} onClick={() => toggleCollapse(grpName)}>
                    <span style={S.grpArrow}>{isCollapsed ? "▸" : "▾"}</span>
                    <span style={S.grpLbl}>{grpName}</span>
                  </div>
                  {!isCollapsed && chars.map(c => {
                    const color    = c.link_color || "#7a6e62";
                    const isActive = selected?.id === c.id;
                    return (
                      <div key={c.id} draggable
                        onDragStart={e => onCharDragStart(e, c.id)}
                        onDragEnd={onDragEnd}
                        style={{ ...S.charRow, background: isActive ? "var(--bg4)" : "transparent", color }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg3)"; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                        onClick={() => setSelected(c)}>
                        {c.portrait_url
                          ? <img src={c.portrait_url} alt={c.name} style={{ width:28, height:28, borderRadius:"50%", objectFit:"cover", border:`1.5px solid ${color}`, flexShrink:0 }} />
                          : <div style={{ width:28, height:28, borderRadius:"50%", background:color+"22", border:`1.5px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color, fontFamily:"sans-serif", fontWeight:"bold", flexShrink:0 }}>{c.name[0]}</div>
                        }
                        {c.name}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* detail panel */}
          <div style={S.panel}>
            {!selected
              ? <div style={S.msg}>Select a character.</div>
              : <DetailPanel key={selected.id} char={selected} />
            }
          </div>
        </div>
      </div>
    </>
  );
}
