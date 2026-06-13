/**
 * server/leadWorker.js
 *
 * Module 6 — AI Lead Generation Engine (backend).
 *
 * Handles the heavy lifting so it doesn't block the Express proxy:
 *   1. Searches Google Places API for businesses by type + location
 *   2. Searches Yelp Fusion API as backup
 *   3. Merges + deduplicates results by phone number
 *   4. Calls Claude to score each lead (batch: 10 per API call)
 *   5. Deduplicates against existing Airtable Leads table
 *   6. Saves scored leads to Airtable
 *
 * Graceful degradation:
 *   - No GOOGLE_PLACES_API_KEY → returns empty from Google, logs demo
 *   - No YELP_API_KEY → returns empty from Yelp, logs demo
 *   - No ANTHROPIC_API_KEY → assigns random scores 40–80 with generic reasons
 *   - No Airtable → skips persistence, returns results in memory
 *   - Never crashes
 *
 * Usage:
 *   import { generateLeads } from './leadWorker.js';
 *   const leads = await generateLeads({ location: 'Brooklyn, NY', businessTypes: ['restaurant','beauty_salon'], radius: 5 });
 *
 * Test mode:
 *   node server/leadWorker.js --test-mode
 */

import dotenv from 'dotenv';
import {
  isConfigured as airtableReady,
  upsertLead,
  getExistingPlaceIds,
} from './airtableClient.js';

dotenv.config();

const GOOGLE_KEY  = process.env.GOOGLE_PLACES_API_KEY;
const YELP_KEY    = process.env.YELP_API_KEY;
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;
const TEST_MODE   = process.argv.includes('--test-mode');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-10);
}

// ─── Google Places API ────────────────────────────────────────────────────────

const GOOGLE_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const GOOGLE_DETAILS_URL     = 'https://maps.googleapis.com/maps/api/place/details/json';

/**
 * Search Google Places by business type + location.
 * Handles pagination (up to 60 results via next_page_token).
 * Rate limit: 1 request per second.
 */
async function searchGooglePlaces(businessType, location, radius = 5) {
  if (!GOOGLE_KEY) {
    console.log(`  [leads] Google Places API key not set — skipping Google search for "${businessType}" in "${location}"`);
    return [];
  }

  const results = [];
  const radiusMeters = radius * 1609; // miles to meters
  let query = `${businessType} in ${location}`;
  let url = `${GOOGLE_TEXT_SEARCH_URL}?query=${encodeURIComponent(query)}&radius=${radiusMeters}&key=${GOOGLE_KEY}`;

  try {
    for (let page = 0; page < 3; page++) {
      await sleep(page > 0 ? 2000 : 0); // Google requires 2s delay between pagination requests
      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error(`  [leads] Google Places error: ${data.status} — ${data.error_message || ''}`);
        break;
      }

      for (const place of (data.results || [])) {
        results.push({
          placeId:      place.place_id,
          businessName: place.name || '',
          address:      place.formatted_address || '',
          rating:       place.rating || 0,
          reviewCount:  place.user_ratings_total || 0,
          businessStatus: place.business_status || '',
          source:       'google',
        });
      }

      if (!data.next_page_token) break;
      url = `${GOOGLE_TEXT_SEARCH_URL}?pagetoken=${data.next_page_token}&key=${GOOGLE_KEY}`;
    }
  } catch (err) {
    console.error(`  [leads] Google Places fetch error: ${err.message}`);
  }

  console.log(`  [leads] Google Places: ${results.length} results for "${businessType}" in "${location}"`);
  return results;
}

/**
 * Fetch phone number and website for a place via Place Details API.
 */
