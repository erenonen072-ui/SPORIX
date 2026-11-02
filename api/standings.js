
"use strict";

const API_URL = "https://sportscore.com/api/widget/standings/";

const LEAGUES = {
  // TÜRKİYE
  "turkish-super-league": "Süper Lig",
  "turkish-first-league": "1. Lig",
  "turkish-second-league": "2. Lig",
  "turkish-third-league": "3. Lig",

  // AVRUPA
  "english-premier-league": "Premier League",
  "spanish-la-liga": "La Liga",
  "bundesliga": "Bundesliga",
  "italian-serie-a": "Serie A",
  "french-ligue-1": "Ligue 1"
};

module.exports = async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "s-maxage=1800, stale-while-revalidate=3600"
  );

  try {
    const slug = String(
      req.query.league || "turkish-super-league"
    );

    if (!LEAGUES[slug]) {
      return res.status(400).json({
        success: false,
        error: "Geçersiz lig seçimi.",
        standings: []
      });
    }

    const url = new URL(API_URL);

    url.searchParams.set("sport", "football");
    url.searchParams.set("slug", slug);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(15000)
    });

    const data = await response.json();

    if (!response.ok || data.error || data.message) {
      return res.status(502).json({
        success: false,
        error: data.error || data.message || "Puan durumu alınamadı.",
        standings: []
      });
    }

    const tables = Array.isArray(data.tables)
      ? data.tables
      : [];

    const standings = tables.flatMap(table =>
      Array.isArray(table.rows) ? table.rows : []
    );

    return res.status(200).json({
      success: true,
      source: "SportScore",
      league: LEAGUES[slug],
      slug,
      competitionLogo: data.competition_logo || "",
      standings,
      tables,
      updated: new Date().toISOString()
    });

  } catch (error) {
    console.error("Standings API error:", error);

    return res.status(500).json({
      success: false,
      error: "Puan durumu sunucudan alınamadı.",
      standings: []
    });
  }
};
