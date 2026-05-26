import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Sidebar       from './components/Sidebar.jsx';
import TopBar        from './components/TopBar.jsx';
import UserDrawer    from './components/UserDrawer.jsx';
import AiAssistant   from './components/AiAssistant.jsx';

import Dashboard         from './modules/Dashboard.jsx';
import Users             from './modules/Users.jsx';
import OnboardingFlow    from './modules/OnboardingFlow.jsx';
import AutomationPanel   from './modules/AutomationPanel.jsx';
import FranchiseResearch from './modules/FranchiseResearch.jsx';
import DataIntegration   from './modules/DataIntegration.jsx';
import Settings          from './modules/Settings.jsx';

import { SEED_USERS } from './data/seed.js';
import {
  fetchUsersFromAPI,
  createUserAPI,
  updateUserAPI,
  deleteUserAPI,
  getSession,
  setSession,
} from './lib/dataLayer.js';
import Login from './modules/Login.jsx';

export default function App() {
  const [session, setSessionState] = useState(getSession());
  const [view,         setView]         = useState('dashboard');
  const [users,        setUsers]        = useState(SEED_USERS);
  const [dataMode,     setDataMode]     = useState('csv');
  const [selectedUser, setSelectedUser] = useState(null);
  const [aiPanelOpen,  setAiPanelOpen]  = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [backendLive,  setBackendLive]  = useState(false);

  // ── On mount: try to load live data from Airtable ──────────────────────────
  useEffect(() => {
    if (!session.token) return;
    fetchUsersFromAPI().then(live => {
      if (live && live.length) {
        setUsers(live);
        setBackendLive(true);
        setDataMode('api');
        console.log(`[App] Loaded ${live.length} users from Airtable ✓`);
      } else {
        console.log('[App] Backend offline or empty — using seed data');
      }
    });
  }, [session.token]);

  // ── Global search ──────────────────────────────────────────────────────────
  const searchedUsers = useMemo(() => {
    if (!globalSearch) return users;
    const q = globalSearch.toLowerCase();
    return users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      (u.market || '').toLowerCase().includes(q)
    );
  }, [users, globalSearch]);

  function handleGlobalSearch(val) {
    setGlobalSearch(val);
    if (val) setView('users');
  }

  // ── Create user (React state + Airtable) ──────────────────────────────────
  const handleCreateUser = useCallback(async (newUser) => {
    // Add to React state immediately (optimistic)
    setUsers(prev => [newUser, ...prev]);
    // Persist to Airtable if backend is live
    const result = await createUserAPI(newUser);
    if (result.demo) {
      console.warn('[App] createUser: backend offline, saved to state only');
    } else {
      console.log('[App] createUser: saved to Airtable ✓', newUser.id);
    }
  }, []);

  // ── Update user fields (React state + Airtable) ───────────────────────────
  const handleUpdateUser = useCallback(async (id, patch) => {
    // Update React state immediately (optimistic)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
    // Keep drawer in sync
    setSelectedUser(prev => prev?.id === id ? { ...prev, ...patch } : prev);
    // Persist to Airtable
    const result = await updateUserAPI(id, patch);
    if (result.demo) {
      console.warn('[App] updateUser: backend offline, saved to state only');
    } else {
      console.log('[App] updateUser: saved to Airtable ✓', id, Object.keys(patch));
    }
  }, []);

  // ── Delete user (React state + Airtable) ──────────────────────────────────
  const handleDeleteUser = useCallback(async (id) => {
    // Remove from React state immediately (optimistic)
    setUsers(prev => prev.filter(u => u.id !== id));
    if (selectedUser?.id === id) setSelectedUser(null);
    // Delete from Airtable
    const result = await deleteUserAPI(id);
    if (result.demo) {
      console.warn('[App] deleteUser: backend offline, removed from state only');
    } else {
      console.log('[App] deleteUser: deleted from Airtable ✓', id);
    }
  }, [selectedUser]);

  if (!session.token) {
    return <Login onLogin={(token, user) => {
      setSession(token, user);
      setSessionState({ token, user });
    }} />;
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--color-bg)' }}>
      <Sidebar
        view={view}
        setView={setView}
        dataMode={dataMode}
        user={session.user}
        onLogout={() => {
          setSession(null);
          setSessionState({ token: null, user: null });
        }}
      />
      <main style={{ flex:1, padding:'0 32px 32px 32px', minWidth:0 }}>
        <TopBar
          onOpenAi={() => setAiPanelOpen(true)}
          search={globalSearch}
          onSearch={handleGlobalSearch}
          backendLive={backendLive}
        />

        {view === 'dashboard'  && (
          <Dashboard users={users} onSelectUser={setSelectedUser} />
        )}
        {view === 'users' && (
          <Users
            users={searchedUsers}
            setUsers={setUsers}
            onSelectUser={setSelectedUser}
            onCreateUser={handleCreateUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
          />
        )}
        {view === 'onboarding' && (
          <OnboardingFlow
            users={users}
            setUsers={setUsers}
            onCreateUser={handleCreateUser}
            onUpdateUser={handleUpdateUser}
          />
        )}
        {view === 'automation' && <AutomationPanel users={users} />}
        {view === 'franchise'  && <FranchiseResearch />}
        {view === 'data'       && (
          <DataIntegration
            dataMode={dataMode}
            setDataMode={setDataMode}
            users={users}
            setUsers={setUsers}
          />
        )}
        {view === 'settings'   && (
          <Settings dataMode={dataMode} setDataMode={setDataMode} />
        )}
      </main>

      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdateUser={handleUpdateUser}
        />
      )}
      {aiPanelOpen && <AiAssistant users={users} onClose={() => setAiPanelOpen(false)} />}
    </div>
  );
}
