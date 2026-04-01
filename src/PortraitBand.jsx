export default function PortraitBand({ sceneChars, charPositions, setCharPositions, selectedCharId, setSelectedCharId, povCharacterId, setPovCharacterId, uncertainChars, removeChar, bandRef }) {
  return (
    <div ref={bandRef} style={{ height:240, flexShrink:0, borderBottom:"1px solid var(--border)", position:"relative", padding:0, margin:0, overflow:"hidden", backgroundImage:`url("https://gjvegoinppbpfusttycs.supabase.co/storage/v1/object/public/Wescrafter%20Images/safeharbor_bg_silver_anchor_evening.png")`, backgroundSize:"cover", backgroundPosition:"center", backgroundRepeat:"no-repeat" }}>
      {sceneChars.length === 0 ? (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text4)", fontStyle:"italic", fontSize:13, fontFamily:"sans-serif" }}>
          No characters in scene
        </div>
      ) : (
        sceneChars.map((c, idx) => {
          const color = c.link_color || "#7a6e62";
          const isPov = c.id === povCharacterId;
          const isUncertain = !!uncertainChars[c.id];
          let longPressTimer = null;
          const togglePov = () => setPovCharacterId(prev => prev === c.id ? null : c.id);
          const total = sceneChars.length;
          const defaultX = (idx / Math.max(total, 1)) * 80 + 10;
          const pos = charPositions[c.id] ?? { x: defaultX, y: 0, z: idx, scale: 1.0 };
          return (
            <div key={c.id} title={`${c.name}${isUncertain ? " · may have left" : ""} · right-click to set POV · double-click to remove`}
              onDoubleClick={() => removeChar(c.id)}
              onContextMenu={e => { e.preventDefault(); togglePov(); }}
              onTouchStart={() => { longPressTimer = setTimeout(togglePov, 500); }}
              onTouchEnd={() => clearTimeout(longPressTimer)}
              onTouchMove={() => clearTimeout(longPressTimer)}
              onMouseDown={e => {
                if (e.button !== 0) return;
                e.preventDefault();
                const startX = e.clientX;
                const startY = e.clientY;
                const startPos = charPositions[c.id] ?? { x: defaultX, y: 0, z: idx, scale: 1.0 };
                let moved = false;
                const band = bandRef.current;
                const rect = band.getBoundingClientRect();
                const onMove = me => {
                  const dx = ((me.clientX - startX) / rect.width) * 100;
                  const dy = ((startY - me.clientY) / rect.height) * 100;
                  if (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5) moved = true;
                  setCharPositions(prev => ({
                    ...prev,
                    [c.id]: { ...startPos, x: Math.max(0, Math.min(95, startPos.x + dx)), y: Math.max(0, Math.min(80, startPos.y + dy)) }
                  }));
                };
                const onUp = () => {
                  if (!moved) setSelectedCharId(c.id);
                  document.removeEventListener('mousemove', onMove);
                  document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
              style={{ position:"absolute", left:`${pos.x}%`, bottom:`${pos.y}%`, zIndex: pos.z, transform:`scale(${pos.scale * (c.height_scale ?? 1.0)})`, transformOrigin:"bottom center", width:160, display:"flex", flexDirection:"column", cursor:"grab", margin:0, padding:0 }}>
              {isUncertain && (
                <div style={{ position:"absolute", top:6, right:6, width:10, height:10, borderRadius:"50%", background:"#e8a020", zIndex:2, boxShadow:"0 0 0 2px var(--bg2)", animation:"pulse-amber 1.6s ease-in-out infinite" }} />
              )}
              {c.portrait_url
                ? <img src={c.portrait_url} alt={c.name} style={{ width:"100%", height:215, objectFit:"cover", objectPosition:"top", display:"block" }} />
                : <div style={{ width:"100%", height:215, background:color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:44, color, fontFamily:"sans-serif", fontWeight:"bold" }}>{c.name[0]}</div>
              }
              {isPov && <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:"var(--gold)", borderRadius:2 }} />}
            </div>
          );
        })
      )}
    </div>
  );
}
