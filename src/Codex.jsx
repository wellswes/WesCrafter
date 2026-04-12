import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabase.js";

const WORLD_ID   = "96f993ca-19eb-4698-b0f7-e8ee94d7e8fc";
const STORY_ID   = "ca821271-2bca-4b3c-bdf7-7224e0b4e8b3";

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
  body:      { flex:1, display:"flex", overflow:"hidden" },
  sidebar:   { width:220, flexShrink:0, overflowY:"auto", background:"var(--bg2)", display:"flex", flexDirection:"column" },
  secToggle: { display:"flex", borderBottom:"1px solid var(--border)", flexShrink:0 },
  secBtn:    { flex:1, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:10, fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase" },
  grpHeader: { display:"flex", alignItems:"center", gap:6, padding:"14px 14px 5px", cursor:"grab", userSelect:"none" },
  grpLbl:    { fontSize:10, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", flex:1 },
  grpArrow:  { fontSize:9, color:"var(--text4)", fontFamily:"sans-serif", flexShrink:0 },
  charRow:   { display:"flex", alignItems:"center", gap:9, padding:"6px 6px 6px 16px", cursor:"pointer", fontFamily:"sans-serif", fontSize:13 },
  panel:     { flex:1, overflowY:"auto", padding:"0 48px 40px 0" },
  name:      { fontSize:28, color:"var(--gold)", fontWeight:"normal", marginBottom:4 },
  meta:      { fontSize:12, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.05em", marginBottom:16 },
  secLbl:    { fontSize:10, color:"var(--gold2)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 },
  secBody:   { fontSize:15, lineHeight:1.8, color:"var(--text)", marginBottom:24, textAlign:"left" },
  msg:       { color:"var(--text4)", fontStyle:"italic", fontSize:13, padding:"24px 0", textAlign:"left", fontFamily:"sans-serif" },
  err:       { background:"#1a1210", border:"1px solid #3a2020", borderRadius:5, padding:"14px 18px", color:"#c07060", fontSize:13, fontFamily:"sans-serif", lineHeight:1.6 },
  // places tree
  treeItem:  { display:"flex", alignItems:"center", gap:5, padding:"5px 8px", cursor:"pointer", fontFamily:"sans-serif", fontSize:12, borderRadius:3, userSelect:"none" },
  treeArrow: { fontSize:8, color:"var(--text4)", flexShrink:0, width:10 },
  treeName:  { flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  locType:   { fontSize:9, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.06em", textTransform:"uppercase", background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:3, padding:"1px 5px", flexShrink:0 },
  // location detail
  detName:   { fontSize:22, color:"var(--gold)", fontWeight:"normal", marginBottom:6 },
  detAtm:    { fontSize:14, color:"var(--text3)", fontStyle:"italic", lineHeight:1.7, marginBottom:16 },
  detDesc:   { fontSize:15, lineHeight:1.8, color:"var(--text)", marginBottom:20 },
  // occupants
  occZone:   { minHeight:52, borderRadius:6, border:"1px dashed var(--border2)", padding:"10px 12px", display:"flex", flexWrap:"wrap", gap:8, alignItems:"flex-start" },
  occChip:   { display:"flex", alignItems:"center", gap:6, background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:20, padding:"3px 8px 3px 3px", fontFamily:"sans-serif", fontSize:12 },
  occRole:   { fontSize:9, color:"var(--text4)", letterSpacing:"0.06em", textTransform:"uppercase" },
  occX:      { background:"none", border:"none", cursor:"pointer", color:"var(--text4)", fontSize:10, padding:"0 0 0 3px", lineHeight:1 },
  rolePick:  { display:"flex", alignItems:"center", gap:6, background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:6, padding:"7px 10px", flexWrap:"wrap" },
  roleBtn:   { background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text3)", fontSize:11, fontFamily:"sans-serif", cursor:"pointer", padding:"3px 8px" },
};

const taBtn = { background:"none", border:"1px solid var(--border2)", borderRadius:4, cursor:"pointer", padding:"3px 10px", fontSize:11, fontFamily:"sans-serif", letterSpacing:"0.05em", color:"var(--text3)" };

const TABS         = ["Core", "Erotic", "Combat", "Sprites", "Relationships"];
const ROLES        = ["owner", "worker", "resident", "regular", "visitor"];

const PRESENCE     = { regular:70, visitor:30 };

const CORE_FIELDS = [
  { key:"species",             label:"Species" },
  { key:"age",                 label:"Age" },
  { key:"occupation",          label:"Occupation" },
  { key:"gender",              label:"Gender" },
  { key:"pronouns",            label:"Pronouns" },
  { key:"physical_appearance", label:"Appearance" },
  { key:"personality",         label:"Personality" },
  { key:"voice_notes",         label:"Voice Notes" },
  { key:"backstory_summary",   label:"Backstory" },
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
  { key:"archetype",       label:"Archetype" },
  { key:"abilities",       label:"Abilities" },
  { key:"spells",          label:"Spells" },
  { key:"stats",           label:"Stats" },
  { key:"fighting_style",  label:"Fighting Style" },
  { key:"equipment_notes", label:"Equipment Notes" },
];

// ── FieldList ────────────────────────────────────────────────────────────────
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
  return (
    <>
      {fields.map(f => (
        <div key={f.key} style={{ marginBottom:20 }}>
          <div style={S.secLbl}>{f.label}</div>
          <textarea value={draft[f.key] ?? ""} onChange={e => onDraftChange(f.key, e.target.value)} rows={3}
            style={{ width:"100%", background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text)", fontSize:14, fontFamily:"Georgia, serif", lineHeight:1.7, padding:"8px 10px", resize:"vertical", outline:"none" }} />
        </div>
      ))}
    </>
  );
}

// ── CoreTab ──────────────────────────────────────────────────────────────────
function CoreTab({ char, onCharUpdate }) {
  const [drafts, setDrafts] = useState({});

  useEffect(() => { setDrafts({}); }, [char.id]);

  const getVal = (key) => drafts[key] !== undefined ? drafts[key] : (char[key] ?? "");
  const setVal = (key, val) => setDrafts(p => ({ ...p, [key]: val }));

  const saveField = async (key) => {
    if (drafts[key] === undefined) return;
    const raw = drafts[key];
    const saved = char[key] ?? "";
    setDrafts(p => { const n = { ...p }; delete n[key]; return n; });
    if (raw === saved) return;
    const update = { [key]: raw || null };
    await supabase.from("characters").update(update).eq("id", char.id);
    onCharUpdate({ ...char, [key]: raw || null });
  };

  const inp = {
    background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4,
    color:"var(--text)", fontSize:14, fontFamily:"Georgia, serif",
    padding:"6px 10px", outline:"none", width:"100%",
  };
  const taStyle = { ...inp, lineHeight:1.7, resize:"vertical" };

  const Field = ({ label, children }) => (
    <div>
      <div style={S.secLbl}>{label}</div>
      {children}
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {/* Row 1 — Identity: species | age */}
      <div style={{ display:"flex", gap:12 }}>
        <Field label="Species">
          <input value={getVal("species")} onChange={e => setVal("species", e.target.value)}
            onBlur={() => saveField("species")} style={inp} />
        </Field>
        <div style={{ width:110, flexShrink:0 }}>
          <Field label="Age">
            <input value={getVal("age")} onChange={e => setVal("age", e.target.value)}
              onBlur={() => saveField("age")} style={inp} />
          </Field>
        </div>
      </div>

      {/* Row 2 — Role: occupation */}
      <Field label="Occupation">
        <input value={getVal("occupation")} onChange={e => setVal("occupation", e.target.value)}
          onBlur={() => saveField("occupation")} style={inp} />
      </Field>

      {/* Row 3 — Gender: gender | pronouns */}
      <div style={{ display:"flex", gap:12 }}>
        <Field label="Gender">
          <input value={getVal("gender")} onChange={e => setVal("gender", e.target.value)}
            onBlur={() => saveField("gender")} style={inp} />
        </Field>
        <Field label="Pronouns">
          <input value={getVal("pronouns")} onChange={e => setVal("pronouns", e.target.value)}
            onBlur={() => saveField("pronouns")} style={inp} />
        </Field>
      </div>

      {/* Row 4 — Appearance */}
      <Field label="Appearance">
        <textarea value={getVal("physical_appearance")} onChange={e => setVal("physical_appearance", e.target.value)}
          onBlur={() => saveField("physical_appearance")} rows={6} style={taStyle} />
      </Field>

      {/* Row 5 — Personality */}
      <Field label="Personality">
        <textarea value={getVal("personality")} onChange={e => setVal("personality", e.target.value)}
          onBlur={() => saveField("personality")} rows={6} style={taStyle} />
      </Field>

      {/* Row 6 — Voice Notes */}
      <Field label="Voice Notes">
        <textarea value={getVal("voice_notes")} onChange={e => setVal("voice_notes", e.target.value)}
          onBlur={() => saveField("voice_notes")} rows={4} style={taStyle} />
      </Field>

      {/* Row 7 — Height */}
      <div>
        <div style={S.secLbl}>Height</div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input type="number" value={getVal("height_feet")} onChange={e => setVal("height_feet", e.target.value)}
            onBlur={() => saveField("height_feet")} placeholder="ft"
            style={{ ...inp, width:70, textAlign:"center" }} />
          <span style={{ fontSize:12, color:"var(--text4)", fontFamily:"sans-serif", flexShrink:0 }}>ft</span>
          <input type="number" value={getVal("height_inches")} onChange={e => setVal("height_inches", e.target.value)}
            onBlur={() => saveField("height_inches")} placeholder="in"
            style={{ ...inp, width:70, textAlign:"center" }} />
          <span style={{ fontSize:12, color:"var(--text4)", fontFamily:"sans-serif", flexShrink:0 }}>in</span>
          {char.height_cm != null && (
            <span style={{ fontSize:12, color:"var(--text4)", fontFamily:"sans-serif", marginLeft:8 }}>
              {char.height_cm} cm · ×{Number(char.height_scale).toFixed(2)}
            </span>
          )}
        </div>
      </div>

    </div>
  );
}

// ── DetailPanel (character) ──────────────────────────────────────────────────
function DetailPanel({ char, onCharUpdate }) {
  const [tab,        setTab]        = useState("Core");
  const [erotic,     setErotic]     = useState(undefined);
  const [combat,     setCombat]     = useState(undefined);
  const [sprites,    setSprites]    = useState(null);
  const [rels,       setRels]       = useState(null);
  const [relsChars,  setRelsChars]  = useState({});
  const [loading,    setLoading]    = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [draft,      setDraft]      = useState({});
  const [saving,     setSaving]     = useState(false);
  const [copied,     setCopied]     = useState(false);
  // name editing
  const [editingName, setEditingName] = useState(false);
  const [nameDraft,   setNameDraft]   = useState(char.name);
  // alias add
  const [newAlias,    setNewAlias]    = useState("");
  // sprite add form
  const [spriteUrl,     setSpriteUrl]     = useState("");
  const [spriteLabel,   setSpriteLabel]   = useState("default");
  const [spriteDefault, setSpriteDefault] = useState(false);

  useEffect(() => {
    setTab("Core"); setErotic(undefined); setCombat(undefined);
    setSprites(null); setRels(null); setRelsChars({});
    setEditing(false); setLoading(true);
    setEditingName(false); setNameDraft(char.name); setNewAlias("");
    Promise.all([
      supabase.from("character_erotic").select("*").eq("character_id", char.id).single(),
      supabase.from("character_combat").select("*").eq("character_id", char.id).single(),
    ]).then(([{ data: e }, { data: c }]) => { setErotic(e || null); setCombat(c || null); setLoading(false); });
  }, [char.id]);

  useEffect(() => {
    if (tab === "Sprites" && sprites === null) loadSprites();
    if (tab === "Relationships" && rels === null) loadRels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadSprites = async () => {
    const { data } = await supabase.from("character_sprites").select("*").eq("character_id", char.id).order("is_default", { ascending: false });
    setSprites(data || []);
  };

  const loadRels = async () => {
    const { data: rows } = await supabase
      .from("relationships")
      .select("*")
      .or(`character_a_id.eq.${char.id},character_b_id.eq.${char.id}`)
      .order("intimacy_level", { ascending: false, nullsFirst: false });
    setRels(rows || []);
    const otherIds = [...new Set((rows || []).map(r => r.character_a_id === char.id ? r.character_b_id : r.character_a_id))];
    if (otherIds.length) {
      const { data: chars } = await supabase.from("characters").select("id, name").in("id", otherIds);
      const map = {};
      for (const c of chars || []) map[c.id] = c.name;
      setRelsChars(map);
    }
  };

  const dataForTab   = () => tab === "Core" ? char   : tab === "Erotic" ? erotic  : combat;
  const fieldsForTab = () => tab === "Core" ? CORE_FIELDS : tab === "Erotic" ? EROTIC_FIELDS : COMBAT_FIELDS;

  const startEdit = () => {
    const src = dataForTab() || {}, init = {};
    fieldsForTab().forEach(f => { init[f.key] = src[f.key] ?? ""; });
    setDraft(init); setEditing(true);
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
        await supabase.from("character_erotic").upsert({ ...payload, character_id: char.id }, { onConflict:"character_id" });
        setErotic(prev => ({ ...(prev||{}), ...payload, character_id: char.id }));
      } else {
        await supabase.from("character_combat").upsert({ ...payload, character_id: char.id }, { onConflict:"character_id" });
        setCombat(prev => ({ ...(prev||{}), ...payload, character_id: char.id }));
      }
    } finally { setSaving(false); setEditing(false); setDraft({}); }
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
    navigator.clipboard.writeText(lines.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // ── header field saves ──
  const saveName = async () => {
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (!trimmed || trimmed === char.name) { setNameDraft(char.name); return; }
    await supabase.from("characters").update({ name: trimmed }).eq("id", char.id);
    onCharUpdate({ ...char, name: trimmed });
  };

  const saveCharType = async (val) => {
    await supabase.from("characters").update({ char_type: val }).eq("id", char.id);
    onCharUpdate({ ...char, char_type: val });
  };

  const addAlias = async () => {
    const trimmed = newAlias.trim();
    if (!trimmed) return;
    const updated = [...(char.aliases || []), trimmed];
    await supabase.from("characters").update({ aliases: updated }).eq("id", char.id);
    onCharUpdate({ ...char, aliases: updated });
    setNewAlias("");
  };

  const removeAlias = async (idx) => {
    const updated = (char.aliases || []).filter((_, i) => i !== idx);
    await supabase.from("characters").update({ aliases: updated }).eq("id", char.id);
    onCharUpdate({ ...char, aliases: updated });
  };

  // ── sprite saves ──
  const addSprite = async () => {
    if (!spriteUrl.trim()) return;
    const isDefault = spriteDefault || (sprites || []).length === 0;
    if (isDefault) {
      await supabase.from("character_sprites").update({ is_default: false }).eq("character_id", char.id);
    }
    await supabase.from("character_sprites").insert({
      character_id: char.id,
      portrait_url: spriteUrl.trim(),
      label: spriteLabel.trim() || "default",
      is_default: isDefault,
    });
    if (isDefault) {
      await supabase.from("characters").update({ portrait_url: spriteUrl.trim() }).eq("id", char.id);
      onCharUpdate({ ...char, portrait_url: spriteUrl.trim() });
    }
    setSpriteUrl(""); setSpriteLabel("default"); setSpriteDefault(false);
    loadSprites();
  };

  const setDefaultSprite = async (sprite) => {
    await supabase.from("character_sprites").update({ is_default: false }).eq("character_id", char.id);
    await supabase.from("character_sprites").update({ is_default: true }).eq("id", sprite.id);
    await supabase.from("characters").update({ portrait_url: sprite.portrait_url }).eq("id", char.id);
    onCharUpdate({ ...char, portrait_url: sprite.portrait_url });
    loadSprites();
  };

  const deleteSprite = async (sprite) => {
    await supabase.from("character_sprites").delete().eq("id", sprite.id);
    if (sprite.is_default) {
      await supabase.from("characters").update({ portrait_url: null }).eq("id", char.id);
      onCharUpdate({ ...char, portrait_url: null });
    }
    loadSprites();
  };

  const color       = char.link_color || "#7a6e62";
  const meta        = [char.character_group, char.role, char.species].filter(Boolean).join(" · ");
  const charType    = char.char_type || "supporting";
  const aliasesList = char.aliases || [];
  const isTextTab   = ["Erotic", "Combat"].includes(tab);

  return (
    <div style={{ display:"flex", gap:28, alignItems:"flex-start" }}>
      <div style={{ width:320, flexShrink:0, position:"sticky", top:0 }}>
        {char.portrait_url
          ? <img src={char.portrait_url} alt={char.name} style={{ width:"100%", height:"auto", objectFit:"cover", borderRadius:8, border:`3px solid ${color}`, display:"block" }} />
          : <div style={{ width:"100%", aspectRatio:"1", borderRadius:8, background:color+"22", border:`3px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:80, color, fontFamily:"sans-serif", fontWeight:"bold" }}>{char.name[0]}</div>
        }
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        {/* name + char_type + actions */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:4 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, minWidth:0 }}>
            {editingName
              ? <input
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditingName(false); setNameDraft(char.name); } }}
                  autoFocus
                  style={{ fontSize:28, color:"var(--gold)", fontWeight:"normal", background:"transparent", border:"none", borderBottom:"1px solid var(--gold2)", outline:"none", fontFamily:"Georgia, serif", minWidth:0, flex:1 }}
                />
              : <div style={{ ...S.name, cursor:"text", flex:1 }} onClick={() => { setEditingName(true); setNameDraft(char.name); }}>{char.name}</div>
            }
            <select
              value={charType}
              onChange={e => saveCharType(e.target.value)}
              style={{ fontSize:10, fontFamily:"sans-serif", background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text4)", padding:"2px 6px", cursor:"pointer", flexShrink:0, letterSpacing:"0.06em", textTransform:"uppercase" }}
            >
              <option value="main">main</option>
              <option value="supporting">supporting</option>
              <option value="background">background</option>
            </select>
          </div>
          {!loading && isTextTab && (
            <div style={{ display:"flex", gap:6, flexShrink:0, paddingTop:6 }}>
              <button onClick={copyForNovelCrafter} style={taBtn}>{copied ? "Copied!" : "Copy"}</button>
              {editing
                ? <><button onClick={saveEdit} disabled={saving} style={{ ...taBtn, color:"var(--gold)", borderColor:"var(--gold2)" }}>{saving ? "Saving…" : "Save"}</button>
                     <button onClick={cancelEdit} disabled={saving} style={taBtn}>Cancel</button></>
                : <button onClick={startEdit} style={taBtn}>Edit</button>
              }
            </div>
          )}
        </div>
        {meta && <div style={S.meta}>{meta}</div>}

        {/* aliases */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12, alignItems:"center" }}>
          {aliasesList.map((alias, i) => (
            <span key={i} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontFamily:"sans-serif", padding:"2px 8px", borderRadius:10, background:"var(--bg4)", border:"1px solid var(--border2)", color:"var(--text3)" }}>
              {alias}
              <button onClick={() => removeAlias(i)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text4)", fontSize:10, padding:"0 0 0 2px", lineHeight:1 }}>✕</button>
            </span>
          ))}
          <form onSubmit={e => { e.preventDefault(); addAlias(); }} style={{ display:"flex" }}>
            <input
              value={newAlias}
              onChange={e => setNewAlias(e.target.value)}
              placeholder="+ alias"
              style={{ fontSize:11, fontFamily:"sans-serif", background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:10, color:"var(--text3)", padding:"2px 8px", outline:"none", width:72 }}
            />
          </form>
        </div>

        {/* tabs */}
        <div style={{ display:"flex", gap:0, borderBottom:"1px solid var(--border)", marginBottom:24 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => { if (!editing) setTab(t); }} style={{
              background:"none", border:"none", cursor: editing ? "default" : "pointer",
              padding:"8px 16px 7px", fontSize:10, fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase",
              color: t === tab ? "var(--gold)" : "var(--text4)",
              borderBottom: t === tab ? "2px solid var(--gold)" : "2px solid transparent",
              marginBottom:-1, opacity: editing && t !== tab ? 0.4 : 1,
            }}>{t}</button>
          ))}
        </div>

        {/* core tab */}
        {tab === "Core" && <CoreTab char={char} onCharUpdate={onCharUpdate} />}

        {/* erotic / combat tabs */}
        {isTextTab && (
          loading
            ? <div style={S.msg}>Loading…</div>
            : <FieldList data={dataForTab()} fields={fieldsForTab()} editing={editing} draft={draft}
                onDraftChange={(k, v) => setDraft(p => ({ ...p, [k]: v }))} />
        )}

        {/* sprites tab */}
        {tab === "Sprites" && (
          <div>
            <div style={{ background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:6, padding:"12px 14px", marginBottom:16 }}>
              <div style={{ fontSize:10, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Add Sprite</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <input
                  value={spriteUrl}
                  onChange={e => setSpriteUrl(e.target.value)}
                  placeholder="Portrait URL"
                  style={{ background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text)", fontSize:12, fontFamily:"sans-serif", padding:"6px 10px", outline:"none" }}
                />
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <input
                    value={spriteLabel}
                    onChange={e => setSpriteLabel(e.target.value)}
                    placeholder="Label (default, combat…)"
                    style={{ flex:1, minWidth:120, background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text)", fontSize:12, fontFamily:"sans-serif", padding:"6px 10px", outline:"none" }}
                  />
                  <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontFamily:"sans-serif", color:"var(--text3)", cursor:"pointer", flexShrink:0 }}>
                    <input type="checkbox" checked={spriteDefault} onChange={e => setSpriteDefault(e.target.checked)} />
                    Set as default
                  </label>
                  <button onClick={addSprite} style={{ ...taBtn, color:"var(--gold)", borderColor:"var(--gold2)", flexShrink:0 }}>Add</button>
                </div>
              </div>
            </div>
            {sprites === null
              ? <div style={S.msg}>Loading…</div>
              : sprites.length === 0
              ? <div style={S.msg}>No sprites yet.</div>
              : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {sprites.map(sp => (
                    <div key={sp.id} style={{ display:"flex", alignItems:"center", gap:12, background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:6, padding:"10px 12px" }}>
                      <img src={sp.portrait_url} alt={sp.label} style={{ width:56, height:56, objectFit:"cover", borderRadius:4, border:`2px solid ${sp.is_default ? "var(--gold)" : "var(--border2)"}`, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontFamily:"sans-serif", color:"var(--text)", marginBottom:4 }}>{sp.label || "—"}</div>
                        {sp.is_default && (
                          <span style={{ fontSize:9, fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", background:"#2a2010", border:"1px solid var(--gold2)", borderRadius:3, color:"var(--gold)", padding:"1px 6px" }}>default</span>
                        )}
                      </div>
                      <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                        {!sp.is_default && (
                          <button onClick={() => setDefaultSprite(sp)} style={taBtn}>Set Default</button>
                        )}
                        <button onClick={() => deleteSprite(sp)} style={{ ...taBtn, color:"#c07060", borderColor:"#3a2020" }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* relationships tab */}
        {tab === "Relationships" && (
          <div>
            {rels === null
              ? <div style={S.msg}>Loading…</div>
              : rels.length === 0
              ? <div style={S.msg}>No relationships on record.</div>
              : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {rels.map(r => {
                    const otherId   = r.character_a_id === char.id ? r.character_b_id : r.character_a_id;
                    const otherName = relsChars[otherId] || (otherId ? otherId.slice(0, 8) + "…" : "?");
                    return (
                      <div key={r.id} style={{ background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:6, padding:"12px 14px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                          <span style={{ fontSize:13, fontFamily:"sans-serif", fontWeight:600, color:"var(--text)" }}>{otherName}</span>
                          {r.status && (
                            <span style={{ fontSize:10, fontFamily:"sans-serif", padding:"2px 8px", borderRadius:10, background:"var(--bg4)", border:"1px solid var(--border2)", color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em" }}>{r.status}</span>
                          )}
                        </div>
                        <div style={{ display:"flex", gap:20, marginBottom: r.dynamic_notes ? 8 : 0 }}>
                          {r.intimacy_level != null && (
                            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                              <span style={{ fontSize:9, fontFamily:"sans-serif", color:"var(--text4)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Intimacy</span>
                              <span style={{ fontSize:16, fontFamily:"sans-serif", color:"#c084fc", fontWeight:"bold" }}>{r.intimacy_level}</span>
                            </div>
                          )}
                          {r.tension_level != null && (
                            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                              <span style={{ fontSize:9, fontFamily:"sans-serif", color:"var(--text4)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Tension</span>
                              <span style={{ fontSize:16, fontFamily:"sans-serif", color:"#f97316", fontWeight:"bold" }}>{r.tension_level}</span>
                            </div>
                          )}
                          {r.trust_level != null && (
                            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                              <span style={{ fontSize:9, fontFamily:"sans-serif", color:"var(--text4)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Trust</span>
                              <span style={{ fontSize:16, fontFamily:"sans-serif", color:"#60c8a0", fontWeight:"bold" }}>{r.trust_level}</span>
                            </div>
                          )}
                        </div>
                        {r.dynamic_notes && (
                          <div style={{ fontSize:12, color:"var(--text3)", fontFamily:"sans-serif", lineHeight:1.55, fontStyle:"italic" }}>{r.dynamic_notes}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ── LocationDetail ───────────────────────────────────────────────────────────
function LocationDetail({ place, characters }) {
  const [occupants,        setOccupants]        = useState([]);
  const [addOpen,          setAddOpen]          = useState(false);
  const [pendingChar,      setPendingChar]      = useState(null);
  const [pendingRole,      setPendingRole]      = useState("regular");
  const [containers,       setContainers]       = useState([]);
  const [openContainers,   setOpenContainers]   = useState({});

  const fetchOccupants = useCallback(async () => {
    const { data } = await supabase
      .from("location_characters")
      .select("id, role, presence_chance, character_id, characters(id, name, portrait_url, link_color)")
      .eq("location_id", place.id);
    setOccupants(data || []);
  }, [place.id]);

  const fetchContainers = useCallback(async () => {
    const { data: ctrs } = await supabase
      .from("containers")
      .select("id, name, character_id, characters(name)")
      .eq("place_id", place.id);
    if (!ctrs?.length) { setContainers([]); return; }
    const withItems = await Promise.all(ctrs.map(async ctr => {
      const { data: items } = await supabase
        .from("items")
        .select("id, name, description, is_significant, is_worn")
        .eq("container_id", ctr.id)
        .order("name");
      return { ...ctr, items: items || [] };
    }));
    setContainers(withItems);
  }, [place.id]);

  useEffect(() => {
    setOccupants([]); setPendingChar(null); setAddOpen(false); fetchOccupants();
    setContainers([]); setOpenContainers({}); fetchContainers();
  }, [fetchOccupants, fetchContainers]);

  const toggleItem = async (itemId, currentValue) => {
    const newVal = !currentValue;
    await supabase.from("items").update({ is_worn: newVal }).eq("id", itemId);
    setContainers(prev => prev.map(ctr => ({
      ...ctr,
      items: ctr.items.map(it => it.id === itemId ? { ...it, is_worn: newVal } : it),
    })));
  };

  const confirmAdd = async () => {
    if (!pendingChar) return;
    await supabase.from("location_characters").insert({
      location_id: place.id, character_id: pendingChar.id,
      role: pendingRole, presence_chance: PRESENCE[pendingRole] ?? 100,
    });
    setPendingChar(null); setAddOpen(false); fetchOccupants();
  };
  const removeOccupant = async (lcId) => {
    await supabase.from("location_characters").delete().eq("id", lcId);
    setOccupants(prev => prev.filter(o => o.id !== lcId));
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:6 }}>
        <div style={S.detName}>{place.name}</div>
        {place.place_type && <span style={S.locType}>{place.place_type}</span>}
      </div>
      {place.atmosphere  && <div style={S.detAtm}>{place.atmosphere}</div>}
      {place.description && <div style={S.detDesc}>{place.description}</div>}

      <div style={{ marginTop:8 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={S.secLbl}>Occupants</div>
            <div style={{ position:"relative" }}>
              <button onClick={() => { setAddOpen(p => !p); setPendingChar(null); }} style={{ ...taBtn, fontSize:10 }}>
                {addOpen ? "✕ Cancel" : "+ Add Occupant"}
              </button>
              {addOpen && !pendingChar && (
                <div style={{ position:"absolute", right:0, top:"100%", marginTop:4, zIndex:10, background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:6, minWidth:190, maxHeight:260, overflowY:"auto", boxShadow:"0 4px 16px #00000088" }}>
                  {characters.map(c => {
                    const color = c.link_color || "#7a6e62";
                    return (
                      <div key={c.id} onClick={() => { setPendingChar(c); setPendingRole("regular"); }}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px", cursor:"pointer", fontFamily:"sans-serif", fontSize:12 }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--bg4)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        {c.portrait_url
                          ? <img src={c.portrait_url} alt={c.name} style={{ width:22, height:22, borderRadius:"50%", objectFit:"cover", border:`1.5px solid ${color}`, flexShrink:0 }} />
                          : <div style={{ width:22, height:22, borderRadius:"50%", background:color+"22", border:`1.5px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color, fontFamily:"sans-serif", fontWeight:"bold", flexShrink:0 }}>{c.name[0]}</div>
                        }
                        <span style={{ color }}>{c.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {pendingChar && (
            <div style={{ ...S.rolePick, marginBottom:10 }}>
              <span style={{ fontSize:12, color:"var(--text3)", fontFamily:"sans-serif" }}>{pendingChar.name} —</span>
              {ROLES.map(r => (
                <button key={r} onClick={() => setPendingRole(r)} style={{ ...S.roleBtn, borderColor: pendingRole===r ? "var(--gold2)" : "var(--border2)", color: pendingRole===r ? "var(--gold)" : "var(--text3)" }}>{r}</button>
              ))}
              <button onClick={confirmAdd} style={{ ...S.roleBtn, color:"var(--gold)", borderColor:"var(--gold2)" }}>Add</button>
              <button onClick={() => { setPendingChar(null); setAddOpen(false); }} style={S.roleBtn}>✕</button>
            </div>
          )}
          <div style={S.occZone}>
            {occupants.length === 0 && (
              <div style={{ color:"var(--text4)", fontStyle:"italic", fontSize:12, fontFamily:"sans-serif" }}>No occupants yet.</div>
            )}
            {occupants.map(o => {
              const c = o.characters; if (!c) return null;
              const color = c.link_color || "#7a6e62";
              return (
                <div key={o.id} style={S.occChip}>
                  {c.portrait_url
                    ? <img src={c.portrait_url} alt={c.name} style={{ width:22, height:22, borderRadius:"50%", objectFit:"cover", border:`1.5px solid ${color}` }} />
                    : <div style={{ width:22, height:22, borderRadius:"50%", background:color+"22", border:`1.5px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color, fontFamily:"sans-serif", fontWeight:"bold" }}>{c.name[0]}</div>
                  }
                  <div>
                    <div style={{ color, fontSize:12, fontFamily:"sans-serif" }}>{c.name}</div>
                    <div style={S.occRole}>{o.role}{(o.role==="regular"||o.role==="visitor")&&o.presence_chance!=null?` · ${o.presence_chance}%`:""}</div>
                  </div>
                  <button style={S.occX} onClick={() => removeOccupant(o.id)}>✕</button>
                </div>
              );
            })}
          </div>
        </div>

      {containers.length > 0 && (
        <div style={{ marginTop:24 }}>
          <div style={S.secLbl}>Containers</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {containers.map(ctr => {
              const isOpen = !!openContainers[ctr.id];
              const ownerName = ctr.characters?.name;
              return (
                <div key={ctr.id} style={{ background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:6, overflow:"hidden" }}>
                  <div
                    onClick={() => setOpenContainers(prev => ({ ...prev, [ctr.id]: !prev[ctr.id] }))}
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", cursor:"pointer", userSelect:"none" }}>
                    <div>
                      <span style={{ fontSize:13, fontFamily:"sans-serif", color:"var(--text)" }}>{ctr.name}</span>
                      {ownerName && <span style={{ fontSize:11, color:"var(--text4)", fontFamily:"sans-serif", marginLeft:8 }}>· {ownerName}</span>}
                    </div>
                    <span style={{ fontSize:10, color:"var(--text4)", fontFamily:"sans-serif" }}>{isOpen ? "▾" : "▸"}</span>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop:"1px solid var(--border)", padding:"8px 12px", display:"flex", flexDirection:"column", gap:6 }}>
                      {ctr.items.length === 0
                        ? <div style={{ fontSize:12, color:"var(--text4)", fontStyle:"italic", fontFamily:"sans-serif" }}>No items.</div>
                        : ctr.items.map(it => (
                            <div key={it.id} style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:13, fontFamily:"sans-serif", color:"var(--text)", fontWeight: it.is_significant ? "bold" : "normal" }}>{it.name}</div>
                                {it.description && <div style={{ fontSize:12, color:"var(--text3)", fontStyle:"italic", fontFamily:"sans-serif", lineHeight:1.5, marginTop:2 }}>{it.description}</div>}
                              </div>
                              <button
                                onClick={() => toggleItem(it.id, it.is_worn)}
                                style={{ flexShrink:0, fontSize:10, fontFamily:"sans-serif", padding:"2px 8px", borderRadius:10, cursor:"pointer", border: it.is_worn ? "1px solid var(--gold)" : "1px solid var(--border2)", background: it.is_worn ? "var(--gold2)" : "var(--bg3)", color: it.is_worn ? "#1a1410" : "var(--text4)" }}>
                                Worn
                              </button>
                            </div>
                          ))
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PlacesSidebar ────────────────────────────────────────────────────────────
function TreeNode({ item, depth, places, collapsed, toggleCollapsed, selectedPlace, setSelectedPlace }) {
  const children = places
    .filter(p => (p.parent_id ?? null) === item.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const hasKids = children.length > 0;
  const isOpen = !collapsed.has(item.id);
  const isSelected = selectedPlace?.id === item.id;

  return (
    <div>
      <div
        onClick={() => { if (hasKids) toggleCollapsed(item.id); setSelectedPlace(item); }}
        onMouseEnter={e => e.currentTarget.style.background = isSelected ? "var(--bg4)" : "var(--bg3)"}
        onMouseLeave={e => e.currentTarget.style.background = isSelected ? "var(--bg4)" : "transparent"}
        style={{
          paddingLeft: depth * 12,
          paddingTop: 5,
          paddingBottom: 5,
          paddingRight: 8,
          background: isSelected ? "var(--bg4)" : "transparent",
          color: isSelected ? "var(--gold)" : "var(--text)",
          cursor: "pointer",
          fontSize: 12,
          fontFamily: "sans-serif",
          userSelect: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: "left",
        }}>
        {hasKids ? (isOpen ? "▾ " : "▸ ") : "   "}{item.name}
      </div>
      {hasKids && isOpen && children.map(child => (
        <TreeNode
          key={child.id}
          item={child}
          depth={depth + 1}
          places={places}
          collapsed={collapsed}
          toggleCollapsed={toggleCollapsed}
          selectedPlace={selectedPlace}
          setSelectedPlace={setSelectedPlace}
        />
      ))}
    </div>
  );
}

function PlacesSidebar({ places, collapsed, toggleCollapsed, selectedPlace, setSelectedPlace }) {
  const roots = places
    .filter(p => (p.parent_id ?? null) === null)
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div style={{ flex:1, overflowY:"auto" }}>
      {roots.map(p => (
        <TreeNode key={p.id} item={p} depth={0}
          places={places} collapsed={collapsed} toggleCollapsed={toggleCollapsed}
          selectedPlace={selectedPlace} setSelectedPlace={setSelectedPlace} />
      ))}
    </div>
  );
}

// ── Lore helpers ─────────────────────────────────────────────────────────────
const formatCategory = s => (s || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const loreBadge = { fontSize:10, fontFamily:"sans-serif", letterSpacing:"0.06em", background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:3, padding:"2px 6px", color:"var(--text4)", flexShrink:0 };

function LorePanel({ entries, onSelect }) {
  if (!entries.length) return <div style={S.msg}>No lore entries found.</div>;
  const groups = {};
  for (const e of entries) {
    const cat = e.category || "uncategorized";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(e);
  }
  const cats = Object.keys(groups).sort();
  for (const cat of cats) groups[cat].sort((a, b) => a.title.localeCompare(b.title));
  return (
    <div>
      {cats.map(cat => (
        <div key={cat} style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, color:"var(--gold2)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", borderBottom:"1px solid var(--border)", paddingBottom:6, marginBottom:8 }}>
            {formatCategory(cat)}
          </div>
          {groups[cat].map(entry => (
            <div key={entry.id} onClick={() => onSelect(entry)}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px", cursor:"pointer", borderRadius:4, transition:"background 0.1s" }}>
              <span style={{ fontFamily:"Georgia, serif", fontSize:14, color:"var(--text)", flex:1 }}>{entry.title}</span>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", justifyContent:"flex-end" }}>
                {(entry.tags || []).map(tag => <span key={tag} style={loreBadge}>{tag}</span>)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function LoreModal({ entry, onClose, onUpdate, onDelete }) {
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [confirm,  setConfirm]  = useState(false);
  const [draft,    setDraft]    = useState({});

  const startEdit = () => {
    setDraft({ title: entry.title || "", category: entry.category || "", tags: (entry.tags || []).join(", "), body_text: entry.body_text || "" });
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setDraft({}); };

  const save = async () => {
    setSaving(true);
    const tags = draft.tags.split(",").map(t => t.trim()).filter(Boolean);
    const payload = { title: draft.title || null, category: draft.category || null, tags, body_text: draft.body_text || null };
    await supabase.from("lore_entries").update(payload).eq("id", entry.id);
    onUpdate({ ...entry, ...payload });
    setSaving(false);
    setEditing(false);
  };

  const del = async () => {
    await supabase.from("lore_entries").delete().eq("id", entry.id);
    onDelete(entry.id);
    onClose();
  };

  const inp = { width:"100%", background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text)", fontSize:14, fontFamily:"Georgia, serif", padding:"7px 10px", outline:"none" };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:8, padding:"28px 32px", maxWidth:660, width:"90%", maxHeight:"82vh", overflowY:"auto", position:"relative" }}>
        {/* close */}
        <button onClick={onClose} style={{ position:"absolute", top:12, right:14, background:"none", border:"none", color:"var(--text4)", fontSize:18, cursor:"pointer", lineHeight:1 }}>✕</button>

        {!editing ? (
          <>
            <div style={{ fontSize:24, color:"var(--gold)", fontWeight:"normal", marginBottom:6, paddingRight:24 }}>{entry.title}</div>
            <div style={{ fontSize:10, color:"var(--gold2)", fontFamily:"sans-serif", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>{formatCategory(entry.category)}</div>
            {(entry.tags || []).length > 0 && (
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:16 }}>
                {entry.tags.map(tag => <span key={tag} style={loreBadge}>{tag}</span>)}
              </div>
            )}
            <div style={{ fontSize:15, lineHeight:1.8, color:"var(--text)", whiteSpace:"pre-wrap" }}>{entry.body_text}</div>
            <div style={{ display:"flex", gap:8, marginTop:20 }}>
              <button onClick={startEdit} style={{ ...taBtn }}>Edit</button>
              {!confirm
                ? <button onClick={() => setConfirm(true)} style={{ ...taBtn, color:"#c07060", borderColor:"#3a2020" }}>Delete</button>
                : <>
                    <span style={{ fontSize:12, fontFamily:"sans-serif", color:"var(--text4)", alignSelf:"center" }}>Delete this entry?</span>
                    <button onClick={del} style={{ ...taBtn, color:"#c07060", borderColor:"#3a2020" }}>Yes, delete</button>
                    <button onClick={() => setConfirm(false)} style={{ ...taBtn }}>Cancel</button>
                  </>
              }
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom:14 }}>
              <div style={S.secLbl}>Title</div>
              <input value={draft.title} onChange={e => setDraft(p => ({...p, title: e.target.value}))} style={inp} />
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={S.secLbl}>Category</div>
              <input value={draft.category} onChange={e => setDraft(p => ({...p, category: e.target.value}))} style={inp} placeholder="e.g. found_object" />
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={S.secLbl}>Tags (comma-separated)</div>
              <input value={draft.tags} onChange={e => setDraft(p => ({...p, tags: e.target.value}))} style={inp} />
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={S.secLbl}>Body</div>
              <textarea value={draft.body_text} onChange={e => setDraft(p => ({...p, body_text: e.target.value}))} rows={8}
                style={{ ...inp, resize:"vertical", lineHeight:1.7 }} />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={save} disabled={saving} style={{ ...taBtn, color:"var(--gold)", borderColor:"var(--gold2)" }}>{saving ? "Saving…" : "Save"}</button>
              <button onClick={cancelEdit} disabled={saving} style={{ ...taBtn }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Codex ────────────────────────────────────────────────────────────────────
export default function Codex() {
  const [section,      setSection]      = useState("characters");
  const [charSidebarW, setCharSidebarW] = useState(() => {
    const saved = localStorage.getItem("codex_sidebar_width_characters");
    return saved ? parseInt(saved, 10) : 280;
  });
  const [placesSidebarW, setPlacesSidebarW] = useState(() => {
    const saved = localStorage.getItem("codex_sidebar_width_places");
    return saved ? parseInt(saved, 10) : 280;
  });
  const resizing      = useRef(false);
  const resizeStartX  = useRef(0);
  const resizeStartW  = useRef(0);
  const currentW      = useRef(280);
  const sectionRef    = useRef("characters");

  const sidebarWidth    = section === "characters" ? charSidebarW : placesSidebarW;
  const setSidebarWidth = section === "characters" ? setCharSidebarW : setPlacesSidebarW;

  const onResizeMouseDown = (e) => {
    e.preventDefault();
    resizing.current     = true;
    resizeStartX.current = e.clientX;
    resizeStartW.current = sidebarWidth;
    currentW.current     = sidebarWidth;
    sectionRef.current   = section;
    const onMove = (ev) => {
      if (!resizing.current) return;
      const w = Math.max(200, Math.min(500, resizeStartW.current + ev.clientX - resizeStartX.current));
      currentW.current = w;
      if (sectionRef.current === "characters") setCharSidebarW(w);
      else setPlacesSidebarW(w);
    };
    const onUp = () => {
      resizing.current = false;
      const key = sectionRef.current === "characters"
        ? "codex_sidebar_width_characters"
        : "codex_sidebar_width_places";
      localStorage.setItem(key, String(currentW.current));
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  };

  // characters
  const [characters,   setCharacters]   = useState([]);
  const [allGroups,    setAllGroups]    = useState([]);
  const [groupOrder,   setGroupOrder]   = useState([]);
  const [collapsed,    setCollapsed]    = useState(() => {
    const saved = localStorage.getItem("codex_collapsed_groups");
    return saved ? new Set(JSON.parse(saved)) : null;
  });
  const [selected,     setSelected]     = useState(null);
  // lore
  const [loreEntries,  setLoreEntries]  = useState(null);
  const [loreLoading,  setLoreLoading]  = useState(false);
  const [loreModal,    setLoreModal]    = useState(null);
  // places
  const [places,       setPlaces]       = useState([]);
  const [placesCollapsed, setPlacesCollapsed] = useState(() => {
    const saved = localStorage.getItem("codex_collapsed_places");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [selectedPlace, setSelectedPlace] = useState(null);
  // shared
  const [storyTitle,   setStoryTitle]   = useState("");
  const [phase,        setPhase]        = useState("loading");
  const [err,          setErr]          = useState("");
  const [dragOverGrp,  setDragOverGrp]  = useState(null);

  const draggingCharId  = useRef(null);
  const draggingGrpName = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [
          { data: chars,   error: e1 },
          { data: grps,    error: e2 },
          { data: story },
          { data: plcs,    error: e3 },
        ] = await Promise.all([
          supabase.from("characters").select("id, name, role, species, age, occupation, portrait_url, link_color, physical_appearance, personality, backstory_summary, voice_notes, gender, pronouns, height_feet, height_inches, height_cm, height_scale, group_id, character_group, char_type, aliases").eq("world_id", WORLD_ID).order("name"),
          supabase.from("character_groups").select("id, name, link_color, sort_order").order("sort_order"),
          supabase.from("stories").select("title").eq("id", STORY_ID).single(),
          supabase.from("places").select("id, name, place_type, parent_id, description, atmosphere").eq("world_id", WORLD_ID).order("name"),
        ]);
        for (const e of [e1, e2, e3]) if (e) throw e;
        if (story?.title) setStoryTitle(story.title);
        const charList = chars || [];
        const grpList  = grps  || [];
        setCharacters(charList);
        setAllGroups(grpList);
        const grpNames   = grpList.map(g => g.name);
        const extraNames = [...new Set(charList.map(c => c.character_group || "Ungrouped"))].filter(n => !grpNames.includes(n));
        const allNames   = [...grpNames, ...extraNames];
        setGroupOrder(allNames);
        setCollapsed(prev => prev !== null ? prev : new Set(allNames));
        if (charList.length) setSelected(charList[0]);
        setPlaces(plcs || []);
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

  // ── character collapsed ──
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

  // ── places collapsed ──
  const togglePlacesCollapsed = useCallback((id) => {
    setPlacesCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  useEffect(() => {
    localStorage.setItem("codex_collapsed_places", JSON.stringify([...placesCollapsed]));
  }, [placesCollapsed]);

  // ── lore lazy load ──
  useEffect(() => {
    if (section !== "lore" || loreEntries !== null || loreLoading) return;
    setLoreLoading(true);
    supabase.from("lore_entries").select("id, title, category, body_text, tags")
      .eq("world_id", WORLD_ID)
      .then(({ data }) => { setLoreEntries(data || []); setLoreLoading(false); });
  }, [section, loreEntries, loreLoading]);

  // ── character drag/drop for group reassign ──
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
    e.preventDefault(); setDragOverGrp(null);
    if (draggingCharId.current) {
      const charId = draggingCharId.current; draggingCharId.current = null;
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
      const src = draggingGrpName.current; draggingGrpName.current = null;
      setGroupOrder(prev => {
        const next = [...prev];
        const srcIdx = next.indexOf(src), tgtIdx = next.indexOf(targetGrpName);
        if (srcIdx === -1 || tgtIdx === -1) return prev;
        next.splice(srcIdx, 1); next.splice(tgtIdx, 0, src);
        next.forEach((name, i) => {
          const grp = allGroups.find(g => g.name === name);
          if (grp) supabase.from("character_groups").update({ sort_order: i + 1 }).eq("id", grp.id);
        });
        return next;
      });
    }
  };
  const onDragEnd = () => { draggingCharId.current = null; draggingGrpName.current = null; setDragOverGrp(null); };

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
          <div style={{ ...S.sidebar, width: section === "lore" ? "auto" : sidebarWidth, minWidth: section === "lore" ? 0 : undefined }}>
            {/* section toggle */}
            <div style={S.secToggle}>
              {["characters","places","lore"].map(s => (
                <button key={s} onClick={() => setSection(s)} style={{
                  ...S.secBtn,
                  color:       section === s ? "var(--gold)"   : "var(--text4)",
                  background: "none", border:"none", borderBottom: section === s ? "2px solid var(--gold)" : "2px solid transparent",
                }}>{s}</button>
              ))}
            </div>

            {phase === "loading" && <div style={{...S.msg, padding:"24px 14px"}}>Loading…</div>}
            {phase === "error"   && <div style={{...S.err, margin:12}}>{err}</div>}

            {/* characters section */}
            {phase === "ready" && section === "characters" && (
              <div style={{ flex:1, overflowY:"auto" }}>
                {orderedGroups.map(grpName => {
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
                          <div key={c.id} draggable onDragStart={e => onCharDragStart(e, c.id)} onDragEnd={onDragEnd}
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
            )}

            {/* places section */}
            {phase === "ready" && section === "places" && (
              <PlacesSidebar
                places={places}
                collapsed={placesCollapsed}
                toggleCollapsed={togglePlacesCollapsed}
                selectedPlace={selectedPlace}
                setSelectedPlace={setSelectedPlace}
              />
            )}
          </div>

          {/* resize handle — hidden for lore */}
          {section !== "lore" && (
            <div onMouseDown={onResizeMouseDown}
              style={{ width:4, flexShrink:0, cursor:"col-resize", background:"transparent" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--border2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"} />
          )}

          {/* detail panel */}
          <div style={{ ...S.panel, paddingLeft: section === "lore" ? 48 : 0 }}>
            {section === "characters" && (
              !selected
                ? <div style={S.msg}>Select a character.</div>
                : <DetailPanel key={selected.id} char={selected}
                    onCharUpdate={updated => { setSelected(updated); setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c)); }} />
            )}
            {section === "places" && (
              !selectedPlace
                ? <div style={S.msg}>Select a location.</div>
                : <LocationDetail key={selectedPlace.id} place={selectedPlace} characters={characters} />
            )}
            {section === "lore" && (
              loreLoading || loreEntries === null
                ? <div style={S.msg}>Loading…</div>
                : <LorePanel entries={loreEntries} onSelect={setLoreModal} />
            )}
          </div>
        </div>

        {/* lore modal */}
        {loreModal && (
          <LoreModal
            entry={loreModal}
            onClose={() => setLoreModal(null)}
            onUpdate={updated => {
              setLoreEntries(prev => (prev || []).map(e => e.id === updated.id ? updated : e));
              setLoreModal(updated);
            }}
            onDelete={id => {
              setLoreEntries(prev => (prev || []).filter(e => e.id !== id));
              setLoreModal(null);
            }}
          />
        )}
      </div>
    </>
  );
}
