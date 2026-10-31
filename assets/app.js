
async function getMatches(leagueSlug) {
  const url = new URL("/api/matches", window.location.origin);

  url.searchParams.set("league", leagueSlug);
  url.searchParams.set(
    "date",
    new Date().toISOString().slice(0, 10)
  );

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Maç verileri alınamadı.");
  }

  return response.json();
}
