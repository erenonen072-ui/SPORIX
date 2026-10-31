
const LEAGUES = {
  "super-lig": "super-lig",
  "1-lig": "1-lig",
  "premier-league": "premier-league",
  "la-liga": "la-liga",
  "serie-a": "serie-a",
  "bundesliga": "bundesliga",
  "ligue-1": "ligue-1",
  "champions-league": "uefa-champions-league"
};

export default async function handler(req, res) {
  const { league, date, status } = req.query;

  if (!league || !LEAGUES[league]) {
    return res.status(400).json({
      error: "Geçersiz veya seçilmemiş lig."
    });
  }

  const url = new URL(
    "https://sportscore.com/api/v1/fixtures/"
  );

  url.searchParams.set("sport", "football");
  url.searchParams.set(
    "date",
    date || new Date().toISOString().slice(0, 10)
  );
  url.searchParams.set("competition", LEAGUES[league]);
  url.searchParams.set("limit", "200");

  if (
    status &&
    ["live", "finished", "upcoming"].includes(status)
  ) {
    url.searchParams.set("status", status);
  }

  try {
    const headers = {};
    const apiKey = process.env.SPORTSCORE_API_KEY;

    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    const response = await fetch(url, { headers });
    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(502).json({
      error: "SportScore bağlantısı kurulamadı."
    });
  }
}
