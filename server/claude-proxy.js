/**
 * Wave Closers — Claude API Proxy
 * Keeps the Anthropic API key server-side.
 *
 * Setup:
 *   npm install express cors
 *   ANTHROPIC_API_KEY=sk-ant-... node server/claude-proxy.js
 *
 * Then in .env:
 *   VITE_CLAUDE_PROXY_URL=http://localhost:3001/api/claude
 */
const express = require('express');
const cors    = require('cors');
const app     = express();
const PORT    = process.env.PORT || 3001;

app.use(cors({ origin:['http://localhost:5173','http://localhost:4173'] }));
app.use(express.json({ limit:'1mb' }));

app.post('/api/claude', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error:'ANTHROPIC_API_KEY not set on server.' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({
        model:      req.body.model      || 'claude-sonnet-4-20250514',
        max_tokens: req.body.max_tokens || 1000,
        system:     req.body.system,
        messages:   req.body.messages,
      }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status:'ok', time: new Date().toISOString() }));
app.listen(PORT, () => console.log(`Claude proxy → http://localhost:${PORT}\nAPI key: ${process.env.ANTHROPIC_API_KEY ? '✓ set' : '✗ NOT SET'}`));
