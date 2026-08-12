import React, { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import Sidebar       from './components/Sidebar.jsx';
import TopBar        from './components/TopBar.jsx';
import UserDrawer    from './components/UserDrawer.jsx';
import AiAssistant   from './components/AiAssistant.jsx';

// Lazy-loaded modules
const Dashboard         = lazy(() => import('./modules/Dashboard.jsx'));
const Users             = lazy(() => import('./modules/Users.jsx'));
const OnboardingFlow    = lazy(() => import('./modules/OnboardingFlow.jsx'));
const AutomationPanel   = lazy(() => import('./modules/AutomationPanel.jsx'));
const FranchiseResearch = lazy(() => import('./modules/FranchiseResearch.jsx'));
const DataIntegration   = lazy(() => import('./modules/DataIntegration.jsx'));
const LeadGeneration    = lazy(() => import('./modules/LeadGeneration.jsx'));
const Settings          = lazy(() => import('./modules/Settings.jsx'));
const Login             = lazy(() => import('./modules/Login.jsx'));
const ChangePassword    = lazy(() => import('./modules/ChangePassword.jsx'));
const AgentPortal       = lazy(() => import('./modules/AgentPortal.jsx'));
const QualifierPortal   = lazy(() => import('./modules/QualifierPortal.jsx'));

import { fetchUsersFromAPI, createUserAPI, updateUserAPI, deleteUserAPI, getSession, setSession, clearMustChangePassword, fetchQualifierQueueAPI, fetchLeadsFromAPI, loadLeadsFromStorage } from './lib/dataLayer.js';
import { ROLE_USER_FILTER, canAccess, defaultView, ROLES, isAgentRole } from './data/roles.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
const RecruiterPortal = lazy(() => import('./modules/RecruiterPortal.jsx'));

function ViewLoading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: '#0B0F19',
      color: '#FFF',
      fontFamily: "'Inter', sans-serif",
      fontSize: 14,
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 24,
          height: 24,
          border: '2px solid rgba(255,255,255,0.2)',
          borderTopColor: '#D97A5E',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span>Loading...</span>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const [session, setSessionState] = useState(getSession());
  const [view,         setView]         = useState('dashboard');
  const [users,        setUsers]        = useState([]);
  const [dataMode,     setDataMode]     = useState('csv');
  const [selectedUser, setSelectedUser] = useState(null);
  const [aiPanelOpen,  setAiPanelOpen]  = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [backendLive,  setBackendLive]  = useState(false);

  const role = session.user?.role || ROLES.ADMIN;
  const mustChangePassword = !!session.mustChangePassword;

  const [leadBadge, setLeadBadge] = useState(0);
  const [uncalledLeadsCount, setUncalledLeadsCount] = useState(0);

  // Poll Qualifier Queue to update Lead Generation Sidebar badge + uncalled leads count
  useEffect(() => {
    if (!session.token || mustChangePassword) return;

    const updateBadge = () => {
      fetchQualifierQueueAPI()
        .then(queue => {
          if (queue && Array.isArray(queue)) {
            const count = queue.filter(l => !l.qualifierStatus || l.qualifierStatus === 'QualifierNew').length;
            setLeadBadge(count);
          } else {
            const stored = loadLeadsFromStorage() || [];
            const count = stored.filter(l => l.status === 'SentToQualifier').length;
            setLeadBadge(count);
          }
        })
        .catch(() => {
          const stored = loadLeadsFromStorage() || [];
          const count = stored.filter(l => l.status === 'SentToQualifier').length;
          setLeadBadge(count);
        });

      fetchLeadsFromAPI()
        .then(live => {
          const all = live && live.length ? live : (loadLeadsFromStorage() || []);
          const uncalled = all.filter(l => l.assignedAgent && !l.calledAt && !l.outcome).length;
          setUncalledLeadsCount(uncalled);
        })
        .catch(() => {
          const stored = loadLeadsFromStorage() || [];
          const uncalled = stored.filter(l => l.assignedAgent && !l.calledAt && !l.outcome).length;
          setUncalledLeadsCount(uncalled);
        });
    };

    updateBadge();
    const interval = setInterval(updateBadge, 15000);
    return () => clearInterval(interval);
  }, [session.token, mustChangePassword]);

  // On login, jump to the default view
  useEffect(() => {
    if (session.token && session.user) {
      setView(defaultView(session.user.role));
    }
  }, [session.token, session.user]);

  // ── On mount: try to load live data from Airtable ──────────────────────────
  useEffect(() => {
    if (!session.token || mustChangePassword) return;
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
  }, [session.token, mustChangePassword]);

  // Filter users by role
  const roleFilteredUsers = useMemo(() => {
    const filter = ROLE_USER_FILTER[role] || (() => true);
    return users.filter(filter);
  }, [users, role]);

  // ── Global search ──────────────────────────────────────────────────────────
  const searchedUsers = useMemo(() => {
    const filter = ROLE_USER_FILTER[role] || (() => true);
    const filtered = users.filter(filter);
    if (!globalSearch) return filtered;
    const q = globalSearch.toLowerCase();
    return filtered.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      (u.market || '').toLowerCase().includes(q)
    );
  }, [users, role, globalSearch]);

  function handleGlobalSearch(val) {
    setGlobalSearch(val);
    if (val) setView('users');
  }

  // ── Create user (React state + Airtable) ──────────────────────────────────
  const handleCreateUser = useCallback(async (newUser) => {
    setUsers(prev => [newUser, ...prev]);
    const result = await createUserAPI(newUser);
    if (result.demo) {
      console.warn('[App] createUser: backend offline, saved to state only');
    } else {
      console.log('[App] createUser: saved to Airtable ✓', newUser.id);
    }
  }, []);

  // ── Update user fields (React state + Airtable) ───────────────────────────
  const handleUpdateUser = useCallback(async (id, patch) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
    setSelectedUser(prev => prev?.id === id ? { ...prev, ...patch } : prev);
    const result = await updateUserAPI(id, patch);
    if (result.demo) {
      console.warn('[App] updateUser: backend offline, saved to state only');
    } else {
      console.log('[App] updateUser: saved to Airtable ✓', id, Object.keys(patch));
    }
  }, []);

  // ── Delete user (React state + Airtable) ──────────────────────────────────
  const handleDeleteUser = useCallback(async (id) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    if (selectedUser?.id === id) setSelectedUser(null);
    const result = await deleteUserAPI(id);
    if (result.demo) {
      console.warn('[App] deleteUser: backend offline, removed from state only');
    } else {
      console.log('[App] deleteUser: deleted from Airtable ✓', id);
    }
  }, [selectedUser]);

  function handlePasswordChanged() {
    clearMustChangePassword();
    setSessionState(prev => ({ ...prev, mustChangePassword: false }));
  }

  function handleLogout() {
    setSession(null);
    setSessionState({ token: null, user: null, mustChangePassword: false });
  }

  if (!session.token) {
    return (
      <Suspense fallback={<ViewLoading />}>
        <Login onLogin={(token, user, mustChange) => {
          setSession(token, user, mustChange);
          setSessionState({ token, user, mustChangePassword: !!mustChange });
        }} />
      </Suspense>
    );
  }

  if (mustChangePassword) {
    return (
      <Suspense fallback={<ViewLoading />}>
        <ChangePassword
          user={session.user}
          onChanged={handlePasswordChanged}
          onLogout={handleLogout}
        />
      </Suspense>
    );
  }

  // All agent-type roles — standalone AgentPortal (no sidebar)
  if (isAgentRole(role)) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<ViewLoading />}>
          <AgentPortal currentUser={session.user} onLogout={handleLogout} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Qualifier uses sidebar layout — no standalone rendering

  const safeView = canAccess(role, view) ? view : defaultView(role);

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--color-bg)' }}>
      <Sidebar
        view={safeView}
        setView={setView}
        dataMode={dataMode}
        user={session.user}
        onLogout={handleLogout}
        leadBadge={leadBadge}
      />
      <main className="wc-main" style={{ flex:1, padding:'0 32px 32px 32px', minWidth:0 }}>
        <TopBar
          onOpenAi={() => setAiPanelOpen(true)}
          search={globalSearch}
          onSearch={handleGlobalSearch}
          backendLive={backendLive}
        />

        <Suspense fallback={<ViewLoading />}>
          <ErrorBoundary>
            {safeView === 'dashboard'  && (
              <Dashboard users={roleFilteredUsers} onSelectUser={setSelectedUser} uncalledLeadsCount={uncalledLeadsCount} />
            )}
            {safeView === 'users' && (
              <Users
                users={searchedUsers}
                setUsers={setUsers}
                onSelectUser={setSelectedUser}
                onCreateUser={handleCreateUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
              />
            )}
            {safeView === 'onboarding' && (
              <OnboardingFlow
                users={roleFilteredUsers}
                setUsers={setUsers}
                onCreateUser={handleCreateUser}
                onUpdateUser={handleUpdateUser}
              />
            )}
            {safeView === 'automation' && <AutomationPanel users={roleFilteredUsers} />}
            {safeView === 'franchise'  && <FranchiseResearch />}
            {safeView === 'leads'      && <LeadGeneration users={users} setUsers={setUsers} setLeadBadge={setLeadBadge} />}
            {safeView === 'data'       && (
              <DataIntegration
                dataMode={dataMode}
                setDataMode={setDataMode}
                users={roleFilteredUsers}
                setUsers={setUsers}
              />
            )}
            {safeView === 'settings'   && (
              <Settings dataMode={dataMode} setDataMode={setDataMode} />
            )}
            {safeView === 'recruiter-portal' && (
              <RecruiterPortal currentUser={session.user} />
            )}
            {safeView === 'qualifier-portal' && (
              <QualifierPortal currentUser={session.user} onLogout={handleLogout} setUsers={setUsers} embedded />
            )}
            {safeView === 'qualifier-completed' && (
              <QualifierPortal currentUser={session.user} onLogout={handleLogout} setUsers={setUsers} embedded completedView />
            )}
          </ErrorBoundary>
        </Suspense>
      </main>

      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdateUser={handleUpdateUser}
        />
      )}
      {aiPanelOpen && <AiAssistant users={roleFilteredUsers} onClose={() => setAiPanelOpen(false)} />}
    </div>
  );
}
