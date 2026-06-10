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

    const sys = `You are SiteCheck's helpful CRO assistant for a Shopify store owner.
You ONLY help with their website audit, conversion optimization, SEO, and using the fix-kit they bought.
Their scan context: ${JSON.stringify(context || {}).slice(0, 1500)}
Be concise (2–4 sentences), practical, and India-D2C aware. If asked to do something off-topic, gently steer back. If they need hands-on help, suggest booking a Digistick call.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 400, system: sys, messages: safeMessages }),
    });
    if (!res.ok) return Response.json({ reply: "Sorry, I couldn't answer that just now. Please try again." });
    const data = await res.json();
    const reply = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return Response.json({ reply: reply || "Could you rephrase that?" });
  } catch (e) {
    return Response.json({ reply: "Something went wrong. Please try again." });
  }
}
