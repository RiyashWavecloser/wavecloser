/**
 * Wave Closers — Seed / placeholder data
 * Replace with real Airtable data once William confirms open items.
 */

export const SEED_USERS = [
  { id:'WC-1001', name:'Maya Chen',     type:'REFERRAL', stage:6, leadsThisWeek:6,  dealsThisMonth:2, joined:'2026-04-18', market:'Brooklyn, NY',  email:'maya@example.com',    notes:'Strong referral network in hospitality.' },
  { id:'WC-1002', name:'Diego Alvarez', type:'REP',      stage:6, leadsThisWeek:11, dealsThisMonth:4, joined:'2026-04-21', market:'Miami, FL',      email:'diego@example.com',   notes:'Ex-payment processor, self-starter.' },
  { id:'WC-1003', name:'Priya Shah',    type:'RESELLER', stage:5, leadsThisWeek:9,  dealsThisMonth:3, joined:'2026-04-25', market:'Austin, TX',     email:'priya@example.com',   notes:'Awaiting lead deployment to landing page.' },
  { id:'WC-1004', name:'Marcus Webb',   type:'ISO',      stage:6, leadsThisWeek:7,  dealsThisMonth:4, joined:'2026-04-12', market:'Denver, CO',     email:'marcus@example.com',  notes:'Done-for-you operation running smoothly.' },
  { id:'WC-1005', name:'Anika Roy',     type:'REP',      stage:6, leadsThisWeek:3,  dealsThisMonth:1, joined:'2026-04-29', market:'Chicago, IL',    email:'anika@example.com',   notes:'Lead shortfall — Sergey notified.' },
  { id:'WC-1006', name:'Jonas Kessler', type:'RESELLER', stage:4, leadsThisWeek:0,  dealsThisMonth:0, joined:'2026-05-04', market:'Phoenix, AZ',    email:'jonas@example.com',   notes:'CX onboarding in progress (Lead Qualifier).' },
  { id:'WC-1007', name:'Tomiko Sato',   type:'REFERRAL', stage:6, leadsThisWeek:7,  dealsThisMonth:3, joined:'2026-03-30', market:'San Diego, CA',  email:'tomiko@example.com',  notes:'Consistent performer.' },
  { id:'WC-1008', name:'Leah Brooks',   type:'ISO',      stage:3, leadsThisWeek:0,  dealsThisMonth:0, joined:'2026-05-05', market:'Atlanta, GA',    email:'leah@example.com',    notes:'Stalled at routing — Recruiter following up.' },
  { id:'WC-1009', name:'Carlos Mendez', type:'REP',      stage:6, leadsThisWeek:12, dealsThisMonth:5, joined:'2026-04-02', market:'Houston, TX',    email:'carlos@example.com',  notes:'Top performer this month.' },
  { id:'WC-1010', name:'Naveen Iyer',   type:'REFERRAL', stage:2, leadsThisWeek:0,  dealsThisMonth:0, joined:'2026-05-06', market:'Seattle, WA',    email:'naveen@example.com',  notes:'Just qualified by Lead Qualifier. Welcome email sent.' },
  { id:'WC-1011', name:'Sara Bergmann', type:'RESELLER', stage:6, leadsThisWeek:14, dealsThisMonth:6, joined:'2026-04-08', market:'Boston, MA',     email:'sara@example.com',    notes:'Best reseller this week.' },
  { id:'WC-1012', name:'Felix Otieno',  type:'ISO',      stage:6, leadsThisWeek:9,  dealsThisMonth:2, joined:'2026-04-15', market:'Charlotte, NC',  email:'felix@example.com',   notes:'Below quota — follow-up scheduled.' },
];

export const AUTOMATION_LOG = [
  { time:'08:42',     task:'Welcome email sent',         target:'Naveen Iyer (Referral Partner)',     status:'sent'  },
  { time:'08:41',     task:'User classified',            target:'Naveen Iyer → Referral Partner',     status:'ok'    },
  { time:'08:18',     task:'Lead-shortfall alert',       target:'Anika Roy (Rep) — 3 / 10 leads',     status:'alert' },
  { time:'07:00',     task:'Weekly report generated',    target:'Riyash + William',                   status:'sent'  },
  { time:'Yesterday', task:'Thursday training invite',   target:'Sara Bergmann → Matt',               status:'sent'  },
  { time:'Yesterday', task:'Contract dispatch',          target:'Jonas Kessler → CX Team',            status:'sent'  },
  { time:'Yesterday', task:'Online learning enrollment', target:'Jonas Kessler',                      status:'sent'  },
  { time:'May 6',     task:'Escalation flagged',         target:'Leah Brooks — stalled at routing',   status:'alert' },
];

