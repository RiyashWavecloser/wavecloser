import React, { useState } from 'react';

function checkStrength(pw) {
  if (!pw) return { score: 0, tier: 'weak', label: '', color: '#999' };
  let score = 0;
  if (pw.length >= 10) score += 1;
  if (pw.length >= 14) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const banned = ['password', 'changeme', '123456', 'qwerty', 'letmein', 'waveclosers'];
  if (banned.some(b => pw.toLowerCase().includes(b))) score = Math.min(score, 1);
  if (score <= 1) return { score: 1, tier: 'weak',   label: 'Weak',   color: 'var(--color-red)' };
  if (score === 2) return { score: 2, tier: 'fair',   label: 'Fair',   color: 'var(--color-amber)' };
  if (score === 3) return { score: 3, tier: 'good',   label: 'Good',   color: '#5B8DEF' };
  return                  { score: 4, tier: 'strong', label: 'Strong', color: 'var(--color-green)' };
}

export default function ChangePassword({ onChanged, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = checkStrength(newPassword);

  // Define the 4 rules
  const ruleLen = newPassword.length >= 10;
  const ruleLetter = /[A-Za-z]/.test(newPassword);
  const ruleNumber = /[0-9]/.test(newPassword);
  const banned = ['password', 'changeme', '123456', 'qwerty', 'letmein', 'waveclosers'];
  const ruleNotCommon = newPassword ? !banned.some(b => newPassword.toLowerCase().includes(b)) : false;

  const allRulesPass = ruleLen && ruleLetter && ruleNumber && ruleNotCommon;
  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit = allRulesPass && passwordsMatch && currentPassword && !loading;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      const backendBase = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const token = localStorage.getItem('wc_session_token');

      const res = await fetch(`${backendBase}/api/auth/change-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        let errMsg = 'Password update failed';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch {
          const txt = await res.text();
          errMsg = txt || errMsg;
        }
        throw new Error(errMsg);
      }

      if (onChanged) {
        onChanged();
      }
    } catch (err) {
      setError(err.message || 'Server connection error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.container}>
      <div style={S.orb1} />
      <div style={S.orb2} />

      <div style={S.card}>
        <div style={S.brandHeader}>
          <div style={S.logoMark}>WC</div>
          <div>
            <h1 style={S.title}>WAVE CLOSERS</h1>
            <p style={S.subtitle}>Security Gate</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={S.form}>
          <h2 style={S.formTitle}>Change Password</h2>
          <p style={S.formDesc}>For security reasons, your account administrator requires you to update your password before accessing the console.</p>

          {error && <div style={S.errorBanner}>{error}</div>}

          <div style={S.inputGroup}>
            <label style={S.label}>Current Password</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              style={S.input}
              disabled={loading}
              required
            />
          </div>

          <div style={S.inputGroup}>
            <label style={S.label}>New Password</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
              style={S.input}
              disabled={loading}
              required
            />
            {newPassword && (
              <div style={S.strengthContainer}>
                <div style={S.strengthText}>
                  <span>Strength: <strong>{strength.label}</strong></span>
                </div>
                <div style={S.strengthBarBg}>
                  <div style={{
                    ...S.strengthBarFill,
                    width: `${(strength.score / 4) * 100}%`,
                    background: strength.color
                  }} />
                </div>
              </div>
            )}
          </div>

          <div style={S.inputGroup}>
            <label style={S.label}>Confirm New Password</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              style={S.input}
              disabled={loading}
              required
            />
            {confirmPassword && !passwordsMatch && (
              <div style={S.warningText}>Passwords do not match</div>
            )}
          </div>

          <div style={S.checkboxContainer}>
            <input
              type="checkbox"
              id="show-passwords"
              checked={showPasswords}
              onChange={e => setShowPasswords(e.target.checked)}
              style={S.checkbox}
            />
            <label htmlFor="show-passwords" style={S.checkboxLabel}>Show passwords</label>
          </div>

          {/* Validation Rules */}
          <div style={S.rulesContainer}>
            <div style={S.rulesTitle}>Password Requirements:</div>
            <div style={S.ruleRow}>
              <span style={{ ...S.ruleCheck, color: ruleLen ? 'var(--color-green)' : '#64748B' }}>
                {ruleLen ? '✓' : '○'}
              </span>
              <span style={{ ...S.ruleLabel, color: ruleLen ? '#FFF' : '#94A3B8' }}>At least 10 characters</span>
            </div>
            <div style={S.ruleRow}>
              <span style={{ ...S.ruleCheck, color: ruleLetter ? 'var(--color-green)' : '#64748B' }}>
                {ruleLetter ? '✓' : '○'}
              </span>
              <span style={{ ...S.ruleLabel, color: ruleLetter ? '#FFF' : '#94A3B8' }}>Contains a letter</span>
            </div>
            <div style={S.ruleRow}>
              <span style={{ ...S.ruleCheck, color: ruleNumber ? 'var(--color-green)' : '#64748B' }}>
                {ruleNumber ? '✓' : '○'}
              </span>
              <span style={{ ...S.ruleLabel, color: ruleNumber ? '#FFF' : '#94A3B8' }}>Contains a number</span>
            </div>
            <div style={S.ruleRow}>
              <span style={{ ...S.ruleCheck, color: ruleNotCommon ? 'var(--color-green)' : '#64748B' }}>
                {ruleNotCommon ? '✓' : '○'}
              </span>
              <span style={{ ...S.ruleLabel, color: ruleNotCommon ? '#FFF' : '#94A3B8' }}>Not a common password</span>
            </div>
          </div>

          <button type="submit" style={{ ...S.btn, opacity: canSubmit ? 1 : 0.6 }} disabled={!canSubmit}>
            {loading ? <span style={S.spinner} /> : 'Update Password →'}
          </button>
        </form>

        <div style={S.footer}>
          <button onClick={onLogout} style={S.logoutBtn}>
            Log out instead
          </button>
        </div>
      </div>

      <style>{`
        @keyframes float1 {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 30px) scale(1.1); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes float2 {
          0% { transform: translate(0, 0) scale(1.05); }
          50% { transform: translate(-30px, -40px) scale(0.95); }
          100% { transform: translate(0, 0) scale(1.05); }
        }
        input:focus {
          border-color: #D97A5E !important;
          box-shadow: 0 0 8px rgba(217, 122, 94, 0.2) !important;
          background: #FFFFFF !important;
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
    background: '#FAF8F4', // Matches var(--color-bg)
    overflow: 'hidden',
    padding: 20,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  orb1: {
    position: 'absolute',
    top: '10%',
    left: '15%',
    width: 400,
    height: 400,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(31, 78, 121, 0.06) 0%, rgba(31, 78, 121, 0) 70%)',
    filter: 'blur(30px)',
    animation: 'float1 20s infinite ease-in-out',
    zIndex: 1,
  },
  orb2: {
    position: 'absolute',
    bottom: '10%',
    right: '15%',
    width: 450,
    height: 450,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(217, 122, 94, 0.05) 0%, rgba(217, 122, 94, 0) 70%)',
    filter: 'blur(40px)',
    animation: 'float2 24s infinite ease-in-out',
    zIndex: 1,
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 440,
    padding: '40px 36px 36px 36px',
    background: '#FFFFFF', // Matches var(--color-surface)
    border: '1px solid #EBE6DC', // Matches var(--color-line)
    borderRadius: 16,
    boxShadow: '0 20px 48px rgba(31, 78, 121, 0.06)',
    color: '#1A1A1A', // Matches var(--color-ink)
    zIndex: 2,
  },
  brandHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  logoMark: {
    width: 44,
    height: 44,
    background: '#1F4E79', // Matches var(--color-primary)
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 15,
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(31, 78, 121, 0.25)',
    letterSpacing: '0.05em',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: '0.15em',
    color: '#1A1A1A',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: 11,
    color: '#D97A5E', // Matches var(--color-accent)
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  formTitle: {
    margin: '0 0 4px 0',
    fontSize: 22,
    fontWeight: 700,
    color: '#1A1A1A',
    letterSpacing: '-0.02em',
  },
  formDesc: {
    margin: '0 0 8px 0',
    fontSize: 13,
    color: '#777777', // Matches var(--color-muted)
    lineHeight: 1.5,
  },
  errorBanner: {
    padding: '12px 14px',
    background: '#FBE5E5', // Matches var(--color-red-bg)
    border: '1px solid rgba(212, 74, 74, 0.25)',
    borderRadius: 8,
    fontSize: 13,
    color: '#9B2727', // Matches var(--color-red-text)
    lineHeight: 1.5,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#777777',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: '#FFFFFF',
    border: '1px solid #EBE6DC',
    borderRadius: 8,
    fontSize: 14,
    color: '#1A1A1A',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  btn: {
    background: '#1F4E79',
    color: '#FFF',
    border: 'none',
    padding: '12px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
    transition: 'all 0.2s',
    boxShadow: '0 4px 14px rgba(31, 78, 121, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 18,
    height: 18,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#FFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  strengthContainer: {
    marginTop: 6,
  },
  strengthText: {
    fontSize: 11,
    color: '#777777',
    marginBottom: 4,
  },
  strengthBarBg: {
    height: 4,
    background: '#F5F1E8',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    transition: 'width 0.3s ease, background 0.3s ease',
  },
  warningText: {
    fontSize: 11,
    color: '#D49A2B',
    marginTop: 4,
  },
  checkboxContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  checkbox: {
    cursor: 'pointer',
    width: 14,
    height: 14,
    accentColor: '#1F4E79',
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#777777',
    cursor: 'pointer',
    userSelect: 'none',
  },
  rulesContainer: {
    padding: 12,
    background: '#F5F1E8',
    borderRadius: 8,
    border: '1px solid #EBE6DC',
  },
  rulesTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#777777',
    letterSpacing: '0.06em',
    marginBottom: 8,
  },
  ruleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  ruleCheck: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  ruleLabel: {
    fontSize: 12,
  },
  footer: {
    marginTop: 20,
    paddingTop: 16,
    borderTop: '1px solid #EBE6DC',
    textAlign: 'center',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: '#777777',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline',
    transition: 'color 0.2s',
    fontWeight: 500,
  },
};
