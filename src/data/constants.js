/**
 * Wave Closers — system constants
 * Updated: July 2026 — dual workflow, 5 user types, 7-step CX onboarding
 *
 * [BRANCH] src/data/constants.js goes to BOTH main AND worker-deploy branches
 */

// ─── Workflow A: Merchant/POS Leads ───────────────────────────────────────────
// Cold Callers, Independent Reps, and Authorized Resellers log in, view their
// assigned leads, call businesses, mark outcomes, move through POS sales pipeline.

// ─── Workflow B: Recruiting / Salesperson Onboarding ─────────────────────────
// Recruiter (Aureliab) finds people OUTSIDE the system (LinkedIn, referrals, etc.)
// and manually adds them. System tracks onboarding status and moves them through
// the 7-step CX flow. Recruiter does NOT use the system to FIND people.

export const USER_TYPES = {
  COLD_CALLER: {
    id:           'COLD_CALLER',
    label:        'Cold Caller',
    short:        'Cold Caller',
    portal:       'agent',       // uses Agent Portal (Workflow A)
    leadPriority: 3,             // lowest priority in lead distribution
    color:        '#5B8DEF',
    earningModel: 'Commission per closed deal',
  },
  REP: {
    id:           'REP',
    label:        'Independent Rep',
    short:        'Indep Rep',
    portal:       'agent',       // same portal as cold caller
    leadPriority: 2,             // medium priority
    color:        '#D97A5E',
    earningModel: '$1,500–$3,000 bonus + 40% residuals',
  },
  RESELLER: {
    id:           'RESELLER',
    label:        'Authorized Reseller',
    short:        'Reseller',
    portal:       'agent',       // same portal as cold caller — NOT recruiter pipeline
    leadPriority: 1,             // HIGHEST priority — gets leads first
    color:        '#2D9B5E',
    earningModel: '$1,500–$3,000 bonus + 40% recurring + priority leads',
  },
  ISO: {
    id:           'ISO',
    label:        'ISO Investor (Done For You)',
    short:        'ISO Investor',
    portal:       'separate',
    leadPriority: 0,
    color:        '#C2547F',
    earningModel: 'Full done-for-you investment operation',
  },
  REFERRAL: {
    id:           'REFERRAL',
    label:        'Referral Partner',
    short:        'Referral',
    portal:       'separate',
    leadPriority: 0,
    color:        '#7B6FDB',
    earningModel: '$2,000 per closed restaurant',
  },
};

/**
 * Lead distribution priority — Resellers first, then Reps, then Cold Callers
 * Used in both automationWorker.js AND leadWorker.js
 * [BRANCH] BOTH main and worker-deploy
 */
export const LEAD_DISTRIBUTION_ORDER = ['RESELLER', 'REP', 'COLD_CALLER'];

/**
 * Full role list for auth system
 */
export const ROLES = [
  'admin',               // William — full access
  'pm',                  // Riyash — full access
  'cx',                  // Mildred — qualifier + CX portal
  'recruiter',           // Aureliab — recruiter portal + recruiting pipeline
  'cold_caller',         // Cold Callers — agent portal, lead priority 3
  'independent_rep',     // Independent Reps — agent portal, lead priority 2
  'authorized_reseller', // Authorized Resellers — agent portal, lead priority 1
  'iso_investor',        // ISO Investors — agent portal
  'referral_partner',    // Referral Partners — agent portal
  'agent_supervisor',    // agentsservices — sees all agents' leads
  'marketer',            // Sergey
  'trainer',             // Matt
];

/**
 * Placeholder benchmarks — to be confirmed with William (scope §12).
 */
export const BENCHMARKS = {
  COLD_CALLER: { weeklyLeads: 10, monthlyQuota: 4,  closeRate: 0.30 },
  REP:         { weeklyLeads: 10, monthlyQuota: 4,  closeRate: 0.35 },
  RESELLER:    { weeklyLeads: 12, monthlyQuota: 5,  closeRate: 0.40 },
  ISO:         { weeklyLeads: 8,  monthlyQuota: 3,  closeRate: 0.50 },
  REFERRAL:    { weeklyLeads: 5,  monthlyQuota: 2,  closeRate: 0.40 },
};

/**
 * 7-step CX onboarding flow — Mildred owns all 7 steps
 * Steps 3–7 have pending notes from William (scope §12)
 * [BRANCH] BOTH main and worker-deploy
 */
export const ONBOARDING_STAGES = [
  { id: 1, label: 'Onboards user to Wave Closers platform',  owner: 'Mildred (CX)' },
  { id: 2, label: 'Sends the contract',                      owner: 'Mildred (CX)' },
  { id: 3, label: 'Sets up online learning access',          owner: 'Mildred (CX)', note: 'Learning platform link pending William §12 #5' },
  { id: 4, label: 'Invites to Thursday sales training',      owner: 'Mildred (CX)', note: 'Meeting time pending William §12 #6' },
  { id: 5, label: 'Offers Brain Goats',                      owner: 'Mildred (CX)', note: 'Details/link pending William §12 #13' },
  { id: 6, label: 'Offers MeetGold',                         owner: 'Mildred (CX)', note: '⚠ MeetGold not yet transferred — pending William §12 #12' },
  { id: 7, label: 'Offers Lead Gen Service',                 owner: 'Mildred (CX)', note: 'Details/link pending William §12 #14' },
];

/**
 * Real team assignments from William's voice note (May 13 2026).
 */
