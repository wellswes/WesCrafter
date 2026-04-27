import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase, STORY_ID } from "./constants.js";

const STEPS = [
  { key:"consolidate",   num:1, label:"Consolidate Beats",       active:true  },
  { key:"sceneBreaks",   num:2, label:"Scene Breaks",            active:true  },
  { key:"captureEvents", num:3, label:"Capture Events",          active:true  },
  { key:"updateCodex",   num:4, label:"Update Character Sheet",  active:true  },
  { key:"newChapter",    num:5, label:"Start New Chapter",       active:true  },
];

const freshState = () => Object.fromEntries(STEPS.map(s => [s.key, "idle"]));

export default function ImportPanel({
  chapterId,
  chapterTitle,
  onOpenCaptureEvents,
  onOpenUpdateCodex,
  onStartNewChapter,
  onSceneBreaksDone,
  onClose,
}) {
  const [steps,              setSteps]              = useState(freshState);
  const [msgs,               setMsgs]               = useState({});
  const [errors,             setErrors]             = useState({});
  const [sceneBreakResult,   setSceneBreakResult]   = useState(null);
  const [scenesExpanded,     setScenesExpanded]     = useState(false);
  const [splitConfirming,    setSplitConfirming]    = useState(false);
  const [splitDone,          setSplitDone]          = useState(false);
  const [splitErr,           setSplitErr]           = useState(null);
  const [pendingTitle,       setPendingTitle]       = useState("");
  const [pendingSummary,     setPendingSummary]     = useState("");
  const [summaryApproved,    setSummaryApproved]    = useState(false);
  const [summaryApproving,   setSummaryApproving]   = useState(false);
  const [summaryApproveErr,  setSummaryApproveErr]  = useState(null);

  // Reset all step state when chapter changes
  useEffect(() => {
    setSteps(freshState());
    setMsgs({});
    setErrors({});
    setSceneBreakResult(null);
    setSplitConfirming(false);
    setSplitDone(false);
    setSplitErr(null);
    setPendingTitle("");
    setPendingSummary("");
    setSummaryApproved(false);
    setSummaryApproving(false);
    setSummaryApproveErr(null);
  }, [chapterId]);

  const setStep = (key, val) => setSteps(p => ({ ...p, [key]: val }));
  const setMsg  = (key, val) => setMsgs(p => ({ ...p, [key]: val }));
  const setErr  = (key, val) => setErrors(p => ({ ...p, [key]: val }));

  const runConsolidate = async () => {
    setStep("consolidate", "running");
    setErr("consolidate", null);
    try {
      const { data, error } = await supabase.rpc("consolidate_beats", { p_chapter_id: chapterId });
      if (error) throw error;
      const count = typeof data === "number" ? data : (data?.merged_groups ?? data?.merged ?? data?.groups_merged ?? 0);
      setMsg("consolidate", `${count} group${count !== 1 ? "s" : ""} merged`);
      setStep("consolidate", "done");
    } catch (e) {
      setErr("consolidate", e.message);
      setStep("consolidate", "error");
    }
  };

  const runSceneBreaks = async () => {
    setStep("sceneBreaks", "running");
    setErr("sceneBreaks", null);
    setSceneBreakResult(null);
    setSummaryApproved(false);
    setSummaryApproveErr(null);
    try {
      const res = await fetch(
        "https://gjvegoinppbpfusttycs.supabase.co/functions/v1/break-scenes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapter_id: chapterId }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSceneBreakResult(data);
      setPendingTitle(data.chapter_title || "");
      setPendingSummary(data.context_summary || "");
      setStep("sceneBreaks", "done");
      // onSceneBreaksDone called after summary approval, not here
    } catch (e) {
      setErr("sceneBreaks", e.message);
      setStep("sceneBreaks", "error");
    }
  };

  const approveSummary = async () => {
    setSummaryApproving(true);
    setSummaryApproveErr(null);
    try {
      const { error } = await supabase
        .from("chapters")
        .update({ title: pendingTitle, context_summary: pendingSummary })
        .eq("id", chapterId);
      if (error) throw error;
      setSummaryApproved(true);
      if (onSceneBreaksDone) onSceneBreaksDone({
        ...sceneBreakResult,
        chapter_title: pendingTitle,
        context_summary: pendingSummary,
      });
    } catch (e) {
      setSummaryApproveErr(e.message);
    } finally {
      setSummaryApproving(false);
    }
  };

  const runCaptureEvents = () => {
    setStep("captureEvents", "done");
    onOpenCaptureEvents();
  };

  const runUpdateCodex = () => {
    setStep("updateCodex", "done");
    onOpenUpdateCodex();
  };

  const runNewChapter = async () => {
    setStep("newChapter", "running");
    setErr("newChapter", null);
    try {
      await onStartNewChapter();
      setMsg("newChapter", "Navigating to new chapter…");
      setStep("newChapter", "done");
    } catch (e) {
      setErr("newChapter", e.message);
      setStep("newChapter", "error");
    }
  };

  const runConfirmSplit = async () => {
    if (!sceneBreakResult?.split_suggested) return;
    setSplitConfirming(true);
    setSplitErr(null);
    try {
      const { error } = await supabase.rpc("split_chapter", {
        p_chapter_id:    chapterId,
        p_split_after_beat: sceneBreakResult.split_after_beat,
        p_title_a:       sceneBreakResult.split_title_a,
        p_title_b:       sceneBreakResult.split_title_b,
      });
      if (error) throw error;
      setSplitDone(true);
    } catch (e) {
      setSplitErr(e.message);
    } finally {
      setSplitConfirming(false);
    }
  };

  const runners = {
    consolidate:   runConsolidate,
    sceneBreaks:   runSceneBreaks,
    captureEvents: runCaptureEvents,
    updateCodex:   runUpdateCodex,
    newChapter:    runNewChapter,
  };

  return createPortal(
    <div style={{
      position: "fixed",
      left: 0,
      bottom: 44,
      width: 220,
      zIndex: 8000,
      background: "var(--bg2)",
      borderTop: "1px solid var(--border2)",
      borderRight: "1px solid var(--border2)",
      borderBottom: "1px solid var(--border2)",
      borderRadius: "0 6px 6px 0",
      boxShadow: "4px 4px 16px #00000066",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      maxHeight: "calc(100vh - 100px)",
      overflowY: "auto",
    }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 10px 8px 12px", borderBottom:"1px solid var(--border)" }}>
        <span style={{ flex:1, fontSize:10, fontFamily:"sans-serif", color:"var(--gold)", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" }}>
          Pipeline
        </span>
        <span style={{ fontSize:10, color:"var(--text4)", fontFamily:"sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:100 }}>
          {chapterTitle}
        </span>
        <button
          onClick={onClose}
          style={{ background:"none", border:"none", color:"var(--text4)", fontSize:14, cursor:"pointer", lineHeight:1, padding:"0 2px", flexShrink:0, fontFamily:"sans-serif" }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text4)"}
        >×</button>
      </div>

      {/* Step rows */}
      <div style={{ display:"flex", flexDirection:"column" }}>
        {STEPS.map(s => {
          const state  = steps[s.key];
          const msg    = msgs[s.key];
          const err    = errors[s.key];
          const isDone = state === "done";
          const isRun  = state === "running";
          const isErr  = state === "error";
          const runner = runners[s.key];
          const clickable = s.active && !isDone && !isRun;

          return (
            <div
              key={s.key}
              onClick={clickable ? runner : undefined}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 9,
                padding: "9px 12px",
                borderBottom: "1px solid var(--border)",
                cursor: clickable ? "pointer" : "default",
                opacity: s.active ? 1 : 0.38,
                background: "transparent",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => { if (clickable) e.currentTarget.style.background = "var(--bg4)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              {/* circle */}
              <div style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isDone ? "#1a3020" : isErr ? "#2a1010" : "var(--bg4)",
                border: `1px solid ${isDone ? "#2d6040" : isErr ? "#6a2020" : "var(--border2)"}`,
                fontSize: 9, fontFamily: "sans-serif",
                color: isDone ? "#6dbf8a" : isErr ? "#c07060" : "var(--text4)",
                transition: "background 0.2s, border-color 0.2s",
              }}>
                {isRun
                  ? <span className="spin" style={{ width:8, height:8, borderWidth:1.5 }} />
                  : isDone ? "✓" : isErr ? "!" : s.num
                }
              </div>

              {/* label + sub-message */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontSize: 11, fontFamily: "sans-serif",
                  color: isDone ? "#6dbf8a" : isErr ? "#c07060" : s.active ? "var(--text)" : "var(--text4)",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  {s.label}
                  {s.key === "sceneBreaks" && isDone && !summaryApproved && (
                    <span style={{ fontSize:8, color:"var(--gold)", fontFamily:"sans-serif", opacity:0.8 }}>review</span>
                  )}
                </div>

                {/* Scene breaks result */}
                {s.key === "sceneBreaks" && isDone && sceneBreakResult && (
                  <div style={{ marginTop:4 }}>
                    {/* Editable title — shown until approved */}
                    {!summaryApproved ? (
                      <input
                        value={pendingTitle}
                        onChange={e => setPendingTitle(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          background: "var(--bg4)",
                          border: "1px solid var(--border2)",
                          borderRadius: 3,
                          color: "#6dbf8a",
                          fontSize: 9,
                          fontFamily: "sans-serif",
                          padding: "3px 5px",
                          marginBottom: 4,
                          outline: "none",
                        }}
                      />
                    ) : (
                      <div style={{ fontSize:9, color:"#6dbf8a", fontFamily:"sans-serif", marginBottom:2 }}>
                        {pendingTitle}
                      </div>
                    )}

                    {/* Scene list */}
                    <div
                      onClick={e => { e.stopPropagation(); setScenesExpanded(v => !v); }}
                      style={{ display:"flex", alignItems:"center", gap:3, cursor:"pointer", userSelect:"none" }}
                    >
                      <span style={{ fontSize:8, color:"var(--text4)", fontFamily:"sans-serif" }}>
                        {scenesExpanded ? "▾" : "▶"}
                      </span>
                      <span style={{ fontSize:9, color:"var(--text4)", fontFamily:"sans-serif" }}>
                        {sceneBreakResult.scenes.length} scene{sceneBreakResult.scenes.length !== 1 ? "s" : ""} created
                      </span>
                    </div>
                    {scenesExpanded && sceneBreakResult.scenes.map((sc, i) => (
                      <div key={i} style={{ fontSize:9, color:"var(--text4)", fontFamily:"sans-serif", paddingLeft:10 }}>
                        {i + 1}. {sc.title} <span style={{ opacity:0.5 }}>({sc.beat_count})</span>
                      </div>
                    ))}

                    {/* Context summary review */}
                    {!summaryApproved ? (
                      <div style={{ marginTop:6 }}>
                        <div style={{ fontSize:9, color:"var(--gold)", fontFamily:"sans-serif", marginBottom:3, opacity:0.8 }}>
                          Context summary
                        </div>
                        <textarea
                          value={pendingSummary}
                          onChange={e => setPendingSummary(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          rows={7}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            background: "var(--bg4)",
                            border: "1px solid var(--border2)",
                            borderRadius: 3,
                            color: "var(--text)",
                            fontSize: 8,
                            fontFamily: "sans-serif",
                            padding: "4px 5px",
                            resize: "vertical",
                            lineHeight: 1.5,
                            marginBottom: 4,
                            outline: "none",
                          }}
                        />
                        <button
                          onClick={e => { e.stopPropagation(); approveSummary(); }}
                          disabled={summaryApproving}
                          style={{
                            width: "100%",
                            background: "none",
                            border: "1px solid var(--gold2)",
                            borderRadius: 3,
                            cursor: summaryApproving ? "default" : "pointer",
                            padding: "3px 0",
                            fontSize: 9,
                            fontFamily: "sans-serif",
                            color: "var(--gold)",
                            opacity: summaryApproving ? 0.5 : 1,
                          }}
                        >
                          {summaryApproving ? "Saving…" : "Approve & Commit"}
                        </button>
                        {summaryApproveErr && (
                          <div style={{ fontSize:9, color:"#c07060", fontFamily:"sans-serif", marginTop:3 }}>
                            {summaryApproveErr}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize:9, color:"#6dbf8a", fontFamily:"sans-serif", marginTop:4 }}>
                        ✓ Summary committed
                      </div>
                    )}

                    {/* Split suggestion */}
                    {sceneBreakResult.split_suggested && !splitDone && (
                      <div style={{ marginTop:8, background:"#1a1400", border:"1px solid #4a3800", borderRadius:4, padding:"8px 10px" }}>
                        <div style={{ fontSize:9, color:"#c9a86c", fontFamily:"sans-serif", marginBottom:3 }}>
                          ⚠ Long chapter — split suggested after beat {sceneBreakResult.split_after_beat}
                        </div>
                        <div style={{ fontSize:9, color:"var(--text4)", fontFamily:"sans-serif", marginBottom:6, lineHeight:1.4 }}>
                          "{sceneBreakResult.split_title_a}" / "{sceneBreakResult.split_title_b}"
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); runConfirmSplit(); }}
                          disabled={splitConfirming}
                          style={{ background:"none", border:"1px solid var(--gold2)", borderRadius:3, cursor:"pointer", padding:"2px 8px", fontSize:9, fontFamily:"sans-serif", color:"var(--gold)", opacity: splitConfirming ? 0.5 : 1 }}
                        >
                          {splitConfirming ? "Splitting…" : "Confirm Split"}
                        </button>
                        {splitErr && (
                          <div style={{ fontSize:9, color:"#c07060", fontFamily:"sans-serif", marginTop:4 }}>{splitErr}</div>
                        )}
                      </div>
                    )}
                    {splitDone && (
                      <div style={{ marginTop:6, fontSize:9, color:"#6dbf8a", fontFamily:"sans-serif" }}>Chapter split complete.</div>
                    )}
                  </div>
                )}

                {msg && !err && s.key !== "sceneBreaks" && (
                  <div style={{ fontSize:9, color:"var(--text4)", fontFamily:"sans-serif", marginTop:2 }}>{msg}</div>
                )}
                {err && (
                  <div style={{ fontSize:9, color:"#c07060", fontFamily:"sans-serif", marginTop:2 }} title={err}>
                    {err.length > 40 ? err.slice(0, 40) + "…" : err}
                  </div>
                )}
                {isErr && (
                  <div style={{ fontSize:9, color:"var(--text4)", fontFamily:"sans-serif", marginTop:2, letterSpacing:"0.04em" }}>
                    click to retry
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
