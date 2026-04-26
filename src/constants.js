import { supabase } from "./supabase.js";
export { supabase };

export const STORY_ID = "ca821271-2bca-4b3c-bdf7-7224e0b4e8b3";
export const WORLD_ID = "96f993ca-19eb-4698-b0f7-e8ee94d7e8fc";

export const TIMES = ["Dawn","Morning","Noon","Afternoon","Evening","Night","Midnight"];
export const WEATHERS = ["Clear","Cloudy","Rain","Storm","Snow","Fog"];
export const SEASONS = ["Spring","Summer","Autumn","Winter"];
export const MODES = [
  { key:"narrative", label:"Narrative", color:"#7a6e62" },
  { key:"intimate",  label:"Intimate",  color:"#D4537E" },
  { key:"combat",    label:"Combat",    color:"#cc2200" },
];

export const CSS = `
  :root {
    --bg:#0f0d0b; --bg2:#1a1612; --bg3:#16130f; --bg4:#25201a;
    --border:#2e2820; --border2:#3a3028;
    --gold:#c9a86c; --gold2:#a8884c;
    --text:#ffffff; --text2:#ffffff; --text3:#cccccc; --text4:#aaaaaa;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { background: var(--bg); font-family: Georgia, serif; color: var(--text); text-align: left; }
  select { appearance: none; }
  select:focus, button:focus, textarea:focus { outline: 2px solid var(--gold2); outline-offset: 1px; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg2); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse-amber { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  .spin { display:inline-block; width:11px; height:11px; border:2px solid rgba(201,168,108,0.25); border-top-color:#c9a86c; border-radius:50%; animation:spin 0.7s linear infinite; vertical-align:middle; }
  select optgroup { color:#c9a86c; font-size:10px; font-family:sans-serif; letter-spacing:0.08em; font-style:normal; }
  select option { color:#ffffff; font-family:sans-serif; font-size:12px; }
`;

export const selFull = {
  width:"100%", background:"#ffffff", color:"#1a2a3a",
  border:"1px solid rgba(0,0,0,0.18)", borderRadius:4,
  padding:"5px 24px 5px 8px", fontSize:12, fontFamily:"sans-serif", cursor:"pointer",
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23888888'/%3E%3C/svg%3E")`,
  backgroundRepeat:"no-repeat", backgroundPosition:"right 7px center",
};
export const panelLbl = {
  fontSize:10, color:"#888", fontFamily:"sans-serif",
  letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:5, display:"block",
};
export const fullBtn = {
  width:"100%", textAlign:"left", background:"#ffffff", color:"#1a2a3a",
  border:"1px solid rgba(0,0,0,0.18)", borderRadius:4, padding:"5px 8px",
  fontSize:12, fontFamily:"sans-serif", cursor:"pointer", display:"flex",
  alignItems:"center", justifyContent:"space-between", gap:4,
};
export const dropBase = {
  position:"absolute", top:"calc(100% + 3px)", left:0, right:0, zIndex:50,
  background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:6,
  boxShadow:"0 4px 20px #00000070", overflow:"hidden",
};
export const dropItem = {
  padding:"7px 10px", fontSize:12, cursor:"pointer",
  color:"var(--text)", fontFamily:"sans-serif",
};

export const fetchChapters = async () => {
  const { data } = await supabase
    .from("chapters").select("id, sequence_number, title, chapter_plan")
    .eq("story_id", STORY_ID).order("sequence_number", { ascending: true });
  return data || [];
};
export const fetchScenes = async (chapterId) => {
  const { data } = await supabase
    .from("scenes").select("id, sequence_number, title, mood")
    .eq("chapter_id", chapterId).order("sequence_number", { ascending: true });
  return data || [];
};
export const fetchBeats = async (sceneId) => {
  const { data } = await supabase
    .from("beats").select("id, sequence_number, type, directive, emotional_register, tags, prose_text, snap_location_id, snap_time_of_day, snap_scene_mode, snap_active_character_ids, snap_pov_character_id, snap_weather, snap_season, snap_outfit_tags")
    .eq("scene_id", sceneId).order("sequence_number", { ascending: true });
  return data || [];
};
export const fetchCharacters = async () => {
  const { data } = await supabase
    .from("characters").select("id, name, aliases, portrait_url, character_group, character_groups(link_color)").order("name");
  return (data || []).map(c => ({ ...c, link_color: c.character_groups?.link_color || "#7a6e62" }));
};
export const fetchGroups = async () => {
  const { data } = await supabase
    .from("character_groups").select("id, name, sort_order").order("sort_order");
  return data || [];
};
export const fetchPlaces = async () => {
  const { data } = await supabase.from("places").select("id, name, place_type, parent_id").eq("world_id", WORLD_ID).order("name");
  return data || [];
};
