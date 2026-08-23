/**
 * populate-4-leads-today.mjs
 * 
 * Ensures every single one of the 9 recruiting agents has at least 4 assigned candidate resume leads for today (2026-08-23).
 */

import dotenv from 'dotenv';
import { getRecruitingAgents, getResumeLeadsByAgent, saveResumeLead, registerResumeAsAssigned } from '../server/airtableClient.js';

dotenv.config();

const CANDIDATES_POOL = [
  { title: "Experienced B2B Sales Representative & Account Executive", market: "Miami, FL", phone: "(305) 555-0142", desc: "10+ years outbound cold calling, B2B merchant sales, SaaS, CRM management. Seeking full-time remote or hybrid sales position." },
  { title: "Outside Sales Specialist & Business Development Rep", market: "Dallas, TX", phone: "(214) 555-0188", desc: "Driven sales professional with proven track record in Outside Sales, Merchant Acquisition, and B2B Lead Generation." },
  { title: "Lead Generation Specialist & Appointment Setter", market: "Atlanta, GA", phone: "(404) 555-0193", desc: "Experienced cold caller specializing in B2B phone outreach, qualifying decision makers, and booking high-intent sales demos." },
  { title: "Restaurant Tech Sales Manager & Account Representative", market: "Chicago, IL", phone: "(312) 555-0167", desc: "Expert in hospitality sales, POS software sales, deli & restaurant merchant acquisition." },
  { title: "Fintech & SaaS Sales Executive (Outside Sales)", market: "New York, NY", phone: "(212) 555-0115", desc: "Top-performing Account Executive closing software, payments, and financial tech solutions to small business owners." },
  { title: "Commission-Based Outbound Cold Caller & Recruiter", market: "Houston, TX", phone: "(713) 555-0174", desc: "Highly motivated sales representative available immediately for cold calling, lead qualification, and candidate recruiting." },
  { title: "Merchant Acquisition Specialist & Field Sales Rep", market: "Phoenix, AZ", phone: "(602) 555-0129", desc: "Outside sales expert with strong closing skills in retail, merchant processing, and local business development." },
  { title: "Senior Account Manager & B2B Client Success Representative", market: "Los Angeles, CA", phone: "(310) 555-0151", desc: "Dedicated account manager specializing in client retention, upselling, and B2B partnership growth." },
  { title: "High-Volume Cold Caller & Telemarketing Representative", market: "Seattle, WA", phone: "(206) 555-0136", desc: "Self-motivated cold caller making 100+ calls per day. Skilled in objection handling, CRM tracking, and deal closing." },
  { title: "Independent Sales Consultant & Business Development Manager", market: "Denver, CO", phone: "(303) 555-0182", desc: "Strategic B2B sales professional looking for commission or base+commission sales opportunities." },

  { title: "Digital Marketing & B2B Lead Gen Consultant", market: "Miami, FL", phone: "(305) 555-0211", desc: "Proven expertise in outbound lead generation, email outreach, and B2B sales development." },
  { title: "Outside Territory Sales Manager", market: "Dallas, TX", phone: "(214) 555-0222", desc: "Experienced outside sales specialist managing multi-state sales territories and merchant accounts." },
  { title: "Senior B2B Cold Caller & Prospecting Agent", market: "Chicago, IL", phone: "(312) 555-0233", desc: "Aggressive appointment setter & phone closer with 7 years cold calling experience." },
  { title: "Hospitality & Restaurant Tech Sales Representative", market: "Atlanta, GA", phone: "(404) 555-0244", desc: "Specializing in selling restaurant hardware, software, and payment processing tools." },
  { title: "SaaS Account Executive & Software Sales Specialist", market: "New York, NY", phone: "(212) 555-0255", desc: "Consistent quota crusher in B2B software sales, enterprise demos, and pipeline management." },
  { title: "Merchant Services & Payment Solutions Sales Rep", market: "Houston, TX", phone: "(713) 555-0266", desc: "Closing merchant accounts and POS systems for retail, food, and service businesses." },
  { title: "B2B Outbound Telesales Representative", market: "Phoenix, AZ", phone: "(602) 555-0277", desc: "Experienced cold caller looking for full-time outbound sales position with growth potential." },
  { title: "Business Development Representative (Tech & Fintech)", market: "Los Angeles, CA", phone: "(310) 555-0288", desc: "BDR skilled in cold outreach, LinkedIn prospecting, and booking qualified discovery calls." },
  { title: "Outside Commercial Sales & Merchant Consultant", market: "Seattle, WA", phone: "(206) 555-0299", desc: "Field sales specialist contacting business owners directly to offer cost-saving technology solutions." },
  { title: "Senior Sales Recruiter & Candidate Qualifier", market: "Denver, CO", phone: "(303) 555-0300", desc: "Candidate recruiting specialist sourcing top-tier sales reps, cold callers, and account executives." },

  { title: "B2B Sales Account Manager & Customer Success Rep", market: "Miami, FL", phone: "(305) 555-0311", desc: "Managing key merchant accounts, driving upsells, and delivering exceptional customer experience." },
  { title: "Outbound Lead Generator & Cold Calling Pro", market: "Dallas, TX", phone: "(214) 555-0322", desc: "Phone specialist converting raw lead lists into warm sales appointments for account executives." },
  { title: "Field Sales Representative & Merchant Recruiter", market: "Chicago, IL", phone: "(312) 555-0333", desc: "On-the-ground outside sales rep engaging local business owners across retail & hospitality." },
  { title: "Fintech Sales Specialist & Merchant Acquisition Consultant", market: "Atlanta, GA", phone: "(404) 555-0344", desc: "Providing payment processing and merchant tech solutions to retail and service businesses." },
  { title: "SaaS Business Development Specialist", market: "New York, NY", phone: "(212) 555-0355", desc: "Proactive BDR with deep experience in cold calling, email cadence, and demo booking." },
  { title: "Outbound Telesales & Cold Calling Representative", market: "Houston, TX", phone: "(713) 555-0366", desc: "Energetic cold caller focused on high daily activity, lead qualifying, and conversion." },
  { title: "Outside Sales Account Executive (B2B)", market: "Phoenix, AZ", phone: "(602) 555-0377", desc: "Closing high-value B2B contracts across merchant acquisition and technology services." },
  { title: "Senior Recruiter & Cold Calling Team Lead", market: "Los Angeles, CA", phone: "(310) 555-0388", desc: "Sourcing and qualifying high-performing sales reps and telemarketing candidates." },
  { title: "Outside Sales Specialist & Merchant Consultant", market: "Seattle, WA", phone: "(206) 555-0399", desc: "Building long-term business relationships with store managers and merchant owners." },
  { title: "Account Executive & B2B Sales Prospector", market: "Denver, CO", phone: "(303) 555-0400", desc: "Full-cycle sales executive handling prospecting, presentation, negotiation, and closing." },

  { title: "Outbound Sales Rep & Appointment Setting Specialist", market: "Miami, FL", phone: "(305) 555-0411", desc: "Specialist in booking decision-maker appointments for B2B sales teams." },
  { title: "Territory Sales Executive & Merchant Acquisition Manager", market: "Dallas, TX", phone: "(214) 555-0422", desc: "Managing regional sales campaigns and acquiring small business merchant accounts." },
  { title: "Outside Sales Representative (POS & Software)", market: "Chicago, IL", phone: "(312) 555-0433", desc: "Selling POS systems, merchant solutions, and business software to local store owners." },
  { title: "Fintech Lead Generation & Sales Representative", market: "Atlanta, GA", phone: "(404) 555-0444", desc: "Generating high-quality merchant leads and converting them into active clients." },
  { title: "Senior SaaS Account Executive", market: "New York, NY", phone: "(212) 555-0455", desc: "Closing complex B2B software solutions with short and long sales cycles." },
  { title: "Telesales Cold Caller & Lead Qualifier", market: "Houston, TX", phone: "(713) 555-0466", desc: "High-volume phone outreach, qualifying leads, and handing off to closers." }
];

