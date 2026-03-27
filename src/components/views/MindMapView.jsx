import { useState, useEffect, useRef, useMemo } from "react";
import { C, CATEGORIES, getCat, mono, sans } from "../../lib/constants";

export default function MindMapView({ ideas, connections, user, onGenerateConnections, onLoadAll, onNavigate, onSetActiveIdea, onNotify }) {
  const [mapNodes, setMapNodes] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [dragNode, setDragNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [focusedNode, setFocusedNode] = useState(null);
  const [mapFilter, setMapFilter] = useState("all");
  const mapContainerRef = useRef(null);

  // Compute node layout from ideas + connections
  useEffect(() => {
    if (!ideas.length) return;
    const cx = 500, cy = 400;
    const nodes = ideas.map((idea, i) => {
      const angle = (i / ideas.length) * Math.PI * 2;
      const cat = getCat(idea.category);
      const connCount = connections.filter(c => c.idea_id_a === idea.id || c.idea_id_b === idea.id).length;
      const radius = Math.max(120, 350 - connCount * 40);
      return {
        id: idea.id, category: idea.category,
        x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 60,
        y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 60,
        text: idea.text.slice(0, 50), fullText: idea.text,
        color: cat.color, icon: cat.icon,
        signal: idea.signal_strength || 3, connCount,
      };
    });
    setMapNodes(nodes);
  }, [ideas.length, connections.length]); // eslint-disable-line

  const getNode = (id) => mapNodes.find(n => n.id === id);
  const nodeRadius = (node) => Math.max(6, 4 + node.signal * 2 + node.connCount);

  const filteredNodes = mapFilter === "all" ? mapNodes : mapNodes.filter(n => n.category === mapFilter);
  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);
  const filteredConns = useMemo(() => connections.filter(c => filteredNodeIds.has(c.idea_id_a) && filteredNodeIds.has(c.idea_id_b)), [connections, filteredNodeIds]);

  const handleMouseDown = (e, node) => {
    e.preventDefault();
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragNode(node.id);
    setDragOffset({ x: e.clientX - rect.left - node.x, y: e.clientY - rect.top - node.y });
  };

  const handleMouseMove = (e) => {
    if (!dragNode) return;
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    setMapNodes(prev => prev.map(n => n.id === dragNode ? { ...n, x, y } : n));
  };

  const handleMouseUp = () => setDragNode(null);

  const handleMapAll = async () => {
    if (!user || ideas.length < 2) return;
    onNotify("Mapping connections...", "processing");
    for (const idea of ideas) {
      const existing = connections.filter(c => c.idea_id_a === idea.id || c.idea_id_b === idea.id);
      if (existing.length < 2) {
        await onGenerateConnections(idea.id, idea.text);
      }
    }
    await onLoadAll(user.id);
    onNotify("Connections mapped.", "success");
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ padding: "10px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>{filteredNodes.length} ideas · {filteredConns.length} connections</span>
        <select value={mapFilter} onChange={e => { setMapFilter(e.target.value); setFocusedNode(null); }}
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "4px 8px", fontSize: 11, fontFamily: sans, borderRadius: 4, outline: "none" }}>
          <option value="all">All Categories</option>
          {CATEGORIES.filter(cat => ideas.some(i => i.category === cat.id)).map(cat => (
            <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
          ))}
        </select>
        <button onClick={handleMapAll}
          style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "5px 12px", fontFamily: mono, fontSize: 11, letterSpacing: "0.08em", cursor: "pointer", borderRadius: 4, flexShrink: 0 }}>
          MAP ALL
        </button>
      </div>

      {/* Canvas */}
      <div ref={mapContainerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={e => { if (e.target === mapContainerRef.current) setFocusedNode(null); }}
        style={{ flex: 1, position: "relative", overflow: "hidden", background: C.bg, cursor: dragNode ? "grabbing" : "default" }}>

        {/* Focused node detail panel */}
        {focusedNode && (() => {
          const fi = ideas.find(i => i.id === focusedNode);
          const fc = connections.filter(c => c.idea_id_a === focusedNode || c.idea_id_b === focusedNode)
            .sort((a, b) => (b.strength || 3) - (a.strength || 3))
            .slice(0, 8);
          if (!fi) return null;
          const cat = getCat(fi.category);
          return (
            <div style={{ position: "absolute", top: 12, left: 16, zIndex: 50, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px", maxWidth: 360, maxHeight: "80vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: cat.color, fontFamily: mono, fontWeight: 500 }}>{cat.icon} {cat.label.toUpperCase()}</span>
                <span onClick={() => { onSetActiveIdea(fi); onNavigate("library"); }}
                  style={{ fontSize: 11, color: C.gold, fontFamily: mono, cursor: "pointer" }}>OPEN IN LIBRARY →</span>
              </div>
              <div style={{ fontSize: 11, color: C.textPrimary, lineHeight: 1.5, marginBottom: 12 }}>{fi.text.slice(0, 120)}{fi.text.length > 120 ? "..." : ""}</div>
              {fc.length > 0 && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginBottom: 8 }}>TOP {fc.length} CONNECTION{fc.length > 1 ? "S" : ""}</div>
                  {fc.map((c, ci) => {
                    const otherId = c.idea_id_a === focusedNode ? c.idea_id_b : c.idea_id_a;
                    const other = ideas.find(i => i.id === otherId);
                    const otherCat = other ? getCat(other.category) : null;
                    return (
                      <div key={ci} style={{ padding: "8px 10px", marginBottom: 4, background: C.bg, borderRadius: 6, border: `1px solid ${C.borderSubtle}` }}>
                        {other && <div style={{ fontSize: 11, color: otherCat?.color || C.textMuted, fontFamily: mono, marginBottom: 3 }}>{otherCat?.icon} {other.text.slice(0, 50)}...</div>}
                        <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.45 }}>{(c.reason || "").slice(0, 100)}{(c.reason || "").length > 100 ? "..." : ""}</div>
                        {c.strength >= 4 && <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, marginTop: 3 }}>◈ STRONG</div>}
                      </div>
                    );
                  })}
                </div>
              )}
              <div onClick={() => setFocusedNode(null)}
                style={{ marginTop: 10, fontSize: 11, color: C.textMuted, fontFamily: mono, cursor: "pointer", textAlign: "center" }}>✕ CLOSE</div>
            </div>
          );
        })()}

        {/* Connection lines (SVG) */}
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {filteredConns.map((conn, i) => {
            const a = getNode(conn.idea_id_a);
            const b = getNode(conn.idea_id_b);
            if (!a || !b) return null;
            const isHovered = hoveredNode && (conn.idea_id_a === hoveredNode || conn.idea_id_b === hoveredNode);
            const isFocusConn = focusedNode && (conn.idea_id_a === focusedNode || conn.idea_id_b === focusedNode);
            const hidden = focusedNode && !isFocusConn;
            return (
              <line key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isFocusConn ? C.gold : isHovered ? C.gold : C.border}
                strokeWidth={isFocusConn ? 2 : isHovered ? 2 : Math.max(0.5, conn.strength * 0.4)}
                opacity={hidden ? 0.03 : isFocusConn ? 0.9 : isHovered ? 0.9 : 0.3}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {mapNodes.filter(n => filteredNodeIds.has(n.id)).map(node => {
          const r = nodeRadius(node);
          const isHovered = hoveredNode === node.id;
          const nodeConns = connections.filter(c => c.idea_id_a === node.id || c.idea_id_b === node.id);
          const isFocused = focusedNode === node.id;
          const isConnectedToFocus = focusedNode && nodeConns.some(c => c.idea_id_a === focusedNode || c.idea_id_b === focusedNode);
          const isFaded = focusedNode && !isFocused && !isConnectedToFocus;
          return (
            <div key={node.id}
              onMouseDown={e => handleMouseDown(e, node)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => setFocusedNode(focusedNode === node.id ? null : node.id)}
              style={{ position: "absolute", left: node.x - r, top: node.y - r, cursor: "pointer", zIndex: isFocused ? 20 : isHovered ? 10 : 1, opacity: isFaded ? 0.12 : 1, transition: "opacity 0.3s" }}>
              <div style={{ width: r * 2, height: r * 2, borderRadius: "50%", background: node.color + (isFocused ? "EE" : isHovered ? "CC" : "66"), border: `2px solid ${isFocused ? C.gold : isHovered ? node.color : "transparent"}`, transition: dragNode ? "none" : "border-color 0.15s, background 0.3s" }} />
              <div style={{ position: "absolute", top: r * 2 + 4, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", maxWidth: isFocused || isConnectedToFocus ? 180 : 120, overflow: "hidden", textOverflow: "ellipsis", fontSize: isFocused ? 11 : 9, fontWeight: isFocused ? 500 : 400, color: isFocused ? C.gold : isConnectedToFocus ? C.textPrimary : isHovered ? C.textPrimary : C.textMuted, fontFamily: mono, textAlign: "center", pointerEvents: "none", transition: "color 0.15s" }}>{node.text}</div>
              {isHovered && (
                <div style={{ position: "absolute", left: r * 2 + 10, top: -10, background: C.surface, border: `1px solid ${C.border}`, padding: "12px 16px", width: 280, zIndex: 100, pointerEvents: "none" }}>
                  <div style={{ fontSize: 11, color: node.color, fontFamily: mono, marginBottom: 6 }}>{node.icon} {node.category.toUpperCase()}</div>
                  <div style={{ fontSize: 11, color: C.textPrimary, lineHeight: 1.6, marginBottom: nodeConns.length ? 10 : 0 }}>{node.fullText.slice(0, 120)}{node.fullText.length > 120 ? "..." : ""}</div>
                  {nodeConns.length > 0 && (
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginBottom: 6 }}>{nodeConns.length} CONNECTION{nodeConns.length > 1 ? "S" : ""}</div>
                      {nodeConns.slice(0, 3).map((c, ci) => (
                        <div key={ci} style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.5, marginBottom: 4 }}>→ {c.reason}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
