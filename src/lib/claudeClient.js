/**
 * Claude API client.
 *
 * NOTE — security:
 * In a real deployment, the Claude API key must never live in the frontend.
 * This client should call a backend proxy (e.g. /api/claude) that holds the
 * key server-side. The function signature below is the same either way.
 *
 * For the prototype it falls back to a friendly message when no proxy is
 * configured so demos don't crash.
 */

const PROXY_URL = import.meta.env.VITE_CLAUDE_PROXY_URL || '';

/**
 * Send a chat message to Claude with system context.
 * @param {string} systemContext - High-level instructions + data context.
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 * @returns {Promise<string>} Claude's reply text.
 */
export async function askClaude(systemContext, messages) {
  if (!PROXY_URL) {
    return '[Demo mode] Claude proxy not configured. Set VITE_CLAUDE_PROXY_URL in your .env to enable live AI responses.';
  }

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemContext,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude proxy returned ${response.status}`);
    }

    const data = await response.json();
    const text = data.content
      ?.map((block) => block.text || '')
      .filter(Boolean)
      .join('\n');

    return text || '(No response)';
  } catch (err) {
    console.error('askClaude error:', err);
    return '(Connection error — check that the Claude proxy is running.)';
  }
}
