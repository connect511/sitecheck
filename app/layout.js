import "./globals.css";
import { pixelScript, PIXEL_ID } from "./lib/pixel";

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
        {PIXEL_ID && <script dangerouslySetInnerHTML={{ __html: pixelScript() }} />}
      </head>
      <body>
        {PIXEL_ID && (
          <noscript>
            <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`} />
          </noscript>
        )}
        {children}</body>
    </html>
  );
}
