import React, { useState } from 'react';
import { ROLE_LABELS, ROLE_VIEWS, ROLES } from '../data/roles.js';

const ALL_NAV = [
  { id:'dashboard',  label:'Dashboard',          icon:'▤' },
  { id:'users',      label:'Users',              icon:'◉' },
  { id:'onboarding', label:'Onboarding Flow',    icon:'⇢' },
  { id:'automation', label:'AI Automation',      icon:'✦' },
  { id:'franchise',  label:'Franchise Research', icon:'◈' },
  { id:'leads',      label:'Lead Generation',    icon:'⚡' },
  { id:'data',       label:'Data Integration',   icon:'⇌' },
  { id:'settings',   label:'Settings',           icon:'⚙' },
  { id:'qualifier-portal',    label:'My Queue',    icon:'🔔' },
  { id:'qualifier-completed', label:'My Completed', icon:'📋' },
];

export default function Sidebar({ view, setView, dataMode, user, onLogout, leadBadge }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const name = user?.name || 'Riyash';
  const role = user?.role || ROLES.ADMIN;
  const roleLabel = ROLE_LABELS[role] || 'Project Manager';
  const allowedViews = ROLE_VIEWS[role] || ROLE_VIEWS[ROLES.ADMIN];
  const nav = ALL_NAV.filter(item => allowedViews.includes(item.id));
  const initial = name.charAt(0).toUpperCase();

  return (
    <>
      <button className="wc-hamburger" onClick={() => setMobileOpen(true)} style={S.hamburger}>☰</button>
      {mobileOpen && <div onClick={() => setMobileOpen(false)} style={S.backdrop} />}
      <aside className={`wc-sidebar ${mobileOpen ? 'wc-sidebar-open' : ''}`} style={S.aside}>
        <button className="wc-sidebar-close" onClick={() => setMobileOpen(false)} style={S.closeBtn}>×</button>
        <div style={S.brand}>
          <div style={S.mark}>WC</div>
          <div>
            <div style={S.name}>WAVE CLOSERS</div>
            <div style={S.sub}>PM · Ops · AI</div>
          </div>
        </div>
        <nav style={{ marginTop:24 }}>
          {nav.map(item => (
            <button
              key={item.id}
              onClick={() => { setView(item.id); setMobileOpen(false); }}
              style={{ ...S.navItem, ...(view===item.id ? S.navActive : {}) }}
            >
              <span style={S.icon}>{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'leads' && leadBadge > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  background: 'var(--color-red, #D44A4A)',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: 10,
                  minWidth: 16,
                  textAlign: 'center'
                }}>{leadBadge}</span>
              )}
            </button>
          ))}
        </nav>
        <div style={S.footer}>
          <div style={S.modePill}>
            <div style={{ ...S.dot, background: dataMode==='api' ? '#2D9B5E' : '#D49A2B' }} />
            <span>{dataMode==='api' ? 'API mode' : 'CSV mode'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={S.avatar}>{initial}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:600 }}>{name}</div>
                <div style={{ fontSize:11, color:'#888' }}>{roleLabel}</div>
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  fontSize: 16,
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s',
                  outline: 'none',
                }}
                title="Logout"
                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-red)'}
                onMouseLeave={e => e.currentTarget.style.color = '#888'}
              >
                ⎋
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

const S = {
  aside:    { width:240, background:'#1A1A1A', color:'#EEE', padding:'24px 16px', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', flexShrink:0 },
  brand:    { display:'flex', alignItems:'center', gap:12, padding:'0 8px' },
  mark:     { width:40, height:40, background:'#1F4E79', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, letterSpacing:'0.05em', borderRadius:6, flexShrink:0 },
  name:     { fontSize:13, fontWeight:700, letterSpacing:'0.12em' },
  sub:      { fontSize:10, color:'#888', letterSpacing:'0.1em', marginTop:2, textTransform:'uppercase' },
  navItem:  { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', background:'transparent', border:'none', color:'#BBB', fontSize:13, textAlign:'left', borderRadius:6, marginBottom:2, cursor:'pointer', transition:'all .15s', fontFamily:'inherit' },
  navActive:{ background:'#2A2A2A', color:'white' },
  icon:     { fontSize:14, width:16, textAlign:'center', color:'#888' },
  footer:   { marginTop:'auto', display:'flex', flexDirection:'column', gap:10, paddingTop:16, borderTop:'1px solid #2A2A2A' },
  modePill: { display:'flex', alignItems:'center', gap:8, padding:'7px 12px', fontSize:11, color:'#AAA', background:'#2A2A2A', borderRadius:6 },
  dot:      { width:8, height:8, borderRadius:'50%' },
  userPill: { display:'flex', alignItems:'center', gap:10, padding:'6px 12px' },
  avatar:   { width:32, height:32, background:'#1F4E79', color:'white', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:13, flexShrink:0 },
  hamburger: {
    position: 'fixed',
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    background: '#1A1A1A',
    color: '#FFF',
    border: '1px solid #333',
    borderRadius: 6,
    fontSize: 20,
    cursor: 'pointer',
    zIndex: 40,
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 44,
  },
  closeBtn: {
    display: 'none',
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: 24,
    cursor: 'pointer',
  },
};

