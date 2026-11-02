const API_URL = "https://sportscore.com/api/v1/fixtures/";

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function getMatches(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.matches)) return data.matches;
  if (Array.isArray(data?.fixtures)) return data.fixtures;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function getDay(date, competition) {
  const url = new URL(API_URL);

  url.searchParams.set("sport", "football");
  url.searchParams.set("date", date);
  url.searchParams.set("limit", "200");

  if (competition) {
    url.searchParams.set("competition", competition);
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`SportScore HTTP ${response.status}`);
  }

  return getMatches(await response.json());
}

module.exports = async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "s-maxage=120, stale-while-revalidate=180"
  );

  try {
    const today = new Date().toISOString().slice(0, 10);

    const from = String(req.query.from || req.query.date || today);
    const to = String(req.query.to || from);
    const competition = String(req.query.competition || "");

    if (!validDate(from) || !validDate(to)) {
      return res.status(400).json({
        error: "Geçersiz tarih.",
        matches: []
      });
    }

    if (competition && !/^[a-z0-9-]+$/.test(competition)) {
      return res.status(400).json({
        error: "Geçersiz lig kodu.",
        matches: []
      });
    }

    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    const days = Math.floor((end - start) / 86400000) + 1;

    if (days < 1 || days > 7) {
      return res.status(400).json({
        error: "En fazla 7 günlük fikstür sorgulanabilir.",
        matches: []
      });
    }

    const dates = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + i);
      dates.push(date.toISOString().slice(0, 10));
    }

    const results = await Promise.all(
      dates.map(date => getDay(date, competition))
    );

    const seen = new Set();

    const matches = results
      .flat()
      .filter(match => {
        const key =
          match.url ||
          match.id ||
          `${match.home}-${match.away}-${match.time}`;

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .sort((a, b) =>
        new Date(a.time || 0) - new Date(b.time || 0)
      );

    return res.status(200).json({
      source: "SportScore",
      from,
      to,
      competition: competition || "all",
      count: matches.length,
      matches
    });

  } catch (error) {
    console.error("SPORIX fixtures API:", error);

    return res.status(500).json({
      error: "Fikstür verileri alınamadı.",
      matches: []
    });
  }
};
