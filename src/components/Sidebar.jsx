import React from 'react';

const NAV = [
  { id:'dashboard',  label:'Dashboard',          icon:'▤' },
  { id:'users',      label:'Users',              icon:'◉' },
  { id:'onboarding', label:'Onboarding Flow',    icon:'⇢' },
  { id:'automation', label:'AI Automation',      icon:'✦' },
  { id:'franchise',  label:'Franchise Research', icon:'◈' },
  { id:'data',       label:'Data Integration',   icon:'⇌' },
];

export default function Sidebar({ view, setView, dataMode }) {
  return (
    <aside style={S.aside}>
      <div style={S.brand}>
        <div style={S.mark}>WC</div>
        <div>
          <div style={S.name}>WAVE CLOSERS</div>
          <div style={S.sub}>PM · Ops · AI</div>
        </div>
      </div>
      <nav style={{ marginTop:24 }}>
        {NAV.map(item => (
          <button key={item.id} onClick={() => setView(item.id)} style={{ ...S.navItem, ...(view===item.id ? S.navActive : {}) }}>
            <span style={S.icon}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div style={S.footer}>
        <div style={S.modePill}>
          <div style={{ ...S.dot, background: dataMode==='api' ? '#2D9B5E' : '#D49A2B' }} />
          <span>{dataMode==='api' ? 'API mode' : 'CSV mode'}</span>
        </div>
        <div style={S.userPill}>
          <div style={S.avatar}>R</div>
          <div>
            <div style={{ fontSize:13, fontWeight:600 }}>Riyash</div>
            <div style={{ fontSize:11, color:'#888' }}>Project Manager</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

const S = {
  aside:   { width:240, background:'#1A1A1A', color:'#EEE', padding:'24px 16px', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', flexShrink:0 },
  brand:   { display:'flex', alignItems:'center', gap:12, padding:'0 8px' },
  mark:    { width:40, height:40, background:'#1F4E79', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, letterSpacing:'0.05em', borderRadius:6, flexShrink:0 },
  name:    { fontSize:13, fontWeight:700, letterSpacing:'0.12em' },
  sub:     { fontSize:10, color:'#888', letterSpacing:'0.1em', marginTop:2, textTransform:'uppercase' },
  navItem: { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', background:'transparent', border:'none', color:'#BBB', fontSize:13, textAlign:'left', borderRadius:6, marginBottom:2, cursor:'pointer', transition:'all .15s', fontFamily:'inherit' },
  navActive:{ background:'#2A2A2A', color:'white' },
  icon:    { fontSize:14, width:16, textAlign:'center', color:'#888' },
  footer:  { marginTop:'auto', display:'flex', flexDirection:'column', gap:10, paddingTop:16, borderTop:'1px solid #2A2A2A' },
  modePill:{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', fontSize:11, color:'#AAA', background:'#2A2A2A', borderRadius:6 },
  dot:     { width:8, height:8, borderRadius:'50%' },
  userPill:{ display:'flex', alignItems:'center', gap:10, padding:'6px 12px' },
  avatar:  { width:32, height:32, background:'#1F4E79', color:'white', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:13, flexShrink:0 },
};
