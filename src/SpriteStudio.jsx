import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { supabase, STORY_ID } from "./constants.js";

const WORLD_ID       = "96f993ca-19eb-4698-b0f7-e8ee94d7e8fc";
const STORAGE_BUCKET = "Wescrafter Images";

const NEGATIVE_PROMPT = "bad anatomy, blurry, low quality, deformed eyes, extra limbs, bad hands, ugly, poorly drawn face, malformed, mutated, extra fingers, fused fingers, too many fingers, long neck, bad proportions, monochrome, greyscale, sketch, lineart, black and white";

const EXPLICIT_TAGS = "nsfw, rating:explicit, uncensored, nipples, pubic hair";
const QUALITY_TAGS  = "game cg, visual novel, highly detailed, soft lighting, white background, simple background";

const CLIP_TYPES = ["idle", "combat", "intimate", "background"];

const FRAMING_OPTIONS = {
  "— Pipeline —":  null,
  "Face Seed":  { slug: "face-seed",  tags: "face focus, close-up portrait",           model: "Curated 4.5", canvas: "512×640",  method: "Text to Image · run multiple seeds · save best seed number" },
  "Body Seed":  { slug: "body-seed",  tags: "full body, standing, arms at sides, facing viewer", model: "Base 4.5", canvas: "512×640", method: "Precise Reference from face master · Strength 1 · Fidelity 1" },
  "— Framing —":   null,
  "Portrait":   { slug: "portrait",   tags: "upper body, simple background",           model: "Curated 4.5", canvas: "512×640",  method: "Precise Reference from body seed · Strength 1 · Fidelity 1" },
  "Cowboy Shot":{ slug: "cowboy",     tags: "cowboy shot",                             model: "Base 4.5",    canvas: "512×640",  method: "Precise Reference from body seed · Strength 1 · Fidelity 1" },
  "Full Body":  { slug: "full-body",  tags: "full body",                               model: "Base 4.5",    canvas: "512×640",  method: "Precise Reference from body seed · Strength 1 · Fidelity 1" },
  "— Background —":null,
  "Background": { slug: "bg",         tags: "atmospheric background, no humans",       model: "Curated 4.5", canvas: "1216×832", method: "Text to Image" },
};

const BODY_POSE_OPTIONS = {
  "":              { slug: "",                tags: "" },
  "arms at sides": { slug: "arms-at-sides",  tags: "standing, arms at sides, facing viewer" },
  "arms crossed":  { slug: "arms-crossed",   tags: "arms crossed, standing, looking at viewer" },
  "arms raised":   { slug: "arms-raised",    tags: "arms raised, standing" },
  "hands on hips": { slug: "hands-on-hips",  tags: "hand on hip, standing" },
  "leaning":       { slug: "leaning",        tags: "leaning, standing" },
  "kneeling":      { slug: "kneeling",       tags: "kneeling, submissive pose" },
};

const PRESET_GROUPS = ["Reference", "Portraits", "NSFW", "SFW"];
const PRESETS = [
  { group: "Reference", label: "portrait_reference",               framing: "Portrait",    pose: "",              expression: "neutral" },
  { group: "Reference", label: "body_reference",                   framing: "Cowboy Shot", pose: "",              expression: "neutral" },
  { group: "Portraits", label: "Portrait / smile",                 framing: "Portrait",    pose: "",              expression: "smile" },
  { group: "Portraits", label: "Portrait / smirk",                 framing: "Portrait",    pose: "",              expression: "smirk" },
  { group: "Portraits", label: "Portrait / seductive",             framing: "Portrait",    pose: "",              expression: "seductive" },
  { group: "NSFW",      label: "Full Body / kneeling / submissive",framing: "Full Body",   pose: "kneeling",      expression: "submissive" },
  { group: "NSFW",      label: "Full Body / kneeling / blush",     framing: "Full Body",   pose: "kneeling",      expression: "blush" },
  { group: "NSFW",      label: "Cowboy / arms crossed / smirk",    framing: "Cowboy Shot", pose: "arms crossed",  expression: "smirk" },
  { group: "NSFW",      label: "Cowboy / arms at sides / neutral", framing: "Cowboy Shot", pose: "arms at sides", expression: "neutral" },
  { group: "NSFW",      label: "Cowboy / hands on hips / seductive",framing: "Cowboy Shot",pose: "hands on hips", expression: "seductive" },
  { group: "NSFW",      label: "Cowboy / arms raised / flustered", framing: "Cowboy Shot", pose: "arms raised",   expression: "flustered" },
  { group: "NSFW",      label: "Cowboy / leaning / smile",         framing: "Cowboy Shot", pose: "leaning",       expression: "smile" },
  { group: "SFW",       label: "Full Body / kneeling / neutral",   framing: "Full Body",   pose: "kneeling",      expression: "neutral" },
  { group: "SFW",       label: "Cowboy / arms crossed / smirk",    framing: "Cowboy Shot", pose: "arms crossed",  expression: "smirk" },
  { group: "SFW",       label: "Cowboy / arms at sides / neutral", framing: "Cowboy Shot", pose: "arms at sides", expression: "neutral" },
  { group: "SFW",       label: "Cowboy / hands on hips / seductive",framing: "Cowboy Shot",pose: "hands on hips", expression: "seductive" },
  { group: "SFW",       label: "Cowboy / arms raised / flustered", framing: "Cowboy Shot", pose: "arms raised",   expression: "flustered" },
  { group: "SFW",       label: "Cowboy / leaning / smile",         framing: "Cowboy Shot", pose: "leaning",       expression: "smile" },
];

