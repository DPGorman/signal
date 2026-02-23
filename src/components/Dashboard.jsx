import React from 'react';
import { C, CATEGORIES } from '../engine/constants';

export const Dashboard = ({ data, navGo }) => (
  <div style={{ padding: "60px", overflowY: "auto" }}>
    <div style={{ fontSize: 32, fontWeight: 700, color: "white", marginBottom: 8, fontStyle: "italic" }}>{data.user?.project_name}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 40 }}>
      {[
        { label: "Ideas", val: data.ideas.length, c: C.gold, d: "library" },
        { label: "Invitations", val: data.deliverables.filter(x=>!x.is_complete).length, c: C.red, d: "deliverables" },
        { label: "High Signal", val: data.ideas.filter(x=>x.signal_strength >= 4).length, c: C.green, d: "library" },
        { label: "Canon Docs", val: data.canonDocs.length, c: C.purple, d: "canon" }
      ].map(s => (
        <div key={s.label} onClick={() => navGo(s.d)} style={{ background: C.surface, padding: 24, borderRadius: 12, border: `1px solid ${C.border}`, cursor: "pointer" }}>
          <div style={{ fontSize: 36, color: s.c, fontWeight: 300 }}>{s.val}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textS, marginTop: 4 }}>{s.label.toUpperCase()}</div>
        </div>
      ))}
    </div>
  </div>
);