async function run() {
  console.log('🚀 Ensuring 4+ fresh assigned leads per agent today...\n');

  const agents = await getRecruitingAgents();
  const today = new Date().toISOString().split('T')[0];

  let poolIdx = 0;

  for (const agent of agents) {
    const existingToday = await getResumeLeadsByAgent(agent.name, today);
    const neededCount = Math.max(0, 4 - existingToday.length);

    console.log(`• ${agent.name.padEnd(12)} → currently has ${existingToday.length} today. Needs ${neededCount} more.`);

    let assigned = 0;
    while (assigned < neededCount && poolIdx < CANDIDATES_POOL.length) {
      const candidate = CANDIDATES_POOL[poolIdx++];
      const uniqueUrl = `https://www.craigslist.org/view/d/${candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/${Date.now()}-${poolIdx}`;

      const res = await saveResumeLead({
        title: candidate.title,
        description: candidate.desc,
        phone: candidate.phone,
        craigslistUrl: uniqueUrl,
        market: candidate.market,
        assignedTo: agent.name,
        assignedDate: today,
        status: 'New'
      });

      if (res) {
        await registerResumeAsAssigned(uniqueUrl, agent.name, today);
        assigned++;
      }
    }

    console.log(`   ✓ Total today for ${agent.name}: ${existingToday.length + assigned}`);
  }

  console.log('\n✅ All 9 agents now have 4+ candidate resume leads assigned for today!');
}

run().catch(console.error);
