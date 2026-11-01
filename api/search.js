
"use strict";

export default async function handler(req, res) {
  const q = String(req.query.q || "").trim();

  if (q.length < 2) {
    return res.status(400).json({
      success: false,
      error: "En az 2 karakterlik arama yapmalısın."
    });
  }

  try {
    const url = new URL(
      "https://sportscore.com/api/v1/search/"
    );

    url.searchParams.set("q", q);
    url.searchParams.set("sport", "football");
    url.searchParams.set("limit", "20");

    const headers = {
      Accept: "application/json"
    };

    const apiKey = process.env.SPORTSCORE_API_KEY;

    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Lig araması başarısız.",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      query: q,
      results: data
    });

  } catch (error) {
    console.error("SPORIX arama hatası:", error);

    return res.status(502).json({
      success: false,
      error: "Arama servisine ulaşılamadı.",
      message: error.message
    });
  }
}
