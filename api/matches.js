
const API_URL = "https://sportscore.com/api/v1/fixtures/";

const TURKISH_LEAGUES = [
  { name: "Süper Lig", slug: "turkish-super-league" },
  { name: "1. Lig", slug: "turkish-first-league" },
  { name: "2. Lig", slug: "turkish-second-league" },
  { name: "3. Lig", slug: "turkish-third-league" },
  { name: "Türkiye Kupası", slug: "turkish-cup" },
  { name: "Süper Kupa", slug: "turkish-super-cup" }
];

// Türkiye tarihini al.
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

// JSON içinden maç listesini bul.
function getMatches(data, depth = 0) {
  if (Array.isArray(data)) {
    return data.filter(item =>
      item && typeof item === "object"
    );
  }

  if (!data || typeof data !== "object" || depth > 8) {
    return [];
  }

  const keys = [
    "matches",
    "fixtures",
    "results",
    "events",
    "items",
    "data",
    "response"
  ];

  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) {
      const result = getMatches(data[key], depth + 1);

      if (result.length) {
        return result;
      }
    }
  }

  return [];
}

// API URL oluştur.
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

// API'den maçları çek.
async function fetchMatches(date, competition) {
  const url = makeUrl(date, competition);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${responseText.slice(0, 200)}`);
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error("SportScore geçerli JSON döndürmedi.");
  }

  const matches = getMatches(data);

  return {
    matches,
    raw: data,
    rawKeys:
      data && typeof data === "object" && !Array.isArray(data)
        ? Object.keys(data)
        : [],
    apiMessage:
      data?.message ||
      data?.error ||
      null,
    apiSuccess: data?.success
  };
}

// Maçın benzersiz anahtarını oluştur.
function getMatchKey(match) {
  const id =
    match.id ||
    match.fixture_id ||
    match.event_id ||
    match.slug;

  if (id) {
    return String(id);
  }

  const home =
    match.home ||
    match.home_team?.name ||
    match.homeTeam?.name ||
    "";

  const away =
    match.away ||
    match.away_team?.name ||
    match.awayTeam?.name ||
    "";

  const time =
    match.time ||
    match.start_time ||
    match.date ||
    "";

  if (home || away || time) {
    return `${home}-${away}-${time}`;
  }

  return JSON.stringify(match);
}

// Tekrar eden maçları birleştir.
// Lig bilgisini kaybetmez.
function uniqueMatches(matches) {
  const map = new Map();

  for (const match of matches) {
    const key = getMatchKey(match);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, match);
      continue;
    }

    map.set(key, {
      ...existing,
      ...match,
      competition_name:
        match.competition_name ||
        existing.competition_name,
      competition_slug:
        match.competition_slug ||
        existing.competition_slug
    });
  }

  return Array.from(map.values());
}

// Maçları tarihe göre sırala.
function sortMatches(matches) {
  return matches.sort((a, b) => {
    const dateA = new Date(
      a.time || a.start_time || a.date || 0
    ).getTime();

    const dateB = new Date(
      b.time || b.start_time || b.date || 0
    ).getTime();

    return dateA - dateB;
  });
}

// API ana fonksiyonu.
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
        error: "Geçersiz tarih. YYYY-MM-DD kullan.",
        matches: [],
        leagues: []
      });
    }

    // Genel maçlar ve 6 Türkiye organizasyonu.
    const requests = [
      fetchMatches(date, null),
      ...TURKISH_LEAGUES.map(league =>
        fetchMatches(date, league.slug)
      )
    ];

    const results = await Promise.allSettled(requests);

    const allMatches = [];
    const leagueResults = [];

    const generalResult = results[0];

    if (generalResult.status === "fulfilled") {
      allMatches.push(...generalResult.value.matches);
    }

    TURKISH_LEAGUES.forEach((league, index) => {
      const result = results[index + 1];

      if (result.status === "fulfilled") {
        const matches = result.value.matches.map(match => ({
          ...match,
          competition_name:
            match.competition_name || league.name,
          competition_slug:
            match.competition_slug || league.slug
        }));

        allMatches.push(...matches);

        leagueResults.push({
          name: league.name,
          slug: league.slug,
          status: matches.length ? "ok" : "empty",
          count: matches.length,
          apiMessage: result.value.apiMessage,
          apiSuccess: result.value.apiSuccess,
          responseKeys: result.value.rawKeys
        });
      } else {
        leagueResults.push({
          name: league.name,
          slug: league.slug,
          status: "error",
          count: 0,
          error:
            result.reason?.message ||
            "Bilinmeyen API hatası"
        });
      }
    });

    const successfulRequests = results.filter(
      result => result.status === "fulfilled"
    ).length;

    if (successfulRequests === 0) {
      throw new Error("SportScore servislerinden yanıt alınamadı.");
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
            : "error",
        generalError:
          generalResult.status === "rejected"
            ? generalResult.reason?.message
            : null
      }
    });

  } catch (error) {
    console.error("SPORIX MATCH API ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Maç verileri alınamadı.",
      matches: [],
      leagues: []
    });
  }
};
