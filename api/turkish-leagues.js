const BASE_URL = "https://sportscore.com/api/v1/search/";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  try {
    const searches = ["Turkish", "Turkey"];

    const results = await Promise.all(
      searches.map(async (query) => {
        const url = new URL(BASE_URL);
        url.searchParams.set("q", query);
        url.searchParams.set("sport", "football");
        url.searchParams.set("limit", "50");

        const response = await fetch(url.toString(), {
          headers: { Accept: "application/json" }
        });

        if (!response.ok) {
          throw new Error(`Arama hatası: ${response.status}`);
        }

        return {
          query,
          data: await response.json()
        };
      })
    );

    return res.status(200).json({
      success: true,
      results
    });
  } catch (error) {
    console.error("SPORIX Türkiye lig araması:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
