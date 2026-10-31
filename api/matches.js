
export default async function handler(req, res) {
  const apiKey = process.env.SPORTSCORE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "SPORTSCORE_API_KEY bulunamadı."
    });
  }

  const { league, date, status } = req.query;

  if (!league) {
    return res.status(400).json({
      error: "Lig seçilmedi."
    });
  }

  const url = new URL("https://sportscore.com/api/v1/fixtures/");

  url.searchParams.set("sport", "football");
  url.searchParams.set(
    "date",
    date || new Date().toISOString().slice(0, 10)
  );
  url.searchParams.set("competition", league);
  url.searchParams.set("limit", "200");

  if (status && status !== "all") {
    url.searchParams.set("status", status);
  }

  try {
    const response = await fetch(url, {
      headers: {
        "X-Api-Key": apiKey
      }
    });

    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(502).json({
      error: "SportScore bağlantısı başarısız."
    });
  }
}
