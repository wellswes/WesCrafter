import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "./constants.js";

const EDGE_URL = "https://gjvegoinppbpfusttycs.supabase.co/functions/v1/update-codex";

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
  { key:"archetype",       label:"Archetype" },
  { key:"abilities",       label:"Abilities" },
  { key:"spells",          label:"Spells" },
  { key:"stats",           label:"Stats" },
  { key:"fighting_style",  label:"Fighting Style" },
  { key:"equipment_notes", label:"Equipment Notes" },
];

const SECTIONS = [
  { key:"core",   label:"Core",   fields:CORE_FIELDS },
  { key:"erotic", label:"Erotic", fields:EROTIC_FIELDS },
  { key:"combat", label:"Combat", fields:COMBAT_FIELDS },
];

function initAccepted(charUpdates) {
  const acc = {};
  charUpdates.forEach((cu, ci) => {
    acc[ci] = { core:{}, erotic:{}, combat:{} };
    for (const sec of SECTIONS) {
      const sd = cu[sec.key];
      if (!sd) continue;
      sec.fields.forEach(f => { if (sd[f.key] != null) acc[ci][sec.key][f.key] = true; });
    }
  });
  return acc;
}

function initDrafts(charUpdates) {
  const d = {};
  charUpdates.forEach((cu, ci) => {
    d[ci] = { core:{}, erotic:{}, combat:{} };
    for (const sec of SECTIONS) {
      const sd = cu[sec.key];
      if (!sd) continue;
      sec.fields.forEach(f => {
        const v = sd[f.key];
        if (v != null) d[ci][sec.key][f.key] = v?.proposed ?? (typeof v === "object" ? "" : String(v));
      });
    }
  });
  return d;
}

