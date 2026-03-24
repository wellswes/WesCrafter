import { useState, useEffect } from "react"
import { supabase } from "./supabase"

const GROUPS = ["The Pack", "The Pirates", "The Estate", "Crestfallen Townsfolk"]
const TABS = ["Core", "Erotic", "Combat"]

const GROUP_COLORS = {
  "The Pack":              { bg: "#EEEDFE", text: "#3C3489", border: "#AFA9EC", dot: "#7F77DD" },
  "The Pirates":           { bg: "#FAECE7", text: "#712B13", border: "#F0997B", dot: "#D85A30" },
  "The Estate":            { bg: "#FBEAF0", text: "#72243E", border: "#ED93B1", dot: "#D4537E" },
  "Crestfallen Townsfolk": { bg: "#E1F5EE", text: "#085041", border: "#5DCAA5", dot: "#1D9E75" },
}

const Field = ({ label, value }) => {
  if (!value) return null
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "#888", marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.75 }}>{value}</div>
    </div>
  )
}

const Badge = ({ children, style }) => (
  <span style={{
    display: "inline-block", fontSize: 11, fontWeight: 500,
    padding: "2px 8px", borderRadius: 6, marginRight: 6, marginBottom: 4,
    ...style
  }}>{children}</span>
)

export default function App() {
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState("groups")
  const [selectedGroup, setGroup] = useState(null)
  const [selectedChar, setChar] = useState(null)
  const [tab, setTab] = useState("Core")

  useEffect(() => {
    async function loadCharacters() {
      const { data, error } = await supabase
        .from("characters")
        .select(`
          *,
          character_erotic(*),
          character_combat(*)
        `)
      if (!error) setCharacters(data)
      setLoading(false)
    }
    loadCharacters()
  }, [])

  const charsInGroup = g => characters.filter(c => c.character_group === g)
  const goGroups = () => { setView("groups"); setGroup(null); setChar(null) }
  const goGroup  = g => { setGroup(g); setView("characters"); setChar(null) }
  const goChar   = c => { setChar(c); setView("codex"); setTab("Core") }

  const Breadcrumb = () => (
    <div style={{ fontSize: 12, color: "#888", marginBottom: 20, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span onClick={goGroups} style={{ cursor: "pointer", color: "#555" }}>Characters</span>
      {selectedGroup && <><span>›</span>
        <span onClick={() => goGroup(selectedGroup)} style={{ cursor: view === "codex" ? "pointer" : "default", color: view === "codex" ? "#555" : "#111" }}>
          {selectedGroup}
        </span></>}
      {selectedChar && <><span>›</span>
        <span style={{ color: "#111" }}>{selectedChar.name}</span></>}
    </div>
  )

  if (loading) return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 16px", fontFamily: "system-ui", color: "#888" }}>
      Loading Codex...
    </div>
  )

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px", fontFamily: "system-ui" }}>

      <div style={{ marginBottom: 24, paddingBottom: 14, borderBottom: "0.5px solid #ddd" }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>WEScrafter</div>
        <div style={{ fontSize: 20, fontWeight: 500, marginTop: 2 }}>Character Codex</div>
      </div>

      <Breadcrumb />

      {/* GROUP LIST */}
      {view === "groups" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {GROUPS.map(g => {
            const c = GROUP_COLORS[g]
            const count = charsInGroup(g).length
            return (
              <div key={g} onClick={() => goGroup(g)} style={{
                padding: "14px 16px", borderRadius: 10, border: `0.5px solid ${c.border}`,
                background: c.bg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot }} />
                  <span style={{ fontSize: 15, fontWeight: 500, color: c.text }}>{g}</span>
                </div>
                <span style={{ fontSize: 12, color: c.text, opacity: 0.7 }}>
                  {count} {count === 1 ? "character" : "characters"} ›
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* CHARACTER LIST */}
      {view === "characters" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {charsInGroup(selectedGroup).length === 0
            ? <div style={{ fontSize: 14, color: "#888", padding: "20px 0" }}>No characters in this group yet.</div>
            : charsInGroup(selectedGroup).map(c => (
              <div key={c.id} onClick={() => goChar(c)} style={{
                padding: "14px 16px", borderRadius: 10, border: "0.5px solid #ddd",
                background: "#f9f9f9", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                    {c.occupation} · {c.age} · {c.pronouns}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "#888" }}>›</span>
              </div>
            ))
          }
        </div>
      )}

      {/* CODEX */}
      {view === "codex" && selectedChar && (() => {
        const e = selectedChar.character_erotic?.[0] || {}
        const combat = selectedChar.character_combat?.[0] || {}
        const col = GROUP_COLORS[selectedChar.character_group] || GROUP_COLORS["The Pack"]
        return (
          <div>
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "0.5px solid #ddd" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 500 }}>{selectedChar.name}</div>
                  <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
                    {selectedChar.occupation} · {selectedChar.age} · {selectedChar.pronouns}
                  </div>
                </div>
                <Badge style={{ background: col.bg, color: col.text, border: `0.5px solid ${col.border}` }}>
                  {selectedChar.character_group}
                </Badge>
              </div>
              <div style={{ marginTop: 12 }}>
                <Badge style={{ background: "#f1f1f1", color: "#444", border: "0.5px solid #ddd" }}>{selectedChar.height}</Badge>
                <Badge style={{ background: "#f1f1f1", color: "#444", border: "0.5px solid #ddd" }}>{selectedChar.build?.split(".")[0]}</Badge>
                <Badge style={{ background: "#f1f1f1", color: "#444", border: "0.5px solid #ddd" }}>{selectedChar.species?.split("(")[0].trim()}</Badge>
                <Badge style={{ background: "#EAF3DE", color: "#27500A", border: "0.5px solid #97C459" }}>● {selectedChar.current_status}</Badge>
              </div>
            </div>

            <div style={{ display: "flex", marginBottom: 20, borderBottom: "0.5px solid #ddd" }}>
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "8px 18px", fontSize: 13, fontWeight: tab === t ? 500 : 400,
                  background: "transparent", border: "none", cursor: "pointer",
                  color: tab === t ? "#111" : "#888",
                  borderBottom: tab === t ? "2px solid #111" : "2px solid transparent",
                  marginBottom: -1
                }}>{t}</button>
              ))}
            </div>

            {tab === "Core" && <div>
              <Field label="Species / Heritage" value={selectedChar.species} />
              <Field label="Physical Appearance" value={selectedChar.physical_appearance} />
              <Field label="Build" value={selectedChar.build} />
              <Field label="Personality" value={selectedChar.personality} />
              <Field label="Voice & Behavior Notes" value={selectedChar.voice_notes} />
              <Field label="Backstory" value={selectedChar.backstory_summary} />
            </div>}

            {tab === "Erotic" && <div>
              <Field label="Appearance Detail" value={e.appearance_detail} />
              <Field label="Body Attributes" value={e.body_attributes} />
              <Field label="Intimacy Behavior" value={e.intimacy_behavior} />
              <Field label="Heat Notes" value={e.heat_notes} />
              <Field label="Sensory Cues" value={e.sensory_cues} />
            </div>}

            {tab === "Combat" && <div>
              <Field label="Archetype" value={combat.archetype} />
              <Field label="Fighting Style" value={combat.fighting_style} />
              <Field label="Equipment" value={combat.equipment_notes} />
              <Field label="Abilities" value={combat.abilities || "Not yet defined"} />
              <Field label="Spells" value={combat.spells || "Not yet defined"} />
            </div>}
          </div>
        )
      })()}

    </div>
  )
}