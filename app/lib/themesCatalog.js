/* Digistick theme marketplace catalog. Prices are validated SERVER-SIDE from
   this file. File key in Supabase Storage bucket "themes" = `${id}.zip`.
   All themes are built by the Digistick team; preview links show the design
   direction each build is inspired by. */

export const THEMES_CATALOG = [
  { id: "peaches",   name: "Peaches",   price: 4999, preview: "https://themes.shopify.com/themes/wave/presets/peaches",       bestFor: "Beauty & skincare",    strengths: ["visual", "conversion"], grad: "tg-1" },
  { id: "beautify",  name: "Beautify",  price: 3999, preview: "https://themes.shopify.com/themes/beautify/presets/beautify",  bestFor: "Cosmetics & wellness", strengths: ["visual", "speed"],      grad: "tg-2" },
  { id: "challenge", name: "Challenge", price: 5999, preview: "https://themes.shopify.com/themes/force/presets/challenge",    bestFor: "Fitness & sports",     strengths: ["conversion"],           grad: "tg-3" },
  { id: "citrus",    name: "Citrus",    price: 4499, preview: "https://themes.shopify.com/themes/maya/presets/citrus",        bestFor: "Food & beverages",     strengths: ["visual"],               grad: "tg-4" },
  { id: "discovery", name: "Discovery", price: 4499, preview: "https://themes.shopify.com/themes/discovery/presets/discovery",bestFor: "Multi-category stores",strengths: ["speed", "conversion"],  grad: "tg-5" },
  { id: "dynamic",   name: "Dynamic",   price: 3999, preview: "https://themes.shopify.com/themes/dynamic/presets/dynamic",    bestFor: "Gadgets & tech",       strengths: ["speed"],                grad: "tg-6" },
  { id: "hyper",     name: "Hyper",     price: 5499, preview: "https://themes.shopify.com/themes/hyper/presets/hyper",        bestFor: "Streetwear & drops",   strengths: ["visual", "conversion"], grad: "tg-1" },
  { id: "megastore", name: "Megastore", price: 6499, preview: "https://themes.shopify.com/themes/megastore/presets/megastore",bestFor: "Large catalogs",       strengths: ["conversion", "speed"],  grad: "tg-2" },
  { id: "monete",    name: "Monete",    price: 5499, preview: "https://themes.shopify.com/themes/july/presets/monete",        bestFor: "Jewellery & luxury",   strengths: ["visual"],               grad: "tg-3" },
  { id: "nuxio",     name: "Nuxio",     price: 5499, preview: "https://themes.shopify.com/themes/athora/presets/nuxio",       bestFor: "Home & decor",         strengths: ["visual", "speed"],      grad: "tg-4" },
  { id: "pattern",   name: "Pattern",   price: 3999, preview: "https://themes.shopify.com/themes/modular/presets/pattern",    bestFor: "Minimal brands",       strengths: ["speed"],                grad: "tg-5" },
  { id: "rawjoy",    name: "Rawjoy",    price: 4999, preview: "https://themes.shopify.com/themes/pebble/presets/rawjoy",      bestFor: "Organic & natural",    strengths: ["visual", "conversion"], grad: "tg-6" },
  { id: "rich",      name: "Rich",      price: 3999, preview: "https://themes.shopify.com/themes/dynamic/presets/rich",       bestFor: "Single product",       strengths: ["conversion", "speed"],  grad: "tg-1" },
  { id: "seoul",     name: "Seoul",     price: 4999, preview: "https://themes.shopify.com/themes/agnes/presets/seoul",        bestFor: "K-beauty & fashion",   strengths: ["visual"],               grad: "tg-2" },
  { id: "vast",      name: "Vast",      price: 6999, preview: "https://themes.shopify.com/themes/maximize/presets/vast",      bestFor: "High-volume D2C",      strengths: ["conversion", "speed"],  grad: "tg-3" },
  { id: "venice",    name: "Venice",    price: 4499, preview: "https://themes.shopify.com/themes/venice/presets/venice",      bestFor: "Fashion & apparel",    strengths: ["visual"],               grad: "tg-4" },
  { id: "verve",     name: "Verve",     price: 5499, preview: "https://themes.shopify.com/themes/stockist/presets/verve",     bestFor: "Lifestyle brands",     strengths: ["visual", "conversion"], grad: "tg-5" },
  { id: "woodmart",  name: "Woodmart",  price: 5999, preview: "https://themes.shopify.com/themes/poco/presets/woodmart",      bestFor: "Furniture & crafts",   strengths: ["conversion"],           grad: "tg-6" },
  { id: "yuva",      name: "Yuva",      price: 5999, preview: "https://themes.shopify.com/themes/yuva/presets/yuva",          bestFor: "Indian D2C brands",    strengths: ["conversion", "visual"], grad: "tg-1" },
  { id: "zest",      name: "Zest",      price: 4999, preview: "https://themes.shopify.com/themes/zest/presets/zest",          bestFor: "Health & supplements", strengths: ["conversion", "speed"],  grad: "tg-2" },
];

export function findTheme(id) {
  return THEMES_CATALOG.find((t) => t.id === id) || null;
}

/* Recommend 3 themes from the store's actual scan: slow stores get
   speed-focused builds, low-converting stores get CRO-heavy builds. */
export function recommendThemes(perf, conversion) {
  const need = (perf ?? 100) < 60 ? "speed" : (conversion ?? 100) < 65 ? "conversion" : "visual";
  const second = need === "speed" ? "conversion" : need === "conversion" ? "speed" : "conversion";
  return [...THEMES_CATALOG]
    .map((t) => ({ id: t.id, score: (t.strengths.includes(need) ? 2 : 0) + (t.strengths.includes(second) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((t) => t.id);
}
