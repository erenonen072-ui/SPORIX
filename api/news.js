
const FEEDS = [
  {
    name: "A Spor",
    url: "https://www.aspor.com.tr/rss/futbol.xml"
  },
  {
    name: "Habertürk",
    url: "https://www.haberturk.com/rss/spor.xml"
  }
];

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
}

function getTag(xml, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(
    new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i")
  );
  return match ? decodeXml(match[1].trim()) : "";
}

function cleanText(value = "") {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function getImage(item) {
  const candidates = [
    item.match(/<media:content\b[^>]*\burl=["']([^"']+)["']/i)?.[1],
    item.match(/<media:thumbnail\b[^>]*\burl=["']([^"']+)["']/i)?.[1],
    item.match(/<enclosure\b[^>]*\burl=["']([^"']+)["']/i)?.[1],
    item.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1]
  ];

  for (const candidate of candidates) {
    const url = safeUrl(candidate || "");
    if (url) return url;
  }

  return "";
}

function parseFeed(xml, source) {
  const entries = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  return entries.map(item => {
    const title = cleanText(getTag(item, "title"));
    const description = cleanText(
      getTag(item, "description") ||
      getTag(item, "content:encoded")
    );

    const link = safeUrl(getTag(item, "link"));
    const dateText =
      getTag(item, "pubDate") ||
      getTag(item, "dc:date");

    const timestamp = Date.parse(dateText);
    const image = getImage(item);

    if (!title || !link) return null;

    return {
      title,
      description: description.slice(0, 240),
      link,
      image,
      source,
      date: Number.isFinite(timestamp)
        ? new Date(timestamp).toISOString()
        : null
    };
  }).filter(Boolean);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Yalnızca GET isteği destekleniyor."
    });
  }

  const results = await Promise.allSettled(
    FEEDS.map(async feed => {
      const response = await fetch(feed.url, {
        headers: {
          "User-Agent": "SPORIX-News/1.0",
          "Accept": "application/rss+xml, application/xml, text/xml"
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`${feed.name} RSS yanıt vermedi.`);
      }

      const xml = await response.text();
      return parseFeed(xml, feed.name);
    })
  );

  const news = results
    .filter(result => result.status === "fulfilled")
    .flatMap(result => result.value);

  const unique = [
    ...new Map(news.map(item => [item.link, item])).values()
  ];

  unique.sort((a, b) =>
    (Date.parse(b.date || "") || 0) -
    (Date.parse(a.date || "") || 0)
  );

  if (!unique.length) {
    return res.status(502).json({
      success: false,
      message: "Haber kaynaklarına şu anda ulaşılamıyor.",
      items: []
    });
  }

  return res.status(200).json({
    success: true,
    updatedAt: new Date().toISOString(),
    count: unique.length,
    items: unique.slice(0, 40)
  });
}
