/**
 * server/apifyClient.js
 *
 * Apify & Craigslist scraper client for real candidate resumes.
 * Supports Apify, Craigslist Internal SAPI, and RSS fallbacks.
 */

/**
 * Verify the Apify actor is reachable ONCE at startup.
 * Returns true if the actor exists and the API key is valid.
 * Call this once before the distribution loop and pass the result down
 * so failed 404s don't waste a round-trip on every keyword×city pair.
 */
export async function verifyApifyActor() {
  const apiKey  = process.env.APIFY_API_KEY;
  const actorId = process.env.APIFY_ACTOR_ID || 'petrpatek~craigslist-scraper';

  if (!apiKey) {
    console.warn('[Apify] No APIFY_API_KEY configured — skipping Apify entirely this run');
    return false;
  }

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}?token=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      console.error(
        `[Apify] Actor "${actorId}" not found (HTTP ${res.status}). ` +
        `Disabling Apify for this run. ` +
        `Confirm APIFY_ACTOR_ID in Railway env matches your Apify console.`
      );
      return false;
    }
    console.log(`[Apify] ✓ Actor verified: ${actorId}`);
    return true;
  } catch (err) {
    console.error('[Apify] Verification network error:', err.message, '— disabling Apify for this run');
    return false;
  }
}


export function extractPhone(text) {
  if (!text) return '';
  return text.match(/\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}/)?.[0] || '';
}

