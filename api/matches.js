
const API_URL = "https://sportscore.com/api/v1/fixtures/";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=45, stale-while-revalidate=90");

  try {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));

    // Geçersiz tarihleri kabul etme.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Geçersiz tarih.",
        matches: []
      });
    }

    const url = new URL(API_URL);

    url.searchParams.set("sport", "football");
    url.searchParams.set("date", date);
    url.searchParams.set("limit", "200");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "SportScore maç servisi yanıt vermedi.",
        matches: []
      });
    }

    const data = await response.json();

    const matches = Array.isArray(data)
      ? data
      : Array.isArray(data.matches)
        ? data.matches
        : Array.isArray(data.fixtures)
          ? data.fixtures
          : Array.isArray(data.data)
            ? data.data
            : [];

    return res.status(200).json({
      matches,
      source: "SportScore",
      date,
      count: matches.length
    });

  } catch (error) {
    console.error("SPORIX matches API:", error);

    return res.status(500).json({
      error: "Maç verileri alınamadı.",
      matches: []
    });
  }
};
