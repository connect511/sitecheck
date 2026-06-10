// ============================================================
//  DIGISTICK CRO THEME — upsell configuration
//  Edit the values below after you have your assets ready.
// ============================================================

export const THEME = {
  enabled: true,                       // set false to hide the upsell entirely
  name: "Digistick CRO Theme",
  tagline: "The same high-converting theme we build for clients — every CRO feature baked in.",
  marketPrice: 30000,                  // anchor / "real" price (₹)
  price: 3999,                         // your offer price (₹)

  // ---- REPLACE THESE with your real assets ----
  previewUrl: "https://YOUR-THEME-DEMO.myshopify.com",   // Shopify demo/preview link
  // Where the paid .zip is served from. Two options:
  //  (a) leave blank and deliver manually after the order email, or
  //  (b) host the zip behind the verified-payment download route (recommended).
  downloadFileName: "digistick-cro-theme.zip",
  // ---------------------------------------------

  features: [
    "Urgency, scarcity & low-stock signals built in",
    "COD trust badges + secure-checkout assurance",
    "Sticky mobile add-to-cart & free-shipping bar",
    "Reviews, social proof & FAQ sections ready",
    "Speed-optimized, mobile-first, SEO-clean markup",
    "Exit-intent offer & email capture included",
  ],
};
