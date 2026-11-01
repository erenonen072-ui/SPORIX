
"use strict";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Sadece GET isteği destekleniyor."
    });
  }

  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 50)
  );

  try {
    const url = new URL("https://sportscore.com/api/widget/matches/");
    url.searchParams.set("sport", "football");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("src", "sporix.vercel.app");

    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("SportScore geçerli JSON döndürmedi.");
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Maç verileri alınamadı."
      });
    }

    const matches = Array.isArray(data.matches)
      ? data.matches
      : Array.isArray(data.data?.matches)
        ? data.data.matches
        : [];

    res.setHeader("Cache-Control", "s-maxage=45, stale-while-revalidate=30");

    return res.status(200).json({
      success: true,
      sport: "football",
      count: matches.length,
      matches,
      updated: new Date().toISOString()
    });
  } catch (error) {
    console.error("SPORIX matches:", error);

    return res.status(502).json({
      success: false,
      error: error.message || "Maç verileri alınamadı."
    });
  }
}
