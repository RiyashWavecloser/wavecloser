import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { USER_TYPES } from '../data/constants.js';
import { computeStatus } from '../lib/status.js';
import { PageHeader, Card, CardHeader, StatCard } from '../components/ui.jsx';
import UserTable from '../components/UserTable.jsx';

export default function Dashboard({ users, onSelectUser }) {
  const stats = useMemo(() => {
    const total = users.length;
    const onTrack = users.filter((u) => computeStatus(u).tier === 'green').length;
    const atRisk = users.filter((u) => computeStatus(u).tier === 'amber').length;
    const belowTarget = users.filter((u) => computeStatus(u).tier === 'red').length;
    const totalLeads = users.reduce((a, u) => a + u.leadsThisWeek, 0);
    const totalDeals = users.reduce((a, u) => a + u.dealsThisMonth, 0);
    return { total, onTrack, atRisk, belowTarget, totalLeads, totalDeals };
  }, [users]);

  const trendData = [
    { week: 'W1',   leads: 42, deals: 9 },
    { week: 'W2',   leads: 58, deals: 14 },
    { week: 'W3',   leads: 71, deals: 19 },
    { week: 'W4',   leads: 84, deals: 23 },
    { week: 'This', leads: stats.totalLeads, deals: stats.totalDeals },
  ];

  const byType = Object.values(USER_TYPES).map((t) => ({
    name: t.short,
    count: users.filter((u) => u.type === t.id).length,
    color: t.color,
  }));

  return (
    <div style={styles.wrap}>
      <PageHeader title="Dashboard" subtitle="Live status across all Wave Closers users" />

      <div style={styles.statGrid}>
        <StatCard label="Total users"      value={stats.total}       sub="across 4 types" />
        <StatCard label="On track"         value={stats.onTrack}     sub="hitting benchmarks" tone="green" />
        <StatCard label="At risk"          value={stats.atRisk}      sub="below 70% quota"    tone="amber" />
        <StatCard label="Below target"     value={stats.belowTarget} sub="needs follow-up"    tone="red" />
        <StatCard label="Leads this week"  value={stats.totalLeads}  sub="across all users" />
        <StatCard label="Deals this month" value={stats.totalDeals}  sub="closed so far" />
      </div>

      <div style={styles.twoCol}>
        <Card>
          <CardHeader title="Lead & deal trend" sub="Last 5 weeks" />
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={trendData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#666' }} />
                <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: '1px solid #DDD', borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="leads" stroke="#1F4E79" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="deals" stroke="#D97A5E" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Users by type" sub={`${users.length} total`} />
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={byType} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} />
                <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: '1px solid #DDD', borderRadius: 8 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {byType.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Active users" sub="click a row for details" />
        <UserTable users={users} onSelectUser={onSelectUser} />
      </Card>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
};
