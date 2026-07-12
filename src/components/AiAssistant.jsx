import React, { useState } from 'react';
import { askClaude } from '../lib/claudeClient.js';

export default function AiAssistant({ onClose, users }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "I'm Claude, integrated into the Wave Closers console. Ask me anything — e.g., 'who's underperforming?', 'draft a welcome email for an ISO Investor', or 'summarise this week'.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    const systemContext = `You are an AI assistant embedded in the Wave Closers PM/Ops console. The user is Riyash, the Project Manager. Be concise and professional.

USER DATA (subset):
${JSON.stringify(users.slice(0, 8), null, 2)}

USER TYPES: Referral Partner, Independent Rep, Authorized Reseller, ISO Investor (DONE FOR YOU).
ROUTING: Referral & Rep → CX directly. Reseller & ISO → Recruiter → CX.
Keep replies short (2-4 sentences) unless asked for detail.`;

    const reply = await askClaude(
      systemContext,
      next.filter((m) => m.role !== 'system')
    );
    setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    setLoading(false);
  }

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <div style={styles.drawer}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>AI Assistant</div>
            <h2 style={styles.title}>Ask Claude</h2>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">×</button>
        </div>
        <div style={styles.body}>
          <div style={styles.messages}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  ...styles.bubble,
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  background: m.role === 'user' ? 'var(--color-primary)' : '#F5F3EE',
                  color: m.role === 'user' ? 'white' : '#222',
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ ...styles.bubble, background: '#F5F3EE', color: '#888' }}>
                Thinking…
              </div>
            )}
          </div>
          <div style={styles.inputRow}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Type your question…"
              style={styles.input}
            />
            <button onClick={send} style={styles.sendBtn} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 },
  drawer: {
    position: 'fixed',
    top: 0,
    right: 0,
    width: 480,
    height: '100vh',
    background: 'white',
    zIndex: 51,
    overflowY: 'auto',
    boxShadow: 'var(--shadow-drawer)',
  },
  header: {
    padding: 24,
    borderBottom: '1px solid var(--color-line)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: '0.1em',
    color: '#888',
    textTransform: 'uppercase',
  },
  title: { margin: '4px 0 0 0', fontSize: 22 },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 24,
    color: '#888',
    padding: 0,
    lineHeight: 1,
  },
  body: {
    padding: 24,
    height: 'calc(100vh - 200px)',
    display: 'flex',
    flexDirection: 'column',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  bubble: {
    maxWidth: '85%',
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  inputRow: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #DDD3C2',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
    background: 'white',
  },
  sendBtn: {
    background: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    padding: '10px 18px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
  },
};
