
const API_URL = "https://sportscore.com/api/widget/matches/";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=45, stale-while-revalidate=90");

  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const url = new URL(API_URL);
    url.searchParams.set("sport", "football");
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString(), {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "SportScore servisi yanıt vermedi.",
        matches: []
      });
    }

    const data = await response.json();

    const matches = Array.isArray(data)
      ? data
      : Array.isArray(data.matches)
        ? data.matches
        : Array.isArray(data.data)
          ? data.data
          : [];

    return res.status(200).json({
      matches,
      source: "SportScore",
      count: matches.length
    });
  } catch (error) {
    console.error("SportScore API error:", error);
    return res.status(500).json({
      error: "Maç verileri alınamadı.",
      matches: []
    });
  }
};
