
const API_URL = "https://sportscore.com/api/v1/fixtures/";

const TURKISH_LEAGUES = [
  { name: "Süper Lig", slug: "turkish-super-league" },
  { name: "1. Lig", slug: "turkish-first-league" },
  { name: "2. Lig", slug: "turkish-second-league" },
  { name: "3. Lig", slug: "turkish-third-league" },
  { name: "Türkiye Kupası", slug: "turkish-cup" },
  { name: "Süper Kupa", slug: "turkish-super-cup" }
];

// Türkiye tarihini YYYY-MM-DD olarak üretir.
function getTurkeyDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

// API farklı JSON yapıları döndürürse maç listesini bulur.
function getMatches(data, depth = 0) {
  if (Array.isArray(data)) return data;

  if (!data || typeof data !== "object" || depth > 5) {
    return [];
  }

  const possibleKeys = [
    "matches",
    "fixtures",
    "results",
    "events",
    "items",
    "data"
  ];

  for (const key of possibleKeys) {
    if (data[key] !== undefined) {
      const result = getMatches(data[key], depth + 1);

      if (result.length > 0) {
        return result;
      }
    }
  }

  return [];
}

// API adresini oluşturur.
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

// SportScore'dan maçları çeker.
async function fetchMatches(date, competition) {
  const url = makeUrl(date, competition);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `SportScore HTTP ${response.status}`
    );
  }

  const data = await response.json();

  return {
    matches: getMatches(data),
    rawCount: Array.isArray(data) ? data.length : null
  };
}

// Aynı maçı birden fazla kez göstermez.
function uniqueMatches(matches) {
  const seen = new Set();

  return matches.filter(match => {
    const key =
      match.id ||
      match.slug ||
      match.url ||
      [
        match.home,
        match.away,
        match.time
      ].join("-");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

// Maçları tarihe göre sıralar.
function sortMatches(matches) {
  return matches.sort((a, b) => {
    const dateA = new Date(
      a.time || a.start_time || 0
    ).getTime();

    const dateB = new Date(
      b.time || b.start_time || 0
    ).getTime();

    return dateA - dateB;
  });
}

module.exports = async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "s-maxage=30, stale-while-revalidate=60"
  );

  try {
    const date = String(
      req.query.date || getTurkeyDate()
    );

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: "Geçersiz tarih.",
        matches: [],
        leagues: []
      });
    }

    // Genel maç listesi + Türkiye ligleri.
    const requests = [
      fetchMatches(date, null),

      ...TURKISH_LEAGUES.map(league =>
        fetchMatches(date, league.slug)
      )
    ];

    const results = await Promise.allSettled(requests);

    const allMatches = [];
    const leagueResults = [];

    // Genel maçlar.
    const generalResult = results[0];

    if (generalResult.status === "fulfilled") {
      allMatches.push(
        ...generalResult.value.matches
      );
    }

    // Türkiye ligleri.
    TURKISH_LEAGUES.forEach((league, index) => {
      const result = results[index + 1];

      if (result.status === "fulfilled") {
        const matches = result.value.matches;

        allMatches.push(...matches);

        leagueResults.push({
          name: league.name,
          slug: league.slug,
          status: "ok",
          count: matches.length
        });
      } else {
        leagueResults.push({
          name: league.name,
          slug: league.slug,
          status: "error",
          count: 0,
          error: result.reason?.message || "Bilinmeyen hata"
        });
      }
    });

    // Bütün istekler başarısızsa hata döndür.
    const successfulRequests = results.filter(
      result => result.status === "fulfilled"
    ).length;

    if (successfulRequests === 0) {
      throw new Error(
        "SportScore servislerinden hiçbir yanıt alınamadı."
      );
    }

    const matches = sortMatches(
      uniqueMatches(allMatches)
    );

    const totalTurkishMatches = leagueResults.reduce(
      (total, league) => total + league.count,
      0
    );

    return res.status(200).json({
      success: true,
      source: "SportScore",
      date,
      count: matches.length,
      turkishCount: totalTurkishMatches,
      matches,
      leagues: leagueResults,
      diagnostics: {
        successfulRequests,
        totalRequests: requests.length,
        generalStatus:
          generalResult.status === "fulfilled"
            ? "ok"
            : "error"
      }
    });

  } catch (error) {
    console.error(
      "SPORIX MATCH API ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message || "Maç verileri alınamadı.",
      matches: [],
      leagues: []
    });
  }
};
