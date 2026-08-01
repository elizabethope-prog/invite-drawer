// Reads a birthday-invite screenshot and returns structured fields.
// Runs server-side so the Anthropic API key never reaches the browser.
// Requires env var ANTHROPIC_API_KEY (set in Netlify site settings).

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "Server is missing ANTHROPIC_API_KEY." }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request body." }, 400); }
  const { base64, mediaType } = body || {};
  if (!base64) return json({ error: "No image supplied." }, 400);

  const today = new Date().toISOString().slice(0, 10);
  const prompt =
    "You are reading a screenshot of a children's birthday party invitation. " +
    "Respond with ONLY a JSON object (no markdown fences, no commentary) with these keys: " +
    "partyFor (the birthday child's name and/or party title, e.g. 'Mia turns 6'; or null), " +
    "dateISO ('YYYY-MM-DD' or null; if the year isn't shown assume the soonest FUTURE date), " +
    "timeText (e.g. '2:00-4:00 PM' or null), " +
    "location (venue and/or address, or null), " +
    "rsvpBy (string or null), " +
    "source (one of Evite, Paperless Post, Punchbowl, Partiful, Mixily, Text message, Other — infer from logos/branding/footer/URL; null if unclear), " +
    "notes (anything else useful like what to bring or parking, or null). " +
    "Today's date is " + today + " for resolving relative dates.";

  let data;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });
    data = await resp.json();
    if (!resp.ok || data.error) {
      return json({ error: (data.error && data.error.message) || ("Anthropic returned HTTP " + resp.status) }, 502);
    }
  } catch (e) {
    return json({ error: "Could not reach the reader: " + (e.message || "network error") }, 502);
  }

  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  let parsed = null;
  try { parsed = JSON.parse(clean); }
  catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
  }
  if (!parsed) return json({ error: "Could not parse the reader's response." }, 502);
  return json(parsed);
};
