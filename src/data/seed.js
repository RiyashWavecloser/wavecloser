/**
 * Wave Closers — Seed / placeholder data
 * Replace with real Airtable data once William confirms open items.
 */

export const SEED_USERS = [
  { id:'WC-1001', name:'Maya Chen',      type:'REFERRAL', stage:6, leadsThisWeek:6,  dealsThisMonth:2, joined:'2026-04-18', market:'Brooklyn, NY',  notes:'Strong referral network in hospitality.' },
  { id:'WC-1002', name:'Diego Alvarez',  type:'REP',      stage:6, leadsThisWeek:11, dealsThisMonth:4, joined:'2026-04-21', market:'Miami, FL',      notes:'Ex-payment processor, self-starter.' },
  { id:'WC-1003', name:'Priya Shah',     type:'RESELLER', stage:5, leadsThisWeek:9,  dealsThisMonth:3, joined:'2026-04-25', market:'Austin, TX',     notes:'Awaiting lead deployment to landing page.' },
  { id:'WC-1004', name:'Marcus Webb',    type:'ISO',      stage:6, leadsThisWeek:7,  dealsThisMonth:4, joined:'2026-04-12', market:'Denver, CO',     notes:'Done-for-you operation running smoothly.' },
  { id:'WC-1005', name:'Anika Roy',      type:'REP',      stage:6, leadsThisWeek:3,  dealsThisMonth:1, joined:'2026-04-29', market:'Chicago, IL',    notes:'Lead shortfall — Sergey notified.' },
  { id:'WC-1006', name:'Jonas Kessler',  type:'RESELLER', stage:4, leadsThisWeek:0,  dealsThisMonth:0, joined:'2026-05-04', market:'Phoenix, AZ',    notes:'CX onboarding in progress (Mildred).' },
  { id:'WC-1007', name:'Tomiko Sato',    type:'REFERRAL', stage:6, leadsThisWeek:7,  dealsThisMonth:3, joined:'2026-03-30', market:'San Diego, CA',  notes:'Consistent performer.' },
  { id:'WC-1008', name:'Leah Brooks',    type:'ISO',      stage:3, leadsThisWeek:0,  dealsThisMonth:0, joined:'2026-05-05', market:'Atlanta, GA',    notes:'Stalled at routing — Janina following up.' },
  { id:'WC-1009', name:'Carlos Mendez',  type:'REP',      stage:6, leadsThisWeek:12, dealsThisMonth:5, joined:'2026-04-02', market:'Houston, TX',    notes:'Top performer this month.' },
  { id:'WC-1010', name:'Naveen Iyer',    type:'REFERRAL', stage:2, leadsThisWeek:0,  dealsThisMonth:0, joined:'2026-05-06', market:'Seattle, WA',    notes:'Just qualified by Mildred — welcome email sent.' },
  { id:'WC-1011', name:'Sara Bergmann',  type:'RESELLER', stage:6, leadsThisWeek:14, dealsThisMonth:6, joined:'2026-04-08', market:'Boston, MA',     notes:'Best reseller this week.' },
  { id:'WC-1012', name:'Felix Otieno',   type:'ISO',      stage:6, leadsThisWeek:9,  dealsThisMonth:2, joined:'2026-04-15', market:'Charlotte, NC',  notes:'Below quota — follow-up scheduled.' },
];

export const AUTOMATION_LOG = [
  { time:'08:42',     task:'Welcome email sent',          target:'Naveen Iyer (Referral Partner)',      status:'sent'  },
  { time:'08:41',     task:'User classified',             target:'Naveen Iyer → Referral Partner',      status:'ok'    },
  { time:'08:18',     task:'Lead-shortfall alert',        target:'Anika Roy (Rep) — 3 / 10 leads',      status:'alert' },
  { time:'07:00',     task:'Weekly report generated',     target:'Riyash + William',                    status:'sent'  },
  { time:'Yesterday', task:'Thursday training invite',    target:'Sara Bergmann → Matt',                status:'sent'  },
  { time:'Yesterday', task:'Contract dispatch',           target:'Jonas Kessler → Mildred (CX)',         status:'sent'  },
  { time:'Yesterday', task:'Online learning enrollment',  target:'Jonas Kessler',                       status:'sent'  },
  { time:'May 6',     task:'Escalation flagged',          target:'Leah Brooks — stalled at routing',    status:'alert' },
];

export const FRANCHISE_MARKETS = [
  { city:'Nashville, TN',      score:92, businesses:4280, growth:'+8.4%', verdict:'Strong'   },
  { city:'Raleigh, NC',        score:88, businesses:3120, growth:'+7.1%', verdict:'Strong'   },
  { city:'Tampa, FL',          score:85, businesses:5640, growth:'+6.2%', verdict:'Strong'   },
  { city:'Columbus, OH',       score:78, businesses:3870, growth:'+4.8%', verdict:'Moderate' },
  { city:'Salt Lake City, UT', score:74, businesses:2410, growth:'+5.3%', verdict:'Moderate' },
];

export const AUTOMATION_TASKS = [
  { name:'User classification',           trigger:'After Mildred qualifies lead',        status:'active',  runs:12 },
  { name:'Welcome email (personalised)',  trigger:'Day 0 sign-up',                        status:'active',  runs:12 },
  { name:'Contract dispatch trigger',     trigger:'Close event → Mildred (CX)',           status:'active',  runs:9  },
  { name:'Online learning enrollment',    trigger:'After contract signed',                status:'pending', runs:0,  note:'Awaits learning platform link from William' },
  { name:'Thursday training auto-invite', trigger:'After learning setup → Matt',          status:'pending', runs:0,  note:'Awaits meeting time from William' },
  { name:'Weekly performance report',     trigger:'Every Monday 7am → Riyash + William', status:'active',  runs:4  },
  { name:'Lead-shortfall alert',          trigger:'Real-time → Sergey (Marketer)',        status:'active',  runs:3  },
  { name:'Quota-miss escalation',         trigger:'End of month → Riyash',               status:'active',  runs:1  },
  { name:'Franchise market research',     trigger:'On demand',                            status:'active',  runs:2  },
];
