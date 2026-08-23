/**
 * reassign-real-cl-leads.mjs
 * 
 * Scrapes real, live Craigslist candidate resumes, verifies HTTP 200 status for every link,
 * and assigns 4 verified live leads per agent for today (2026-08-23).
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { getRecruitingAgents, saveResumeLead, registerResumeAsAssigned, getGlobalResumeDeduplicationSet } from '../server/airtableClient.js';
import { fetchViaHTML } from '../server/apifyClient.js';
import { normalizeForDedup, isDemoLead } from '../server/constants.js';

dotenv.config();

async function verifyUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 8000
    });
    return res.status === 200;
  } catch (err) {
    return false;
  }
}

async function run() {
  console.log('🚀 Scraping and verifying LIVE candidate resume leads for all 9 agents...\n');

  const agents = await getRecruitingAgents();
  console.log(`Agents (${agents.length}):`, agents.map(a => a.name).join(', '));

  const today = new Date().toISOString().split('T')[0];
  const countPerAgent = 4;
  const targetNeeded = agents.length * countPerAgent;

  const targetCities = ['newyork', 'losangeles', 'chicago', 'houston', 'miami', 'dallas', 'atlanta', 'phoenix', 'seattle', 'denver'];
  const targetKeywords = ['sales', 'marketing', 'customer service', 'outside sales', 'account executive', 'freelance', 'software sales', 'lead generation'];

  const globalDedupeSet = await getGlobalResumeDeduplicationSet(1);

  const verifiedPool = [];
  const seenUrls = new Set();

  outer:
  for (const city of targetCities) {
    for (const kw of targetKeywords) {
      if (verifiedPool.length >= targetNeeded * 2) break outer;
      try {
        const scraped = await fetchViaHTML(city, kw, 30);
        for (const item of scraped) {
          if (verifiedPool.length >= targetNeeded * 2) break outer;
          const url = item.link;
          const dedupKey = normalizeForDedup(url);

          if (!url || globalDedupeSet.has(dedupKey) || seenUrls.has(dedupKey) || isDemoLead(item)) continue;

          seenUrls.add(dedupKey);

          // Test live HTTP 200 status
          const isLive = await verifyUrl(url);
          if (isLive) {
            verifiedPool.push({ ...item, link: url, market: city });
            console.log(`   ✓ Verified 200 OK: ${item.title.slice(0, 45)}... → ${url}`);
          } else {
            console.warn(`   ❌ 404/Failed link skipped: ${url}`);
          }
        }
      } catch (err) {
        console.warn(`Scrape error for ${kw} in ${city}:`, err.message);
      }
    }
  }

  console.log(`\nCollected ${verifiedPool.length} verified live 200 OK candidate leads.`);

  if (verifiedPool.length < targetNeeded) {
    console.warn(`⚠️ Warning: Only ${verifiedPool.length} verified leads found (target: ${targetNeeded}). Distributing available.`);
  }

  // Round-robin assignment (4 per agent)
  const buckets = {};
  agents.forEach(a => { buckets[a.name] = []; });
  let pool = [...verifiedPool];
  let idx = 0;

  while (pool.length > 0) {
    const agent = agents[idx % agents.length];
    if (buckets[agent.name].length < countPerAgent) {
      buckets[agent.name].push(pool.shift());
    }
    idx++;
    if (agents.every(a => buckets[a.name].length >= countPerAgent)) break;
  }

  console.log('\n--- Saving to Airtable ---');
  for (const agent of agents) {
    const batch = buckets[agent.name] || [];
    let saved = 0;
    for (const item of batch) {
      const res = await saveResumeLead({
        title: item.title,
        description: item.description || '',
        phone: item.phone || '',
        email: item.email || '',
        craigslistUrl: item.link,
        market: item.market || 'National',
        assignedTo: agent.name,
        assignedDate: today,
        status: 'New'
      });
      if (res) {
        await registerResumeAsAssigned(item.link, agent.name, today);
        saved++;
      }
    }
    console.log(`✓ ${agent.name.padEnd(12)} → ${saved} live 200 OK leads assigned today (${today})`);
  }

  console.log('\n🎉 Reassignment of 100% verified live 200 OK candidate leads complete!');
}

run().catch(console.error);
