import React, { useState, useMemo } from 'react';
import Sidebar       from './components/Sidebar.jsx';
import TopBar        from './components/TopBar.jsx';
import UserDrawer    from './components/UserDrawer.jsx';
import AiAssistant   from './components/AiAssistant.jsx';

import Dashboard         from './modules/Dashboard.jsx';
import OnboardingFlow    from './modules/OnboardingFlow.jsx';
import AutomationPanel   from './modules/AutomationPanel.jsx';
import FranchiseResearch from './modules/FranchiseResearch.jsx';
import DataIntegration   from './modules/DataIntegration.jsx';
import Users             from './modules/Users.jsx';

import { SEED_USERS } from './data/seed.js';

export default function App() {
  const [view,         setView]         = useState('dashboard');
  const [users,        setUsers]        = useState(SEED_USERS);
  const [dataMode,     setDataMode]     = useState('csv');
  const [selectedUser, setSelectedUser] = useState(null);
  const [aiPanelOpen,  setAiPanelOpen]  = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const searchedUsers = useMemo(() => {
    if (!globalSearch) return users;
    const q = globalSearch.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q) || u.market.toLowerCase().includes(q));
  }, [users, globalSearch]);

  function handleGlobalSearch(val) {
    setGlobalSearch(val);
    if (val) setView('users');
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--color-bg)' }}>
      <Sidebar view={view} setView={setView} dataMode={dataMode} />
      <main style={{ flex:1, padding:'0 32px 32px 32px', minWidth:0 }}>
        <TopBar onOpenAi={() => setAiPanelOpen(true)} search={globalSearch} onSearch={handleGlobalSearch} />
        {view === 'dashboard'  && <Dashboard       users={users}         onSelectUser={setSelectedUser} />}
        {view === 'users'      && <Users            users={searchedUsers} setUsers={setUsers} />}
        {view === 'onboarding' && <OnboardingFlow   users={users}         setUsers={setUsers} />}
        {view === 'automation' && <AutomationPanel  users={users} />}
        {view === 'franchise'  && <FranchiseResearch />}
        {view === 'data'       && <DataIntegration  dataMode={dataMode} setDataMode={setDataMode} users={users} setUsers={setUsers} />}
      </main>
      {selectedUser && <UserDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />}
      {aiPanelOpen  && <AiAssistant users={users} onClose={() => setAiPanelOpen(false)} />}
    </div>
  );
}
