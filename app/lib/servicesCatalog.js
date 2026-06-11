/* All Digistick services with team members. Imported by BOTH the dashboard UI
   and the server API — prices are always validated server-side from this file,
   so the client can never tamper with amounts. Advance = 10% of member price. */

export const ADVANCE_PCT = 0.30;

export const SERVICES_CATALOG = [
  { key: "speed", ic: "zap", cls: "sv-blue", name: "Store Speed Optimization", start: 2999, unit: "one-time",
    desc: "We take your Performance score above 85 — images, scripts, theme code, the works.",
    members: [
      { id: "speed-1", name: "Rohit Verma", role: "Performance Engineer", rating: 4.9, jobs: 142, days: "3 days", price: 2999 },
      { id: "speed-2", name: "Priya Nair", role: "Sr. Shopify Developer", rating: 4.8, jobs: 117, days: "4 days", price: 3499 },
      { id: "speed-3", name: "Arjun Mehta", role: "Core Web Vitals Specialist", rating: 4.7, jobs: 89, days: "3 days", price: 2999 },
    ] },
  { key: "seo", ic: "search", cls: "sv-purple", name: "SEO Optimization Sprint", start: 4999, unit: "one-time",
    desc: "Full on-page + technical SEO: metas, schema, structure, content depth, indexing fixes.",
    members: [
      { id: "seo-1", name: "Kavya Iyer", role: "SEO Lead", rating: 4.9, jobs: 163, days: "7 days", price: 5999 },
      { id: "seo-2", name: "Aman Gupta", role: "Technical SEO Specialist", rating: 4.8, jobs: 134, days: "7 days", price: 4999 },
      { id: "seo-3", name: "Sneha Kulkarni", role: "Content & On-page SEO", rating: 4.7, jobs: 98, days: "10 days", price: 4999 },
    ] },
  { key: "cro", ic: "cart", cls: "sv-amber", name: "CRO Upgrade", start: 3999, unit: "one-time",
    desc: "Trust, urgency, reviews, sticky cart — every conversion gap on your list, installed.",
    members: [
      { id: "cro-1", name: "Vikram Singh", role: "CRO Strategist", rating: 4.9, jobs: 151, days: "5 days", price: 4499 },
      { id: "cro-2", name: "Ananya Reddy", role: "Conversion Designer", rating: 4.8, jobs: 122, days: "5 days", price: 3999 },
      { id: "cro-3", name: "Karan Malhotra", role: "Shopify CRO Developer", rating: 4.7, jobs: 95, days: "4 days", price: 3999 },
    ] },
  { key: "meta_ads", ic: "megaphone", cls: "sv-green", name: "Meta Ads Management", start: 7999, unit: "per month",
    desc: "Full-funnel Meta campaigns — creatives, audiences, scaling. Month-to-month, no lock-in.",
    members: [
      { id: "meta-1", name: "Ishita Sharma", role: "Performance Marketer", rating: 4.9, jobs: 87, days: "ongoing", price: 9999 },
      { id: "meta-2", name: "Rahul Joshi", role: "Meta Ads Specialist", rating: 4.8, jobs: 76, days: "ongoing", price: 7999 },
      { id: "meta-3", name: "Divya Menon", role: "D2C Ads Strategist", rating: 4.8, jobs: 64, days: "ongoing", price: 8499 },
    ] },
  { key: "google_ads", ic: "target", cls: "sv-blue", name: "Google Ads Management", start: 7999, unit: "per month",
    desc: "Search, Shopping and PMax campaigns built for profitable D2C growth.",
    members: [
      { id: "gads-1", name: "Siddharth Rao", role: "Google Ads Lead", rating: 4.8, jobs: 92, days: "ongoing", price: 8999 },
      { id: "gads-2", name: "Neha Agarwal", role: "PPC Specialist", rating: 4.7, jobs: 71, days: "ongoing", price: 7999 },
    ] },
  { key: "shopify_dev", ic: "store", cls: "sv-purple", name: "Shopify Store Development", start: 9999, unit: "one-time",
    desc: "A complete conversion-ready Shopify store — theme setup, pages, apps, payments, launch.",
    members: [
      { id: "dev-1", name: "Aditya Kapoor", role: "Sr. Shopify Developer", rating: 4.9, jobs: 118, days: "10 days", price: 12999 },
      { id: "dev-2", name: "Meera Pillai", role: "Shopify Developer", rating: 4.8, jobs: 84, days: "12 days", price: 9999 },
      { id: "dev-3", name: "Harsh Patel", role: "Theme Customization Expert", rating: 4.7, jobs: 67, days: "10 days", price: 10999 },
    ] },
  { key: "branding", ic: "palette", cls: "sv-amber", name: "Branding & Logo Design", start: 4999, unit: "one-time",
    desc: "Logo, color system, typography and brand kit that makes your store feel premium.",
    members: [
      { id: "brand-1", name: "Tanvi Desai", role: "Brand Designer", rating: 4.9, jobs: 104, days: "7 days", price: 5999 },
      { id: "brand-2", name: "Nikhil Bhatia", role: "Visual Identity Designer", rating: 4.8, jobs: 88, days: "7 days", price: 4999 },
    ] },
  { key: "social", ic: "chat", cls: "sv-green", name: "Social Media Management", start: 5999, unit: "per month",
    desc: "Content calendar, design, captions and posting for Instagram + Facebook. 15 posts/month.",
    members: [
      { id: "soc-1", name: "Riya Chauhan", role: "Social Media Manager", rating: 4.8, jobs: 79, days: "ongoing", price: 6999 },
      { id: "soc-2", name: "Manish Tiwari", role: "Content Strategist", rating: 4.7, jobs: 62, days: "ongoing", price: 5999 },
    ] },
  { key: "video", ic: "image", cls: "sv-blue", name: "Video Editing (10 Reels)", start: 3999, unit: "per pack",
    desc: "10 scroll-stopping reels/ads edited from your raw footage — hooks, captions, transitions.",
    members: [
      { id: "vid-1", name: "Sahil Khanna", role: "Sr. Video Editor", rating: 4.9, jobs: 133, days: "6 days", price: 4999 },
      { id: "vid-2", name: "Pooja Saxena", role: "Reels Editor", rating: 4.8, jobs: 97, days: "7 days", price: 3999 },
    ] },
  { key: "photoshoot", ic: "eye", cls: "sv-purple", name: "Product Photoshoot", start: 2999, unit: "per pack",
    desc: "Studio-quality product photos at Digistick Studio — 10 products, 30 edited shots.",
    members: [
      { id: "photo-1", name: "Devansh Choudhary", role: "Product Photographer", rating: 4.9, jobs: 86, days: "5 days", price: 3499 },
      { id: "photo-2", name: "Shruti Bansal", role: "E-commerce Photographer", rating: 4.8, jobs: 73, days: "5 days", price: 2999 },
    ] },
  { key: "whatsapp", ic: "phone", cls: "sv-green", name: "WhatsApp Automation (Zuvoox)", start: 1999, unit: "setup",
    desc: "Abandoned-cart recovery, order updates and broadcast campaigns on WhatsApp Business API.",
    members: [
      { id: "wa-1", name: "Yash Thakur", role: "Automation Specialist", rating: 4.8, jobs: 91, days: "2 days", price: 1999 },
      { id: "wa-2", name: "Aarti Mishra", role: "WhatsApp Flows Expert", rating: 4.7, jobs: 58, days: "3 days", price: 2499 },
    ] },
  { key: "ugc_video", ic: "image", cls: "sv-amber", name: "UGC Video Pack", start: 4999, unit: "per pack",
    desc: "5 authentic creator-style UGC videos of your product — hooks, voiceover, captions, ad-ready.",
    members: [
      { id: "ugc-1", name: "Simran Kaur", role: "UGC Creator & Editor", rating: 4.9, jobs: 112, days: "7 days", price: 5999 },
      { id: "ugc-2", name: "Aryan Khurana", role: "UGC Content Producer", rating: 4.8, jobs: 87, days: "8 days", price: 4999 },
    ] },
  { key: "lifestyle_shoot", ic: "eye", cls: "sv-green", name: "Lifestyle & Model Shoot", start: 5999, unit: "per pack",
    desc: "On-model and lifestyle photography at Digistick Studio — 20 edited shots that sell the feeling.",
    members: [
      { id: "ls-1", name: "Devansh Choudhary", role: "Lead Photographer", rating: 4.9, jobs: 86, days: "6 days", price: 6999 },
      { id: "ls-2", name: "Mitali Joshi", role: "Fashion Photographer", rating: 4.8, jobs: 64, days: "7 days", price: 5999 },
    ] },
  { key: "ai_automation", ic: "bot", cls: "sv-purple", name: "AI Automation Setup", start: 4999, unit: "setup",
    desc: "AI chatbots, auto-replies, lead capture and workflow automations wired into your store and WhatsApp.",
    members: [
      { id: "ai-1", name: "Kabir Anand", role: "AI Automation Engineer", rating: 4.9, jobs: 53, days: "5 days", price: 5999 },
      { id: "ai-2", name: "Nandini Rathi", role: "Automation Specialist", rating: 4.8, jobs: 41, days: "5 days", price: 4999 },
    ] },
  { key: "growth", ic: "trophy", cls: "sv-dark", name: "Complete Growth Package", start: 14999, unit: "per month",
    desc: "Speed + SEO + CRO + Ads + content under one roof. Your store, run like our best clients.",
    members: [
      { id: "gr-1", name: "Aditi Krishnan", role: "Growth Lead", rating: 4.9, jobs: 47, days: "ongoing", price: 14999 },
      { id: "gr-2", name: "Varun Saini", role: "Sr. Growth Manager", rating: 4.9, jobs: 39, days: "ongoing", price: 17999 },
    ] },
];

export function findMember(serviceKey, memberId) {
  const svc = SERVICES_CATALOG.find((s) => s.key === serviceKey);
  if (!svc) return null;
  const member = svc.members.find((m) => m.id === memberId);
  if (!member) return null;
  return { service: svc, member, advance: Math.round(member.price * ADVANCE_PCT) };
}
