 export const runtime = "nodejs";
export const maxDuration = 30;

// Scan-aware AI chat. Only reachable from inside the paid report (client-gated),
// with a hard server-side cap on conversation length as an abuse backstop.
const MAX_TURNS = 8;          // user messages per conversation
const MAX_MSG_LEN = 600;      // chars per user message

export async function POST(req) {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return Response.json({ reply: "AI chat isn't configured yet. (Add ANTHROPIC_API_KEY to enable it.)" });
    }

    const { messages, context } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "No message." }, { status: 400 });
    }
    const userTurns = messages.filter((m) => m.role === "user").length;
    if (userTurns > MAX_TURNS) {
      return Response.json({ reply: "You've reached the chat limit for this report. For deeper help, book a free call with Digistick — we'll take it from here." });
    }
    // Trim/guard input
    const safeMessages = messages.slice(-2 * MAX_TURNS).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, MAX_MSG_LEN),
    }));

    const sys = `You are SiteCheck's AI Growth Consultant for a Shopify store owner (Digistick's Growth OS).
Their scan context (real data — always ground your answers in it): ${JSON.stringify(context || {}).slice(0, 1500)}
Rules you must always follow:
1. Reference their actual scan data (scores, failed checks, leak estimate) in every answer — never give generic advice when specific data exists.
2. Where relevant, estimate the revenue impact in rupees of the issue or the fix, using their leak figure as the anchor and clearly framing it as an estimate.
3. End with ONE clear next action they should take.
4. When a problem maps to a Digistick service (speed optimization, SEO sprint, CRO upgrade, theme upgrade at Rs 3,999, Meta ads management, or the Rs 799 Growth Plan), mention it naturally as the done-for-you option — helpful, never pushy.
Be concise (2-4 sentences), practical, and India-D2C aware. Only help with their store's growth, audit, CRO, SEO, ads, and the fix-kit; gently steer off-topic requests back.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 400, system: sys, messages: safeMessages }),
    });
    if (!res.ok) {
      let detail = "";
      try { const err = await res.json(); detail = err?.error?.message || err?.error?.type || ""; } catch {}
      const hint = res.status === 401 ? "API key looks invalid."
        : res.status === 400 && /credit|balance|quota/i.test(detail) ? "Anthropic account has no credit — add billing credit in the console."
        : res.status === 429 ? "Rate limited — try again in a moment."
        : detail || `API error ${res.status}`;
      return Response.json({ reply: `Chat is temporarily unavailable (${hint})` });
    }
    const data = await res.json();
    const reply = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return Response.json({ reply: reply || "Could you rephrase that?" });
  } catch (e) {
    return Response.json({ reply: "Something went wrong. Please try again." });
  }
}