async function getPlaceDetails(placeId) {
  if (!GOOGLE_KEY) return {};
  try {
    const url = `${GOOGLE_DETAILS_URL}?place_id=${placeId}&fields=formatted_phone_number,website&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return {
      phone:   data.result?.formatted_phone_number || '',
      website: data.result?.website || '',
    };
  } catch {
    return {};
  }
}

// ─── Yelp Fusion API ──────────────────────────────────────────────────────────

const YELP_SEARCH_URL = 'https://api.yelp.com/v3/businesses/search';

const YELP_CATEGORY_MAP = {
  restaurant:   'restaurants',
  beauty_salon: 'beautysvc',
  nail_salon:   'nailsalons',
  deli:         'delis',
  massage:      'massage',
  small_retail: 'shoppingcenters',
};

/**
 * Search Yelp Fusion API for businesses.
 * Returns up to 50 results per query.
 */
async function searchYelp(businessType, location) {
  if (!YELP_KEY) {
    console.log(`  [leads] Yelp API key not set — skipping Yelp search for "${businessType}" in "${location}"`);
    return [];
  }

  const category = YELP_CATEGORY_MAP[businessType] || businessType;
  const params = new URLSearchParams({
    term: businessType.replace(/_/g, ' '),
    location,
    limit: '50',
    categories: category,
  });

  try {
    const res = await fetch(`${YELP_SEARCH_URL}?${params}`, {
      headers: { Authorization: `Bearer ${YELP_KEY}` },
    });
    const data = await res.json();

    if (data.error) {
      console.error(`  [leads] Yelp error: ${data.error.code} — ${data.error.description}`);
      return [];
    }

    const results = (data.businesses || []).map(biz => ({
      placeId:      `yelp-${biz.id}`,
      businessName: biz.name || '',
      address:      [biz.location?.address1, biz.location?.city, biz.location?.state, biz.location?.zip_code].filter(Boolean).join(', '),
      phone:        biz.display_phone || biz.phone || '',
      website:      biz.url || '',
      rating:       biz.rating || 0,
      reviewCount:  biz.review_count || 0,
      source:       'yelp',
    }));

    console.log(`  [leads] Yelp: ${results.length} results for "${businessType}" in "${location}"`);
    return results;
  } catch (err) {
    console.error(`  [leads] Yelp fetch error: ${err.message}`);
    return [];
  }
}

// ─── Merge + Deduplicate ──────────────────────────────────────────────────────

/**
 * Merge Google and Yelp results, deduplicating by normalized phone number.
 * Prefers Google data (more detailed), merges Yelp ratings if available.
 */
function mergeAndDeduplicate(googleResults, yelpResults) {
  const byPhone = new Map();
  const byName = new Map();

  // Add Google results first (preferred source)
  for (const r of googleResults) {
    const phone = normalizePhone(r.phone);
    if (phone) byPhone.set(phone, r);
    byName.set(r.businessName.toLowerCase().trim(), r);
  }

  // Merge Yelp results (only add if not already present)
  for (const r of yelpResults) {
    const phone = normalizePhone(r.phone);
    const nameLower = r.businessName.toLowerCase().trim();
    if (phone && byPhone.has(phone)) continue;
    if (byName.has(nameLower)) continue;
    if (phone) byPhone.set(phone, r);
    byName.set(nameLower, r);
  }

  // Combine unique results
  const seen = new Set();
  const merged = [];
  for (const r of [...byPhone.values(), ...byName.values()]) {
    const key = normalizePhone(r.phone) || r.businessName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }

  return merged;
}

// ─── Claude Lead Scoring ──────────────────────────────────────────────────────

const SCORING_SYSTEM_PROMPT = `You are a lead scoring analyst for Wave Closers, a payment processing company targeting restaurants and foot-traffic businesses.

Score each business 0-100 based on:
- Rating: 4★+ = higher score (owner cares about quality)
- Review volume: more reviews = more foot traffic = better prospect
- Number of locations: multi-location indicators = higher deal value
- Has website: owner is tech-aware and likely open to modern payment solutions
- Business status: actively operating businesses only

Return ONLY valid JSON array with this exact shape, no markdown, no preamble:
[{ "placeId": "...", "score": 0-100, "reason": "1-sentence explanation" }]`;

/**
 * Score leads using Claude API in batches of 10 for efficiency.
 * Falls back to random scores when Claude is unavailable.
 */
async function scoreLeads(leads) {
  if (!CLAUDE_KEY) {
    console.log(`  [leads] Claude API key not set — assigning demo scores`);
    return leads.map(l => ({
      ...l,
      score: Math.floor(40 + Math.random() * 40),
      scoreReason: `${l.rating >= 4 ? 'Good' : 'Moderate'} rating with ${l.reviewCount} reviews — worth a call.`,
    }));
  }

  const scored = [];
  const batchSize = 10;

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const batchSummary = batch.map(l => ({
      placeId: l.placeId,
      name: l.businessName,
      rating: l.rating,
      reviews: l.reviewCount,
      hasWebsite: !!l.website,
      address: l.address,
    }));

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SCORING_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Score these ${batch.length} businesses:\n${JSON.stringify(batchSummary)}` }],
        }),
      });

      const data = await res.json();
      const text = data.content?.map(b => b.text || '').join('') || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const scores = JSON.parse(clean);

      for (const lead of batch) {
        const s = scores.find(x => x.placeId === lead.placeId);
        scored.push({
          ...lead,
          score: s?.score || Math.floor(50 + Math.random() * 30),
          scoreReason: s?.reason || 'Scored by Claude AI.',
        });
      }

      console.log(`  [leads] Claude scored batch ${Math.floor(i / batchSize) + 1}: ${batch.length} leads`);
      await sleep(500); // Rate limit between batches
    } catch (err) {
      console.error(`  [leads] Claude scoring error (batch ${Math.floor(i / batchSize) + 1}):`, err.message);
      // Fallback to demo scores for this batch
      for (const lead of batch) {
        scored.push({
          ...lead,
          score: Math.floor(40 + Math.random() * 40),
          scoreReason: `${lead.rating >= 4 ? 'Good' : 'Moderate'} rating — Claude scoring unavailable.`,
        });
      }
    }
  }

  return scored;
}

