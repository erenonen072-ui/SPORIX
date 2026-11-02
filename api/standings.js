
"use strict";

const API_URL = "https://sportscore.com/api/widget/standings/";

const LEAGUES = {
  "turkish-super-league": "Süper Lig",
  "turkish-first-league": "1. Lig",
  "turkish-second-league": "2. Lig",
  "turkish-third-league": "3. Lig"
};

module.exports = async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "s-maxage=3600, stale-while-revalidate=7200"
  );

  try {
    const slug = String(
      req.query.league || "turkish-super-league"
    );

    if (!LEAGUES[slug]) {
      return res.status(400).json({
        success: false,
        error: "Geçersiz lig seçimi.",
        standings: []
      });
    }

    const url = new URL(API_URL);
    url.searchParams.set("sport", "football");
    url.searchParams.set("slug", slug);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "SPORIX/1.0"
      }
    });

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        success: false,
        error: "SportScore geçerli JSON göndermedi.",
        standings: []
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: "SportScore isteği başarısız.",
        upstreamStatus: response.status,
        details: data,
        standings: []
      });
    }

    if (
      data?.error ||
      data?.message === "No current season"
    ) {
      return res.status(200).json({
        success: false,
        error: data.error || data.message,
        league: LEAGUES[slug],
        slug,
        standings: [],
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      source: "SportScore",
      league: LEAGUES[slug],
      slug,
      data
    });

  } catch (error) {
    console.error("SPORIX standings API:", error);

    return res.status(500).json({
      success: false,
      error: "Puan durumu alınamadı.",
      standings: []
    });
  }
};