export async function fetchViaApify(citySlug, keywords, limit = 100) {
  const apiKey = process.env.APIFY_API_KEY;

  if (!apiKey) {
    throw new Error('APIFY_API_KEY not set');
  }

  const actorId = process.env.APIFY_ACTOR_ID || 'petrpatek~craigslist-scraper';

  // Build the Craigslist resume search URL
  const searchUrl = `https://${citySlug}.craigslist.org/search/res?query=${encodeURIComponent(keywords)}&sort=date`;
  console.log(`[Apify] Scraping: ${searchUrl}`);

  const response = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${apiKey}&timeout=120&memory=512`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: searchUrl }],
        maxItems:  limit,
        proxyConfiguration: {
          useApifyProxy: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Apify API ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(`Apify returned unexpected format: ${typeof data}`);
  }

  console.log(`[Apify] Raw results for ${citySlug}: ${data.length}`);

  // Filter out posts older than 60 days
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const results = data
    .filter(item => {
      const url = (item.url || item.link || '').trim();
      if (!url) {
        console.warn('[Apify] Item has no URL — skipping');
        return false;
      }
      if (!url.includes('craigslist.org')) {
        console.warn(`[Apify] Not a Craigslist URL: ${url} — skipping`);
        return false;
      }
      // Filter old posts
      if (item.time || item.date) {
        const postDate = new Date(item.time || item.date);
        if (!isNaN(postDate.getTime()) && postDate < sixtyDaysAgo) return false;
      }
      return true;
    })
    .map(item => {
      let url = (item.url || item.link || '').trim();

      // Fix common URL format issues from Apify
      // Sometimes Apify returns search page URL instead of post URL
      // Real post URL format: https://city.craigslist.org/xxx/res/1234567890.html
      // Bad URL format: https://city.craigslist.org/search/res?query=sales
      if (url.includes('/search/')) {
        console.warn(`[Apify] Got search URL instead of post URL: ${url} — skipping`);
        return null;
      }

      return {
        title:       (item.title || 'Resume Post').trim(),
        description: (item.postingBody || item.description || item.body || '')
                     .replace(/<[^>]+>/g, '').trim().slice(0, 500),
        phone:       extractPhone(item.postingBody || item.description || item.body || ''),
        link:        url,
        date:        item.time || item.date || new Date().toISOString(),
        source:      'apify',
      };
    })
    .filter(item => item !== null && item.link && !item.link.includes('waveclosers.com'));

  console.log(`[Apify] ${results.length} valid post URLs after filtering`);
  return results;
}


/**
 * Fetch resumes from Craigslist's internal SAPI (JSON).
 * Does NOT require Apify or any paid scraper — queries the same API the CL browser app uses.
 */
export async function fetchViaCLSAPI(citySlug, keywords, limit = 50) {
  const url = `https://sapi.craigslist.org/web/v8/postings/search/full?batch=1-0-360-0-0&cc=US&lang=en&query=${encodeURIComponent(keywords)}&searchPath=res`;

  console.log(`[CL-SAPI] Fetching resumes: city=${citySlug} query="${keywords}"`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': `https://${citySlug}.craigslist.org/`,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`CL SAPI returned ${res.status}`);

  const json = await res.json();
  const rawItems = json?.data?.items || [];

  const results = rawItems
    .filter(item => Array.isArray(item) && item.length >= 9)
    .map(item => {
      const rawTitle    = String(item[8] || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
      const title       = rawTitle.replace(/^(\d+,)+/, '').trim();
      const postingHash = Array.isArray(item[6]) ? item[6][1] : String(item[6] || item[0] || '');

      let pathSlug = '';
      if (Array.isArray(item[7])) {
        pathSlug = item[7].find(x => typeof x === 'string' && !/^\d+:/.test(x)) || '';
      } else if (typeof item[7] === 'string' && !/^\d+:/.test(item[7])) {
        pathSlug = item[7];
      }

      if (!pathSlug) {
        pathSlug = (title || 'posting')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'posting';
      }

      const link = postingHash
        ? `https://www.craigslist.org/view/d/${pathSlug}/${postingHash}`
        : `https://${citySlug}.craigslist.org/search/res`;

      return { title, link, postingId: postingHash, description: '', phone: '', email: '', date: '', source: 'cl-sapi', market: citySlug };
    })
    .filter(item => item.title && item.link && !item.link.includes('waveclosers.com') && !item.link.includes('/search/'))
    .slice(0, limit);

  console.log(`[CL-SAPI] ${rawItems.length} raw items → ${results.length} usable resumes for ${citySlug}`);
  return results;
}



/**
 * Per-city circuit breaker — resets every worker run.
 * Once a city gets a 403/block on ANY method, all subsequent keyword
 * attempts for that city are skipped immediately without a network hit.
 */
export const blockedCitiesThisRun = new Set();

export async function fetchViaRSS(citySlug, keywords, limit, _blockedCities = blockedCitiesThisRun) {
  // Circuit breaker — skip immediately if this city already blocked
  if (_blockedCities.has(citySlug)) {
    console.log(`[Craigslist RSS] Skipping ${citySlug} — already blocked this run`);
    return [];
  }

  const url = `https://${citySlug}.craigslist.org/search/res?query=${encodeURIComponent(keywords)}&format=rss&sort=date`;
  console.log('[Craigslist RSS] Fallback fetch:', url);

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 10000);

  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':     'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 403) {
    console.warn(`[Craigslist RSS] 403 for ${citySlug} — marking blocked for rest of this run`);
    _blockedCities.add(citySlug);
    return [];
  }
  if (!res.ok) throw new Error(`Craigslist RSS returned ${res.status}`);

  const xml = await res.text();
  if (xml.includes('<title>blocked</title>') || xml.includes('blocked')) {
    console.warn(`[Craigslist RSS] Block detected in body for ${citySlug} — marking blocked`);
    _blockedCities.add(citySlug);
    return [];
  }

  if (!xml.includes('<item>')) {
    console.warn('[Craigslist RSS] No items in response for:', citySlug);
    return [];
  }

  const items    = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const title = (
      block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
      block.match(/<title>(.*?)<\/title>/)?.[1] || ''
    ).trim();
    let link = (
      block.match(/<link>(.*?)<\/link>/)?.[1] ||
      block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || ''
    ).trim();
    if (link.startsWith('//')) link = 'https:' + link;
    else if (link.startsWith('http://')) link = link.replace('http://', 'https://');
    const desc = (
      block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
      block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || ''
    ).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
    const date  = (block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '').trim();
    const phone = desc.match(/\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}/)?.[0] || '';
    const email = desc.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';

    if (title && link) {
      items.push({ title, description: desc, phone, email, link, date, market: citySlug });
    }
  }

  console.log(`[Craigslist RSS] ${items.length} resumes found for ${citySlug}`);
  return items;
}

/**
 * Direct Craigslist HTML scraper for candidate resumes.
 * Always returns live, working 200 OK posting URLs extracted from current search results.
 */
