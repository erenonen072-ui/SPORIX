const API_BASE = "https://sportscore.com/api/v1";

async function getMatches(leagueSlug) {
  const url = new URL(`${API_BASE}/fixtures/`);

  url.searchParams.set("sport", "football");
  url.searchParams.set("date", new Date().toISOString().slice(0, 10));
  url.searchParams.set("competition", leagueSlug);
  url.searchParams.set("limit", "200");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Maç verileri alınamadı.");
  }

  return response.json();
}