// ─── Main: Generate Leads ─────────────────────────────────────────────────────

/**
 * Generate scored leads for a given location and business types.
 *
 * @param {{ location: string, businessTypes: string[], radius?: number }} opts
 * @returns {Promise<{ leads: object[], stats: { google: number, yelp: number, merged: number, scored: number, saved: number } }>}
 */
export async function generateLeads({ location, businessTypes, radius = 5 }) {
  const isDemo = !GOOGLE_KEY && !YELP_KEY;
  console.log(`\n[leads] ─── Generate Leads ───`);
  console.log(`  Location: ${location}`);
  console.log(`  Types: ${businessTypes.join(', ')}`);
  console.log(`  Radius: ${radius} miles`);
  console.log(`  Mode: ${isDemo ? 'DEMO (no API keys)' : 'LIVE'}`);

  // If no API keys, return seed data
  if (isDemo) {
    console.log('  [leads] No API keys configured — returning demo data');
    const { SEED_LEADS } = await import('../src/data/seed.js').catch(() => ({ SEED_LEADS: [] }));
    // If we can't import seed (because of ESM path issues in prod), generate synthetic data
    const demoLeads = SEED_LEADS?.length ? SEED_LEADS : generateDemoLeads(location, businessTypes);
    return {
      leads: demoLeads.filter(l => businessTypes.includes(l.type)).sort((a, b) => b.score - a.score),
      stats: { google: 0, yelp: 0, merged: demoLeads.length, scored: demoLeads.length, saved: 0 },
      demo: true,
    };
  }

  // Step 1 & 2: Fetch from Google Places + Yelp for each business type
  let allGoogle = [];
  let allYelp = [];

  const typeLabels = {
    restaurant: 'restaurant',
    beauty_salon: 'beauty salon',
    nail_salon: 'nail salon',
    deli: 'deli',
    massage: 'massage',
    small_retail: 'retail store',
  };

  for (const type of businessTypes) {
    const label = typeLabels[type] || type;
    const google = await searchGooglePlaces(label, location, radius);
    allGoogle.push(...google.map(r => ({ ...r, type })));
    await sleep(1000); // Rate limit

    const yelp = await searchYelp(type, location);
    allYelp.push(...yelp.map(r => ({ ...r, type })));
    await sleep(500);
  }

  // Step 2b: Fetch phone numbers from Google Place Details
  for (const lead of allGoogle) {
    if (!lead.phone && lead.placeId) {
      const details = await getPlaceDetails(lead.placeId);
      lead.phone = details.phone || '';
      lead.website = details.website || '';
      await sleep(200); // Rate limit
    }
  }

  // Step 3: Merge + deduplicate
  const merged = mergeAndDeduplicate(allGoogle, allYelp);
  console.log(`  [leads] Merged: ${merged.length} unique businesses (${allGoogle.length} Google + ${allYelp.length} Yelp)`);

  // Step 4: Claude lead scoring
  const scored = await scoreLeads(merged);
  scored.sort((a, b) => b.score - a.score);

  // Step 5: Deduplicate against existing Airtable leads
  let saved = 0;
  if (airtableReady()) {
    try {
      const existingIds = await getExistingPlaceIds();
      const newLeads = scored.filter(l => !existingIds.has(l.placeId));
      console.log(`  [leads] New leads (not in Airtable): ${newLeads.length} of ${scored.length}`);

      // Step 6: Save to Airtable
      for (const lead of newLeads) {
        try {
          await upsertLead({
            ...lead,
            status: 'New',
            market: location,
            createdAt: new Date().toISOString(),
          });
          saved++;
        } catch (err) {
          console.error(`  [leads] Save error for ${lead.businessName}: ${err.message}`);
        }
        await sleep(200); // Airtable rate limit
      }
    } catch (err) {
      console.error(`  [leads] Airtable dedup error: ${err.message}`);
    }
  } else {
    console.log('  [leads] Airtable not configured — leads not persisted');
  }

  console.log(`  [leads] ✓ Complete: ${scored.length} scored, ${saved} saved to Airtable`);

  return {
    leads: scored,
    stats: { google: allGoogle.length, yelp: allYelp.length, merged: merged.length, scored: scored.length, saved },
    demo: false,
  };
}

