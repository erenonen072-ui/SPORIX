
const LEAGUES = {
  "premier-league": "english-premier-league",
  "la-liga": "spanish-la-liga",
  "serie-a": "italian-serie-a",
  "bundesliga": "bundesliga",
  "champions-league": "uefa-champions-league"
};

const TEAM_COMPETITIONS = {
  "super-lig": "Turkish Super League"
};

function filterMatches(matches, { competition, date, status }) {
  let result = Array.isArray(matches) ? matches : [];

  if (competition) {
    result = result.filter(
      match => match.competition === competition
    );
  }

  if (date) {
    result = result.filter(
      match => match.time?.slice(0, 10) === date
    );
  }

  if (status && ["live", "finished", "upcoming"].includes(status)) {
    result = result.filter(match => match.status === status);
  }

  return result;
}

export default async function handler(req, res) {
  const { league, date, status, team } = req.query;

  if (!league) {
    return res.status(400).json({
      error: "Lig seçilmedi."
    });
  }

  try {
    let url;
    let competitionName = null;

    // Süper Lig: takım fikstüründen yalnızca lig maçlarını al.
    if (TEAM_COMPETITIONS[league]) {
      if (!team || !/^[a-z0-9-]+$/i.test(team)) {
        return res.status(400).json({
          error: "Süper Lig takım fikstürü için team parametresi gerekli.",
          example: "/api/matches?league=super-lig&team=galatasaray"
        });
      }

      url = new URL("https://sportscore.com/api/widget/team/");
      url.searchParams.set("sport", "football");
      url.searchParams.set("slug", team);
      url.searchParams.set("limit", "30");

      competitionName = TEAM_COMPETITIONS[league];
    } else {
      const competitionSlug = LEAGUES[league];

      if (!competitionSlug) {
        return res.status(400).json({
          error: "Bu lig için doğrulanmış SportScore kodu henüz eklenmedi.",
          league
        });
      }

      url = new URL("https://sportscore.com/api/v1/fixtures/");
      url.searchParams.set("sport", "football");
      url.searchParams.set(
        "date",
        date || new Date().toLocaleDateString("en-CA", {
          timeZone: "Europe/Istanbul"
        })
      );
      url.searchParams.set("competition", competitionSlug);
      url.searchParams.set("limit", "200");

      if (status && ["live", "finished", "upcoming"].includes(status)) {
        url.searchParams.set("status", status);
      }
    }

    url.searchParams.set("src", "sporix");

    const headers = {};
    const apiKey = process.env.SPORTSCORE_API_KEY;

    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "SportScore API isteği başarısız oldu.",
        details: data
      });
    }

    const matches = filterMatches(data.matches, {
      competition: competitionName,
      date: TEAM_COMPETITIONS[league] ? date : null,
      status
    });

    return res.status(200).json({
      sport: "football",
      league,
      team: team || null,
      date: date || null,
      count: matches.length,
      matches,
      updated: data.updated || new Date().toISOString()
    });

  } catch (error) {
    return res.status(502).json({
      error: "Maç verileri alınamadı.",
      message: error.message
    });
  }
}