export const FRANCHISE_MARKETS = [
  { city:'Nashville, TN',      score:92, businesses:4280, growth:'+8.4%', verdict:'Strong'   },
  { city:'Raleigh, NC',        score:88, businesses:3120, growth:'+7.1%', verdict:'Strong'   },
  { city:'Tampa, FL',          score:85, businesses:5640, growth:'+6.2%', verdict:'Strong'   },
  { city:'Columbus, OH',       score:78, businesses:3870, growth:'+4.8%', verdict:'Moderate' },
  { city:'Salt Lake City, UT', score:74, businesses:2410, growth:'+5.3%', verdict:'Moderate' },
];

export const AUTOMATION_TASKS = [
  { name:'User classification',           trigger:'After Qualifier qualifies lead (stage 2)',  status:'active',  runs:12, lastRun:'Today 08:41' },
  { name:'Welcome email (personalised)',  trigger:'Stage 3 → user email',                    status:'active',  runs:12, lastRun:'Today 08:42' },
  { name:'Contract dispatch trigger',     trigger:'Stage 4 → CX Team',                       status:'active',  runs:9,  lastRun:'Yesterday'   },
  { name:'Online learning enrollment',    trigger:'After contract signed',                    status:'pending', runs:0,  lastRun:'—', note:'Waiting on William: learning platform link (Open item #5)' },
  { name:'Thursday training auto-invite', trigger:'After learning setup → Matt',             status:'pending', runs:0,  lastRun:'—', note:'Waiting on William: Thursday meeting time (Open item #6)' },
  { name:'Weekly performance report',     trigger:'Every Monday 7am → Riyash + William',     status:'active',  runs:4,  lastRun:'Today 07:00'  },
  { name:'Lead-shortfall alert',          trigger:'Real-time → Sergey (Marketer)',            status:'active',  runs:3,  lastRun:'Today 08:18'  },
  { name:'Quota-miss escalation',         trigger:'End of month → Riyash',                   status:'active',  runs:1,  lastRun:'Apr 30'       },
  { name:'Franchise market research',     trigger:'On demand',                               status:'active',  runs:2,  lastRun:'May 8'        },
];

export const PREVIOUS_RESEARCH = [
  { query:'Southeast US growth markets', topCity:'Nashville, TN', score:92, date:'May 8, 2026' },
  { query:'Underserved Texas markets',   topCity:'San Antonio, TX', score:86, date:'May 2, 2026' },
];

/**
 * Module 6 — Seed leads for demo mode (20 businesses across all types).
 */
