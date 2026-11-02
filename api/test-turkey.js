const BASE_URL = "https://sportscore.com/api/v1/fixtures/";

const leagues = [
  { name: "Süper Lig", id: "8y39mp1h6jmojxg" },
  { name: "1. Lig", id: "9k82rekhgorepzj" },
  { name: "2. Lig", id: "z318q66hxjqo9jd" },
  { name: "3. Lig", id: "9dn1m1ghl1moepl" },
  { name: "Türkiye Kupası", id: "z8yomo4h11q0j6l" },
  { name: "Süper Kupa", id: "p3glrw7hngqdyjv" }
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
        url.searchParams.set("competition", league.id);

        const response = await fetch(url);

        if (!response.ok) {
          return {
            league: league.name,
            error: response.status
          };
        }

        const data = await response.json();

        const matches =
          Array.isArray(data) ? data :
          data.fixtures || data.data || data.results || [];

        return {
          league: league.name,
          id: league.id,
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