const CSS = `
  :root {
    --bg:#0f0d0b; --bg2:#1a1612; --bg3:#16130f; --bg4:#25201a;
    --border:#2e2820; --border2:#3a3028;
    --gold:#c9a86c; --gold2:#a8884c;
    --text:#ffffff; --text3:#cccccc; --text4:#aaaaaa;
    --rose:#c084a0; --rose-bg:#2a1020; --rose-border:#6a3040;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { background: var(--bg); font-family: sans-serif; color: var(--text); }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg2); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
`;

const taBtn = {
  background: "none", border: "1px solid var(--border2)", borderRadius: 4,
  cursor: "pointer", padding: "4px 12px", fontSize: 11, fontFamily: "sans-serif", color: "var(--text3)",
};

const secLbl = {
  fontSize: 10, color: "var(--gold2)", fontFamily: "sans-serif",
  letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8,
};

const inpStyle = {
  width: "100%", background: "var(--bg4)", border: "1px solid var(--border2)",
  borderRadius: 4, color: "var(--text)", fontSize: 13, fontFamily: "sans-serif",
  padding: "7px 10px", outline: "none",
};

// ── CopyButton ────────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} style={{ ...taBtn, color: copied ? "var(--gold)" : "var(--text4)" }}>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ── ToggleGroup ───────────────────────────────────────────────────────────────
function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", border: "1px solid var(--border2)", borderRadius: 4, overflow: "hidden" }}>
      {options.map((opt, i) => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          ...taBtn, border: "none", borderRadius: 0,
          borderRight: i < options.length - 1 ? "1px solid var(--border2)" : "none",
          background: value === opt ? "var(--bg4)" : "none",
          color: value === opt ? "var(--gold)" : "var(--text4)",
          padding: "5px 14px",
        }}>{opt}</button>
      ))}
    </div>
  );
}