export const TEAM = [
  { role: 'Admin / Executive Sponsor',              owner: 'William',  color: '#D44A4A' },
  { role: 'Project Manager (PM + Ops + AI)',         owner: 'Riyash',   color: '#5B8DEF' },
  { role: 'Appointment Setter / Qualifier (CX)',     owner: 'Mildred',  color: '#7B6FDB' },
  { role: 'Recruiter / Franchise Sales',             owner: 'Aureliab', color: '#D97A5E', note: '⚠ Email placeholder — confirm with William (Open Item #11)' },
  { role: 'Marketer',                                owner: 'Sergey',   color: '#2D9B5E' },
  { role: 'Sales Trainer',                           owner: 'Matt',     color: '#D49A2B' },
  { role: 'Sales Manager (Step 6)',                  owner: 'TBC',      color: '#999999' },
  { role: 'Claude (AI Automation Layer)',             owner: 'AI',       color: '#C2547F' },
];

export const STATUS_COLORS = {
  green:      { bg: 'var(--color-green-bg)',  text: 'var(--color-green-text)',  dot: 'var(--color-green)' },
  amber:      { bg: 'var(--color-amber-bg)',  text: 'var(--color-amber-text)',  dot: 'var(--color-amber)' },
  red:        { bg: 'var(--color-red-bg)',    text: 'var(--color-red-text)',    dot: 'var(--color-red)'   },
  onboarding: { bg: 'var(--color-info-bg)',   text: 'var(--color-info-text)',   dot: 'var(--color-info)'  },
};

/**
 * Open items (scope §12) — update when William confirms each.
 * [BRANCH] main only
 */
export const OPEN_ITEMS = [
  { num: 1,  item: 'API availability from waveclosers.com',            blocks: 'API sync mode'                                          },
  { num: 2,  item: 'Weekly lead targets per user type',                 blocks: 'Lead-shortfall alerts'                                  },
  { num: 3,  item: 'Monthly quota benchmarks per user type',            blocks: 'Quota-miss escalations'                                 },
  { num: 4,  item: 'Contract template for CX automation',              blocks: 'Contract dispatch email'                                 },
  { num: 5,  item: 'Online learning platform link / login flow',        blocks: 'Step 3 of CX onboarding'                               },
  { num: 6,  item: 'Thursday sales training meeting time',             blocks: 'Step 4 of CX onboarding'                               },
  { num: 7,  item: 'Sales Manager role assignment',                     blocks: 'Step 6 ownership'                                       },
  { num: 8,  item: 'Google Places API key',                             blocks: 'Primary lead source (using Yelp only until confirmed)'  },
  { num: 9,  item: 'Yelp API key',                                      blocks: 'Backup lead source'                                     },
  { num: 10, item: 'Target markets / cities for first lead batch',      blocks: 'Weekly lead generation'                                 },
  { num: 11, item: 'Aureliab exact email address',                      blocks: 'Recruiter account creation'                             },
  { num: 12, item: 'MeetGold platform transfer',                        blocks: 'Step 6 of CX onboarding'                               },
  { num: 13, item: 'Brain Goats details and link',                      blocks: 'Step 5 of CX onboarding'                               },
  { num: 14, item: 'Lead Gen Service details and link',                 blocks: 'Step 7 of CX onboarding'                               },
];

/**
 * Module 6 — AI Lead Generation Engine constants.
 */
export const BUSINESS_TYPES = [
  { id: 'restaurant',    label: 'Restaurants',     yelpCategory: 'restaurants',     icon: '🍽️' },
  { id: 'beauty_salon',  label: 'Beauty Salons',   yelpCategory: 'beautysvc',       icon: '💇' },
  { id: 'nail_salon',    label: 'Nail Salons',     yelpCategory: 'nailsalons',      icon: '💅' },
  { id: 'deli',          label: 'Delis',           yelpCategory: 'delis',           icon: '🥪' },
  { id: 'massage',       label: 'Massage Places',  yelpCategory: 'massage',         icon: '💆' },
  { id: 'small_retail',  label: 'Small Retail',    yelpCategory: 'shoppingcenters', icon: '🏪' },
];

/**
 * Real cold-calling agent accounts (confirmed June 2026).
 * Janina is an agent — NOT recruiter (corrected from earlier placeholder).
 * Aureliab is the Recruiter / Franchise Sales person (separate staff account).
 * [BRANCH] BOTH main and worker-deploy
 */
export const AGENTS = [
  { id: 'agent-janina',   name: 'Janina',             email: 'janina@waveclosers.com',   role: 'cold_caller' },
  { id: 'agent-johnm',    name: 'John Mell Morillo',  email: 'johnm@waveclosers.com',    role: 'cold_caller' },
  { id: 'agent-giana',    name: 'Gian Ericka Arcega', email: 'giana@waveclosers.com',    role: 'cold_caller' },
  { id: 'agent-juliusb',  name: 'Julius Bacarra',     email: 'juliusb@waveclosers.com',  role: 'cold_caller' },
  { id: 'agent-karenm',   name: 'Karen Monito',       email: 'karenm@waveclosers.com',   role: 'cold_caller' },
  { id: 'agent-jemelyna', name: 'Jemelyn Andaya',     email: 'jemelyna@waveclosers.com', role: 'cold_caller' },
  { id: 'agent-manilynp', name: 'Manilyn Parabas',    email: 'manilynp@waveclosers.com', role: 'cold_caller' },
  { id: 'agent-melaniea', name: 'Melanie Aranton',    email: 'melaniea@waveclosers.com', role: 'cold_caller' },
  { id: 'agent-aprils',   name: 'April Joy Saguid',   email: 'aprils@waveclosers.com',   role: 'cold_caller' },
];

// Supervisor account — sees all 9 agents' leads via dropdown
export const AGENT_SUPERVISOR_EMAIL = 'agentsservices@waveclosers.com';
// ⚠ PLACEHOLDER — confirm real email with William (Open Item #11)
export const RECRUITER_EMAIL        = (typeof process !== 'undefined' ? process.env.RECRUITER_EMAIL : null) || 'aureliab@waveclosers.com';
export const RECRUITER_NAME         = 'Aureliab';

export const DAILY_LEADS_PER_AGENT = 100;
export const NUM_AGENTS = 9;

