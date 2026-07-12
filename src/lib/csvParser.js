/**
 * Wave Closers — CSV Parser
 * Parses pasted or uploaded CSV into user objects.
 *
 * Accepted columns (case-insensitive):
 *   id, name, type, stage, leadsthisweek, dealsthismonth, joined, market, notes
 *
 * Type accepts: referral/ref/1 → REFERRAL
 *               rep/independent/2 → REP
 *               reseller/authorized/3 → RESELLER
 *               iso/investor/4 → ISO
 */

const TYPE_MAP = {
  referral:'REFERRAL', ref:'REFERRAL', '1':'REFERRAL',
  rep:'REP', independent:'REP', '2':'REP',
  reseller:'RESELLER', authorized:'RESELLER', '3':'RESELLER',
  iso:'ISO', investor:'ISO', 'done for you':'ISO', '4':'ISO',
};

function normaliseType(raw = '') {
  return TYPE_MAP[raw.trim().toLowerCase()] || 'REFERRAL';
}

export function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { users:[], errors:['CSV must have a header row + at least one data row.'] };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,''));
  const errors = [];
  const users  = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const row  = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });

    const name = row.name;
    if (!name) { errors.push(`Row ${i+1}: missing name — skipped.`); continue; }

    users.push({
      id:             row.id || `WC-${Date.now()}-${i}`,
      name,
      type:           normaliseType(row.type),
      stage:          Math.min(6, Math.max(1, parseInt(row.stage) || 1)),
      leadsThisWeek:  parseInt(row.leadsthisweek)  || 0,
      dealsThisMonth: parseInt(row.dealsthismonth) || 0,
      joined:         row.joined || new Date().toISOString().split('T')[0],
      market:         row.market || '—',
      notes:          row.notes  || '',
    });
  }

  return { users, errors };
}

export const CSV_TEMPLATE =
`id,name,type,stage,leadsThisWeek,dealsThisMonth,joined,market,notes
WC-2001,Jane Smith,REP,6,8,3,2026-05-01,Dallas TX,Strong closer
WC-2002,Bob Jones,Referral,4,0,1,2026-05-03,Portland OR,New this week`;
