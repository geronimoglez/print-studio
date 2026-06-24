// Cliente mínimo de Firecrawl (v2) para scrapear una página y extraer JSON con un schema.
// Sirve para sitios con JS/anti-bot (como MakerWorld) que un fetch normal no puede leer.

export async function firecrawlScrapeJson(
  url: string,
  schema: object,
  prompt: string,
): Promise<unknown | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        onlyMainContent: false,
        formats: [{ type: "json", schema, prompt }],
      }),
    });
    if (!r.ok) {
      console.error("Firecrawl", r.status, (await r.text().catch(() => "")).slice(0, 300));
      return null;
    }
    const j = (await r.json()) as { data?: { json?: unknown } };
    return j?.data?.json ?? null;
  } catch (e) {
    console.error("Firecrawl error", e instanceof Error ? e.message : e);
    return null;
  }
}
