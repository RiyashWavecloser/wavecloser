/**
 * server/constants.js
 *
 * Server-side mirror of src/data/constants.js.
 * Used by automationWorker.js and emailService.js.
 * [BRANCH] BOTH branches (main + worker-deploy)
 */

export const USER_TYPES = {
  COLD_CALLER: {
    id:           'COLD_CALLER',
    label:        'Cold Caller',
    short:        'Cold Caller',
    portal:       'agent',
    leadPriority: 3,
    color:        '#5B8DEF',
    earningModel: 'Commission per closed deal',
  },
  REP: {
    id:           'REP',
    label:        'Independent Rep',
    short:        'Indep Rep',
    portal:       'agent',
    leadPriority: 2,
    color:        '#D97A5E',
    earningModel: '$1,500–$3,000 bonus + 40% residuals',
  },
  RESELLER: {
    id:           'RESELLER',
    label:        'Authorized Reseller',
    short:        'Reseller',
    portal:       'agent',
    leadPriority: 1,
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
 */
export const LEAD_DISTRIBUTION_ORDER = ['RESELLER', 'REP', 'COLD_CALLER'];

export const BENCHMARKS = {
  COLD_CALLER: { weeklyLeads: 10, monthlyQuota: 4,  closeRate: 0.30 },
  REP:         { weeklyLeads: 10, monthlyQuota: 4,  closeRate: 0.35 },
  RESELLER:    { weeklyLeads: 12, monthlyQuota: 5,  closeRate: 0.40 },
  ISO:         { weeklyLeads: 8,  monthlyQuota: 3,  closeRate: 0.50 },
  REFERRAL:    { weeklyLeads: 5,  monthlyQuota: 2,  closeRate: 0.40 },
};

export const DAILY_LEADS_PER_AGENT  = Number(process.env.DAILY_LEADS_PER_AGENT || 100);
export const WEEKLY_LEADS_PER_AGENT = Number(process.env.WEEKLY_LEADS_PER_AGENT || 500);
export const LEAD_GENERATION_MARKETS = process.env.LEAD_GENERATION_MARKETS || 'Miami FL,Houston TX,Atlanta GA,Chicago IL,Dallas TX';
export const NUM_AGENTS             = Number(process.env.NUM_AGENTS || 9);

/**
 * Real cold-calling agent accounts (confirmed June 2026).
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

export const AGENT_SUPERVISOR_EMAIL = process.env.AGENT_SUPERVISOR_EMAIL || 'agentsservices@waveclosers.com';

export const BUSINESS_TYPES = [
  'restaurant', 'beauty_salon', 'nail_salon', 'deli', 'massage', 'small_retail',
];

export const LEAD_STATUSES = [
  'New', 'Assigned', 'Called', 'Interested', 'NotInterested', 'Callback', 'NoAnswer',
];

// ─── Resume Lead Distribution (Workflow C) ────────────────────────────────────

/**
 * Number of Craigslist resume leads assigned to each recruiting agent per day.
 */
export const DAILY_RESUME_LEADS_PER_WCR = Number(process.env.DAILY_RESUME_LEADS_PER_WCR || 100);

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

export const RESUME_SEARCH_KEYWORDS_LIST = RESUME_SEARCH_KEYWORDS;

/**
 * Staff roles that receive daily resume leads.
 */
export const RECRUITING_ROLES = ['wave_closer_recruiter', 'recruiter'];

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

// ─── ALL USA Craigslist Cities — Complete list across all 50 states ────────────

/**
 * Complete Craigslist city list for the entire USA.
 * Used by getCitiesForToday() in automationWorker.js to rotate daily batches.
 * Each entry: { label: 'City, ST', slug: 'craigslist-subdomain' }
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

// TARGET_MARKETS now points to the complete USA city list (used by automationWorker.js)
// automationWorker.js uses getCitiesForToday() to rotate through a daily batch of 20 cities
export const TARGET_MARKETS = ALL_USA_CRAIGSLIST_CITIES;

// Legacy CITY_SUBDOMAINS — kept for backwards-compatibility with any UI pickers
export const CITY_SUBDOMAINS = Object.fromEntries(
  ALL_USA_CRAIGSLIST_CITIES.map(c => [c.slug, c.label])
);

export const CRAIGSLIST_CITIES = ALL_USA_CRAIGSLIST_CITIES.map(c => ({ label: c.label, value: c.slug }));

export const ROTATING_USA_CITIES = ALL_USA_CRAIGSLIST_CITIES.map(c => c.slug);

/**
 * Complete nationwide major USA cities for automated business lead generation.
 */
export const ALL_USA_BUSINESS_MARKETS = ALL_USA_CRAIGSLIST_CITIES.map(c => c.label);

export const HIGH_VOLUME_CITIES = [
  { label: 'New York City, NY',    slug: 'newyork'       },
  { label: 'Los Angeles, CA',      slug: 'losangeles'    },
  { label: 'Chicago, IL',          slug: 'chicago'       },
  { label: 'Houston, TX',          slug: 'houston'       },
  { label: 'Phoenix, AZ',          slug: 'phoenix'       },
  { label: 'Philadelphia, PA',     slug: 'philadelphia'  },
  { label: 'San Antonio, TX',      slug: 'sanantonio'    },
  { label: 'San Diego, CA',        slug: 'sandiego'      },
  { label: 'Dallas, TX',           slug: 'dallas'        },
  { label: 'San Francisco, CA',    slug: 'sfbay'         },
  { label: 'Seattle, WA',          slug: 'seattle'       },
  { label: 'Denver, CO',           slug: 'denver'        },
  { label: 'Boston, MA',           slug: 'boston'        },
  { label: 'Miami, FL',            slug: 'miami'         },
  { label: 'Atlanta, GA',          slug: 'atlanta'       },
  { label: 'Minneapolis, MN',      slug: 'minneapolis'   },
  { label: 'Portland, OR',         slug: 'portland'      },
  { label: 'Las Vegas, NV',        slug: 'lasvegas'      },
  { label: 'Detroit, MI',          slug: 'detroit'       },
  { label: 'New Jersey',           slug: 'newjersey'     },
  { label: 'Long Island, NY',      slug: 'longisland'    },
  { label: 'Sacramento, CA',       slug: 'sacramento'    },
  { label: 'Pittsburgh, PA',       slug: 'pittsburgh'    },
  { label: 'Orlando, FL',          slug: 'orlando'       },
  { label: 'Tampa, FL',            slug: 'tampa'         },
  { label: 'Charlotte, NC',        slug: 'charlotte'     },
  { label: 'Raleigh, NC',          slug: 'raleigh'       },
  { label: 'Nashville, TN',        slug: 'nashville'     },
  { label: 'Austin, TX',           slug: 'austin'        },
  { label: 'Indianapolis, IN',     slug: 'indianapolis'  },
];

export const DEMO_PHRASES = [
  'energetic sales professional based in',
  'proven track record in outbound phone outreach and merchant communication',
  'seeking cold calling, b2b sales, or appointment setting position',
  'connecticut / hartford seeking cold calling',
  'orlando, fl seeking cold calling',
  'waveclosers-candidate.com',
  'waveclosers.com',
  '@waveclosers',
  'example.com',
  'test lead',
  'demo lead',
  'sample resume',
  'lorem ipsum',
];

/**
 * normalizeResumeURL — strips trailing slash, query params, and fragment.
 * IMPORTANT: does NOT lowercase — Craigslist postingHash is case-sensitive.
 * e.g. "a4HRs84R6cXEecD42jNemB" ≠ "a4hrs84r6cxeecd42jnemb" (404 if lowercased)
 */
export function normalizeResumeURL(url) {
  return (url || '')
    .trim()
    .replace(/\/$/, '')
    .replace(/\?.*$/, '')
    .replace(/#.*$/, '');
}

/**
 * normalizeForDedup — lowercase-normalised form ONLY for Set membership checks.
 * Never save this to Airtable — use normalizeResumeURL for the real URL.
 */
export function normalizeForDedup(url) {
  return normalizeResumeURL(url).toLowerCase();
}

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

export function isDemoLead(lead) {
  const desc  = (lead.description || lead.postingBody || '').toLowerCase();
  const url   = normalizeResumeURL(lead.link || lead.url || lead.craigslistUrl || '');
  const title = (lead.title || '').toLowerCase();

  // Check description for demo phrases
  if (DEMO_PHRASES.some(phrase => desc.includes(phrase))) return true;

  // Check title for demo phrases
  if (DEMO_PHRASES.some(phrase => title.includes(phrase))) return true;

  // Check URL validity
  if (!url) return true;
  if (!url.startsWith('https://')) return true;
  if (!url.includes('craigslist.org')) return true;
  if (url.includes('/search/res')) return true; // search page not post

  // Valid Craigslist posting URLs can be /view/d/..., /d/..., or .html
  const isPostUrl = url.includes('/view/d/') || url.includes('/d/') || url.includes('.html');
  if (!isPostUrl) return true;

  // Check for fake domain in URL
  if (DEMO_PHRASES.some(phrase => url.includes(phrase))) return true;

  return false;
}

