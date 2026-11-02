const API_URL = "https://sportscore.com/api/v1/fixtures/";

const TURKISH_LEAGUES = [
  { name: "Süper Lig", slug: "turkish-super-league" },
  { name: "1. Lig", slug: "turkish-first-league" },
  { name: "2. Lig", slug: "turkish-second-league" },
  { name: "3. Lig", slug: "turkish-third-league" },
  { name: "Türkiye Kupası", slug: "turkish-cup" },
  { name: "Süper Kupa", slug: "turkish-super-cup" }
];

function getMatches(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.matches)) return data.matches;
  if (Array.isArray(data?.fixtures)) return data.fixtures;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function makeUrl(date, competition) {
  const url = new URL(API_URL);

  url.searchParams.set("sport", "football");
  url.searchParams.set("date", date);
  url.searchParams.set("limit", "200");

  if (competition) {
    url.searchParams.set("competition", competition);
  }

  return url.toString();
}

async function fetchMatches(date, competition) {
  const response = await fetch(makeUrl(date, competition), {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`SportScore HTTP ${response.status}`);
  }

  return getMatches(await response.json());
}

function uniqueMatches(matches) {
  const seen = new Set();

  return matches.filter(match => {
    const key =
      match.url ||
      match.id ||
      `${match.home}-${match.away}-${match.time}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

module.exports = async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "s-maxage=120, stale-while-revalidate=180"
  );

  try {
    const date = String(
      req.query.date || new Date().toISOString().slice(0, 10)
    );

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Geçersiz tarih.",
        matches: []
      });
    }

    const requests = [
      fetchMatches(date, null),
      ...TURKISH_LEAGUES.map(league =>
        fetchMatches(date, league.slug)
      )
    ];

    const results = await Promise.allSettled(requests);

    const generalResult = results[0];

    const allMatches = [];

    if (generalResult.status === "fulfilled") {
      allMatches.push(...generalResult.value);
    }

    const leagues = TURKISH_LEAGUES.map((league, index) => {
      const result = results[index + 1];

      if (result.status === "fulfilled") {
        allMatches.push(...result.value);

        return {
          name: league.name,
          slug: league.slug,
          status: "ok",
          count: result.value.length
        };
      }

      return {
        name: league.name,
        slug: league.slug,
        status: "error",
        count: 0
      };
    });

    if (
      generalResult.status === "rejected" &&
      !leagues.some(league => league.status === "ok")
    ) {
      throw new Error("Maç servislerine ulaşılamadı.");
    }

    const matches = uniqueMatches(allMatches);

    matches.sort((a, b) =>
      new Date(a.time || 0) - new Date(b.time || 0)
    );

    return res.status(200).json({
      source: "SportScore",
      date,
      count: matches.length,
      matches,
      leagues
    });

  } catch (error) {
    console.error("SPORIX matches API:", error);

    return res.status(500).json({
      error: "Maç verileri alınamadı.",
      matches: []
    });
  }
};
