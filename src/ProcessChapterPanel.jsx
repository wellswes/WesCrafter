import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase, STORY_ID } from "./constants.js";

const EDGE_URL = "https://gjvegoinppbpfusttycs.supabase.co/functions/v1/process-chapter";

const IMPACT = {
  turning_point: { bg: "#2d1a4a", border: "#7c3aed", text: "#c084fc" },
  major:         { bg: "#1a2a40", border: "#2563eb", text: "#60a5fa" },
  minor:         { bg: "#1e1c1a", border: "#3a3530", text: "#9ca3af" },
};

function DiffField({ label, oldVal, newVal }) {
  const changed = oldVal !== undefined && oldVal !== null && oldVal !== newVal;
  return (
    <>
      <span style={{ color: "var(--text4)", fontSize: 12, fontFamily: "sans-serif" }}>{label}</span>
      <span style={{ fontSize: 12, fontFamily: "sans-serif" }}>
        {changed && (
          <span style={{ color: "#555", textDecoration: "line-through", marginRight: 5 }}>
            {String(oldVal ?? "—")}
          </span>
        )}
        <span style={{ color: "var(--text3)" }}>{String(newVal ?? "—")}</span>
      </span>
    </>
  );
}

export default function ProcessChapterPanel({ chapterId, chapterTitle, onClose }) {
  const [status, setStatus]           = useState("loading");
  const [data, setData]               = useState(null);
  const [error, setError]             = useState(null);
  const [accepted, setAccepted]       = useState({ events: {}, rels: {} });
  const [expandedNotes, setExpanded]  = useState({});
  const [committing, setCommitting]   = useState(false);
  const [summary, setSummary]         = useState(null);

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
        const ev = {}, rel = {};
        (result.events || []).forEach((_, i) => { ev[i] = true; });
        (result.relationship_updates || []).forEach((_, i) => { rel[i] = true; });
        setAccepted({ events: ev, rels: rel });
        setStatus("review");
      })
      .catch(e => { setError(e.message); setStatus("error"); });
  }, [chapterId]);

  const toggleEvent = i => setAccepted(p => ({ ...p, events: { ...p.events, [i]: !p.events[i] } }));
  const toggleRel   = i => setAccepted(p => ({ ...p, rels:   { ...p.rels,   [i]: !p.rels[i]   } }));
  const toggleNotes = k => setExpanded(p => ({ ...p, [k]: !p[k] }));

  const charName = id => data?.character_map?.[id] ?? (id ? id.slice(0, 8) + "…" : "?");

  const commit = async () => {
    if (!data) return;
    setCommitting(true);
    try {
      const { events, relationship_updates, character_map, chapter_sequence } = data;
      const validIds = new Set(Object.keys(character_map));
      let eventsWritten = 0;
      let relsWritten   = 0;

      for (let i = 0; i < events.length; i++) {
        if (!accepted.events[i]) continue;
        const ev = events[i];
        const validCharIds = (ev.character_ids || []).filter(id => validIds.has(id));
        const { data: inserted } = await supabase.from("story_events").insert({
          story_id:      STORY_ID,
          title:         ev.title,
          impact_level:  ev.impact_level,
          summary:       ev.summary,
          character_ids: validCharIds,
          chapter_start: chapter_sequence,
          chapter_end:   chapter_sequence,
        }).select("id").single();
        if (inserted?.id) {
          const validNotes = (ev.character_notes || []).filter(n => validIds.has(n.character_id));
          if (validNotes.length) {
            await supabase.from("character_event_notes").insert(
              validNotes.map(n => ({ event_id: inserted.id, character_id: n.character_id, note: n.note }))
            );
          }
        }
        eventsWritten++;
      }

      for (let i = 0; i < relationship_updates.length; i++) {
        if (!accepted.rels[i]) continue;
        const ru = relationship_updates[i];
        if (!validIds.has(ru.character_a_id) || !validIds.has(ru.character_b_id)) continue;
        const fields = {
          status:         ru.status,
          intimacy_level: ru.intimacy_level,
          tension_level:  ru.tension_level,
          dynamic_notes:  ru.dynamic_notes,
        };
        if (ru.is_update && ru.existing?.id) {
          await supabase.from("relationships").update(fields).eq("id", ru.existing.id);
        } else {
          await supabase.from("relationships").insert({
            character_a_id: ru.character_a_id,
            character_b_id: ru.character_b_id,
            ...fields,
          });
        }
        relsWritten++;
      }

      setSummary({ eventsWritten, relsWritten });
      setStatus("committed");
    } catch (e) {
      alert("Commit failed: " + e.message);
    } finally {
      setCommitting(false);
    }
  };

  const acceptedCount = {
    events: Object.values(accepted.events).filter(Boolean).length,
    rels:   Object.values(accepted.rels).filter(Boolean).length,
  };
  const noneSelected = acceptedCount.events === 0 && acceptedCount.rels === 0;

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.88)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 10,
        padding: "13px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg2)",
      }}>
        <span style={{ fontSize: 12, fontFamily: "sans-serif", color: "var(--gold)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Process Chapter
        </span>
        <span style={{ fontSize: 12, color: "var(--border2)", fontFamily: "sans-serif" }}>—</span>
        <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "sans-serif" }}>{chapterTitle}</span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text4)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 4px", fontFamily: "sans-serif" }}>×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

        {status === "loading" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text4)", fontFamily: "sans-serif", fontSize: 13, fontStyle: "italic", padding: "60px 0", justifyContent: "center" }}>
            <span className="spin" /> Analyzing chapter…
          </div>
        )}

        {status === "error" && (
          <div style={{ color: "#c07060", fontFamily: "sans-serif", fontSize: 13, background: "#1a1210", border: "1px solid #3a2020", borderRadius: 5, padding: "14px 18px", maxWidth: 600, margin: "0 auto" }}>
            <strong>Analysis failed:</strong> {error}
          </div>
        )}

        {status === "committed" && summary && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6dbf8a", fontFamily: "sans-serif", marginBottom: 8 }}>committed</div>
            <div style={{ fontSize: 14, color: "var(--text3)", fontFamily: "sans-serif" }}>
              {summary.eventsWritten} event{summary.eventsWritten !== 1 ? "s" : ""} written,{" "}
              {summary.relsWritten} relationship{summary.relsWritten !== 1 ? "s" : ""} updated
            </div>
            <button onClick={onClose} style={{ marginTop: 24, background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: 4, color: "var(--text3)", fontSize: 12, fontFamily: "sans-serif", padding: "7px 24px", cursor: "pointer" }}>
              Done
            </button>
          </div>
        )}

        {status === "review" && data && (
          <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>

            {/* ── Events ── */}
            <section>
              <div style={{ fontSize: 10, color: "var(--text4)", fontFamily: "sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                Events ({data.events.length})
              </div>
              {data.events.length === 0
                ? <div style={{ color: "var(--text4)", fontStyle: "italic", fontSize: 13, fontFamily: "sans-serif" }}>No events identified.</div>
                : data.events.map((ev, i) => {
                    const colors    = IMPACT[ev.impact_level] || IMPACT.minor;
                    const isAcc     = accepted.events[i];
                    const notesKey  = `ev-${i}`;
                    const hasNotes  = ev.character_notes?.length > 0;
                    return (
                      <div key={i} style={{
                        background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 6,
                        padding: "12px 14px", marginBottom: 10,
                        opacity: isAcc ? 1 : 0.4, transition: "opacity 0.15s",
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13, fontFamily: "sans-serif", fontWeight: 600, color: "var(--text)" }}>{ev.title}</span>
                              <span style={{
                                fontSize: 10, fontFamily: "sans-serif", padding: "2px 8px", borderRadius: 10,
                                background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text,
                                textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0,
                              }}>
                                {(ev.impact_level || "").replace("_", " ")}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text3)", fontFamily: "sans-serif", lineHeight: 1.55, marginBottom: 8 }}>
                              {ev.summary}
                            </div>
                            {(ev.character_ids || []).filter(id => data.character_map[id]).length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 7 }}>
                                {ev.character_ids.filter(id => data.character_map[id]).map(id => (
                                  <span key={id} style={{ fontSize: 11, fontFamily: "sans-serif", padding: "2px 9px", borderRadius: 10, background: "var(--bg4)", border: "1px solid var(--border2)", color: "var(--text3)" }}>
                                    {charName(id)}
                                  </span>
                                ))}
                              </div>
                            )}
                            {hasNotes && (
                              <button
                                onClick={() => toggleNotes(notesKey)}
                                style={{ background: "none", border: "none", color: "var(--text4)", fontSize: 11, fontFamily: "sans-serif", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                              >
                                {expandedNotes[notesKey] ? "Hide" : "Show"} character notes ({ev.character_notes.length})
                              </button>
                            )}
                            {expandedNotes[notesKey] && (
                              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                                {ev.character_notes.filter(cn => data.character_map[cn.character_id]).map((cn, j) => (
                                  <div key={j} style={{ fontSize: 12, fontFamily: "sans-serif", color: "var(--text3)", background: "var(--bg3)", borderRadius: 4, padding: "6px 10px", borderLeft: "2px solid var(--border2)" }}>
                                    <span style={{ color: "var(--gold2)", fontWeight: 600 }}>{charName(cn.character_id)}: </span>
                                    {cn.note}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => toggleEvent(i)}
                            style={{
                              flexShrink: 0, borderRadius: 4, fontSize: 11, fontFamily: "sans-serif",
                              padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap",
                              background: isAcc ? "#1a3020" : "var(--bg3)",
                              border: `1px solid ${isAcc ? "#2d6040" : "var(--border2)"}`,
                              color: isAcc ? "#6dbf8a" : "#666",
                            }}
                          >
                            {isAcc ? "✓ Accept" : "Dismiss"}
                          </button>
                        </div>
                      </div>
                    );
                  })
              }
            </section>

            {/* ── Relationship Updates ── */}
            <section>
              <div style={{ fontSize: 10, color: "var(--text4)", fontFamily: "sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                Relationship Updates ({data.relationship_updates.length})
              </div>
              {data.relationship_updates.length === 0
                ? <div style={{ color: "var(--text4)", fontStyle: "italic", fontSize: 13, fontFamily: "sans-serif" }}>No relationship changes identified.</div>
                : data.relationship_updates.map((ru, i) => {
                    const isAcc  = accepted.rels[i];
                    const ex     = ru.existing;
                    const nameA  = charName(ru.character_a_id);
                    const nameB  = charName(ru.character_b_id);
                    return (
                      <div key={i} style={{
                        background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 6,
                        padding: "12px 14px", marginBottom: 10,
                        opacity: isAcc ? 1 : 0.4, transition: "opacity 0.15s",
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13, fontFamily: "sans-serif", fontWeight: 600, color: "var(--text)" }}>
                                {nameA} &amp; {nameB}
                              </span>
                              <span style={{
                                fontSize: 10, fontFamily: "sans-serif", padding: "2px 8px", borderRadius: 10,
                                background: ru.is_update ? "#1a2a1a" : "#1a1a2a",
                                border: `1px solid ${ru.is_update ? "#2d4d2d" : "#2d2d4d"}`,
                                color: ru.is_update ? "#7ab87a" : "#7a7ab8",
                                textTransform: "uppercase", letterSpacing: "0.06em",
                              }}>
                                {ru.is_update ? "update" : "new"}
                              </span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "5px 12px", alignItems: "baseline" }}>
                              {ru.status !== undefined && (
                                <DiffField label="Status" oldVal={ex?.status} newVal={ru.status} />
                              )}
                              {ru.intimacy_level !== undefined && (
                                <DiffField label="Intimacy" oldVal={ex?.intimacy_level} newVal={ru.intimacy_level} />
                              )}
                              {ru.tension_level !== undefined && (
                                <DiffField label="Tension" oldVal={ex?.tension_level} newVal={ru.tension_level} />
                              )}
                              {ru.dynamic_notes && (
                                <>
                                  <span style={{ color: "var(--text4)", fontSize: 12, fontFamily: "sans-serif" }}>Notes</span>
                                  <span style={{ color: "var(--text3)", fontSize: 12, fontFamily: "sans-serif", lineHeight: 1.4 }}>{ru.dynamic_notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleRel(i)}
                            style={{
                              flexShrink: 0, borderRadius: 4, fontSize: 11, fontFamily: "sans-serif",
                              padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap",
                              background: isAcc ? "#1a3020" : "var(--bg3)",
                              border: `1px solid ${isAcc ? "#2d6040" : "var(--border2)"}`,
                              color: isAcc ? "#6dbf8a" : "#666",
                            }}
                          >
                            {isAcc ? "✓ Accept" : "Dismiss"}
                          </button>
                        </div>
                      </div>
                    );
                  })
              }
            </section>

          </div>
        )}
      </div>

      {/* Footer */}
      {status === "review" && data && (
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
          padding: "11px 24px", borderTop: "1px solid var(--border)", background: "var(--bg2)",
        }}>
          <span style={{ flex: 1, fontSize: 12, color: "var(--text4)", fontFamily: "sans-serif" }}>
            {acceptedCount.events} event{acceptedCount.events !== 1 ? "s" : ""},{" "}
            {acceptedCount.rels} relationship{acceptedCount.rels !== 1 ? "s" : ""} selected
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "1px solid var(--border2)", borderRadius: 4, color: "var(--text4)", fontSize: 12, fontFamily: "sans-serif", padding: "6px 16px", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={commit}
            disabled={committing || noneSelected}
            style={{
              borderRadius: 4, fontSize: 12, fontFamily: "sans-serif",
              padding: "6px 20px", fontWeight: "bold",
              cursor: committing || noneSelected ? "not-allowed" : "pointer",
              background: committing || noneSelected ? "var(--bg4)" : "var(--gold2)",
              border: `1px solid ${committing || noneSelected ? "var(--border2)" : "var(--gold)"}`,
              color: committing || noneSelected ? "#555" : "#1a1410",
              display: "flex", alignItems: "center", gap: 6,
              opacity: committing || noneSelected ? 0.6 : 1,
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
