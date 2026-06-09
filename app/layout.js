import "./globals.css";

export const metadata = {
  title: "SiteCheck by Digistick — Free Website Audit + ₹399 Conversion Fix-Kit",
  description:
    "Paste your URL for an instant audit across speed, SEO, accessibility & conversion. Unlock a ₹399 fix-kit with an AI conversion roadmap and copy-paste Shopify CRO snippets. By Digistick.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
