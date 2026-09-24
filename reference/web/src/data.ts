export const BRAND = {
  name: 'Lumen Coffee Co.',
  short: 'Lumen',
  url: 'lumen.coffee',
  category: 'D2C specialty coffee',
}

export type NodeSpec = {
  id: string
  title: string
  icon: 'eye' | 'drop' | 'type' | 'image' | 'ear' | 'wave' | 'heart' | 'key' | 'users' | 'pin' | 'radar' | 'coin'
  logs: string[]
  result: string
}

export type LandId = 'identity' | 'voice' | 'audience'

export type LandSpec = {
  id: LandId
  index: number
  name: string
  kicker: string
  blurb: string
  theme: 'light' | 'dark'
  done: string
  nodes: NodeSpec[]
}

export const LANDS: LandSpec[] = [
  {
    id: 'identity',
    index: 1,
    name: 'Identity Meadow',
    kicker: 'Visual identity',
    blurb: 'Reading the logo, palette, type and imagery',
    theme: 'light',
    done: 'Visual identity decoded',
    nodes: [
      {
        id: 'logo',
        title: 'Logo Vision',
        icon: 'eye',
        logs: ['GET lumen.coffee/brand-kit', 'vectorising mark · 214 paths', 'symmetry score 0.92', 'glyph: sunrise + wordmark'],
        result: 'Geometric, warm mark',
      },
      {
        id: 'palette',
        title: 'Palette Extractor',
        icon: 'drop',
        logs: ['sampling 1,480 assets', 'k-means clustering · k=5', 'deep roast / cream / sunrise', 'contrast AA passed'],
        result: 'Earthy, premium palette',
      },
      {
        id: 'type',
        title: 'Type Detector',
        icon: 'type',
        logs: ['OCR on 312 creatives', 'geometric sans · 94% match', 'headline 700 · tracking −2%'],
        result: 'Modern, friendly type',
      },
      {
        id: 'imagery',
        title: 'Imagery Lens',
        icon: 'image',
        logs: ['embedding 860 photos', 'themes: morning light, hands', 'people-first framing 68%'],
        result: 'Warm lifestyle imagery',
      },
    ],
  },
  {
    id: 'voice',
    index: 2,
    name: 'Voice Lagoon',
    kicker: 'Tone & sentiment',
    blurb: 'Listening to 12.4k posts and 9.8k reviews',
    theme: 'dark',
    done: 'Brand voice decoded',
    nodes: [
      {
        id: 'listen',
        title: 'Social Listener',
        icon: 'ear',
        logs: ['crawl IG · X · Reddit', '12,412 posts · EN 81% HI 14%', 'entities: cold brew, oat latte'],
        result: '3.2k mentions / month',
      },
      {
        id: 'tone',
        title: 'Tone Classifier',
        icon: 'wave',
        logs: ['tone model v3 loaded', 'warm 0.81 · witty 0.64', 'formal 0.12 · emoji: medium'],
        result: 'Warm & witty voice',
      },
      {
        id: 'sentiment',
        title: 'Sentiment Engine',
        icon: 'heart',
        logs: ['scoring 9,812 reviews', 'pos 78% · neu 17% · neg 5%', 'pain point: delivery delays', 'NPS proxy +52'],
        result: '78% positive',
      },
      {
        id: 'keywords',
        title: 'Keyword Miner',
        icon: 'key',
        logs: ['TF-IDF + topic model', '"slow mornings" "single origin"', '"cozy" "desk ritual"'],
        result: '24 intent keywords',
      },
    ],
  },
  {
    id: 'audience',
    index: 3,
    name: 'Audience Summit',
    kicker: 'Audience & market',
    blurb: 'Mapping who buys, where, and who else is shouting',
    theme: 'light',
    done: 'Audience & market decoded',
    nodes: [
      {
        id: 'persona',
        title: 'Persona Builder',
        icon: 'users',
        logs: ['joining first-party + social graph', '3 clusters found', 'urban creators 24–34 · 41%'],
        result: 'Urban creators, 24–34',
      },
      {
        id: 'geo',
        title: 'Geo Mapper',
        icon: 'pin',
        logs: ['heatmap from 18k orders', 'Bandra · Indiranagar', 'Koramangala · Lower Parel'],
        result: '3 metro hotspots',
      },
      {
        id: 'competitors',
        title: 'Competitor Radar',
        icon: 'radar',
        logs: ['scanning 14 D2C coffee brands', 'share of voice 11% · rank #4', 'white space: podcasts, commuters'],
        result: '2 open channels',
      },
      {
        id: 'budget',
        title: 'Budget Oracle',
        icon: 'coin',
        logs: ['seasonality: Oct–Dec peak', 'CPM band 2.1–5.0 USDC', 'reach target 3.1M'],
        result: '6k USDC / month',
      },
    ],
  },
]

export const DNA = [
  { k: 'Archetype', v: 'The Everyday Creator' },
  { k: 'Voice', v: 'Warm · Witty · Unhurried' },
  { k: 'Audience', v: 'Urban creators, 24–34' },
  { k: 'Hotspots', v: 'Mumbai · Bengaluru' },
  { k: 'Budget', v: '6,000 USDC / month' },
]

export type ArtKind =
  | 'billboard'
  | 'metro'
  | 'bus'
  | 'podcast'
  | 'creator'
  | 'newsletter'
  | 'screens'
  | 'stadium'
  | 'radio'
  | 'magazine'
  | 'video'
  | 'cafe'

export type District = {
  id: string
  name: string
  listings: number
  thought: string
}