export async function fetchViaHTML(citySlug, keywords, limit = 50) {
  const url = `https://${citySlug}.craigslist.org/search/res?query=${encodeURIComponent(keywords)}`;
  console.log(`[Craigslist HTML] Fetching live resumes for ${citySlug}: "${keywords}"`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`Craigslist HTML returned ${res.status}`);

  const html = await res.text();
  const items = [];
  const seenLinks = new Set();

  const resultRegex = /<a[^>]*href="([^"]*craigslist\.org\/view\/d\/[^"]*|\/view\/d\/[^"]*|[^"]*craigslist\.org\/d\/[^"]*|\/d\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = resultRegex.exec(html)) !== null && items.length < limit) {
    let link = match[1].trim();
    if (link.startsWith('//')) link = 'https:' + link;
    else if (link.startsWith('/')) link = `https://${citySlug}.craigslist.org` + link;

    if (seenLinks.has(link)) continue;
    seenLinks.add(link);

    const rawTitle = match[2]
      .replace(/<[^>]+>/g, '')
      .replace(/\$\d+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!rawTitle || rawTitle.length < 3 || rawTitle.toLowerCase().includes('next page') || rawTitle.toLowerCase() === 'resumes') continue;

    items.push({
      title: rawTitle,
      link,
      description: `Candidate Resume from ${citySlug.toUpperCase()}: ${rawTitle}`,
      phone: '',
      email: '',
      date: new Date().toISOString().slice(0, 10),
      market: citySlug,
      source: 'html-scraper',
    });
  }

  console.log(`[Craigslist HTML] ${items.length} live working resumes found for ${citySlug}`);
  return items;
}

/**
 * Robust multi-tier Craigslist resume search with fallbacks:
 * 1) Direct HTML Scraper (Always returns live 200 OK links)
 * 2) Apify (only if apifyAvailable=true — verified once at startup)
 * 3) CL SAPI (internal JSON API fallback)
 * 4) RSS (last resort — skipped for blocked cities via circuit breaker)
 *
 * @param {string}  citySlug       - Craigslist city slug (e.g. 'newyork')
 * @param {string}  keywords       - Search keywords
 * @param {number}  limit          - Max results to return
 * @param {boolean} apifyAvailable - Whether Apify actor was verified at startup
 * @param {Set}     blockedCities  - Per-run circuit breaker set (mutated in place)
 */
export async function fetchCraigslistResumesWithFallback(
  citySlug,
  keywords,
  limit = 50,
  apifyAvailable = false,
  blockedCities = blockedCitiesThisRun
) {
  // If this city already 403'd this run, skip it immediately
  if (blockedCities.has(citySlug)) {
    console.log(`[Craigslist] Skipping ${citySlug} — circuit breaker active`);
    return [];
  }

  try {
    const results = await fetchViaHTML(citySlug, keywords, limit);
    if (results.length > 0) return results;
    console.warn('[Craigslist] HTML Scraper returned 0 results, trying SAPI');
  } catch (htmlErr) {
    // Mark blocked if HTML also got a 403 (same anti-bot)
    if (htmlErr.message && htmlErr.message.includes('403')) {
      console.warn(`[Craigslist] HTML 403 for ${citySlug} — marking blocked for this run`);
      blockedCities.add(citySlug);
      return [];
    }
    console.warn('[Craigslist] HTML Scraper failed, trying SAPI:', htmlErr.message);
  }

  // Only try Apify if actor was verified working at startup
  if (apifyAvailable) {
    try {
      const results = await fetchViaApify(citySlug, keywords, limit);
      if (results.length > 0) return results;
    } catch (e) {
      console.warn('[Craigslist] Apify failed, falling back to CL SAPI:', e.message);
    }
  }

  try {
    const results = await fetchViaCLSAPI(citySlug, keywords, limit);
    if (results.length > 0) return results;
  } catch (sapiErr) {
    console.warn('[Craigslist] CL SAPI failed, trying RSS:', sapiErr.message);
  }

  try {
    return await fetchViaRSS(citySlug, keywords, limit, blockedCities);
  } catch (rssErr) {
    console.warn('[Craigslist] RSS fallback failed:', rssErr.message);
    return [];
  }
}
