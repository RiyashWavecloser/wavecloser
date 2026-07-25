import dotenv from 'dotenv';
dotenv.config();

async function testRss() {
  const rssUrl = "https://newyork.craigslist.org/search/res?query=sales&format=rss";
  console.log("Fetching RSS URL:", rssUrl);
  try {
    const fetchRes = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, text/xml, */*',
      }
    });

    console.log("Status:", fetchRes.status);
    console.log("Headers:", Object.fromEntries(fetchRes.headers.entries()));
    const xml = await fetchRes.text();
    console.log("Response (first 1000 chars):", xml.slice(0, 1000));
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

testRss();