export default function UpdateCodexPanel({ chapterId, chapterTitle, onClose }) {
  const [status,     setStatus]     = useState("loading");
  const [data,       setData]       = useState(null);
  const [error,      setError]      = useState(null);
  const [accepted,   setAccepted]   = useState({});
  const [drafts,     setDrafts]     = useState({});
  const [committing, setCommitting] = useState(false);
  const [summary,    setSummary]    = useState(null);

  useEffect(() => {
    fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapter_id: chapterId }),
    })
      .then(r => r.json())
      .then(result => {
        if (result.error) throw new Error(result.error);
        setData(result);
        setAccepted(initAccepted(result.character_updates || []));
        setDrafts(initDrafts(result.character_updates || []));
        setStatus("review");
      })
      .catch(e => { setError(e.message); setStatus("error"); });
  }, [chapterId]);

  const updateDraft = (ci, section, key, val) => {
    setDrafts(p => ({ ...p, [ci]: { ...p[ci], [section]: { ...p[ci][section], [key]: val } } }));
  };

  const toggleField = (ci, section, key) => {
    setAccepted(p => ({
      ...p,
      [ci]: { ...p[ci], [section]: { ...p[ci][section], [key]: !p[ci][section][key] } },
    }));
  };

  const toggleChar = (ci) => {
    setAccepted(p => {
      const charAcc = p[ci] || {};
      const anyOn = SECTIONS.some(sec => Object.values(charAcc[sec.key] || {}).some(Boolean));
      const newVal = !anyOn;
      const updated = { core:{}, erotic:{}, combat:{} };
      for (const sec of SECTIONS) {
        Object.keys(charAcc[sec.key] || {}).forEach(k => { updated[sec.key][k] = newVal; });
      }
      return { ...p, [ci]: updated };
    });
  };

  const isCharOn = (ci) =>
    SECTIONS.some(sec => Object.values(accepted[ci]?.[sec.key] || {}).some(Boolean));

  const commit = async () => {
    if (!data) return;
    setCommitting(true);
    let charsWritten = 0, fieldsWritten = 0;
    try {
      for (let ci = 0; ci < (data.character_updates || []).length; ci++) {
        const cu  = data.character_updates[ci];
        const acc = accepted[ci] || {};
        let charFields = 0;

        const resolveValue = (v, draftVal) => {
          if (v == null) return null;
          const proposed = draftVal !== undefined ? draftVal : (v?.proposed ?? v);
          if (v?.mode === "append" && v?.current) return v.current + " " + proposed;
          return proposed;
        };
        const charDrafts = drafts[ci] || {};

        const corePayload = {};
        CORE_FIELDS.forEach(f => {
          const v = cu.core?.[f.key];
          if (acc.core?.[f.key] && v != null) corePayload[f.key] = resolveValue(v, charDrafts.core?.[f.key]);
        });
        if (Object.keys(corePayload).length) {
          await supabase.from("characters").update(corePayload).eq("id", cu.character_id);
          charFields += Object.keys(corePayload).length;
        }

        const eroticPayload = {};
        EROTIC_FIELDS.forEach(f => {
          const v = cu.erotic?.[f.key];
          if (acc.erotic?.[f.key] && v != null) eroticPayload[f.key] = resolveValue(v, charDrafts.erotic?.[f.key]);
        });
        if (Object.keys(eroticPayload).length) {
          await supabase.from("character_erotic").upsert({ ...eroticPayload, character_id: cu.character_id }, { onConflict:"character_id" });
          charFields += Object.keys(eroticPayload).length;
        }

        const combatPayload = {};
        COMBAT_FIELDS.forEach(f => {
          const v = cu.combat?.[f.key];
          if (acc.combat?.[f.key] && v != null) combatPayload[f.key] = resolveValue(v, charDrafts.combat?.[f.key]);
        });
        if (Object.keys(combatPayload).length) {
          await supabase.from("character_combat").upsert({ ...combatPayload, character_id: cu.character_id }, { onConflict:"character_id" });
          charFields += Object.keys(combatPayload).length;
        }

        if (charFields > 0) { charsWritten++; fieldsWritten += charFields; }
      }
      setSummary({ charsWritten, fieldsWritten });
      setStatus("committed");
    } catch (e) {
      alert("Commit failed: " + e.message);
    } finally {
      setCommitting(false);
    }
  };

  const totalAccepted = Object.values(accepted).reduce((sum, charAcc) => {
    for (const sec of SECTIONS) sum += Object.values(charAcc?.[sec.key] || {}).filter(Boolean).length;
    return sum;
  }, 0);

  return createPortal(
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.88)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:10, padding:"13px 24px", borderBottom:"1px solid var(--border)", background:"var(--bg2)" }}>
        <span style={{ fontSize:12, fontFamily:"sans-serif", color:"var(--gold)", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" }}>
          Update Codex
        </span>
        <span style={{ fontSize:12, color:"var(--border2)", fontFamily:"sans-serif" }}>—</span>
        <span style={{ fontSize:12, color:"var(--text3)", fontFamily:"sans-serif" }}>{chapterTitle}</span>
        <div style={{ flex:1 }} />
        <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--text4)", fontSize:22, cursor:"pointer", lineHeight:1, padding:"0 4px", fontFamily:"sans-serif" }}>×</button>
      </div>

      {/* Body */}
      <div style={{ flex:1, overflowY:"auto", padding:"24px" }}>

        {status === "loading" && (
          <div style={{ display:"flex", alignItems:"center", gap:12, color:"var(--text4)", fontFamily:"sans-serif", fontSize:13, fontStyle:"italic", padding:"60px 0", justifyContent:"center" }}>
            <span className="spin" /> Analyzing character development…
          </div>
        )}

        {status === "error" && (
          <div style={{ color:"#c07060", fontFamily:"sans-serif", fontSize:13, background:"#1a1210", border:"1px solid #3a2020", borderRadius:5, padding:"14px 18px", maxWidth:600, margin:"0 auto" }}>
            <strong>Analysis failed:</strong> {error}
          </div>
        )}

        {status === "committed" && summary && (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", color:"#6dbf8a", fontFamily:"sans-serif", marginBottom:8 }}>committed</div>
            <div style={{ fontSize:14, color:"var(--text3)", fontFamily:"sans-serif" }}>
              {summary.charsWritten} character{summary.charsWritten !== 1 ? "s" : ""} updated,{" "}
              {summary.fieldsWritten} field{summary.fieldsWritten !== 1 ? "s" : ""} written
            </div>
            <button onClick={onClose} style={{ marginTop:24, background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text3)", fontSize:12, fontFamily:"sans-serif", padding:"7px 24px", cursor:"pointer" }}>
              Done
            </button>
          </div>
        )}

        {status === "review" && data && (
          <div style={{ maxWidth:760, margin:"0 auto", display:"flex", flexDirection:"column", gap:20 }}>
            {(data.character_updates || []).length === 0
              ? <div style={{ color:"var(--text4)", fontStyle:"italic", fontSize:13, fontFamily:"sans-serif", textAlign:"center", padding:"48px 0" }}>
                  No character updates proposed.
                </div>
              : (data.character_updates || []).map((cu, ci) => {
                  const charOn = isCharOn(ci);
                  return (
                    <div key={ci} style={{ background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:6, overflow:"hidden", opacity: charOn ? 1 : 0.4, transition:"opacity 0.15s" }}>

                      {/* char header */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 14px", borderBottom:"1px solid var(--border)", background:"var(--bg3)" }}>
                        <span style={{ fontSize:14, fontFamily:"sans-serif", fontWeight:600, color:"var(--gold)", letterSpacing:"0.03em" }}>{cu.character_name}</span>
                        <button
                          onClick={() => toggleChar(ci)}
                          style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text4)", fontSize:11, fontFamily:"sans-serif", padding:"2px 0" }}
                        >
                          {charOn ? "Dismiss all" : "Restore all"}
                        </button>
                      </div>

                      {/* sections */}
                      <div style={{ padding:"14px 14px", display:"flex", flexDirection:"column", gap:16 }}>
                        {SECTIONS.map(sec => {
                          const sd = cu[sec.key];
                          if (!sd) return null;
                          const fields = sec.fields.filter(f => sd[f.key] != null);
                          if (!fields.length) return null;
                          return (
                            <div key={sec.key}>
                              <div style={{ fontSize:9, color:"var(--gold2)", fontFamily:"sans-serif", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>{sec.label}</div>
                              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                                {fields.map(f => {
                                  const isOn  = !!accepted[ci]?.[sec.key]?.[f.key];
                                  const val   = sd[f.key];
                                  const mode  = val?.mode;
                                  const current  = val?.current;
                                  const draftVal = drafts[ci]?.[sec.key]?.[f.key] ?? "";
                                  const taRows   = Math.max(2, (draftVal.match(/\n/g) || []).length + 2);
                                  return (
                                    <div key={f.key} style={{ display:"flex", alignItems:"flex-start", gap:10, opacity: isOn ? 1 : 0.35, transition:"opacity 0.15s" }}>
                                      <div style={{ flex:1, background:"var(--bg3)", borderRadius:4, padding:"8px 11px", border:"1px solid var(--border)" }}>
                                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                                          <span style={{ fontSize:10, color:"var(--text4)", fontFamily:"sans-serif", letterSpacing:"0.08em", textTransform:"uppercase" }}>{f.label}</span>
                                          {mode && <span style={{ fontSize:9, padding:"1px 5px", borderRadius:8, fontFamily:"sans-serif", letterSpacing:"0.06em", textTransform:"uppercase", background: mode === "append" ? "#1a2a1a" : "#1a1a2a", border: `1px solid ${mode === "append" ? "#2d4d2d" : "#2d2d4d"}`, color: mode === "append" ? "#7ab87a" : "#7a7ab8" }}>{mode}</span>}
                                        </div>
                                        {mode === "replace" && current && (
                                          <div style={{ fontSize:12, color:"var(--text4)", fontFamily:"Georgia, serif", lineHeight:1.55, textDecoration:"line-through", marginBottom:6 }}>{current}</div>
                                        )}
                                        {mode === "append" && current && (
                                          <div style={{ fontSize:12, color:"var(--text4)", fontFamily:"Georgia, serif", lineHeight:1.55, marginBottom:6 }}>{current}</div>
                                        )}
                                        <textarea
                                          value={draftVal}
                                          onChange={e => updateDraft(ci, sec.key, f.key, e.target.value)}
                                          rows={taRows}
                                          style={{
                                            width:"100%", background:"var(--bg4)", border:`1px solid ${mode === "append" ? "#2d6040" : "var(--border2)"}`,
                                            borderRadius:3, color: mode === "append" ? "#a8d8a8" : "var(--text3)",
                                            fontSize:13, fontFamily:"Georgia, serif", lineHeight:1.65,
                                            padding:"5px 7px", resize:"vertical", outline:"none", boxSizing:"border-box",
                                            ...(mode === "append" ? { borderLeft:"2px solid #2d6040" } : {}),
                                          }}
                                        />
                                      </div>
                                      <button
                                        onClick={() => toggleField(ci, sec.key, f.key)}
                                        style={{
                                          flexShrink:0, borderRadius:4, fontSize:11, fontFamily:"sans-serif",
                                          padding:"4px 10px", cursor:"pointer", whiteSpace:"nowrap", marginTop:2,
                                          background: isOn ? "#1a3020" : "var(--bg3)",
                                          border: `1px solid ${isOn ? "#2d6040" : "var(--border2)"}`,
                                          color: isOn ? "#6dbf8a" : "#666",
                                        }}
                                      >
                                        {isOn ? "✓" : "—"}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
            }
          </div>
        )}
      </div>

      {/* Footer */}
      {status === "review" && data && (
        <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:12, padding:"11px 24px", borderTop:"1px solid var(--border)", background:"var(--bg2)" }}>
          <span style={{ flex:1, fontSize:12, color:"var(--text4)", fontFamily:"sans-serif" }}>
            {totalAccepted} field{totalAccepted !== 1 ? "s" : ""} selected
          </span>
          <button
            onClick={onClose}
            style={{ background:"none", border:"1px solid var(--border2)", borderRadius:4, color:"var(--text4)", fontSize:12, fontFamily:"sans-serif", padding:"6px 16px", cursor:"pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={commit}
            disabled={committing || totalAccepted === 0}
            style={{
              borderRadius:4, fontSize:12, fontFamily:"sans-serif", padding:"6px 20px", fontWeight:"bold",
              cursor: committing || totalAccepted === 0 ? "not-allowed" : "pointer",
              background: committing || totalAccepted === 0 ? "var(--bg4)" : "var(--gold2)",
              border: `1px solid ${committing || totalAccepted === 0 ? "var(--border2)" : "var(--gold)"}`,
              color: committing || totalAccepted === 0 ? "#555" : "#1a1410",
              display:"flex", alignItems:"center", gap:6,
              opacity: committing || totalAccepted === 0 ? 0.6 : 1,
            }}
          >
            {committing ? <><span className="spin" /> Writing…</> : "Commit"}
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
