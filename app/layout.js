import "./globals.css";

export const metadata = {
  title: "SiteCheck by Digistick — Free Website Audit + ₹399 Conversion Fix-Kit",
  description:
    "Paste your URL for an instant audit across speed, SEO, accessibility & conversion. Unlock a ₹399 fix-kit with an AI conversion roadmap and copy-paste Shopify CRO snippets. By Digistick.",
};

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "";
const pixelInit = PIXEL_ID
  ? `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`
  : "";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {pixelInit ? <script dangerouslySetInnerHTML={{ __html: pixelInit }} /> : null}
      </head>
      <body>
        {PIXEL_ID ? (
          <noscript>
            <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`} />
          </noscript>
        ) : null}
        {children}
      </body>
    </html>
  );
}
