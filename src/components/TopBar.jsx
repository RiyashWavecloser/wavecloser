import React from 'react';
import { formatToday } from '../lib/status.js';

export default function TopBar({ onOpenAi, search, onSearch }) {
  return (
    <div style={S.topbar}>
      <div>
        <div style={S.label}>Wave Closers — Internal Operations Console</div>
        <div style={S.date}>{formatToday()}</div>
      </div>
      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <div style={S.searchBox}>
          <span style={{ color:'#999', marginRight:8, fontSize:16 }}>⌕</span>
          <input placeholder="Search users, deals, markets…" style={S.searchInput} value={search||''} onChange={e => onSearch && onSearch(e.target.value)} />
        </div>
        <button onClick={onOpenAi} style={S.aiBtn}>∗ Ask Claude</button>
      </div>
    </div>
  );
}

const S = {
  topbar:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 0', borderBottom:'1px solid var(--color-line)', marginBottom:24 },
  label:      { fontSize:11, letterSpacing:'0.15em', color:'#888', textTransform:'uppercase' },
  date:       { fontSize:13, color:'#555', marginTop:2 },
  searchBox:  { display:'flex', alignItems:'center', background:'white', padding:'8px 14px', borderRadius:8, border:'1px solid var(--color-line)', width:260 },
  searchInput:{ border:'none', outline:'none', flex:1, fontSize:13, background:'transparent' },
  aiBtn:      { background:'var(--color-ink)', color:'white', border:'none', padding:'9px 16px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' },
};
