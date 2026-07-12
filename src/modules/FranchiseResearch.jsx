import React, { useState } from 'react';
import { PageHeader, Card, CardHeader, Note } from '../components/ui.jsx';
import { formatNumber } from '../lib/status.js';
import { askClaude } from '../lib/claudeClient.js';
import EmptyState from '../components/EmptyState.jsx';

/**
 * FranchiseResearch — v2 additions:
 *   - Previous results cache (last 5 queries, click to reload)
 *   - Narrative paragraph from Claude
 */
export default function FranchiseResearch() {
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [narrative, setNarrative] = useState('');
  const [error,     setError]     = useState('');
  const [cache,     setCache]     = useState([]);
  const [lastQuery, setLastQuery] = useState('');

  async function runResearch(q) {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setLoading(true); setError(''); setNarrative('');
    const reply = await askClaude(
      `You are a franchise location analyst for Wave Closers, a payment processing company targeting restaurants.
Analyse regions for franchise placement based on: restaurant density, population growth, income levels, food-service industry trends, competitive saturation.
Return ONLY valid JSON with this exact shape, no markdown, no preamble:
{ "narrative": "2-3 sentence summary of the region", "markets": [{ "city": "City, ST", "score": 0-100, "businesses": number, "growth": "+X.X%", "verdict": "Strong|Moderate|Weak" }] }
Include exactly 5 markets ordered by score descending. Verdict must be one of exactly: Strong, Moderate, Weak.`,
      [{ role:'user', content:`Analyse franchise markets for Wave Closers in: ${searchQuery}` }]
    );
    try {
      const clean  = reply.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setResults(parsed.markets || []);
      setNarrative(parsed.narrative || '');
      setLastQuery(searchQuery);
      // Add to cache
      const topCity = (parsed.markets?.[0]?.city) || '—';
      const topScore = parsed.markets?.[0]?.score || 0;
      setCache(prev => [{ query: searchQuery, topCity, score: topScore, date: new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) }, ...prev].slice(0, 5));
    } catch {
      setError('Could not parse Claude response — try a simpler query.');
      setNarrative(reply.length < 400 ? reply : '');
    }
    setLoading(false);
  }

  function loadCached(item) {
    setQuery(item.query);
    runResearch(item.query);
  }

  return (
    <div style={S.wrap}>
      <PageHeader title="Merchant Market Research" subtitle="Claude-powered market scoring — scope §9" />

      {/* ── Query input ── */}
      <Card>
        <CardHeader title="Run a market analysis" sub="Powered by Claude API" />
        <div style={S.row}>
          <input
            placeholder="e.g. 'Southeast US cities with restaurant growth', 'Texas metros with strong food service'"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runResearch()}
            style={S.input}
          />
          <button onClick={() => runResearch()} style={S.primaryBtn} disabled={loading || !query.trim()}>
            {loading ? '⟳ Analysing…' : 'Analyse →'}
          </button>
        </div>
        <div style={{ fontSize:12, color:'#888', marginTop:8 }}>
          Inputs: restaurant density · population growth · income levels · food-service trends · competitive saturation
        </div>
      </Card>

      {/* ── Claude narrative ── */}
      {narrative && (
        <Card>
          <CardHeader title="Claude's analysis" sub={`Query: "${lastQuery}"`} />
          <p style={{ fontSize:13, color:'#444', lineHeight:1.8, margin:0 }}>{narrative}</p>
        </Card>
      )}

      {error && <Note tone="warn">{error}</Note>}

      {/* ── Results table ── */}
      <Card>
        <CardHeader
          title="Ranked markets"
          sub={`${results.length} candidates${lastQuery ? ` — ${lastQuery}` : ''}`}
        />
        {results.length === 0
          ? <EmptyState icon="◈" title="No market analyses yet" message="Run your first market analysis using the form above." />
          : (<>
        <table style={S.table}>
          <thead>
            <tr>{['Rank','Market','Score','Businesses','YoY growth','Verdict'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {results.map((m, i) => (
              <tr key={m.city}>
                <td style={S.td}><span style={S.rank}>{i + 1}</span></td>
                <td style={S.td}><strong>{m.city}</strong></td>
                <td style={S.td}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={S.bar}>
                      <div style={{ ...S.fill, width:`${m.score}%`, background: m.score>=85?'var(--color-green)':m.score>=70?'var(--color-amber)':'var(--color-red)' }} />
                    </div>
                    <strong>{m.score}</strong>
                  </div>
                </td>
                <td style={S.td}>{formatNumber(m.businesses)}</td>
                <td style={{ ...S.td, color: String(m.growth).startsWith('-') ? 'var(--color-red)' : 'var(--color-green)', fontWeight:600 }}>{m.growth}</td>
                <td style={S.td}>
                  <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:4, fontSize:11, fontWeight:600,
                    background: m.verdict==='Strong'?'var(--color-green-bg)':m.verdict==='Moderate'?'var(--color-amber-bg)':'var(--color-red-bg)',
                    color:      m.verdict==='Strong'?'var(--color-green-text)':m.verdict==='Moderate'?'var(--color-amber-text)':'var(--color-red-text)',
                  }}>{m.verdict}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Note>Regression analysis and social media listening per scope §9 will enhance scores in production.</Note>
        </>)}
      </Card>

      {/* ── Previous results cache ── */}
      {cache.length > 0 && (
        <Card>
          <CardHeader title="Previous analyses" sub="Click to reload any result" />
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {cache.map((item, i) => (
              <button key={i} onClick={() => loadCached(item)} style={S.cacheRow}>
                <div style={{ flex:1, textAlign:'left' }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{`"${item.query}"`}</div>
                  <div style={{ fontSize:11, color:'#888', marginTop:2 }}>Top: {item.topCity} — Score: {item.score}</div>
                </div>
                <div style={{ fontSize:11, color:'#AAA', whiteSpace:'nowrap' }}>{item.date}</div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

const S = {
  wrap:       { display:'flex', flexDirection:'column', gap:16 },
  row:        { display:'grid', gridTemplateColumns:'1fr auto', gap:12 },
  input:      { padding:'10px 12px', border:'1px solid #DDD3C2', borderRadius:6, fontSize:13, outline:'none', background:'white' },
  primaryBtn: { background:'var(--color-primary)', color:'white', border:'none', padding:'10px 18px', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' },
  table:      { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:         { textAlign:'left', padding:'10px 8px', borderBottom:'1px solid var(--color-line)', fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 },
  td:         { padding:'12px 8px', borderBottom:'1px solid var(--color-line-soft)', color:'#333' },
  rank:       { display:'inline-flex', alignItems:'center', justifyContent:'center', width:26, height:26, background:'var(--color-ink)', color:'white', borderRadius:4, fontSize:12, fontWeight:700 },
  bar:        { width:100, height:6, background:'var(--color-line)', borderRadius:3, overflow:'hidden' },
  fill:       { height:'100%', borderRadius:3, transition:'width .5s' },
  cacheRow:   { display:'flex', alignItems:'center', gap:16, padding:'12px 0', borderBottom:'1px solid var(--color-line-soft)', background:'transparent', border:'none', cursor:'pointer', width:'100%', textAlign:'left', transition:'background .1s', fontFamily:'inherit' },
};
