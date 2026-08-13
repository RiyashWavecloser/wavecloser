/**
 * server/apifyClient.js
 *
 * Apify & Craigslist scraper client for real candidate resumes.
 * Supports Apify, Craigslist Internal SAPI, and RSS fallbacks.
 */

export function extractPhone(text) {
  if (!text) return '';
  return text.match(/\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}/)?.[0] || '';
}

export async function fetchViaApify(citySlug, keywords, limit = 100) {
  const apiKey = process.env.APIFY_API_KEY;

  if (!apiKey) {
    throw new Error('APIFY_API_KEY not set');
  }

  // Build the Craigslist resume search URL
  const searchUrl = `https://${citySlug}.craigslist.org/search/res?query=${encodeURIComponent(keywords)}&sort=date`;
  console.log(`[Apify] Scraping: ${searchUrl}`);

  const response = await fetch(
    `https://api.apify.com/v2/acts/petrpatek~craigslist-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=120&memory=512`,
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
      const title       = String(item[8] || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
      const pathSlug    = Array.isArray(item[7]) ? item[7][1] : String(item[7] || '');
      const postingHash = Array.isArray(item[6]) ? item[6][1] : String(item[6] || item[0] || '');

      // Real Craigslist post URL format: https://www.craigslist.org/view/d/{slug}/{hash}
      // Or fallback if pathSlug/postingHash missing
      const link = (pathSlug && postingHash)
        ? `https://www.craigslist.org/view/d/${pathSlug}/${postingHash}`
        : `https://${citySlug}.craigslist.org/search/res`;

      return { title, link, postingId: postingHash, description: '', phone: '', email: '', date: '', source: 'cl-sapi', market: citySlug };
    })
    .filter(item => item.title && item.link && !item.link.includes('waveclosers.com') && !item.link.includes('/search/'))
    .slice(0, limit);

  console.log(`[CL-SAPI] ${rawItems.length} raw items → ${results.length} usable resumes for ${citySlug}`);
  return results;
}



export async function fetchViaRSS(citySlug, keywords, limit) {
  const url = `https://${citySlug}.craigslist.org/search/res?query=${encodeURIComponent(keywords)}&format=rss&sort=date`;
  console.log('[Craigslist RSS] Fallback fetch:', url);

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 10000);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':     'application/rss+xml, application/xml, text/xml, */*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (res.status === 403) throw new Error('Craigslist returned 403 (anti-bot block on RSS)');
  if (!res.ok)           throw new Error(`Craigslist RSS returned ${res.status}`);

  const xml = await res.text();
  if (xml.includes('<title>blocked</title>') || xml.includes('blocked')) {
    throw new Error('Craigslist RSS: request blocked');
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
 * Robust multi-tier Craigslist resume search with fallbacks:
 * 1) Apify (if key exists)
 * 2) CL SAPI (internal JSON API, free, always works)
 * 3) RSS (last resort)
 */
export async function fetchCraigslistResumesWithFallback(citySlug, keywords, limit = 50) {
  const APIFY_KEY = process.env.APIFY_API_KEY;

  if (APIFY_KEY) {
    try {
      const results = await fetchViaApify(citySlug, keywords, limit);
      if (results.length > 0) return results;
      console.warn('[Craigslist] Apify returned 0 results, falling back to CL SAPI');
    } catch (e) {
      console.warn('[Craigslist] Apify failed, falling back to CL SAPI:', e.message);
    }
  }

  try {
    const results = await fetchViaCLSAPI(citySlug, keywords, limit);
    if (results.length > 0) return results;
    console.warn('[Craigslist] CL SAPI returned 0 results, trying RSS');
  } catch (sapiErr) {
    console.warn('[Craigslist] CL SAPI failed, trying RSS:', sapiErr.message);
  }

  try {
    return await fetchViaRSS(citySlug, keywords, limit);
  } catch (rssErr) {
    console.warn('[Craigslist] RSS fallback failed:', rssErr.message);
    return [];
  }
}
