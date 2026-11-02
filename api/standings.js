const API_URL = "https://sportscore.com/api/widget/standings/";

const LEAGUES = {
  "turkish-super-league": "Süper Lig",
  "turkish-first-league": "1. Lig",
  "turkish-second-league": "2. Lig",
  "turkish-third-league": "3. Lig"
};

module.exports = async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "s-maxage=3600, stale-while-revalidate=7200"
  );

  try {
    const slug = String(
      req.query.league || "turkish-super-league"
    );

    if (!LEAGUES[slug]) {
      return res.status(400).json({
        error: "Geçersiz lig seçimi.",
        standings: []
      });
    }

    const url = new URL(API_URL);

    url.searchParams.set("sport", "football");
    url.searchParams.set("slug", slug);

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Puan durumu servisi yanıt vermedi.",
        standings: []
      });
    }

    const data = await response.json();

    return res.status(200).json({
      source: "SportScore",
      league: LEAGUES[slug],
      slug,
      data
    });

  } catch (error) {
    console.error("SPORIX standings API:", error);

    return res.status(500).json({
      error: "Puan durumu alınamadı.",
      standings: []
    });
  }
};