export const LEAD_STATUSES = {
  NEW:                 { id: 'New',               label: 'New',               color: 'var(--color-info)'               },
  ASSIGNED:            { id: 'Assigned',          label: 'Assigned',          color: 'var(--color-primary)'            },
  CALLED:              { id: 'Called',            label: 'Called',            color: 'var(--color-amber)'              },
  INTERESTED:          { id: 'Interested',        label: 'Interested',        color: 'var(--color-green)'              },
  NOT_INTERESTED:      { id: 'NotInterested',     label: 'Not Interested',    color: 'var(--color-red)'                },
  CALLBACK:            { id: 'Callback',          label: 'Callback',          color: 'var(--color-amber)'              },
  NO_ANSWER:           { id: 'NoAnswer',          label: 'No Answer',         color: 'var(--color-faint, #999)'        },
  SENT_TO_QUALIFIER:   { id: 'SentToQualifier',  label: 'Sent to Qualifier', color: '#1F4E79'                         },
  ASSIGNED_TO_PARTNER: { id: 'AssignedToPartner',label: 'Assigned to Partner',color: '#C2547F'                       },
  ROUTED_TO_RECRUITER: { id: 'RoutedToRecruiter',label: 'Routed to Recruiter',color: '#D97A5E'                       },
  ROUTED_TO_CX:        { id: 'RoutedToCX',       label: 'Routed to CX',      color: '#7B6FDB'                         },
};

/**
 * Qualifier's statuses for the portal — separate from agent statuses.
 */
export const QUALIFIER_STATUSES = {
  NEW:       { id: 'QualifierNew',       label: 'New',       color: '#D49A2B', icon: '🟡' },
  CONTACTED: { id: 'QualifierContacted', label: 'Contacted', color: '#5B8DEF', icon: '📞' },
  QUALIFIED: { id: 'QualifierQualified', label: 'Qualified', color: '#2D9B5E', icon: '✅' },
  NOT_A_FIT: { id: 'QualifierNotAFit',  label: 'Not a fit', color: '#D44A4A', icon: '❌' },
  FOLLOW_UP: { id: 'QualifierFollowUp', label: 'Follow up', color: '#7B6FDB', icon: '📅' },
};

/**
 * Recruiting pipeline statuses (Workflow B)
 */
export const RECRUIT_STATUSES = [
  'New',
  'Contacted',
  'Interested',
  'Onboarding',
  'Active',
  'Declined',
];

/**
 * Recruiting pipeline stages — ordered step-by-step (excluding Declined which is an exit).
 * Used by the step-by-step status flow UI in RecruiterPortal.
 */
export const RECRUIT_STAGES = [
  { step: 1, status: 'New',        label: 'New',        color: '#888888' },
  { step: 2, status: 'Contacted',  label: 'Contacted',  color: '#5B8DEF' },
  { step: 3, status: 'Interested', label: 'Interested', color: '#D49A2B' },
  { step: 4, status: 'Onboarding', label: 'Onboarding', color: '#7B6FDB' },
  { step: 5, status: 'Active',     label: 'Active',     color: '#2D9B5E' },
];

/**
 * Recruit source options (for Aureliab's pipeline)
 */
export const RECRUIT_SOURCES = [
  'LinkedIn',
  'Craigslist',
  'Referral',
  'Job Board',
  'Social Media',
  'Direct Outreach',
  'Other',
];


/**
 * Recruit type options — NO Authorized Reseller (different channel)
 */
export const RECRUIT_TYPES = [
  'Independent Rep',
  'ISO Investor',
  'Referral Partner',
];

export const AUTOMATION_TASKS = [
  { name: 'User classification',           trigger: 'After Qualifier qualifies lead (stage 2)',  status: 'active',  runs: 0, lastRun: 'Never' },
  { name: 'Welcome email (personalised)',  trigger: 'Stage 3 → user email',                    status: 'active',  runs: 0, lastRun: 'Never' },
  { name: 'Contract dispatch trigger',     trigger: 'Stage 4 → CX Team',                       status: 'active',  runs: 0, lastRun: 'Never' },
  { name: 'Online learning enrollment',    trigger: 'After contract signed (stage 5)',         status: 'pending', runs: 0, lastRun: 'Never', note: 'Waiting on William: learning platform link (Open item #5)' },
  { name: 'Thursday training auto-invite', trigger: 'After learning setup (stage 6) → Matt',   status: 'pending', runs: 0, lastRun: 'Never', note: 'Waiting on William: Thursday meeting time (Open item #6)' },
  { name: 'Weekly performance report',     trigger: 'Every Monday 7am → PM & Admin',           status: 'active',  runs: 0, lastRun: 'Never' },
  { name: 'Lead-shortfall alert',          trigger: 'Real-time check → Sergey (Marketer)',     status: 'active',  runs: 0, lastRun: 'Never' },
  { name: 'Quota-miss escalation',         trigger: 'End of month → PM',                       status: 'active',  runs: 0, lastRun: 'Never' },
  { name: 'Franchise market research',     trigger: 'On demand',                               status: 'active',  runs: 0, lastRun: 'Never' },
];

export const RECRUITING_AGENTS = [
  { name: 'Janina',    email: 'janina@waveclosers.com'   },
  { name: 'John M',    email: 'johnm@waveclosers.com'    },
  { name: 'Giana',     email: 'giana@waveclosers.com'    },
  { name: 'Julius B',  email: 'juliusb@waveclosers.com'  },
  { name: 'Karen M',   email: 'karenm@waveclosers.com'   },
  { name: 'Jemelyn',   email: 'jemelyna@waveclosers.com' },
  { name: 'Manilyn',   email: 'manilynp@waveclosers.com' },
  { name: 'Melanie',   email: 'melaniea@waveclosers.com' },
  { name: 'April S',   email: 'aprils@waveclosers.com'   },
];