// ── NewCharModal ──────────────────────────────────────────────────────────────
function NewCharModal({ onClose, onCreate }) {
  const [name,       setName]       = useState("");
  const [appearance, setAppearance] = useState("");
  const [species,    setSpecies]    = useState("Human");
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");

  const save = async () => {
    if (!name.trim()) { setErr("Name is required."); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("characters")
      .insert({ name: name.trim(), physical_appearance: appearance.trim() || null, species: species.trim() || "Human", world_id: WORLD_ID })
      .select()
      .single();
    if (error) { setErr(error.message); setSaving(false); return; }
    onCreate(data);
  };

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
    >
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 8, padding: 24, width: 420, maxWidth: "95vw" }}>
        <div style={{ fontSize: 15, color: "var(--gold)", fontFamily: "Georgia, serif", marginBottom: 18 }}>New Character</div>
        {err && <div style={{ fontSize: 12, color: "#c07060", marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Name *</div>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus style={inpStyle} onKeyDown={e => e.key === "Enter" && save()} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Species</div>
            <input value={species} onChange={e => setSpecies(e.target.value)} style={inpStyle} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Physical Appearance</div>
            <textarea value={appearance} onChange={e => setAppearance(e.target.value)} rows={4}
              style={{ ...inpStyle, resize: "vertical", lineHeight: 1.6, fontFamily: "Georgia, serif" }} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={onClose} style={taBtn}>Cancel</button>
            <button onClick={save} disabled={saving}
              style={{ ...taBtn, color: "var(--gold)", borderColor: "var(--gold2)" }}>{saving ? "Saving…" : "Create"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── SpriteStudio ──────────────────────────────────────────────────────────────
export default function SpriteStudio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [characters,   setCharacters]   = useState([]);
  const [groupOrder,   setGroupOrder]   = useState([]);
  const [collapsed,    setCollapsed]    = useState(new Set());
  const [search,       setSearch]       = useState("");
  const [phase,        setPhase]        = useState("loading");

  const [selected,     setSelected]     = useState(null);
  const [erotic,       setErotic]       = useState(null);
  const [sprites,      setSprites]      = useState([]);
  const [charLoading,  setCharLoading]  = useState(false);

  const [mode,         setMode]         = useState("SFW");
  const [framing,      setFraming]      = useState("Face Seed");
  const [bodyPose,     setBodyPose]     = useState("");
  const [preset,       setPreset]       = useState("");
  const [bust,         setBust]         = useState("");
  const [expression,   setExpression]   = useState("");

  // wardrobe
  const [wardrobe,            setWardrobe]            = useState([]);
  const [selectedOutfit,      setSelectedOutfit]      = useState(null);
  const [selectedAccessories, setSelectedAccessories] = useState(new Set());

  // seed fields
  const [faceSeed,          setFaceSeed]          = useState("");
  const [bodySeed,          setBodySeed]           = useState("");
  const [seedSaving,        setSeedSaving]         = useState(false);

  // prompt overrides
  const [positiveOverride,  setPositiveOverride]   = useState("");
  const [negativeOverride,  setNegativeOverride]   = useState("");
  const [overrideSaving,    setOverrideSaving]     = useState(false);

  // prompt generation
  const [novelaiPrompt,    setNovElaiPrompt]    = useState("");
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  const [stories,           setStories]           = useState([]);
  const [selectedStory,     setSelectedStory]     = useState("all");
  const [charLinkedStories, setCharLinkedStories] = useState([]);
  const [linkingStory,      setLinkingStory]      = useState(false);

  const [dragOver,      setDragOver]      = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [uploadStatus,  setUploadStatus]  = useState("Uploading…");
  const [toast,         setToast]         = useState("");
  const [lightbox,    setLightbox]    = useState(null);
  const [showNewChar, setShowNewChar] = useState(false);

  const fileInputRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  // load stories + initial characters
  useEffect(() => {
    (async () => {
      const { data: storyList } = await supabase
        .from("stories")
        .select("id, title, world_id")
        .order("title");
      setStories(storyList || []);

      await loadCharacters("all");

      const charId = searchParams.get("character");
      if (charId) {
        const { data: chars } = await supabase
          .from("characters")
          .select("id, name, portrait_url, character_group, species, height_feet, height_inches, height_cm, physical_appearance, novelai_prompt, novelai_face_seed, novelai_body_seed, novelai_positive, novelai_negative")
          .eq("id", charId)
          .single();
        if (chars) await doSelectChar(chars);
      }

      setPhase("ready");
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCharacters = useCallback(async (storyId) => {
    const SELECT = "id, name, portrait_url, character_group, species, height_feet, height_inches, height_cm, physical_appearance, novelai_prompt, novelai_face_seed, novelai_body_seed, novelai_positive, novelai_negative";
    let query = supabase.from("characters").select(SELECT);

    if (storyId !== "all") {
      const { data: links } = await supabase
        .from("story_characters")
        .select("character_id")
        .eq("story_id", storyId);
      const ids = (links || []).map(l => l.character_id);
      if (ids.length === 0) { setCharacters([]); setGroupOrder([]); setCollapsed(new Set()); return; }
      query = query.in("id", ids);
    }

    const { data } = await query.order("name");
    const charList = data || [];
    setCharacters(charList);
    const groups = [...new Set(charList.map(c => c.character_group || "Ungrouped"))];
    setGroupOrder(groups);
    setCollapsed(new Set(groups));
  }, []);

  const doSelectChar = useCallback(async (char) => {
    setSelected(char);
    setErotic(null);
    setSprites([]);
    setCharLoading(true);
    setNovElaiPrompt(char.novelai_prompt || "");
    setFaceSeed(char.novelai_face_seed ? String(char.novelai_face_seed) : "");
    setBodySeed(char.novelai_body_seed ? String(char.novelai_body_seed) : "");
    setPositiveOverride(char.novelai_positive || "");
    setNegativeOverride(char.novelai_negative || "");
    setBust("");
    setExpression("");
    setPreset("");
    setSelectedOutfit(null);
    setSelectedAccessories(new Set());
    const [{ data: e }, { data: s }, { data: ls }, { data: ward }] = await Promise.all([
      supabase.from("character_erotic").select("appearance_detail, body_attributes").eq("character_id", char.id).single(),
      supabase.from("character_sprites").select("*").eq("character_id", char.id).order("is_default", { ascending: false }),
      supabase.from("story_characters").select("story_id, stories(title)").eq("character_id", char.id),
      supabase.from("items").select("id, name, prompt_shortcode, visual_description, novelai_description, is_accessory, containers!inner(character_id)").eq("containers.character_id", char.id).not("prompt_shortcode", "is", null),
    ]);
    setErotic(e || null);
    setSprites(s || []);
    setCharLinkedStories(ls || []);
    setWardrobe(ward || []);
    setCharLoading(false);
  }, []);

  const selectChar = useCallback(async (char) => {
    setSearchParams({ character: char.id });
    await doSelectChar(char);
  }, [doSelectChar, setSearchParams]);

  const reloadSprites = async (charId) => {
    const { data } = await supabase.from("character_sprites").select("*").eq("character_id", charId).order("is_default", { ascending: false });
    setSprites(data || []);
  };

  // ── Save seeds ──────────────────────────────────────────────────────────────
  const saveSeeds = async () => {
    if (!selected) return;
    setSeedSaving(true);
    await supabase.from("characters").update({
      novelai_face_seed: faceSeed ? parseInt(faceSeed) : null,
      novelai_body_seed: bodySeed ? parseInt(bodySeed) : null,
    }).eq("id", selected.id);
    setSeedSaving(false);
    showToast("Seeds saved");
  };

  // ── Save overrides ──────────────────────────────────────────────────────────
  const saveOverrides = async () => {
    if (!selected) return;
    setOverrideSaving(true);
    await supabase.from("characters").update({
      novelai_positive: positiveOverride || null,
      novelai_negative: negativeOverride || null,
    }).eq("id", selected.id);
    setSelected(prev => ({ ...prev, novelai_positive: positiveOverride || null, novelai_negative: negativeOverride || null }));
    setOverrideSaving(false);
    showToast("Overrides saved");
  };

  // ── Generate base prompt via AI ─────────────────────────────────────────────
  const generateBasePrompt = async () => {
    if (!selected) return;
    setGeneratingPrompt(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-sprite-prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ character_id: selected.id }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);
      const promptJson = JSON.stringify(result);
      await supabase.from("characters").update({ novelai_prompt: promptJson }).eq("id", selected.id);
      setNovElaiPrompt(promptJson);
      setSelected(prev => ({ ...prev, novelai_prompt: promptJson }));
      showToast("Prompt generated and saved");
    } catch (err) {
      showToast("Generation failed: " + err.message);
    }
    setGeneratingPrompt(false);
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleFiles = async (files) => {
    if (!selected || !files?.length) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) { showToast("File too large (max 10MB)"); return; }

    setUploading(true);
    try {
      const filename   = file.name;
      const isExplicit = mode === "Explicit";
      const clipMatch  = CLIP_TYPES.find(ct => new RegExp(`_${ct}[_.]`, "i").test(filename));
      const parsedClip = clipMatch || "idle";

      const dotIdx    = filename.lastIndexOf(".");
      const base      = dotIdx >= 0 ? filename.slice(0, dotIdx) : filename;
      const seedMatch = base.match(/s-(\d+)/i);

      // Background removal for images (skip WebM)
      const isWebM = /\.webm$/i.test(filename);
      let uploadFile = file;
      let ext = dotIdx >= 0 ? filename.slice(dotIdx) : ".png";
      if (!isWebM) {
        setUploadStatus("Removing background…");
        const form = new FormData();
        form.append("image_file", file);
        const bgRes = await fetch("/api/remove-bg", { method: "POST", body: form });
        if (!bgRes.ok) throw new Error(`Background removal failed (${bgRes.status})`);
        uploadFile = new File([await bgRes.blob()], base + ".png", { type: "image/png" });
        ext = ".png";
      }
      setUploadStatus("Uploading…");

      // Build filename from UI state: [char]_[framing]_[pose]_[expression]_[x]_s-[seed].ext
      const toSlug      = s => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const charSlug    = selected.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      const framingSlug = FRAMING_OPTIONS[framing]?.slug || toSlug(framing);
      const poseSlug    = BODY_POSE_OPTIONS[bodyPose]?.slug || "";
      const expSlug     = expression ? toSlug(expression) : "";
      const xSuffix     = isExplicit ? "_x" : "";
      const seedPart    = seedMatch ? `_s-${seedMatch[1]}` : "";
      const tokens      = [charSlug, framingSlug, poseSlug, expSlug].filter(Boolean);
      const cleanFilename = `${tokens.join("_")}${xSuffix}${seedPart}${ext}`;
      const path          = `${STORY_ID}/${charSlug}/${cleanFilename}`;

      const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, uploadFile, { upsert: true });
      if (upErr) {
        console.error("Storage upload error", { message: upErr.message, statusCode: upErr.statusCode, error: upErr });
        throw upErr;
      }

      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

      const isFirst = sprites.length === 0;
      await supabase.from("character_sprites").insert({
        character_id:    selected.id,
        portrait_url:    publicUrl,
        clip_type:       parsedClip,
        source_filename: filename,
        is_explicit:     isExplicit,
        is_default:      isFirst,
      });

      if (isFirst) {
        await supabase.from("characters").update({ portrait_url: publicUrl }).eq("id", selected.id);
        setSelected(prev => ({ ...prev, portrait_url: publicUrl }));
        setCharacters(prev => prev.map(c => c.id === selected.id ? { ...c, portrait_url: publicUrl } : c));
      }

      await reloadSprites(selected.id);
      showToast("Uploaded successfully");
    } catch (e) {
      showToast("Upload failed: " + e.message);
    }
    setUploading(false);
  };

  // ── Sprite management ───────────────────────────────────────────────────────
  const setDefaultSprite = async (sprite) => {
    await supabase.from("character_sprites").update({ is_default: false }).eq("character_id", selected.id);
    await supabase.from("character_sprites").update({ is_default: true }).eq("id", sprite.id);
    await supabase.from("characters").update({ portrait_url: sprite.portrait_url }).eq("id", selected.id);
    setSelected(prev => ({ ...prev, portrait_url: sprite.portrait_url }));
    setCharacters(prev => prev.map(c => c.id === selected.id ? { ...c, portrait_url: sprite.portrait_url } : c));
    setSprites(prev => prev.map(s => ({ ...s, is_default: s.id === sprite.id })));
  };

  const deleteSprite = async (sprite) => {
    if (!window.confirm("Delete this sprite?")) return;
    await supabase.from("character_sprites").delete().eq("id", sprite.id);
    if (sprite.is_default) {
      await supabase.from("characters").update({ portrait_url: null }).eq("id", selected.id);
      setSelected(prev => ({ ...prev, portrait_url: null }));
      setCharacters(prev => prev.map(c => c.id === selected.id ? { ...c, portrait_url: null } : c));
    }
    setSprites(prev => prev.filter(s => s.id !== sprite.id));
  };

  // ── Build assembled prompt ──────────────────────────────────────────────────
  const buildPrompt = () => {
    if (!selected) return "";

    let parsed = null;
    try { parsed = novelaiPrompt ? JSON.parse(novelaiPrompt) : null; } catch {}

    const framingData = FRAMING_OPTIONS[framing];
    const isExplicit  = mode === "Explicit";

    const parts = [];

    // 1. Preamble
    parts.push("best quality, masterpiece, year 2025");

    // 2. Identity
    if (parsed?.identity) parts.push(parsed.identity);
    else parts.push("1girl, solo");

    // 3. Physical DNA — strip breast size (controlled by bust dropdown), occupation tags, and deduplicate
    if (parsed?.physical) {
      const stripped = parsed.physical
        // weighted variants: (word breasts:1.2) or (word chest:1.3)
        .replace(/\(\s*(flat|soft|full|small|medium|large|huge|gigantic|massive|enormous)\s+(chest|breasts?|boobs?|tits?|bust)\s*:[0-9.]+\s*\)/gi, "")
        // plain variants: word breasts / word chest
        .replace(/\b(flat|soft|full|small|medium|large|huge|gigantic|massive|enormous)\s+(chest|breasts?|boobs?|tits?|bust)\b/gi, "")
        // cup sizes: A-cup, b cup, Dcup etc.
        .replace(/\(\s*[a-fA-F][-\s]?cup\s*:[0-9.]+\s*\)/gi, "")
        .replace(/\b[a-fA-F][-\s]?cup\b/gi, "")
        // occupation/role tags
        .replace(/\b(chef|cook|baker|scholar|researcher|scientist|doctor|nurse|teacher|professor|librarian|maid|butler|soldier|knight|guard|merchant|farmer|hunter|warrior|wizard|mage|witch|priestess?|nun|detective|officer|pilot|engineer|mechanic)\b/gi, "")
        // normalise commas
        .replace(/,\s*,+/g, ",").replace(/(^[\s,]+|[\s,]+$)/g, "").trim();
      // deduplicate comma-separated tokens
      const tokens = stripped.split(",").map(t => t.trim()).filter(Boolean);
      const seen = new Set();
      const deduped = tokens.filter(t => { const k = t.toLowerCase(); return seen.has(k) ? false : seen.add(k); });
      if (deduped.length) parts.push(deduped.join(", "));
    }

    // 3b. Bust size — deduplicate if tag already appeared in physical
    if (bust) {
      const allSoFar = parts.join(", ").toLowerCase();
      if (!allSoFar.includes(bust.toLowerCase())) parts.push(bust);
    }

    // 3c. Expression
    if (expression) parts.push(expression);

    // 3e. Positive override
    if (selected.novelai_positive) parts.push(selected.novelai_positive);

    // 4. Outfit prompt
    if (selectedOutfit) {
      const item = wardrobe.find(w => w.id === selectedOutfit);
      if (item) parts.push(item.novelai_description || item.name);
    }

    // 5. Accessories
    for (const id of selectedAccessories) {
      const item = wardrobe.find(w => w.id === id);
      if (item) parts.push(item.novelai_description || item.name);
    }

    // 6. Explicit body tags
    if (isExplicit && parsed?.explicit) {
      parts.push(parsed.explicit);
    }

    // 7. Framing + body pose tags
    const allPoseTags = [
      ...(framingData?.tags?.split(",").map(t => t.trim()) || []),
      ...(BODY_POSE_OPTIONS[bodyPose]?.tags?.split(",").map(t => t.trim()) || []),
    ].filter(Boolean);
    if (allPoseTags.length) {
      const existingTags = new Set(parts.join(", ").toLowerCase().split(",").map(t => t.trim()));
      const newTags = allPoseTags.filter(t => !existingTags.has(t.toLowerCase()));
      if (newTags.length) parts.push(newTags.join(", "));
    }

    // 8. Vibe — excluded from prompt (codex field, not a prompt tag)

    // 9. Quality postamble
    parts.push(QUALITY_TAGS);

    // 0. Prefix (unshifted to front)
    const slug           = selected.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const framingPfx     = framing.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const posePfx        = bodyPose.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const outfitItem     = wardrobe.find(w => w.id === selectedOutfit);
    const outfitSlug     = outfitItem?.prompt_shortcode || "";
    const explicitSuffix = isExplicit ? "_x" : "";
    const prefixParts    = [slug, framingPfx, posePfx, outfitSlug].filter(Boolean).join("_");
    const prefix         = `${prefixParts}${explicitSuffix}`;
    parts.unshift(prefix);

    return parts.filter(Boolean).join(", ");
  };

  const toggleCollapse = (grpName) => {
    setCollapsed(prev => {
      const n = new Set(prev);
      n.has(grpName) ? n.delete(grpName) : n.add(grpName);
      return n;
    });
  };

  const filteredChars = search.trim()
    ? characters.filter(c => c.name.toLowerCase().includes(search.toLowerCase().trim()))
    : characters;

  const groupMap = filteredChars.reduce((acc, c) => {
    const g = c.character_group || "Ungrouped";
    if (!acc[g]) acc[g] = [];
    acc[g].push(c);
    return acc;
  }, {});

  const visibleGroups = search.trim()
    ? Object.keys(groupMap)
    : groupOrder.filter(g => groupMap[g]?.length);

  const prompt      = buildPrompt();
  const framingData = FRAMING_OPTIONS[framing];
  const negPrompt  = selected?.novelai_negative
    ? `${NEGATIVE_PROMPT}, ${selected.novelai_negative}`
    : NEGATIVE_PROMPT;

  return (
    <>
      <style>{CSS}</style>
      <div style={{ height: "100vh", background: "var(--bg)", color: "var(--text)", display: "flex", flexDirection: "column" }}>

        {/* nav */}
        <div style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)", padding: "0 16px", height: 48, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <Link to="/codex" style={{ fontSize: 12, color: "var(--text3)", textDecoration: "none", letterSpacing: "0.04em" }}>← Codex</Link>
          <div style={{ width: 1, height: 22, background: "var(--border)" }} />
          <span style={{ fontSize: 15, color: "var(--gold)", fontFamily: "Georgia, serif" }}>Sprite Studio</span>
        </div>

        {/* body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── left column — character selector ── */}
          <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--bg2)", borderRight: "1px solid var(--border)", overflow: "hidden" }}>

            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <select
                value={selectedStory}
                onChange={e => {
                  const v = e.target.value;
                  setSelectedStory(v);
                  loadCharacters(v);
                  setSelected(null);
                  setCharLinkedStories([]);
                }}
                style={{ width: "100%", background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: 4, color: "var(--gold)", fontSize: 12, fontFamily: "sans-serif", padding: "5px 9px", outline: "none", cursor: "pointer" }}
              >
                <option value="all">— All Characters —</option>
                {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>

            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search characters…"
                style={{ width: "100%", background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: 4, color: "var(--text)", fontSize: 12, fontFamily: "sans-serif", padding: "5px 9px", outline: "none" }}
              />
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {phase === "loading" && <div style={{ padding: 16, fontSize: 12, color: "var(--text4)" }}>Loading…</div>}
              {visibleGroups.map(grpName => {
                const isOpen = !collapsed.has(grpName);
                const chars  = groupMap[grpName] || [];
                return (
                  <div key={grpName}>
                    <div
                      onClick={() => toggleCollapse(grpName)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px 5px", cursor: "pointer", userSelect: "none" }}
                    >
                      <span style={{ fontSize: 8, color: "var(--text4)" }}>{isOpen ? "▾" : "▸"}</span>
                      <span style={{ fontSize: 10, color: "var(--text4)", letterSpacing: "0.1em", textTransform: "uppercase", flex: 1 }}>{grpName}</span>
                      <span style={{ fontSize: 9, color: "var(--text4)" }}>{chars.length}</span>
                    </div>
                    {isOpen && chars.map(c => {
                      const isActive = selected?.id === c.id;
                      return (
                        <div key={c.id}
                          onClick={() => selectChar(c)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", cursor: "pointer", background: isActive ? "var(--bg4)" : "transparent", fontSize: 13 }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg3)"; }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                        >
                          {c.portrait_url
                            ? <img src={c.portrait_url} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--border2)", flexShrink: 0 }} />
                            : <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--bg4)", border: "1.5px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--text4)", fontWeight: "bold", flexShrink: 0 }}>{c.name[0]}</div>
                          }
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                          {c.novelai_prompt && <span style={{ fontSize: 8, color: "var(--gold2)" }}>●</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div style={{ padding: 12, flexShrink: 0, borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => setShowNewChar(true)}
                style={{ width: "100%", background: "none", border: "1px solid var(--border2)", borderRadius: 4, color: "var(--gold)", fontSize: 12, fontFamily: "sans-serif", padding: "6px 10px", cursor: "pointer", letterSpacing: "0.05em" }}
              >+ New Character</button>
            </div>
          </div>

          {/* ── right column ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px" }}>
            {!selected ? (
              <div style={{ color: "var(--text4)", fontStyle: "italic", fontSize: 13, fontFamily: "sans-serif", padding: "20px 0" }}>Select a character to begin.</div>
            ) : charLoading ? (
              <div style={{ color: "var(--text4)", fontSize: 13, fontFamily: "sans-serif", padding: "20px 0" }}>Loading…</div>
            ) : (
              <>
                {/* character header */}
                <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 24, color: "var(--gold)", fontFamily: "Georgia, serif" }}>{selected.name}</div>
                </div>

                {/* ── Seeds ── */}
                <div style={{ marginBottom: 28 }}>
                  <div style={secLbl}>Reference Seeds</div>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 10, color: "var(--text4)", fontFamily: "sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Face Seed</div>
                      <input
                        value={faceSeed}
                        onChange={e => setFaceSeed(e.target.value)}
                        placeholder="e.g. 3734540117"
                        style={{ ...inpStyle, fontSize: 12, fontFamily: "monospace" }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 10, color: "var(--text4)", fontFamily: "sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Body Seed</div>
                      <input
                        value={bodySeed}
                        onChange={e => setBodySeed(e.target.value)}
                        placeholder="e.g. 3334344071"
                        style={{ ...inpStyle, fontSize: 12, fontFamily: "monospace" }}
                      />
                    </div>
                    <button
                      onClick={saveSeeds}
                      disabled={seedSaving}
                      style={{ ...taBtn, color: "var(--gold)", borderColor: "var(--gold2)", padding: "7px 16px", marginBottom: 1 }}
                    >{seedSaving ? "Saving…" : "Save Seeds"}</button>
                  </div>
                </div>

                {/* ── Prompt Builder ── */}
                <div style={{ marginBottom: 32 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={secLbl}>Prompt Builder</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {novelaiPrompt
                        ? <span style={{ fontSize: 10, color: "var(--gold2)", fontFamily: "sans-serif" }}>● base prompt saved</span>
                        : <span style={{ fontSize: 10, color: "var(--text4)", fontFamily: "sans-serif" }}>○ no base prompt</span>
                      }
                      <button
                        onClick={generateBasePrompt}
                        disabled={generatingPrompt || (!selected.physical_appearance && !erotic)}
                        style={{ ...taBtn, color: "var(--gold)", borderColor: "var(--gold2)", padding: "4px 14px" }}
                      >{generatingPrompt ? "Generating…" : novelaiPrompt ? "Regenerate" : "Generate Base Prompt"}</button>
                    </div>
                  </div>

                  {/* Controls row */}
                  {(() => {
                    const outfitItems    = wardrobe.filter(w => !w.is_accessory && w.prompt_shortcode !== "nude");
                    const accessoryItems = wardrobe.filter(w => w.is_accessory === true);
                    const accCount       = selectedAccessories.size;
                    const selStyle = (active) => ({ background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: 4, color: active ? "var(--text3)" : "var(--text4)", fontSize: 12, fontFamily: "sans-serif", padding: "6px 10px", cursor: "pointer", outline: "none" });
                    const lbl = (text) => <div style={{ fontSize: 10, color: "var(--text4)", fontFamily: "sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{text}</div>;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>

                        {/* Row 1: Mode + Preset */}
                        <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
                          <div>
                            {lbl("Mode")}
                            <ToggleGroup options={["SFW", "Explicit"]} value={mode} onChange={setMode} />
                          </div>
                          <div>
                            {lbl("Preset")}
                            <select
                              value={preset}
                              onChange={e => {
                                const p = PRESETS.find(p => p.label === e.target.value);
                                if (!p) { setPreset(""); return; }
                                setPreset(p.label);
                                setFraming(p.framing);
                                setBodyPose(p.pose);
                                setExpression(p.expression);
                              }}
                              style={{ ...selStyle(!!preset), minWidth: 220 }}
                            >
                              <option value="">— pick preset —</option>
                              {PRESET_GROUPS.map(grp => (
                                <optgroup key={grp} label={grp}>
                                  {PRESETS.filter(p => p.group === grp).map(p => (
                                    <option key={p.label} value={p.label}>{p.label}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Row 2: Framing + rest */}
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>

                        {/* Framing */}
                        <div>
                          {lbl("Framing")}
                          <select
                            value={framing}
                            onChange={e => { setFraming(e.target.value); setPreset(""); }}
                            style={{ ...selStyle(true), minWidth: 140 }}
                          >
                            {Object.entries(FRAMING_OPTIONS).map(([key, val]) =>
                              val === null
                                ? <option key={key} disabled>{key}</option>
                                : <option key={key} value={key}>{key}</option>
                            )}
                          </select>
                        </div>

                        {/* Pose */}
                        <div>
                          {lbl("Pose")}
                          <select
                            value={bodyPose}
                            onChange={e => { setBodyPose(e.target.value); setPreset(""); }}
                            style={selStyle(!!bodyPose)}
                          >
                            {Object.keys(BODY_POSE_OPTIONS).map(key => (
                              <option key={key} value={key}>{key || "(none)"}</option>
                            ))}
                          </select>
                        </div>

                        {/* Bust */}
                        <div>
                          {lbl("Bust")}
                          <select
                            value={bust}
                            onChange={e => setBust(e.target.value)}
                            style={selStyle(!!bust)}
                          >
                            <option value="">(omit)</option>
                            <option value="flat chest">flat chest</option>
                            <option value="small breasts">small breasts</option>
                            <option value="medium breasts">medium breasts</option>
                            <option value="large breasts">large breasts</option>
                          </select>
                        </div>

                        {/* Expression */}
                        <div>
                          {lbl("Expression")}
                          <select
                            value={expression}
                            onChange={e => { setExpression(e.target.value); setPreset(""); }}
                            style={selStyle(!!expression)}
                          >
                            <option value="">(omit)</option>
                            <option value="neutral">neutral</option>
                            <option value="smile">smile</option>
                            <option value="smirk">smirk</option>
                            <option value="blush">blush</option>
                            <option value="flustered">flustered</option>
                            <option value="shy">shy</option>
                            <option value="surprised">surprised</option>
                            <option value="sad">sad</option>
                            <option value="angry">angry</option>
                            <option value="playful">playful</option>
                            <option value="seductive">seductive</option>
                            <option value="submissive">submissive</option>
                            <option value="ahegao">ahegao</option>
                            <option value="open mouth">open mouth</option>
                            <option value="wink">wink</option>
                            <option value=":3">:3</option>
                          </select>
                        </div>

                        {/* Outfit */}
                        {outfitItems.length > 0 && (
                          <div>
                            {lbl("Outfit")}
                            <select
                              value={selectedOutfit || ""}
                              onChange={e => setSelectedOutfit(e.target.value || null)}
                              style={{ ...selStyle(!!selectedOutfit), minWidth: 160 }}
                            >
                              <option value="">— No outfit —</option>
                              {outfitItems.map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Accessories */}
                        {accessoryItems.length > 0 && (
                          <div>
                            {lbl(<>Accessories {accCount > 0 && <span style={{ color: "var(--gold2)" }}>({accCount})</span>}</>)}
                            <details style={{ position: "relative" }}>
                              <summary style={{ ...taBtn, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", listStyle: "none", cursor: "pointer", userSelect: "none" }}>
                                {accCount === 0 ? "None selected" : `${accCount} selected`} <span style={{ fontSize: 9 }}>▾</span>
                              </summary>
                              <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "8px 0", minWidth: 200, marginTop: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                                {accessoryItems.map(item => (
                                  <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontFamily: "sans-serif", color: selectedAccessories.has(item.id) ? "var(--text)" : "var(--text3)" }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedAccessories.has(item.id)}
                                      onChange={() => setSelectedAccessories(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; })}
                                      style={{ accentColor: "var(--gold)", flexShrink: 0 }}
                                    />
                                    {item.name}
                                  </label>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}

                        </div>{/* end row 2 */}
                      </div>
                    );
                  })()}

                  {/* Positive / Negative overrides */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: "var(--text4)", fontFamily: "sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Positive Override</div>
                        <textarea
                          value={positiveOverride}
                          onChange={e => setPositiveOverride(e.target.value)}
                          rows={2}
                          style={{ ...inpStyle, resize: "vertical", lineHeight: 1.6, fontFamily: "sans-serif" }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: "var(--text4)", fontFamily: "sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Negative Override</div>
                        <textarea
                          value={negativeOverride}
                          onChange={e => setNegativeOverride(e.target.value)}
                          rows={2}
                          style={{ ...inpStyle, resize: "vertical", lineHeight: 1.6, fontFamily: "sans-serif" }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={saveOverrides}
                        disabled={overrideSaving}
                        style={{ ...taBtn, color: "var(--gold)", borderColor: "var(--gold2)", padding: "7px 16px" }}
                      >{overrideSaving ? "Saving…" : "Save Overrides"}</button>
                    </div>
                  </div>

                  {/* Generation notes */}
                  {framingData && (
                    <div style={{ marginBottom: 14, padding: "8px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, color: "var(--text4)", fontFamily: "sans-serif", lineHeight: 1.8 }}>
                      <span style={{ color: "var(--gold2)" }}>⚙</span>
                      {" "}Model: <span style={{ color: "var(--text3)" }}>{framingData.model}</span>
                      {" · "}Canvas: <span style={{ color: "var(--text3)" }}>{framingData.canvas}</span>
                      {" · "}<span style={{ color: "var(--text3)" }}>{framingData.method}</span>
                      {framing === "Face Seed" && faceSeed && (
                        <span> · Face seed: <span style={{ color: "var(--gold)", fontFamily: "monospace" }}>{faceSeed}</span></span>
                      )}
                      {framing !== "Face Seed" && framing !== "Body Seed" && bodySeed && (
                        <span> · Body seed: <span style={{ color: "var(--gold)", fontFamily: "monospace" }}>{bodySeed}</span></span>
                      )}
                    </div>
                  )}

                  {/* Assembled prompt */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                      <div style={{ fontSize: 10, color: "var(--text4)", fontFamily: "sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>Assembled Prompt</div>
                      <CopyButton text={prompt} />
                    </div>
                    <textarea readOnly value={prompt} rows={5} style={{ width: "100%", background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 4, color: "var(--text3)", fontSize: 12, fontFamily: "sans-serif", lineHeight: 1.6, padding: "8px 10px", resize: "vertical", outline: "none" }} />
                  </div>

                  {/* Negative prompt */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                      <div style={{ fontSize: 10, color: "var(--text4)", fontFamily: "sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>Negative Prompt</div>
                      <CopyButton text={negPrompt} />
                    </div>
                    <textarea readOnly value={negPrompt} rows={2} style={{ width: "100%", background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 4, color: "var(--text3)", fontSize: 12, fontFamily: "sans-serif", lineHeight: 1.6, padding: "8px 10px", resize: "vertical", outline: "none" }} />
                  </div>

                </div>

                {/* upload zone */}
                <div style={{ marginBottom: 28 }}>
                  <div style={secLbl}>Upload</div>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragOver ? "var(--gold)" : "var(--border2)"}`,
                      borderRadius: 8, padding: 32, textAlign: "center",
                      cursor: uploading ? "default" : "pointer",
                      background: dragOver ? "var(--bg4)" : "var(--bg3)",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 13, color: "var(--text4)", fontFamily: "sans-serif", marginBottom: 6 }}>
                      {uploading ? uploadStatus : "Drop PNG, WebM, or APNG here"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text4)", fontFamily: "sans-serif" }}>or click to browse · max 10MB</div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.webm,.apng,image/png,video/webm,image/apng"
                      style={{ display: "none" }}
                      onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = ""; }}
                    />
                  </div>
                </div>

                {/* existing sprites */}
                <div style={{ marginBottom: 28 }}>
                  <div style={secLbl}>Sprites ({sprites.length})</div>
                  {sprites.length === 0 ? (
                    <div style={{ color: "var(--text4)", fontStyle: "italic", fontSize: 13, fontFamily: "sans-serif", padding: "12px 0" }}>
                      No sprites yet — generate in NovelAI and drop them above
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 12 }}>
                      {sprites.map(sp => (
                        <div key={sp.id} style={{ background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 6, overflow: "hidden" }}>
                          <div
                            onClick={() => sp.portrait_url && setLightbox(sp.portrait_url)}
                            style={{ cursor: sp.portrait_url ? "pointer" : "default", background: "var(--bg3)", aspectRatio: "1 / 1", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            {sp.portrait_url
                              ? <img src={sp.portrait_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div style={{ fontSize: 11, color: "var(--text4)", fontFamily: "sans-serif" }}>No image</div>
                            }
                          </div>
                          <div style={{ padding: "8px 10px" }}>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 7 }}>
                              {sp.clip_type   && <span style={{ fontSize: 9, fontFamily: "sans-serif", letterSpacing: "0.07em", textTransform: "uppercase", background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: 3, color: "var(--text4)", padding: "1px 5px" }}>{sp.clip_type}</span>}
                              {sp.mood_tag    && <span style={{ fontSize: 9, fontFamily: "sans-serif", letterSpacing: "0.07em", textTransform: "uppercase", background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: 3, color: "var(--text4)", padding: "1px 5px" }}>{sp.mood_tag}</span>}
                              {sp.is_default  && <span style={{ fontSize: 9, fontFamily: "sans-serif", letterSpacing: "0.07em", textTransform: "uppercase", background: "#2a2010", border: "1px solid var(--gold2)", borderRadius: 3, color: "var(--gold)", padding: "1px 5px" }}>default</span>}
                              {sp.is_explicit && <span style={{ fontSize: 9, fontFamily: "sans-serif", letterSpacing: "0.07em", textTransform: "uppercase", background: "var(--rose-bg)", border: "1px solid var(--rose-border)", borderRadius: 3, color: "var(--rose)", padding: "1px 5px" }}>explicit</span>}
                            </div>
                            <div style={{ display: "flex", gap: 5 }}>
                              {!sp.is_default && (
                                <button onClick={() => setDefaultSprite(sp)} style={{ ...taBtn, fontSize: 10, padding: "2px 8px" }}>Set Default</button>
                              )}
                              <button onClick={() => deleteSprite(sp)} style={{ ...taBtn, fontSize: 10, padding: "2px 8px", color: "#c07060", borderColor: "#3a2020" }}>Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* toast */}
        {toast && (
          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: 6, padding: "10px 20px", fontSize: 13, fontFamily: "sans-serif", color: "var(--text)", zIndex: 1000, pointerEvents: "none" }}>
            {toast}
          </div>
        )}

        {/* lightbox */}
        {lightbox && (
          <div
            onClick={() => setLightbox(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, cursor: "pointer" }}
          >
            <img src={lightbox} alt="sprite" style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 6 }} />
          </div>
        )}

        {/* new character modal */}
        {showNewChar && (
          <NewCharModal
            onClose={() => setShowNewChar(false)}
            onCreate={async (char) => {
              const grp = char.character_group || "Ungrouped";
              setCharacters(prev => [...prev, char].sort((a, b) => a.name.localeCompare(b.name)));
              setGroupOrder(prev => prev.includes(grp) ? prev : [...prev, grp]);
              setShowNewChar(false);
              await selectChar(char);
            }}
          />
        )}
      </div>
    </>
  );
}
