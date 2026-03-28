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

const taBtn = { background:"none", border:"1px solid var(--border2)", borderRadius:4, cursor:"pointer", padding:"3px 10px", fontSize:11, fontFamily:"sans-serif", letterSpacing:"0.05em", color:"var(--text3)" };

function FieldList({ data, fields, editing, draft, onDraftChange }) {
  if (!editing) {
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
  // edit mode — show all fields as textareas
  return (
    <>
      {fields.map(f => (
        <div key={f.key} style={{ marginBottom:20 }}>
          <div style={S.secLbl}>{f.label}</div>
          <textarea
            value={draft[f.key] ?? ""}
            onChange={e => onDraftChange(f.key, e.target.value)}
            rows={3}
            style={{ width:"100%", background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text)", fontSize:14, fontFamily:"Georgia, serif", lineHeight:1.7, padding:"8px 10px", resize:"vertical", outline:"none" }}
          />
        </div>
      ))}
    </>
  );
}

function DetailPanel({ char, onCharUpdate }) {
  const [tab,     setTab]     = useState("Core");
  const [erotic,  setErotic]  = useState(undefined);
  const [combat,  setCombat]  = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState({});
  const [saving,  setSaving]  = useState(false);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    setTab("Core");
    setErotic(undefined);
    setCombat(undefined);
    setEditing(false);
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

  const dataForTab = () => tab === "Core" ? char : tab === "Erotic" ? erotic : combat;
  const fieldsForTab = () => tab === "Core" ? CORE_FIELDS : tab === "Erotic" ? EROTIC_FIELDS : COMBAT_FIELDS;

  const startEdit = () => {
    const src = dataForTab() || {};
    const init = {};
    fieldsForTab().forEach(f => { init[f.key] = src[f.key] ?? ""; });
    setDraft(init);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setDraft({}); };

  const saveEdit = async () => {
    setSaving(true);
    const payload = {};
    fieldsForTab().forEach(f => { payload[f.key] = draft[f.key] || null; });
    try {
      if (tab === "Core") {
        await supabase.from("characters").update(payload).eq("id", char.id);
        onCharUpdate({ ...char, ...payload });
      } else if (tab === "Erotic") {
        await supabase.from("character_erotic").upsert({ ...payload, character_id: char.id }, { onConflict: "character_id" });
        setErotic(prev => ({ ...(prev || {}), ...payload, character_id: char.id }));
      } else {
        await supabase.from("character_combat").upsert({ ...payload, character_id: char.id }, { onConflict: "character_id" });
        setCombat(prev => ({ ...(prev || {}), ...payload, character_id: char.id }));
      }
    } finally {
      setSaving(false);
      setEditing(false);
      setDraft({});
    }
  };

  const copyForNovelCrafter = () => {
    const sections = [
      { label:"CORE",   fields:CORE_FIELDS,   data:char },
      { label:"EROTIC", fields:EROTIC_FIELDS, data:erotic },
      { label:"COMBAT", fields:COMBAT_FIELDS, data:combat },
    ];
    const lines = [`[${char.name}]`];
    for (const { label, fields, data } of sections) {
      if (!data) continue;
      const entries = fields.filter(f => data[f.key] != null && data[f.key] !== "");
      if (!entries.length) continue;
      lines.push("", label);
      for (const f of entries) lines.push(`${f.label}: ${data[f.key]}`);
    }
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
        {/* name row + action buttons */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:4 }}>
          <div style={S.name}>{char.name}</div>
          {!loading && (
            <div style={{ display:"flex", gap:6, flexShrink:0, paddingTop:6 }}>
              <button onClick={copyForNovelCrafter} style={taBtn}>{copied ? "Copied!" : "Copy"}</button>
              {editing
                ? <>
                    <button onClick={saveEdit}   disabled={saving} style={{ ...taBtn, color:"var(--gold)",  borderColor:"var(--gold2)" }}>{saving ? "Saving…" : "Save"}</button>
                    <button onClick={cancelEdit} disabled={saving} style={taBtn}>Cancel</button>
                  </>
                : <button onClick={startEdit} style={taBtn}>Edit</button>
              }
            </div>
          )}
        </div>
        {meta && <div style={S.meta}>{meta}</div>}

        {/* tab bar */}
        <div style={{ display:"flex", gap:0, borderBottom:"1px solid var(--border)", marginBottom:24 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => { if (!editing) setTab(t); }} style={{
              background:"none", border:"none", cursor: editing ? "default" : "pointer",
              padding:"8px 16px 7px",
              fontSize:10, fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase",
              color: t === tab ? "var(--gold)" : "var(--text4)",
              borderBottom: t === tab ? "2px solid var(--gold)" : "2px solid transparent",
              marginBottom:-1,
              opacity: editing && t !== tab ? 0.4 : 1,
            }}>{t}</button>
          ))}
        </div>

        {/* tab content */}
        {loading
          ? <div style={S.msg}>Loading…</div>
          : <FieldList
              data={dataForTab()}
              fields={fieldsForTab()}
              editing={editing}
              draft={draft}
              onDraftChange={(k, v) => setDraft(p => ({ ...p, [k]: v }))}
            />
        }
      </div>
    </div>
  );
}