export const SEED_LEADS = [
  { placeId:'demo-001', businessName:'La Trattoria',         type:'restaurant',   address:'123 Main St, Brooklyn, NY 11201',     phone:'(718) 555-0101', website:'latrattoria.com',         rating:4.6, reviewCount:342, score:91, scoreReason:'High rating with strong foot traffic and no current WC client nearby.',      status:'New',         assignedAgent:'', calledAt:null, outcome:'', market:'Brooklyn, NY' },
  { placeId:'demo-002', businessName:'Golden Scissors',       type:'beauty_salon', address:'456 Oak Ave, Brooklyn, NY 11215',      phone:'(718) 555-0102', website:'goldenscissors.com',       rating:4.3, reviewCount:189, score:82, scoreReason:'Owner-operated salon with loyal customer base and 5+ years in business.',   status:'New',         assignedAgent:'', calledAt:null, outcome:'', market:'Brooklyn, NY' },
  { placeId:'demo-003', businessName:'Sakura Nails',          type:'nail_salon',   address:'789 Elm St, Brooklyn, NY 11201',       phone:'(718) 555-0103', website:'',                         rating:4.1, reviewCount:156, score:74, scoreReason:'Consistent reviews, no website — owner may want modern payment options.',   status:'Assigned',    assignedAgent:'Agent 1', calledAt:null, outcome:'', market:'Brooklyn, NY' },
  { placeId:'demo-004', businessName:'Brooklyn Deli & Grill', type:'deli',          address:'321 Bergen St, Brooklyn, NY 11217',    phone:'(718) 555-0104', website:'brooklyndeli.com',         rating:4.4, reviewCount:278, score:85, scoreReason:'High volume lunch spot, owner-operated, strong repeat customers.',          status:'Called',      assignedAgent:'Agent 1', calledAt:'2026-06-04T14:30:00', outcome:'Callback', market:'Brooklyn, NY' },
  { placeId:'demo-005', businessName:'Zen Massage Studio',    type:'massage',      address:'555 Court St, Brooklyn, NY 11231',     phone:'(718) 555-0105', website:'zenmassage.nyc',           rating:4.8, reviewCount:412, score:93, scoreReason:'Premium service, high reviews, owner-operated — excellent prospect.',       status:'SentToQualifier', assignedAgent:'Agent 2', calledAt:'2026-06-04T10:15:00', outcome:'Interested', market:'Brooklyn, NY', qualifierNotifiedAt:'2026-06-04T10:15:00', qualifierStatus:'QualifierNew' },
  { placeId:'demo-006', businessName:'Petals & Stems',        type:'small_retail', address:'100 Smith St, Brooklyn, NY 11201',      phone:'(718) 555-0106', website:'petalsandstems.com',       rating:4.5, reviewCount:98,  score:69, scoreReason:'Boutique flower shop, moderate traffic, owner interested in tech.',        status:'New',         assignedAgent:'', calledAt:null, outcome:'', market:'Brooklyn, NY' },
  { placeId:'demo-007', businessName:'Taco Loco',             type:'restaurant',   address:'200 Atlantic Ave, Brooklyn, NY 11201', phone:'(718) 555-0107', website:'',                         rating:4.2, reviewCount:523, score:88, scoreReason:'Very high volume, no website — likely needs payment processing upgrade.',   status:'Assigned',    assignedAgent:'Agent 3', calledAt:null, outcome:'', market:'Brooklyn, NY' },
  { placeId:'demo-008', businessName:'Glamour Hair Studio',   type:'beauty_salon', address:'333 Flatbush Ave, Brooklyn, NY 11217', phone:'(718) 555-0108', website:'glamourhair.nyc',          rating:3.9, reviewCount:67,  score:52, scoreReason:'Lower reviews but established location, worth a call.',                   status:'New',         assignedAgent:'', calledAt:null, outcome:'', market:'Brooklyn, NY' },
  { placeId:'demo-009', businessName:'Pho Saigon',            type:'restaurant',   address:'444 5th Ave, Brooklyn, NY 11215',      phone:'(718) 555-0109', website:'phosaigon.com',            rating:4.7, reviewCount:891, score:95, scoreReason:'Top-rated, very high traffic, multi-location potential — top priority.',    status:'SentToQualifier', assignedAgent:'Agent 2', calledAt:'2026-06-04T11:00:00', outcome:'Interested', market:'Brooklyn, NY', qualifierNotifiedAt:'2026-06-04T11:00:00', qualifierStatus:'QualifierNew' },
  { placeId:'demo-010', businessName:'Quick Nails',            type:'nail_salon',   address:'550 Fulton St, Brooklyn, NY 11217',    phone:'(718) 555-0110', website:'',                         rating:3.7, reviewCount:45,  score:41, scoreReason:'Low reviews and no online presence — low conversion probability.',         status:'NoAnswer',   assignedAgent:'Agent 4', calledAt:'2026-06-04T15:00:00', outcome:'NoAnswer', market:'Brooklyn, NY' },
  { placeId:'demo-011', businessName:'Miami Grill House',     type:'restaurant',   address:'100 Ocean Dr, Miami, FL 33139',        phone:'(305) 555-0201', website:'miamigrillhouse.com',      rating:4.5, reviewCount:567, score:89, scoreReason:'Tourist area, high foot traffic, owner-operated — strong prospect.',       status:'New',         assignedAgent:'', calledAt:null, outcome:'', market:'Miami, FL' },
  { placeId:'demo-012', businessName:'Beauty Bar Miami',       type:'beauty_salon', address:'200 Collins Ave, Miami, FL 33139',      phone:'(305) 555-0202', website:'beautybarmiami.com',       rating:4.4, reviewCount:234, score:80, scoreReason:'Premium salon with website and strong reviews — tech-savvy owner.',        status:'Assigned',    assignedAgent:'Agent 5', calledAt:null, outcome:'', market:'Miami, FL' },
  { placeId:'demo-013', businessName:'Havana Deli',            type:'deli',          address:'300 Calle Ocho, Miami, FL 33135',      phone:'(305) 555-0203', website:'',                         rating:4.6, reviewCount:445, score:86, scoreReason:'Very popular, high repeat business, strong local brand.',                  status:'New',         assignedAgent:'', calledAt:null, outcome:'', market:'Miami, FL' },
  { placeId:'demo-014', businessName:'Thai Orchid Massage',    type:'massage',      address:'400 Brickell Ave, Miami, FL 33131',    phone:'(305) 555-0204', website:'thaiorchid.com',           rating:4.3, reviewCount:178, score:76, scoreReason:'Upscale area, good reviews — moderate conversion probability.',           status:'Assigned',    assignedAgent:'Agent 6', calledAt:null, outcome:'', market:'Miami, FL' },
  { placeId:'demo-015', businessName:'Little Havana Gifts',    type:'small_retail', address:'500 SW 8th St, Miami, FL 33135',       phone:'(305) 555-0205', website:'',                         rating:4.0, reviewCount:52,  score:48, scoreReason:'Tourist gift shop, seasonal traffic — lower priority.',                   status:'NotInterested', assignedAgent:'Agent 7', calledAt:'2026-06-03T16:00:00', outcome:'NotInterested', market:'Miami, FL' },
  { placeId:'demo-016', businessName:'Austin BBQ Joint',       type:'restaurant',   address:'600 S Congress Ave, Austin, TX 78704', phone:'(512) 555-0301', website:'austinbbq.com',            rating:4.8, reviewCount:1203,score:96, scoreReason:'Top-rated BBQ, massive review volume, multi-location — top prospect.',    status:'SentToQualifier', assignedAgent:'Agent 8', calledAt:'2026-06-04T09:30:00', outcome:'Interested', market:'Austin, TX', qualifierNotifiedAt:'2026-06-04T09:30:00', qualifierStatus:'QualifierNew' },
  { placeId:'demo-017', businessName:'Nails 2000',             type:'nail_salon',   address:'700 Lamar Blvd, Austin, TX 78703',     phone:'(512) 555-0302', website:'nails2000.com',            rating:4.2, reviewCount:134, score:71, scoreReason:'Established nail salon, owner-operated with decent online presence.',      status:'New',         assignedAgent:'', calledAt:null, outcome:'', market:'Austin, TX' },
  { placeId:'demo-018', businessName:'Yoga & Massage Co',      type:'massage',      address:'800 Rainey St, Austin, TX 78701',      phone:'(512) 555-0303', website:'yogamassage.co',           rating:4.6, reviewCount:289, score:83, scoreReason:'Trendy area, strong reviews, owner likely tech-savvy.',                    status:'Assigned',    assignedAgent:'Agent 9', calledAt:null, outcome:'', market:'Austin, TX' },
  { placeId:'demo-019', businessName:'Corner Bodega',          type:'deli',          address:'900 E 6th St, Austin, TX 78702',       phone:'(512) 555-0304', website:'',                         rating:3.8, reviewCount:89,  score:55, scoreReason:'Moderate foot traffic, no website — could benefit from modern POS.',      status:'New',         assignedAgent:'', calledAt:null, outcome:'', market:'Austin, TX' },
  { placeId:'demo-020', businessName:'The Gift Spot',          type:'small_retail', address:'1000 S 1st St, Austin, TX 78704',      phone:'(512) 555-0305', website:'thegiftspot.com',          rating:4.1, reviewCount:76,  score:62, scoreReason:'Boutique retail with web presence — moderate potential.',                 status:'Assigned',    assignedAgent:'Agent 10', calledAt:null, outcome:'', market:'Austin, TX' },
];

