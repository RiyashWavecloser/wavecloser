import fetch from 'node-fetch';

const TOKEN = process.env.APIFY_TOKEN;
const ACTOR = 'solidcode~craigslist-scraper';
const SEARCH_URL = 'https://newyork.craigslist.org/search/res?query=sales';

async function main() {
  console.log(`Running actor ${ACTOR} with url: ${SEARCH_URL}...`);
  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${TOKEN}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startUrls: [{ url: SEARCH_URL }],
      maxItems: 5,
    }),
  });

  if (!res.ok) {
    console.error('Run failed:', res.status, await res.text());
    return;
  }

  const data = await res.json();
  console.log(`Run successful! Retrieved ${data.length} items:`);
  console.log(JSON.stringify(data.slice(0, 2), null, 2));
}

main().catch(console.error);
