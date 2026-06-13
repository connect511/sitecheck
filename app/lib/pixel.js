"use client";

/* Client-side Meta Pixel event helper. The base pixel is injected in layout.js
   from NEXT_PUBLIC_FB_PIXEL_ID. This just fires events; safe no-op if not loaded. */
export function track(event, params) {
  if (typeof window === "undefined" || !window.fbq) return;
  try {
    window.fbq("track", event, params || {});
  } catch {}
}