// ─── ALL USA Craigslist Cities — Complete list across all 50 states ───────────

/**
 * Complete Craigslist city list for the entire USA.
 * Used by automationWorker.js and any city-picker UI components.
 * Each entry: { label: 'City, ST', slug: 'craigslist-subdomain' }
 * [BRANCH] BOTH main and worker-deploy
 */
export const ALL_USA_CRAIGSLIST_CITIES = [
  // Alabama
  { label: 'Auburn, AL',           slug: 'auburn'          },
  { label: 'Birmingham, AL',       slug: 'bham'            },
  { label: 'Dothan, AL',           slug: 'dothan'          },
  { label: 'Florence, AL',         slug: 'shoals'          },
  { label: 'Gadsden, AL',          slug: 'gadsden'         },
  { label: 'Huntsville, AL',       slug: 'huntsville'      },
  { label: 'Mobile, AL',           slug: 'mobile'          },
  { label: 'Montgomery, AL',       slug: 'montgomery'      },
  { label: 'Tuscaloosa, AL',       slug: 'tuscaloosa'      },
  // Alaska
  { label: 'Anchorage, AK',        slug: 'anchorage'       },
  { label: 'Fairbanks, AK',        slug: 'fairbanks'       },
  { label: 'Juneau, AK',           slug: 'juneau'          },
  // Arizona
  { label: 'Flagstaff, AZ',        slug: 'flagstaff'       },
  { label: 'Phoenix, AZ',          slug: 'phoenix'         },
  { label: 'Prescott, AZ',         slug: 'prescott'        },
  { label: 'Sierra Vista, AZ',     slug: 'sierravista'     },
  { label: 'Tucson, AZ',           slug: 'tucson'          },
  { label: 'Yuma, AZ',             slug: 'yuma'            },
  // Arkansas
  { label: 'Fayetteville, AR',     slug: 'fayar'           },
  { label: 'Fort Smith, AR',       slug: 'fortsmith'       },
  { label: 'Jonesboro, AR',        slug: 'jonesboro'       },
  { label: 'Little Rock, AR',      slug: 'littlerock'      },
  { label: 'Texarkana, AR',        slug: 'texarkana'       },
  // California
  { label: 'Bakersfield, CA',      slug: 'bakersfield'     },
  { label: 'Chico, CA',            slug: 'chico'           },
  { label: 'Fresno, CA',           slug: 'fresno'          },
  { label: 'Hanford, CA',          slug: 'hanford'         },
  { label: 'Imperial County, CA',  slug: 'imperial'        },
  { label: 'Inland Empire, CA',    slug: 'inlandempire'    },
  { label: 'Los Angeles, CA',      slug: 'losangeles'      },
  { label: 'Mendocino, CA',        slug: 'mendocino'       },
  { label: 'Merced, CA',           slug: 'merced'          },
  { label: 'Modesto, CA',          slug: 'modesto'         },
  { label: 'Monterey, CA',         slug: 'monterey'        },
  { label: 'Orange County, CA',    slug: 'orangecounty'    },
  { label: 'Palm Springs, CA',     slug: 'palmsprings'     },
  { label: 'Redding, CA',          slug: 'redding'         },
  { label: 'Sacramento, CA',       slug: 'sacramento'      },
  { label: 'San Diego, CA',        slug: 'sandiego'        },
  { label: 'San Francisco, CA',    slug: 'sfbay'           },
  { label: 'San Luis Obispo, CA',  slug: 'slo'             },
  { label: 'Santa Barbara, CA',    slug: 'santabarbara'    },
  { label: 'Santa Cruz, CA',       slug: 'santacruz'       },
  { label: 'Santa Maria, CA',      slug: 'santamaria'      },
  { label: 'Stockton, CA',         slug: 'stockton'        },
  { label: 'Ventura, CA',          slug: 'ventura'         },
  { label: 'Visalia, CA',          slug: 'visalia'         },
  { label: 'Yuba City, CA',        slug: 'yubasutter'      },
  // Colorado
  { label: 'Boulder, CO',          slug: 'boulder'         },
  { label: 'Colorado Springs, CO', slug: 'cosprings'       },
  { label: 'Denver, CO',           slug: 'denver'          },
  { label: 'Fort Collins, CO',     slug: 'fortcollins'     },
  { label: 'Grand Junction, CO',   slug: 'grandjunction'   },
  { label: 'Pueblo, CO',           slug: 'pueblo'          },
  { label: 'Steamboat Springs, CO',slug: 'steamboat'       },
  // Connecticut
  { label: 'Hartford, CT',         slug: 'hartford'        },
  { label: 'New Haven, CT',        slug: 'newhavenct'      },
  // Delaware
  { label: 'Delaware',             slug: 'delaware'        },
  // Florida
  { label: 'Daytona Beach, FL',    slug: 'daytonabeach'    },
  { label: 'Fort Myers, FL',       slug: 'fortmyers'       },
  { label: 'Gainesville, FL',      slug: 'gainesville'     },
  { label: 'Jacksonville, FL',     slug: 'jacksonville'    },
  { label: 'Keys, FL',             slug: 'keys'            },
  { label: 'Lakeland, FL',         slug: 'lakeland'        },
  { label: 'Miami, FL',            slug: 'miami'           },
  { label: 'Ocala, FL',            slug: 'ocala'           },
  { label: 'Orlando, FL',          slug: 'orlando'         },
  { label: 'Panama City, FL',      slug: 'panamacity'      },
  { label: 'Pensacola, FL',        slug: 'pensacola'       },
  { label: 'Sarasota, FL',         slug: 'sarasota'        },
  { label: 'Space Coast, FL',      slug: 'spacecoast'      },
  { label: 'St. Augustine, FL',    slug: 'staugustine'     },
  { label: 'Tallahassee, FL',      slug: 'tallahassee'     },
  { label: 'Tampa, FL',            slug: 'tampa'           },
  { label: 'Treasure Coast, FL',   slug: 'treasurecoast'   },
  // Georgia
  { label: 'Albany, GA',           slug: 'albanyga'        },
  { label: 'Athens, GA',           slug: 'athens'          },
  { label: 'Atlanta, GA',          slug: 'atlanta'         },
  { label: 'Augusta, GA',          slug: 'augusta'         },
  { label: 'Brunswick, GA',        slug: 'brunswick'       },
  { label: 'Columbus, GA',         slug: 'columbusga'      },
  { label: 'Macon, GA',            slug: 'macon'           },
  { label: 'Savannah, GA',         slug: 'savannah'        },
  { label: 'Valdosta, GA',         slug: 'valdosta'        },
  // Hawaii
  { label: 'Hawaii',               slug: 'honolulu'        },
  // Idaho
  { label: 'Boise, ID',            slug: 'boise'           },
  { label: 'East Idaho, ID',       slug: 'eastidaho'       },
  { label: 'Lewiston, ID',         slug: 'lewiston'        },
  { label: 'Twin Falls, ID',       slug: 'twinfalls'       },
  // Illinois
  { label: 'Bloomington, IL',      slug: 'bloomington'     },
  { label: 'Chicago, IL',          slug: 'chicago'         },
  { label: 'Decatur, IL',          slug: 'decatur'         },
  { label: 'Peoria, IL',           slug: 'peoria'          },
  { label: 'Quad Cities, IL',      slug: 'quad'            },
  { label: 'Rockford, IL',         slug: 'rockford'        },
  { label: 'Southern Illinois',    slug: 'carbondale'      },
  { label: 'Springfield, IL',      slug: 'springfieldil'   },
  // Indiana
  { label: 'Evansville, IN',       slug: 'evansville'      },
  { label: 'Fort Wayne, IN',       slug: 'fortwayne'       },
  { label: 'Indianapolis, IN',     slug: 'indianapolis'    },
  { label: 'Kokomo, IN',           slug: 'kokomo'          },
  { label: 'Lafayette, IN',        slug: 'tippecanoe'      },
  { label: 'Muncie, IN',           slug: 'muncie'          },
  { label: 'South Bend, IN',       slug: 'southbend'       },
  { label: 'Terre Haute, IN',      slug: 'terrehaute'      },
  // Iowa
  { label: 'Cedar Rapids, IA',     slug: 'cedarrapids'     },
  { label: 'Des Moines, IA',       slug: 'desmoines'       },
  { label: 'Dubuque, IA',          slug: 'dubuque'         },
  { label: 'Iowa City, IA',        slug: 'iowacity'        },
  { label: 'Sioux City, IA',       slug: 'siouxcity'       },
  // Kansas
  { label: 'Lawrence, KS',         slug: 'lawrence'        },
  { label: 'Manhattan, KS',        slug: 'ksu'             },
  { label: 'Topeka, KS',           slug: 'topeka'          },
  { label: 'Wichita, KS',          slug: 'wichita'         },
  // Kentucky
  { label: 'Bowling Green, KY',    slug: 'bgky'            },
  { label: 'Lexington, KY',        slug: 'lexington'       },
  { label: 'Louisville, KY',       slug: 'louisville'      },
  { label: 'Owensboro, KY',        slug: 'owensboro'       },
  // Louisiana
  { label: 'Baton Rouge, LA',      slug: 'batonrouge'      },
  { label: 'Houma, LA',            slug: 'houma'           },
  { label: 'Lafayette, LA',        slug: 'lafayette'       },
  { label: 'Lake Charles, LA',     slug: 'lakecharles'     },
  { label: 'Monroe, LA',           slug: 'monroe'          },
  { label: 'New Orleans, LA',      slug: 'neworleans'      },
  { label: 'Shreveport, LA',       slug: 'shreveport'      },
  // Maine
  { label: 'Maine',                slug: 'maine'           },
  // Maryland
  { label: 'Annapolis, MD',        slug: 'annapolis'       },
  { label: 'Baltimore, MD',        slug: 'baltimore'       },
  { label: 'Eastern Shore, MD',    slug: 'easternshore'    },
  { label: 'Frederick, MD',        slug: 'frederick'       },
  { label: 'Southern Maryland',    slug: 'smd'             },
  // Massachusetts
  { label: 'Boston, MA',           slug: 'boston'          },
  { label: 'Cape Cod, MA',         slug: 'capecod'         },
  { label: 'South Coast, MA',      slug: 'southcoast'      },
  { label: 'Western Massachusetts',slug: 'westernmass'     },
  // Michigan
  { label: 'Ann Arbor, MI',        slug: 'annarbor'        },
  { label: 'Battle Creek, MI',     slug: 'battlecreek'     },
  { label: 'Detroit, MI',          slug: 'detroit'         },
  { label: 'Flint, MI',            slug: 'flint'           },
  { label: 'Grand Rapids, MI',     slug: 'grandrapids'     },
  { label: 'Holland, MI',          slug: 'holland'         },
  { label: 'Jackson, MI',          slug: 'jacksonmi'       },
  { label: 'Kalamazoo, MI',        slug: 'kalamazoo'       },
  { label: 'Lansing, MI',          slug: 'lansing'         },
  { label: 'Muskegon, MI',         slug: 'muskegon'        },
  { label: 'Northern Michigan',    slug: 'nmi'             },
  { label: 'Saginaw, MI',          slug: 'saginaw'         },
  { label: 'Upper Peninsula, MI',  slug: 'up'              },
  // Minnesota
  { label: 'Bemidji, MN',          slug: 'bemidji'         },
  { label: 'Brainerd, MN',         slug: 'brainerd'        },
  { label: 'Duluth, MN',           slug: 'duluth'          },
  { label: 'Mankato, MN',          slug: 'mankato'         },
  { label: 'Minneapolis, MN',      slug: 'minneapolis'     },
  { label: 'Rochester, MN',        slug: 'rochestermn'     },
  { label: 'St. Cloud, MN',        slug: 'stcloud'         },
  // Mississippi
  { label: 'Biloxi, MS',           slug: 'gulfport'        },
  { label: 'Hattiesburg, MS',      slug: 'hattiesburg'     },
  { label: 'Jackson, MS',          slug: 'jackson'         },
  { label: 'Meridian, MS',         slug: 'meridian'        },
  // Missouri
  { label: 'Columbia, MO',         slug: 'columbiamo'      },
  { label: 'Joplin, MO',           slug: 'joplin'          },
  { label: 'Kansas City, MO',      slug: 'kansascity'      },
  { label: 'Kirksville, MO',       slug: 'kirksville'      },
  { label: 'Lake of Ozarks, MO',   slug: 'lakeoftheozarks' },
  { label: 'Springfield, MO',      slug: 'springfield'     },
  { label: 'St. Joseph, MO',       slug: 'stjoseph'        },
  { label: 'St. Louis, MO',        slug: 'stlouis'         },
  // Montana
  { label: 'Billings, MT',         slug: 'billings'        },
  { label: 'Bozeman, MT',          slug: 'bozeman'         },
  { label: 'Butte, MT',            slug: 'butte'           },
  { label: 'Great Falls, MT',      slug: 'greatfalls'      },
  { label: 'Helena, MT',           slug: 'helena'          },
  { label: 'Missoula, MT',         slug: 'missoula'        },
  // Nebraska
  { label: 'Grand Island, NE',     slug: 'grandisland'     },
  { label: 'Lincoln, NE',          slug: 'lincoln'         },
  { label: 'North Platte, NE',     slug: 'northplatte'     },
  { label: 'Omaha, NE',            slug: 'omaha'           },
  // Nevada
  { label: 'Las Vegas, NV',        slug: 'lasvegas'        },
  { label: 'Reno, NV',             slug: 'reno'            },
  // New Hampshire
  { label: 'New Hampshire',        slug: 'newhampshire'    },
  // New Jersey
  { label: 'New Jersey',           slug: 'newjersey'       },
  // New Mexico
  { label: 'Albuquerque, NM',      slug: 'albuquerque'     },
  { label: 'Farmington, NM',       slug: 'farmington'      },
  { label: 'Las Cruces, NM',       slug: 'lascruces'       },
  { label: 'Santa Fe, NM',         slug: 'santafe'         },
  // New York
  { label: 'Albany, NY',           slug: 'albany'          },
  { label: 'Binghamton, NY',       slug: 'binghamton'      },
  { label: 'Buffalo, NY',          slug: 'buffalo'         },
  { label: 'Catskills, NY',        slug: 'catskills'       },
  { label: 'Chautauqua, NY',       slug: 'chautauqua'      },
  { label: 'Elmira, NY',           slug: 'elmira'          },
  { label: 'Finger Lakes, NY',     slug: 'fingerlakes'     },
  { label: 'Glens Falls, NY',      slug: 'glensfalls'      },
  { label: 'Hudson Valley, NY',    slug: 'hudsonvalley'    },
  { label: 'Ithaca, NY',           slug: 'ithaca'          },
  { label: 'Long Island, NY',      slug: 'longisland'      },
  { label: 'New York City, NY',    slug: 'newyork'         },
  { label: 'Oneonta, NY',          slug: 'oneonta'         },
  { label: 'Plattsburgh, NY',      slug: 'plattsburgh'     },
  { label: 'Potsdam, NY',          slug: 'potsdam'         },
  { label: 'Rochester, NY',        slug: 'rochester'       },
  { label: 'Syracuse, NY',         slug: 'syracuse'        },
  { label: 'Utica, NY',            slug: 'utica'           },
  { label: 'Watertown, NY',        slug: 'watertown'       },
  // North Carolina
  { label: 'Asheville, NC',        slug: 'asheville'       },
  { label: 'Boone, NC',            slug: 'boone'           },
  { label: 'Charlotte, NC',        slug: 'charlotte'       },
  { label: 'Fayetteville, NC',     slug: 'fayetteville'    },
  { label: 'Greensboro, NC',       slug: 'greensboro'      },
  { label: 'Hickory, NC',          slug: 'hickory'         },
  { label: 'Jacksonville, NC',     slug: 'jacksonvillenc'  },
  { label: 'Outer Banks, NC',      slug: 'outerbanks'      },
  { label: 'Raleigh, NC',          slug: 'raleigh'         },
  { label: 'Wilmington, NC',       slug: 'wilmington'      },
  { label: 'Winston-Salem, NC',    slug: 'winstonsalem'    },
  // North Dakota
  { label: 'Bismarck, ND',         slug: 'bismarck'        },
  { label: 'Fargo, ND',            slug: 'fargo'           },
  { label: 'Grand Forks, ND',      slug: 'grandforks'      },
  // Ohio
  { label: 'Akron, OH',            slug: 'akron'           },
  { label: 'Ashtabula, OH',        slug: 'ashtabula'       },
  { label: 'Athens, OH',           slug: 'athensohio'      },
  { label: 'Chillicothe, OH',      slug: 'chillicothe'     },
  { label: 'Cincinnati, OH',       slug: 'cincinnati'      },
  { label: 'Cleveland, OH',        slug: 'cleveland'       },
  { label: 'Columbus, OH',         slug: 'columbus'        },
  { label: 'Dayton, OH',           slug: 'dayton'          },
  { label: 'Lima, OH',             slug: 'limaohio'        },
  { label: 'Mansfield, OH',        slug: 'mansfield'       },
  { label: 'Sandusky, OH',         slug: 'sandusky'        },
  { label: 'Toledo, OH',           slug: 'toledo'          },
  { label: 'Tuscarawas, OH',       slug: 'tuscarawas'      },
  { label: 'Youngstown, OH',       slug: 'youngstown'      },
  // Oklahoma
  { label: 'Lawton, OK',           slug: 'lawton'          },
  { label: 'Oklahoma City, OK',    slug: 'oklahomacity'    },
  { label: 'Stillwater, OK',       slug: 'stillwater'      },
  { label: 'Tulsa, OK',            slug: 'tulsa'           },
  // Oregon
  { label: 'Bend, OR',             slug: 'bend'            },
  { label: 'Corvallis, OR',        slug: 'corvallis'       },
  { label: 'Eugene, OR',           slug: 'eugene'          },
  { label: 'Klamath Falls, OR',    slug: 'klamath'         },
  { label: 'Medford, OR',          slug: 'medford'         },
  { label: 'Oregon Coast',         slug: 'oregoncoast'     },
  { label: 'Portland, OR',         slug: 'portland'        },
  { label: 'Roseburg, OR',         slug: 'roseburg'        },
  { label: 'Salem, OR',            slug: 'salem'           },
  // Pennsylvania
  { label: 'Allentown, PA',        slug: 'allentown'       },
  { label: 'Altoona, PA',          slug: 'altoona'         },
  { label: 'Erie, PA',             slug: 'erie'            },
  { label: 'Harrisburg, PA',       slug: 'harrisburg'      },
  { label: 'Lancaster, PA',        slug: 'lancaster'       },
  { label: 'Philadelphia, PA',     slug: 'philadelphia'    },
  { label: 'Pittsburgh, PA',       slug: 'pittsburgh'      },
  { label: 'Poconos, PA',          slug: 'poconos'         },
  { label: 'Reading, PA',          slug: 'reading'         },
  { label: 'Scranton, PA',         slug: 'scranton'        },
  { label: 'State College, PA',    slug: 'statecollege'    },
  { label: 'Williamsport, PA',     slug: 'williamsport'    },
  { label: 'York, PA',             slug: 'york'            },
  // Rhode Island
  { label: 'Rhode Island',         slug: 'providence'      },
  // South Carolina
  { label: 'Charleston, SC',       slug: 'charleston'      },
  { label: 'Columbia, SC',         slug: 'columbia'        },
  { label: 'Florence, SC',         slug: 'florencesc'      },
  { label: 'Greenville, SC',       slug: 'greenville'      },
  { label: 'Hilton Head, SC',      slug: 'hiltonhead'      },
  { label: 'Myrtle Beach, SC',     slug: 'myrtlebeach'     },
  { label: 'Spartanburg, SC',      slug: 'spartanburg'     },
  // South Dakota
  { label: 'Pierre, SD',           slug: 'pierre'          },
  { label: 'Rapid City, SD',       slug: 'rapidcity'       },
  { label: 'Sioux Falls, SD',      slug: 'siouxfalls'      },
  // Tennessee
  { label: 'Chattanooga, TN',      slug: 'chattanooga'     },
  { label: 'Clarksville, TN',      slug: 'clarksville'     },
  { label: 'Jackson, TN',          slug: 'jacksontn'       },
  { label: 'Knoxville, TN',        slug: 'knoxville'       },
  { label: 'Memphis, TN',          slug: 'memphis'         },
  { label: 'Nashville, TN',        slug: 'nashville'       },
  { label: 'Tri-Cities, TN',       slug: 'tricities'       },
  // Texas
  { label: 'Abilene, TX',          slug: 'abilene'         },
  { label: 'Amarillo, TX',         slug: 'amarillo'        },
  { label: 'Austin, TX',           slug: 'austin'          },
  { label: 'Beaumont, TX',         slug: 'beaumont'        },
  { label: 'Corpus Christi, TX',   slug: 'corpuschristi'   },
  { label: 'Dallas, TX',           slug: 'dallas'          },
  { label: 'Del Rio, TX',          slug: 'delrio'          },
  { label: 'El Paso, TX',          slug: 'elpaso'          },
  { label: 'Fort Worth, TX',       slug: 'fortworth'       },
  { label: 'Galveston, TX',        slug: 'galveston'       },
  { label: 'Houston, TX',          slug: 'houston'         },
  { label: 'Killeen, TX',          slug: 'killeen'         },
  { label: 'Laredo, TX',           slug: 'laredo'          },
  { label: 'Lubbock, TX',          slug: 'lubbock'         },
  { label: 'McAllen, TX',          slug: 'mcallen'         },
  { label: 'Midland, TX',          slug: 'midland'         },
  { label: 'San Antonio, TX',      slug: 'sanantonio'      },
  { label: 'San Marcos, TX',       slug: 'sanmarcos'       },
  { label: 'Tyler, TX',            slug: 'easttexas'       },
  { label: 'Victoria, TX',         slug: 'victoriatx'      },
  { label: 'Waco, TX',             slug: 'waco'            },
  { label: 'Wichita Falls, TX',    slug: 'wichitafalls'    },
  // Utah
  { label: 'Logan, UT',            slug: 'logan'           },
  { label: 'Ogden, UT',            slug: 'ogden'           },
  { label: 'Provo, UT',            slug: 'provo'           },
  { label: 'Salt Lake City, UT',   slug: 'saltlakecity'    },
  { label: 'St. George, UT',       slug: 'stgeorge'        },
  // Vermont
  { label: 'Vermont',              slug: 'vermont'         },
  // Virginia
  { label: 'Charlottesville, VA',  slug: 'charlottesville' },
  { label: 'Danville, VA',         slug: 'danville'        },
  { label: 'Fredericksburg, VA',   slug: 'fredericksburg'  },
  { label: 'Hampton Roads, VA',    slug: 'norfolk'         },
  { label: 'Harrisonburg, VA',     slug: 'harrisonburg'    },
  { label: 'Lynchburg, VA',        slug: 'lynchburg'       },
  { label: 'New River Valley, VA', slug: 'nrv'             },
  { label: 'Northern Virginia',    slug: 'washingtondc'    },
  { label: 'Richmond, VA',         slug: 'richmond'        },
  { label: 'Roanoke, VA',          slug: 'roanoke'         },
  { label: 'Southwest Virginia',   slug: 'swva'            },
  { label: 'Winchester, VA',       slug: 'winchester'      },
  // Washington
  { label: 'Bellingham, WA',       slug: 'bellingham'      },
  { label: 'Kennewick, WA',        slug: 'kennewick'       },
  { label: 'Olympia, WA',          slug: 'olympia'         },
  { label: 'Seattle, WA',          slug: 'seattle'         },
  { label: 'Skagit, WA',           slug: 'skagit'          },
  { label: 'Spokane, WA',          slug: 'spokane'         },
  { label: 'Tacoma, WA',           slug: 'tacoma'          },
  { label: 'Wenatchee, WA',        slug: 'wenatchee'       },
  { label: 'Yakima, WA',           slug: 'yakima'          },
  // West Virginia
  { label: 'Charleston, WV',       slug: 'charlestonwv'    },
  { label: 'Huntington, WV',       slug: 'huntington'      },
  { label: 'Morgantown, WV',       slug: 'morgantown'      },
  { label: 'Parkersburg, WV',      slug: 'parkersburg'     },
  { label: 'Wheeling, WV',         slug: 'wheeling'        },
  // Wisconsin
  { label: 'Appleton, WI',         slug: 'appleton'        },
  { label: 'Eau Claire, WI',       slug: 'eauclaire'       },
  { label: 'Green Bay, WI',        slug: 'greenbay'        },
  { label: 'Janesville, WI',       slug: 'janesville'      },
  { label: 'Kenosha, WI',          slug: 'kenosha'         },
  { label: 'La Crosse, WI',        slug: 'lacrosse'        },
  { label: 'Madison, WI',          slug: 'madison'         },
  { label: 'Milwaukee, WI',        slug: 'milwaukee'       },
  { label: 'Racine, WI',           slug: 'racine'          },
  { label: 'Sheboygan, WI',        slug: 'sheboygan'       },
  { label: 'Wausau, WI',           slug: 'wausau'          },
  // Wyoming
  { label: 'Casper, WY',           slug: 'wyoming'         },
  { label: 'Cheyenne, WY',         slug: 'wyoming'         },
];

