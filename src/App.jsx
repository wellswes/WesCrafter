import { useState, useEffect } from "react"
import { supabase } from "./supabase"

const BANNER_URL = "https://gjvegoinppbpfusttycs.supabase.co/storage/v1/object/public/Wescrafter%20Images/SafeHarborLogo.png"
const TIMES = ["Dawn", "Morning", "Midday", "Afternoon", "Evening", "Late Evening", "Midnight", "Deep Night"]
const CHAR_TABS = ["Core", "Erotic", "Combat"]
const TOP_SECTIONS = ["Characters", "Places", "Lore", "Factions", "Creatures"]

const Field = ({ label, value }) => {
  if (!value) return null
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b5a3e", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, lineHeight: 1.8, color: "#c4a87a" }}>{value}</div>
    </div>
  )
}

const Badge = ({ children, style }) => (
  <span style={{ display: "inline-block", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 6, marginRight: 6, marginBottom: 4, ...style }}>{children}</span>
)

const PortraitPlaceholder = ({ name, color, width, height }) => (
  <div style={{ width, height, borderRadius: 8, background: color + "15", border: "1px solid " + color + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: width / 3, color }}>
    {name[0]}
  </div>
)

export default function App() {
  const [characters, setCharacters] = useState([])
  const [groups, setGroups] = useState([])
  const [locations, setLocations] = useState([])
  const [sceneChars, setSceneChars] = useState([])
  const [sceneLocation, setSceneLocation] = useState("The Manor")
  const [sceneTime, setSceneTime] = useState("Late Evening")
  const [showPicker, setShowPicker] = useState(false)
  const [showLocPicker, setShowLocPicker] = useState(false)
  const [expanded, setExpanded] = useState({ Characters: true })
  const [selectedCharId, setSelectedCharId] = useState(null)
  const [selectedSection, setSelectedSection] = useState(null)
  const [charTab, setCharTab] = useState("Core")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: chars }, { data: grps }, { data: locs }] = await Promise.all([
        supabase.from("characters").select("*, character_erotic(*), character_combat(*), character_groups(name, link_color, parent_group_id)"),
        supabase.from("character_groups").select("*").order("sort_order"),
        supabase.from("settlements").select("id, name"),
      ])
      if (chars) setCharacters(chars)
      if (grps) setGroups(grps)
      if (locs) setLocations(locs)
      setLoading(false)
    }
    load()
  }, [])

  const topGroups = groups.filter(g => !g.parent_group_id)
  const childGroups = id => groups.filter(g => g.parent_group_id === id)
  const charsInGroup = id => characters.filter(c => c.group_id === id)
  const selectedChar = characters.find(c => c.id === selectedCharId)
  const available = characters.filter(c => !sceneChars.find(s => s.id === c.id))

  const toggle = key => setExpanded(p => ({ ...p, [key]: !p[key] }))
  const selectChar = id => { setSelectedCharId(id); setSelectedSection(null); setCharTab("Core") }
  const selectSection = s => { setSelectedSection(s); setSelectedCharId(null) }

  const addToScene = c => { setSceneChars(p => [...p, c]); setShowPicker(false) }
  const removeFromScene = id => setSceneChars(p => p.filter(c => c.id !== id))

  // Recursive tree node for groups
  const GroupNode = ({ group, depth = 0 }) => {
    const children = childGroups(group.id)
    const chars = charsInGroup(group.id)
    const hasChildren = children.length > 0 || chars.length > 0
    const isOpen = expanded[group.id]
    const color = group.link_color || "#c4a87a"

    return (
      <div>
        <div onClick={() => toggle(group.id)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px 6px " + (16 + depth * 16) + "px", cursor: "pointer", borderRadius: 4, userSelect: "none" }}
          onMouseEnter={e => e.currentTarget.style.background = "#1a1410"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <span style={{ fontSize: 9, color: "#3a2f1e", width: 10 }}>{hasChildren ? (isOpen ? "▼" : "►") : ""}</span>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#a89070", letterSpacing: "0.03em" }}>{group.name}</span>
          {chars.length > 0 && <span style={{ fontSize: 10, color: "#3a2f1e", marginLeft: "auto" }}>{chars.length}</span>}
        </div>

        {isOpen && (
          <div>
            {children.map(child => <GroupNode key={child.id} group={child} depth={depth + 1} />)}
            {chars.map(c => (
              <div key={c.id} onClick={() => selectChar(c.id)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px 5px " + (32 + depth * 16) + "px", cursor: "pointer", borderRadius: 4, background: selectedCharId === c.id ? "#1a1410" : "transparent" }}
                onMouseEnter={e => e.currentTarget.style.background = "#1a1410"}
                onMouseLeave={e => e.currentTarget.style.background = selectedCharId === c.id ? "#1a1410" : "transparent"}
              >
                {c.portrait_url
                  ? <img src={c.portrait_url} alt={c.name} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", border: "1px solid " + color + "44", flexShrink: 0 }} />
                  : <div style={{ width: 22, height: 22, borderRadius: "50%", background: color + "22", border: "1px solid " + color + "44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color, flexShrink: 0 }}>{c.name[0]}</div>
                }
                <span style={{ fontSize: 13, color: selectedCharId === c.id ? color : "#8b7355" }}>{c.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) return (
    <div style={{ background: "#0e0c0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: "#6b5a3e", fontSize: 16 }}>
      Opening the Codex...
    </div>
  )

  return (
    <div style={{ background: "#0e0c0a", minHeight: "100vh", fontFamily: "Georgia, serif", color: "#c4a87a" }}
      onClick={() => { setShowPicker(false); setShowLocPicker(false) }}
    >

      {/* BANNER */}
      <div style={{ width: "100%", maxHeight: 200, overflow: "hidden", background: "#0a0806", position: "relative" }}>
        <img src={BANNER_URL} alt="Safe Harbor" style={{ width: "100%", objectFit: "cover", objectPosition: "center top", display: "block", maxHeight: 200 }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(transparent, #0e0c0a)" }} />
      </div>

      {/* SCENE STATE BAR */}
      <div style={{ borderBottom: "1px solid #1a1410", background: "#0a0908", padding: "0 24px", display: "flex", alignItems: "center", gap: 16, minHeight: 64, position: "relative" }}
        onClick={e => e.stopPropagation()}
      >
        <div onClick={() => { setShowLocPicker(!showLocPicker); setShowPicker(false) }}
          style={{ fontSize: 11, color: "#3a2f1e", cursor: "pointer", whiteSpace: "nowrap", letterSpacing: "0.06em", minWidth: 200 }}
          onMouseEnter={e => e.currentTarget.style.color = "#6b5a3e"}
          onMouseLeave={e => e.currentTarget.style.color = "#3a2f1e"}
        >
          {sceneLocation} · {sceneTime}
        </div>

        {showLocPicker && (
          <div style={{ position: "absolute", top: "100%", left: 24, zIndex: 200, background: "#150f08", border: "1px solid #2a1f12", borderRadius: 8, padding: 8, minWidth: 220, boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}>
            <div style={{ fontSize: 10, color: "#3a2f1e", letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 12px 8px" }}>Location</div>
            {locations.length === 0
              ? <div style={{ padding: "8px 12px", fontSize: 12, color: "#3a2f1e", fontStyle: "italic" }}>No settlements yet</div>
              : locations.map(l => (
                <div key={l.id} onClick={() => { setSceneLocation(l.name); setShowLocPicker(false) }}
                  style={{ padding: "7px 12px", fontSize: 13, cursor: "pointer", color: "#c4a87a", borderRadius: 4 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#2a1f12"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >{l.name}</div>
              ))
            }
            <div style={{ borderTop: "1px solid #2a1f12", margin: "8px 0 4px" }} />
            <div style={{ fontSize: 10, color: "#3a2f1e", letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 12px 8px" }}>Time of Day</div>
            {TIMES.map(t => (
              <div key={t} onClick={() => { setSceneTime(t); setShowLocPicker(false) }}
                style={{ padding: "7px 12px", fontSize: 12, cursor: "pointer", color: "#8b7355", borderRadius: 4, fontStyle: "italic" }}
                onMouseEnter={e => e.currentTarget.style.background = "#2a1f12"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >{t}</div>
            ))}
          </div>
        )}

        <div style={{ width: 1, height: 36, background: "#1a1410", flexShrink: 0 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          {sceneChars.map(c => {
            const color = c.character_groups?.link_color || "#6b4c10"
            return (
              <div key={c.id} onDoubleClick={() => removeFromScene(c.id)} title={c.name + " · double click to remove"} style={{ cursor: "pointer", position: "relative" }}>
                {c.portrait_url
                  ? <img src={c.portrait_url} alt={c.name} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid " + color + "66" }} />
                  : <div style={{ width: 40, height: 40, borderRadius: "50%", background: color + "22", border: "1.5px solid " + color + "55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color }}>{c.name[0]}</div>
                }
                <div style={{ position: "absolute", bottom: -14, left: "50%", transform: "translateX(-50%)", fontSize: 8, color: "#3a2f1e", whiteSpace: "nowrap" }}>{c.name}</div>
              </div>
            )
          })}

          <div onClick={e => { e.stopPropagation(); setShowPicker(!showPicker); setShowLocPicker(false) }}
            style={{ width: 40, height: 40, borderRadius: "50%", border: "1px dashed #2a1f12", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#2a1f12", fontSize: 20 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#5a4a35"; e.currentTarget.style.color = "#5a4a35" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a1f12"; e.currentTarget.style.color = "#2a1f12" }}
          >+</div>

          {showPicker && (
            <div style={{ position: "absolute", top: "100%", left: 260, zIndex: 200, background: "#150f08", border: "1px solid #2a1f12", borderRadius: 8, padding: 8, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}>
              {available.length === 0
                ? <div style={{ padding: "12px 16px", fontSize: 12, color: "#3a2f1e" }}>All characters in scene</div>
                : available.map(c => (
                  <div key={c.id} onClick={() => addToScene(c)}
                    style={{ padding: "8px 12px", fontSize: 14, cursor: "pointer", color: c.character_groups?.link_color || "#c4a87a", borderRadius: 4, display: "flex", alignItems: "center", gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = "#2a1f12"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.character_groups?.link_color || "#6b4c10", flexShrink: 0 }} />
                    {c.name}
                    <span style={{ fontSize: 10, color: "#3a2f1e", marginLeft: "auto" }}>{c.character_groups?.name}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>

      {/* BODY — tree + content */}
      <div style={{ display: "flex", height: "calc(100vh - 264px)", overflow: "hidden" }}>

        {/* TREE NAV */}
        <div style={{ width: 260, flexShrink: 0, borderRight: "1px solid #1a1410", overflowY: "auto", padding: "16px 8px" }}>
          {TOP_SECTIONS.map(s => (
            <div key={s}>
              <div onClick={() => { toggle(s); selectSection(s) }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 8px", cursor: "pointer", borderRadius: 4, background: selectedSection === s && !selectedCharId ? "#1a1410" : "transparent" }}
                onMouseEnter={e => e.currentTarget.style.background = "#1a1410"}
                onMouseLeave={e => e.currentTarget.style.background = selectedSection === s && !selectedCharId ? "#1a1410" : "transparent"}
              >
                <span style={{ fontSize: 9, color: "#3a2f1e", width: 10 }}>{s === "Characters" ? (expanded[s] ? "▼" : "►") : "►"}</span>
                <span style={{ fontSize: 14, color: "#c4a87a", fontWeight: 500, letterSpacing: "0.04em" }}>{s}</span>
              </div>

              {s === "Characters" && expanded["Characters"] && (
                <div>
                  {topGroups.map(g => <GroupNode key={g.id} group={g} depth={0} />)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CONTENT PANEL */}
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 48px" }}>

          {/* Welcome */}
          {!selectedCharId && !selectedSection && (
            <div style={{ color: "#3a2f1e", fontSize: 14, fontStyle: "italic", marginTop: 40, textAlign: "center" }}>
              Select a section from the codex.
            </div>
          )}

          {/* Section placeholder */}
          {selectedSection && selectedSection !== "Characters" && !selectedCharId && (
            <div style={{ color: "#3a2f1e", fontSize: 14, fontStyle: "italic", marginTop: 40, textAlign: "center" }}>
              {selectedSection} — coming soon
            </div>
          )}

          {/* Characters welcome */}
          {selectedSection === "Characters" && !selectedCharId && (
            <div style={{ color: "#3a2f1e", fontSize: 14, fontStyle: "italic", marginTop: 40, textAlign: "center" }}>
              Select a character from the tree.
            </div>
          )}

          {/* CHARACTER CODEX */}
          {selectedCharId && selectedChar && (() => {
            const e = selectedChar.character_erotic?.[0] || {}
            const combat = selectedChar.character_combat?.[0] || {}
            const color = selectedChar.character_groups?.link_color || "#c4a87a"
            return (
              <div style={{ display: "flex", gap: 48 }}>
                <div style={{ flexShrink: 0, width: 200, position: "sticky", top: 0, alignSelf: "flex-start" }}>
                  {selectedChar.portrait_url
                    ? <img src={selectedChar.portrait_url} alt={selectedChar.name} style={{ width: 200, borderRadius: 10, border: "1px solid " + color + "33", display: "block" }} />
                    : <PortraitPlaceholder name={selectedChar.name} color={color} width={200} height={280} />
                  }
                  <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {selectedChar.height && <Badge style={{ background: color + "22", color, border: "0.5px solid " + color + "44" }}>{selectedChar.height}</Badge>}
                    {selectedChar.age && <Badge style={{ background: color + "22", color, border: "0.5px solid " + color + "44" }}>{selectedChar.age}</Badge>}
                    {selectedChar.pronouns && <Badge style={{ background: color + "22", color, border: "0.5px solid " + color + "44" }}>{selectedChar.pronouns}</Badge>}
                    <Badge style={{ background: "#1a4a2a", color: "#4ade80", border: "0.5px solid #2d6a3a" }}>● {selectedChar.current_status}</Badge>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #1a1410" }}>
                    <div style={{ fontSize: 32, color, fontWeight: "normal" }}>{selectedChar.name}</div>
                    <div style={{ fontSize: 14, color: "#6b5a3e", marginTop: 4 }}>{selectedChar.occupation} · {selectedChar.character_groups?.name}</div>
                    {selectedChar.species && <div style={{ fontSize: 13, color: "#3a2f1e", marginTop: 4, fontStyle: "italic" }}>{selectedChar.species.split("(")[0].trim()}</div>}
                  </div>

                  <div style={{ display: "flex", marginBottom: 28, borderBottom: "1px solid #1a1410" }}>
                    {CHAR_TABS.map(t => (
                      <button key={t} onClick={() => setCharTab(t)} style={{ padding: "10px 24px", fontSize: 13, background: "transparent", border: "none", cursor: "pointer", color: charTab === t ? color : "#3a2f1e", borderBottom: charTab === t ? "2px solid " + color : "2px solid transparent", marginBottom: -1, fontFamily: "Georgia, serif", letterSpacing: "0.05em" }}>{t}</button>
                    ))}
                  </div>

                  {charTab === "Core" && <div>
                    <Field label="Species / Heritage" value={selectedChar.species} />
                    <Field label="Physical Appearance" value={selectedChar.physical_appearance} />
                    <Field label="Build" value={selectedChar.build} />
                    <Field label="Personality" value={selectedChar.personality} />
                    <Field label="Voice & Behavior" value={selectedChar.voice_notes} />
                    <Field label="Backstory" value={selectedChar.backstory_summary} />
                  </div>}

                  {charTab === "Erotic" && <div>
                    <Field label="Appearance Detail" value={e.appearance_detail} />
                    <Field label="Body Attributes" value={e.body_attributes} />
                    <Field label="Intimacy Behavior" value={e.intimacy_behavior} />
                    <Field label="Heat Notes" value={e.heat_notes} />
                    <Field label="Sensory Cues" value={e.sensory_cues} />
                  </div>}

                  {charTab === "Combat" && <div>
                    <Field label="Archetype" value={combat.archetype} />
                    <Field label="Fighting Style" value={combat.fighting_style} />
                    <Field label="Equipment" value={combat.equipment_notes} />
                    <Field label="Abilities" value={combat.abilities || "Not yet defined"} />
                    <Field label="Spells" value={combat.spells || "Not yet defined"} />
                  </div>}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}