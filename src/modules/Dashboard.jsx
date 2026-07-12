import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { USER_TYPES } from '../data/constants.js';
import { computeStatus } from '../lib/status.js';
import { PageHeader, Card, CardHeader, StatCard } from '../components/ui.jsx';
import UserTable from '../components/UserTable.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Dashboard({ users, onSelectUser, uncalledLeadsCount = 0 }) {
  const stats = useMemo(() => {
    const total       = users.length;
    const onTrack     = users.filter(u => computeStatus(u).tier === 'green').length;
    const atRisk      = users.filter(u => computeStatus(u).tier === 'amber').length;
    const belowTarget = users.filter(u => computeStatus(u).tier === 'red').length;
    const onboarding  = users.filter(u => computeStatus(u).tier === 'onboarding').length;
    const totalLeads  = users.reduce((a, u) => a + (u.leadsThisWeek || 0), 0);
    const totalDeals  = users.reduce((a, u) => a + (u.dealsThisMonth || 0), 0);
    return { total, onTrack, atRisk, belowTarget, onboarding, totalLeads, totalDeals };
  }, [users]);

  const alertUsers = useMemo(
    () => users.filter(u => ['amber', 'red'].includes(computeStatus(u).tier)),
    [users]
  );

  // Only build trend data from real users — no hardcoded dummy weeks
  const byType = Object.values(USER_TYPES).map(t => ({
    name:  t.short,
    count: users.filter(u => u.type === t.id).length,
    color: t.color,
  }));

  const hasUsers = users.length > 0;
  const hasTypeData = byType.some(t => t.count > 0);

  return (
    <div style={styles.wrap}>
      <PageHeader title="Dashboard" subtitle="Live status across all Wave Closers users" />

      {/* ── Alert banner ── */}
      {alertUsers.length > 0 && (
        <div style={styles.alertBanner}>
          <strong>⚠ {alertUsers.length} user{alertUsers.length > 1 ? 's' : ''} need attention:</strong>{' '}
          {alertUsers.map(u => u.name).join(', ')}
          {' '}— {alertUsers.filter(u => computeStatus(u).tier === 'red').length > 0 && 'below 50% lead target. '}
          {alertUsers.filter(u => computeStatus(u).tier === 'amber').length > 0 && 'below 70% quota.'}
          Click their row below for details.
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="wc-stat-grid" style={styles.statGrid}>
        <StatCard label="Total users"      value={stats.total}            sub="across all types" />
        <StatCard label="On track"         value={stats.onTrack}          sub="hitting benchmarks"  tone="green" />
        <StatCard label="At risk"          value={stats.atRisk}           sub="below 70% quota"     tone="amber" />
        <StatCard label="Below target"     value={stats.belowTarget}      sub="needs follow-up"     tone="red" />
        <StatCard label="Uncalled leads"   value={uncalledLeadsCount}     sub="calls left to do"    tone="amber" />
        <StatCard label="Leads this week"  value={stats.totalLeads}       sub="across all users" />
        <StatCard label="Deals this month" value={stats.totalDeals}       sub="closed so far" />
      </div>

      {/* ── Charts ── */}
      <div className="wc-two-col" style={styles.twoCol}>
        <Card>
          <CardHeader title="Lead & deal trend" sub="Weekly totals from Airtable" />
          {!hasUsers
            ? <EmptyState icon="▤" title="No data yet" message="Data will appear here as users and leads are added." />
            : (
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={[{ week: 'This week', leads: stats.totalLeads, deals: stats.totalDeals }]}
                    margin={{ top: 10, right: 16, left: -8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#666' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                    <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #DDD', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="leads" name="Leads" stroke="#1F4E79" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="deals" name="Deals" stroke="#D97A5E" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          }
        </Card>

        <Card>
          <CardHeader title="Users by type" sub={`${users.length} total`} />
          {!hasTypeData
            ? <EmptyState icon="◉" title="No users yet" message="Add your first user or recruit a salesperson to get started." />
            : (
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={byType} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                    <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #DDD', borderRadius: 8 }} />
                    <Bar dataKey="count" name="Users" radius={[6, 6, 0, 0]}>
                      {byType.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          }
        </Card>
      </div>

      {/* ── User table ── */}
      <Card>
        <CardHeader title="Active users" sub="Click a row for full detail" />
        {!hasUsers
          ? <EmptyState icon="◉" title="No users yet" message="Add your first user or recruit a salesperson to get started." />
          : <UserTable users={users} onSelectUser={onSelectUser} />
        }
      </Card>
    </div>
  );
}

const styles = {
  wrap:        { display: 'flex', flexDirection: 'column', gap: 16 },
  alertBanner: { background: 'var(--color-amber-bg)', border: '1px solid var(--color-amber)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--color-amber-text)', lineHeight: 1.6 },
  statGrid:    { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12 },
  twoCol:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
};