// TARGET_MARKETS points to the full USA city list
export const TARGET_MARKETS = ALL_USA_CRAIGSLIST_CITIES;

// CRAIGSLIST_CITIES must be declared AFTER ALL_USA_CRAIGSLIST_CITIES to avoid TDZ error
export const CRAIGSLIST_CITIES = ALL_USA_CRAIGSLIST_CITIES.map(c => ({ label: c.label, value: c.slug }));

export const RESUME_SEARCH_KEYWORDS = [
  // User Requested Core Keywords
  'Sales',
  'Sales experience',
  'Motivated individuals',
  'Goal-oriented',
  'Results-driven',
  'Prospective clients',
  'Client relationships',
  'Build lasting relationships',
  'Business development',
  'Professional growth',
  'Earning potential',
  'Commission-only',
  'Competitive compensation',
  'Marketing',
  'Sales opportunities',
  'Jobs',
  'Customer representative',
  'Sales Representative',

  // Outbound & Telemarketing
  'cold calling',
  'cold caller',
  'outbound sales',
  'outbound calling',
  'telemarketing',
  'telesales',
  'phone sales',
  'inside sales',
  'outside sales',
  'direct sales',
  'direct marketing',
  'appointment setter',
  'appointment setting',
  'sales closer',
  'high ticket closer',
  'field sales',
  'door to door sales',
  'door to door',
  'direct sales',
  'direct marketing',

  // Business development
  'business development',
  'business development rep',
  'BDR',
  'SDR',
  'sales development',
  'account executive',
  'account manager',
  'account representative',

  // Closing roles
  'closer',
  'sales closer',
  'high ticket closer',
  'appointment setter',
  'appointment setting',

  // Payment and merchant specific
  'payment processing sales',
  'merchant services',
  'merchant sales',
  'POS sales',
  'point of sale sales',
  'fintech sales',
  'financial sales',

  // B2B specific
  'B2B sales',
  'B2B representative',
  'business to business',
  'small business sales',
  'SMB sales',

  // General looking for work
  'seeking sales position',
  'sales experience',
  'sales background',
  'sales motivated',
  'self motivated sales',
  'results driven sales',
  'goal oriented sales',

  // Entry level and experienced
  'entry level sales',
  'junior sales',
  'senior sales',
  'experienced sales',
  'sales professional available',
  'sales talent',
  'motivated sales',

  // Referral and partner roles
  'referral partner',
  'affiliate sales',
  'reseller',
  'independent contractor sales',
  'freelance sales',
  '1099 sales',
];

export function cleanCraigslistUrl(rawUrl, title = '') {
  if (!rawUrl) return '';
  let url = String(rawUrl).trim();

  const viewMatch = url.match(/craigslist\.org\/(?:view\/d|res\/d)\/([^/]+)\/([^/?#]+)/i);
  if (viewMatch) {
    let slug = viewMatch[1];
    const hashOrId = viewMatch[2].replace(/\.html$/i, '');

    if (/^\d+:/.test(slug) || slug === 'posting' || !slug) {
      slug = (title || '')
        .toLowerCase()
        .replace(/^(\d+,)+/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'posting';
    }
    return `https://www.craigslist.org/view/d/${slug}/${hashOrId}`;
  }

  return url;
}
