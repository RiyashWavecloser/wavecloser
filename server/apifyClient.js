/**
 * server/apifyClient.js
 *
 * Apify scraper client for real Craigslist candidate resumes.
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
    `https://api.apify.com/v2/acts/apify~craigslist-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=120&memory=512`,
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
      // Must have a real URL
      if (!item.url && !item.link) return false;
      // Filter old posts
      if (item.time || item.date) {
        const postDate = new Date(item.time || item.date);
        if (!isNaN(postDate.getTime()) && postDate < sixtyDaysAgo) return false;
      }
      return true;
    })
    .map(item => ({
      title:       (item.title || 'Resume Post').trim(),
      description: (item.postingBody || item.description || item.body || '')
                   .replace(/<[^>]+>/g, '').trim().slice(0, 500),
      phone:       extractPhone(item.postingBody || item.description || item.body || ''),
      link:        (item.url || item.link || '').trim(),
      date:        item.time || item.date || new Date().toISOString(),
      source:      'apify',
    }))
    .filter(item => item.link && !item.link.includes('waveclosers.com')); // safety check — never fake data

  console.log(`[Apify] Valid results after filtering: ${results.length}`);
  return results;
}
