const BASE_URL = "https://sportscore.com/api/v1/fixtures/";

const leagues = [
  { name: "Süper Lig", slug: "turkish-super-league" },
  { name: "1. Lig", slug: "turkish-first-league" },
  { name: "2. Lig", slug: "turkish-second-league" },
  { name: "3. Lig", slug: "turkish-third-league" },
  { name: "Türkiye Kupası", slug: "turkish-cup" },
  { name: "Süper Kupa", slug: "turkish-super-cup" }
];

module.exports = async (req, res) => {
  try {
    const date = req.query.date || "2026-11-02";

    const results = await Promise.all(
      leagues.map(async (league) => {
        const url = new URL(BASE_URL);

        url.searchParams.set("sport", "football");
        url.searchParams.set("date", date);
        url.searchParams.set("limit", "100");
        url.searchParams.set("competition", league.slug);

        const response = await fetch(url);

        if (!response.ok) {
          return {
            league: league.name,
            status: response.status
          };
        }

        const data = await response.json();

        const matches = Array.isArray(data)
          ? data
          : data.fixtures || data.data || data.results || [];

        return {
          league: league.name,
          slug: league.slug,
          count: matches.length,
          matches: matches.slice(0, 5)
        };
      })
    );

    res.status(200).json({
      success: true,
      date,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
