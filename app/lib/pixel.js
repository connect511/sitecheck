"use client";

/* Meta Pixel loader + event helper.
   Set NEXT_PUBLIC_FB_PIXEL_ID in Vercel to your Pixel ID. If it's not set,
   nothing loads (so dev/preview stays clean). */

export const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "";

/* Fire a standard or custom Pixel event. Safe to call anywhere — no-ops if
   the pixel isn't loaded yet or no ID is configured. */
export function track(event, params) {
  if (typeof window === "undefined" || !window.fbq) return;
  try {
    window.fbq("track", event, params || {});
  } catch {}
}

/* The inline script that bootstraps fbq + fires the initial PageView. */
export function pixelScript() {
  if (!PIXEL_ID) return "";
  return `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');fbq('track','PageView');`;
}
