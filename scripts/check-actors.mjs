import fetch from 'node-fetch';

const TOKEN = process.env.APIFY_TOKEN;

const actors = [
  'solidcode~craigslist-scraper',
  'parseforge~craigslist-scraper',
  'fatihtahta~craigslist-scraper',
  'ivanvs~craigslist-scraper-pay-per-result',
];

async function main() {
  for (const actor of actors) {
    console.log(`Checking actor: ${actor}...`);
    const url = `https://api.apify.com/v2/acts/${actor}?token=${TOKEN}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      console.log(`  ✓ Found! Username: ${data.data.username} | Name: ${data.data.name} | Title: ${data.data.title}`);
    } else {
      console.log(`  ✗ Failed: ${res.status}`);
    }
  }
}

main().catch(console.error);
