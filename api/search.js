
"use strict";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Sadece GET isteği destekleniyor."
    });
  }

  const q = String(req.query.q || "").trim();

  if (q.length < 2) {
    return res.status(400).json({
      success: false,
      error: "En az 2 karakterlik arama yapmalısın."
    });
  }

  const apiKey = process.env.SPORTSCORE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "SPORTSCORE_API_KEY tanımlanmamış."
    });
  }

  try {
    const url = new URL(
      "https://sportscore.com/api/v1/search/"
    );

    url.searchParams.set("q", q);
    url.searchParams.set("sport", "football");
    url.searchParams.set("limit", "20");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey
      }
    });

    const contentType =
      response.headers.get("content-type") || "";

    const body = await response.text();

    if (!response.ok) {
      console.error(
        "SportScore HTTP hatası:",
        response.status,
        body.slice(0, 300)
      );

      return res.status(response.status).json({
        success: false,
        error: "SportScore arama isteği başarısız.",
        status: response.status
      });
    }

    if (!contentType.includes("application/json")) {
      console.error(
        "SportScore JSON yerine HTML döndürdü:",
        body.slice(0, 300)
      );

      return res.status(502).json({
        success: false,
        error: "SportScore geçerli JSON yanıtı göndermedi.",
        contentType
      });
    }

    let data;

    try {
      data = JSON.parse(body);
    } catch {
      return res.status(502).json({
        success: false,
        error: "SportScore yanıtı JSON olarak okunamadı."
      });
    }

    const competitions =
      data?.results?.competitions ||
      data?.competitions ||
      [];

    return res.status(200).json({
      success: true,
      query: q,
      count: Array.isArray(competitions)
        ? competitions.length
        : 0,
      results: data
    });

  } catch (error) {
    console.error("SPORIX arama hatası:", error);

    return res.status(502).json({
      success: false,
      error: "Arama servisine ulaşılamadı."
    });
  }
}