export default function Codex() {
  const [characters,  setCharacters]  = useState([]);
  const [allGroups,   setAllGroups]   = useState([]);
  const [groupOrder,  setGroupOrder]  = useState([]);
  const [collapsed,   setCollapsed]   = useState(() => {
    const saved = localStorage.getItem("codex_collapsed_groups");
    return saved ? new Set(JSON.parse(saved)) : null;
  });
  const [selected,    setSelected]    = useState(null);
  const [storyTitle,  setStoryTitle]  = useState("");
  const [phase,       setPhase]       = useState("loading");
  const [err,         setErr]         = useState("");
  const [dragOverGrp, setDragOverGrp] = useState(null);

  const draggingCharId  = useRef(null);
  const draggingGrpName = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: chars, error: e1 }, { data: grps, error: e2 }, { data: story }] = await Promise.all([
          supabase
            .from("characters")
            .select("id, name, role, species, age, occupation, portrait_url, link_color, physical_appearance, personality, backstory_summary, group_id, character_group")
            .eq("world_id", WORLD_ID)
            .order("name"),
          supabase
            .from("character_groups")
            .select("id, name, link_color, sort_order")
            .order("sort_order"),
          supabase
            .from("stories")
            .select("title")
            .eq("id", "ca821271-2bca-4b3c-bdf7-7224e0b4e8b3")
            .single(),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        if (story?.title) setStoryTitle(story.title);
        const charList = chars || [];
        const grpList  = grps  || [];
        setCharacters(charList);
        setAllGroups(grpList);
        // order by sort_order from DB; append any group names from chars not in groups table
        const grpNames = grpList.map(g => g.name);
        const extraNames = [...new Set(charList.map(c => c.character_group || "Ungrouped"))].filter(n => !grpNames.includes(n));
        const allNames = [...grpNames, ...extraNames];
        setGroupOrder(allNames);
        setCollapsed(prev => prev !== null ? prev : new Set(allNames));
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
      const next = new Set(prev ?? []);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  useEffect(() => {
    if (collapsed === null) return;
    localStorage.setItem("codex_collapsed_groups", JSON.stringify([...collapsed]));
  }, [collapsed]);

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
      const updates = { group_id: targetGroup.id, character_group: targetGrpName, link_color: targetGroup.link_color };
      setCharacters(prev => prev.map(c => c.id === charId ? { ...c, ...updates } : c));
      if (selected?.id === charId) setSelected(prev => ({ ...prev, ...updates }));
      await supabase.from("characters").update(updates).eq("id", charId);
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
        // write sort_order back to Supabase for all groups in the table
        next.forEach((name, i) => {
          const grp = allGroups.find(g => g.name === name);
          if (grp) supabase.from("character_groups").update({ sort_order: i + 1 }).eq("id", grp.id);
        });
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
          <span style={{ fontSize:15, color:"var(--gold)", fontFamily:"Georgia, serif" }}>
            {storyTitle ? `${storyTitle.split(':')[0].trim()} Codex` : "Codex"}
          </span>
        </div>

        <div style={S.body}>
          {/* sidebar */}
          <div style={S.sidebar}>
            {phase === "loading" && <div style={{...S.msg, padding:"24px 14px"}}>Loading…</div>}
            {phase === "error"   && <div style={{...S.err, margin:12}}>{err}</div>}
            {phase === "ready"   && orderedGroups.map(grpName => {
              const chars      = groupMap[grpName] || [];
              const isCollapsed = collapsed?.has(grpName) ?? true;
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
              : <DetailPanel key={selected.id} char={selected} onCharUpdate={updated => { setSelected(updated); setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c)); }} />
            }
          </div>
        </div>
      </div>
    </>
  );
}