export const DISTRICTS: District[] = [
  { id: 'outdoor', name: 'Outdoor & Billboards', listings: 1204, thought: 'Morning commute… big & bold?' },
  { id: 'transit', name: 'Metro & Transit', listings: 2310, thought: 'Creators ride the metro…' },
  { id: 'audio', name: 'Podcasts & Audio', listings: 1876, thought: '"Slow mornings" → podcasts!' },
  { id: 'creators', name: 'Creators & Social', listings: 3120, thought: 'Warm, witty voices…' },
  { id: 'newsletters', name: 'Newsletters', listings: 942, thought: 'Desk-ritual readers…' },
  { id: 'indoor', name: 'Co-work & Indoor', listings: 1688, thought: 'Where do they work?' },
  { id: 'events', name: 'Events & Arenas', listings: 1340, thought: 'Too loud for Lumen?' },
]

export type AdSpace = {
  id: string
  title: string
  district: string
  loc: string
  art: ArtKind
  match: number
  reach: string
  price: number
  unit: string
  format: string
}

/** What streams past during the scan. The high matches become results. */
export const STREAM: AdSpace[] = [
  { id: 'a1', title: 'Western Express Hwy Hoarding', district: 'outdoor', loc: 'Andheri, Mumbai', art: 'billboard', match: 58, reach: '2.1M / wk', price: 2500, unit: 'wk', format: '40×20 ft hoarding' },
  { id: 'r1', title: 'Linking Road Billboard', district: 'outdoor', loc: 'Bandra, Mumbai', art: 'billboard', match: 96, reach: '1.2M / wk', price: 1450, unit: 'wk', format: '30×15 ft backlit' },
  { id: 'a2', title: 'BKC Bus Shelter Network', district: 'transit', loc: 'BKC, Mumbai', art: 'bus', match: 64, reach: '640K / wk', price: 860, unit: 'wk', format: '24 shelters' },
  { id: 'r2', title: 'Indiranagar Metro Pillars', district: 'transit', loc: 'Bengaluru', art: 'metro', match: 94, reach: '860K / wk', price: 1020, unit: 'wk', format: '18 pillar wraps' },
  { id: 'a3', title: 'Cricket Talk Daily', district: 'audio', loc: 'Pan-India', art: 'radio', match: 41, reach: '1.4M listens', price: 1080, unit: 'mo', format: '6 pre-rolls' },
  { id: 'r3', title: 'Slow Mornings Podcast', district: 'audio', loc: 'Pan-India', art: 'podcast', match: 92, reach: '210K listens', price: 580, unit: 'mo', format: '3 host-read spots' },
  { id: 'r4', title: '@chai.and.charcoal', district: 'creators', loc: 'Mumbai creator', art: 'creator', match: 91, reach: '540K reach', price: 780, unit: 'mo', format: '2 reels + 3 stories' },
  { id: 'a4', title: '@gym.bro.gains', district: 'creators', loc: 'Delhi creator', art: 'video', match: 33, reach: '1.1M reach', price: 960, unit: 'mo', format: '1 dedicated video' },
  { id: 'r5', title: 'The Daily Grind', district: 'newsletters', loc: '180K subscribers', art: 'newsletter', match: 89, reach: '180K opens', price: 460, unit: 'mo', format: '1 feature slot' },
  { id: 'a5', title: 'Weekend Auto Journal', district: 'newsletters', loc: '95K subscribers', art: 'magazine', match: 47, reach: '95K opens', price: 260, unit: 'mo', format: 'Banner slot' },
  { id: 'r6', title: 'Koramangala Co-work Screens', district: 'indoor', loc: 'Bengaluru', art: 'screens', match: 90, reach: '95K / wk', price: 1510, unit: 'mo', format: '40 lobby screens' },
  { id: 'a6', title: 'Mall Food Court Tents', district: 'indoor', loc: 'Pune', art: 'cafe', match: 71, reach: '120K / wk', price: 360, unit: 'mo', format: '200 table tents' },
  { id: 'a7', title: 'Arena LED Ring', district: 'events', loc: 'Pune', art: 'stadium', match: 52, reach: '3.4M / match', price: 4100, unit: 'match', format: '90s LED rotation' },
  { id: 'a8', title: 'Indie Music Fest Stage', district: 'events', loc: 'Goa', art: 'stadium', match: 68, reach: '60K attendees', price: 1800, unit: 'event', format: 'Side-stage branding' },
]

/** Settlement network for the USDC transfer. Swap here to change chains. */
export const CHAIN = {
  name: 'Sui',
  fee: '0.0021 SUI',
  explorer: 'suiscan.xyz',
  /** transaction digest shown once the transfer lands */
  digest: '8Hq3…pX2d',
  escrow: '0x9b1e…e5c0',
  stages: ['Submitted', 'Certified', 'Checkpointed'],
  finality: '0.4s',
}

export const WALLET = { name: 'Scout Wallet', address: '0x5c7e…a41b', balance: 12480 }

/** Payout addresses for each matched publisher, in RESULTS order. */
export const PUBLISHER_WALLETS = ['0x7a3f…9c2e', '0xb41d…07fa', '0x2e98…d3b1', '0xc6a0…5e84', '0x18f7…aa29', '0xe3b5…61cd']

export const MATCH_THRESHOLD = 85
export const RESULTS = STREAM.filter((a) => a.match >= MATCH_THRESHOLD)
export const TOTAL = RESULTS.reduce((s, a) => s + a.price, 0)