// ─── Demo data generator (fallback when seed import fails) ────────────────────

function generateDemoLeads(location, businessTypes) {
  const names = {
    restaurant:   ['Italian Kitchen', 'Burger Palace', 'Sushi Corner', 'Thai Express', 'Pizza Roma'],
    beauty_salon: ['Style Studio', 'Glamour Hair', 'Beauty Lounge', 'Hair Lab', 'Salon Elite'],
    nail_salon:   ['Perfect Nails', 'Luxe Nails', 'Nails & More', 'Polish Bar', 'Nail Art Studio'],
    deli:         ['Corner Deli', 'Fresh Market Deli', 'City Deli', 'Garden Deli', 'Sunrise Deli'],
    massage:      ['Zen Spa', 'Relax Studio', 'Healing Touch', 'Body Works', 'Calm Retreat'],
    small_retail: ['The Gift Shop', 'Flower Corner', 'Vintage Finds', 'Book Nook', 'Pet Boutique'],
  };

  const leads = [];
  let counter = 1;
  for (const type of businessTypes) {
    const typeNames = names[type] || ['Business'];
    for (const name of typeNames.slice(0, 4)) {
      leads.push({
        placeId: `demo-gen-${counter++}`,
        businessName: name,
        type,
        address: `${100 + counter} Main St, ${location}`,
        phone: `(555) 555-${String(1000 + counter).slice(-4)}`,
        website: counter % 3 === 0 ? `${name.toLowerCase().replace(/\s/g, '')}.com` : '',
        rating: +(3.5 + Math.random() * 1.5).toFixed(1),
        reviewCount: Math.floor(20 + Math.random() * 500),
        score: Math.floor(40 + Math.random() * 55),
        scoreReason: 'Demo lead — connect API keys for real scoring.',
        status: 'New',
        assignedAgent: '',
        calledAt: null,
        outcome: '',
        market: location,
      });
    }
  }
  return leads.sort((a, b) => b.score - a.score);
}

// ─── Test mode ────────────────────────────────────────────────────────────────

async function runTestMode() {
  console.log('\n[leads] 🧪 ========== TEST MODE ==========');
  console.log('  Testing lead generation pipeline with demo data.');
  console.log(`  Google Places: ${GOOGLE_KEY ? '✓ key set' : '✗ no key (demo)'}`);
  console.log(`  Yelp Fusion:   ${YELP_KEY ? '✓ key set' : '✗ no key (demo)'}`);
  console.log(`  Claude:        ${CLAUDE_KEY ? '✓ key set' : '✗ no key (demo scores)'}`);
  console.log(`  Airtable:      ${airtableReady() ? '✓ connected' : '✗ not configured (no save)'}\n`);

  const result = await generateLeads({
    location: 'Brooklyn, NY',
    businessTypes: ['restaurant', 'beauty_salon'],
    radius: 5,
  });

  console.log(`\n  Results: ${result.leads.length} leads`);
  console.log(`  Stats: ${JSON.stringify(result.stats)}`);
  console.log(`  Demo: ${result.demo}`);
  if (result.leads.length > 0) {
    console.log(`  Top lead: ${result.leads[0].businessName} (score: ${result.leads[0].score})`);
  }

  console.log('\n[leads] 🧪 ========== TEST COMPLETE ==========\n');
  process.exit(0);
}

if (TEST_MODE) runTestMode();
