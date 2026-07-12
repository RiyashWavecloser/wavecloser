import fetch from 'node-fetch';

const TOKEN = process.env.APIFY_TOKEN;

async function main() {
  const url = `https://api.apify.com/v2/store?search=craigslist&limit=250&token=${TOKEN}`;
  console.log('Fetching store actors matching craigslist...');
  const res = await fetch(url);
  if (!res.ok) {
    console.error('Failed to fetch:', res.status, await res.text());
    return;
  }
  const data = await res.json();
  const items = data.data?.items || [];
  console.log(`Found total ${items.length} actors. Filtering for 'craigslist' in name/title/username...`);
  const matches = items.filter(item => {
    const term = 'craigslist';
    return (item.name || '').toLowerCase().includes(term) ||
           (item.username || '').toLowerCase().includes(term) ||
           (item.title || '').toLowerCase().includes(term);
  });
  console.log(`Matched ${matches.length} actors:`);
  matches.forEach(item => {
    console.log(`- Username: ${item.username} | Name: ${item.name} | Title: ${item.title}`);
  });
}

main().catch(console.error);
