import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const backendBase = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

      const res = await fetch(`${backendBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        // Try to read JSON error, fallback to plain text
        let errMsg = 'Login failed';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch {
          const txt = await res.text();
          if (txt && txt.startsWith('<!')) errMsg = 'Server returned HTML (likely 404). Ensure backend is running.';
          else errMsg = txt || errMsg;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();

      // Success
      if (onLogin) {
        onLogin(data.token, data.user);
      }
    } catch (err) {
      setError(err.message || 'Server connection error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.container}>
      {/* ── Background decorative orbs ── */}
      <div style={S.orb1} />
      <div style={S.orb2} />

      {/* ── Login Card ── */}
      <div style={S.card}>
        <div style={S.brandHeader}>
          <div style={S.logoMark}>WC</div>
          <div>
            <h1 style={S.title}>WAVE CLOSERS</h1>
            <p style={S.subtitle}>Internal Operations Console</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={S.form}>
          <h2 style={S.formTitle}>Operator Sign In</h2>

          {error && <div style={S.errorBanner}>{error}</div>}

          <div style={S.inputGroup}>
            <label style={S.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. riyash@waveclosers.com"
              style={S.input}
              disabled={loading}
              required
            />
          </div>

          <div style={S.inputGroup}>
            <label style={S.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={S.input}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" style={S.btn} disabled={loading}>
            {loading ? <span style={S.spinner} /> : 'Sign In →'}
          </button>
        </form>

        <div style={S.footer}>
          <div style={S.footerTitle}>Demo Credentials</div>
          <div style={S.footerCreds}>
            <div>Email: <code style={S.code}>riyash@waveclosers.com</code></div>
            <div>Password: <code style={S.code}>password</code></div>
          </div>
        </div>
      </div>

      {/* Inject CSS animation styles */}
      <style>{`
        @keyframes float1 {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(80px, 60px) scale(1.2); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes float2 {
          0% { transform: translate(0, 0) scale(1.1); }
          50% { transform: translate(-60px, -80px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1.1); }
        }
        input:focus {
          border-color: #D97A5E !important;
          box-shadow: 0 0 10px rgba(217, 122, 94, 0.4) !important;
          background: rgba(255, 255, 255, 0.08) !important;
        }
      `}</style>
    </div>
  );
}

const S = {
  container: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100vw',
    background: '#0B0F19', // Deep dark obsidian background
    overflow: 'hidden',
    padding: 20,
    fontFamily: "'Inter', sans-serif",
  },
  orb1: {
    position: 'absolute',
    top: '15%',
    left: '20%',
    width: 350,
    height: 350,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(31, 78, 121, 0.6) 0%, rgba(31, 78, 121, 0) 70%)',
    filter: 'blur(40px)',
    animation: 'float1 20s infinite ease-in-out',
    zIndex: 1,
  },
  orb2: {
    position: 'absolute',
    bottom: '15%',
    right: '20%',
    width: 380,
    height: 380,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(217, 122, 94, 0.4) 0%, rgba(217, 122, 94, 0) 70%)',
    filter: 'blur(50px)',
    animation: 'float2 24s infinite ease-in-out',
    zIndex: 1,
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 440,
    padding: '40px 32px 32px 32px',
    background: 'rgba(15, 23, 42, 0.45)', // Glassy slate container
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    backdropFilter: 'blur(16px) saturate(180%)',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
    color: '#F8FAFC',
    zIndex: 2,
  },
  brandHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 36,
  },
  logoMark: {
    width: 44,
    height: 44,
    background: '#1F4E79',
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 15,
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(31, 78, 121, 0.4)',
    letterSpacing: '0.05em',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: '0.15em',
    color: '#FFF',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  formTitle: {
    margin: '0 0 4px 0',
    fontSize: 20,
    fontWeight: 600,
    color: '#FFF',
  },
  errorBanner: {
    padding: '12px 14px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    fontSize: 13,
    color: '#FCA5A5',
    lineHeight: 1.5,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#94A3B8',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    fontSize: 14,
    color: '#FFF',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  btn: {
    background: '#1F4E79',
    color: '#FFF',
    border: 'none',
    padding: '14px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
    transition: 'all 0.2s',
    boxShadow: '0 4px 14px rgba(31, 78, 121, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 20,
    height: 20,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#FFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  footer: {
    marginTop: 32,
    paddingTop: 24,
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  footerTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 8,
  },
  footerCreds: {
    fontSize: 12,
    color: '#64748B',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    lineHeight: 1.6,
  },
  code: {
    fontFamily: 'monospace',
    background: 'rgba(255,255,255,0.04)',
    padding: '2px 4px',
    borderRadius: 4,
    color: '#E2E8F0',
  },
};