/**
 * Module 6 — Seed analytics: daily call stats per agent for demo mode.
 */
export const SEED_LEAD_STATS = {
  daily: [
    { agent: 'Agent 1',  leadsAssigned: 100, callsToday: 67, interested: 8,  notInterested: 32, callback: 12, noAnswer: 15 },
    { agent: 'Agent 2',  leadsAssigned: 100, callsToday: 83, interested: 12, notInterested: 41, callback: 14, noAnswer: 16 },
    { agent: 'Agent 3',  leadsAssigned: 95,  callsToday: 54, interested: 5,  notInterested: 28, callback: 9,  noAnswer: 12 },
    { agent: 'Agent 4',  leadsAssigned: 100, callsToday: 91, interested: 14, notInterested: 45, callback: 16, noAnswer: 16 },
    { agent: 'Agent 5',  leadsAssigned: 100, callsToday: 72, interested: 9,  notInterested: 36, callback: 11, noAnswer: 16 },
    { agent: 'Agent 6',  leadsAssigned: 80,  callsToday: 45, interested: 4,  notInterested: 22, callback: 8,  noAnswer: 11 },
    { agent: 'Agent 7',  leadsAssigned: 100, callsToday: 78, interested: 11, notInterested: 38, callback: 13, noAnswer: 16 },
    { agent: 'Agent 8',  leadsAssigned: 100, callsToday: 95, interested: 16, notInterested: 47, callback: 15, noAnswer: 17 },
    { agent: 'Agent 9',  leadsAssigned: 90,  callsToday: 61, interested: 7,  notInterested: 30, callback: 10, noAnswer: 14 },
    { agent: 'Agent 10', leadsAssigned: 85,  callsToday: 39, interested: 3,  notInterested: 19, callback: 7,  noAnswer: 10 },
  ],
  topMarkets:       ['Brooklyn, NY', 'Miami, FL', 'Austin, TX', 'Houston, TX', 'Nashville, TN'],
  topBusinessTypes: ['restaurant', 'beauty_salon', 'deli', 'massage', 'nail_salon'],
};

