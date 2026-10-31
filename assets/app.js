const API = "https://sportscore.com/api/v1";

const matchesElement = document.getElementById("matches");
const leagueSelect = document.getElementById("leagueSelect");
const matchDate = document.getElementById("matchDate");
const refreshButton = document.getElementById("refreshMatches");

let allMatches = [];
let activeFilter = "all";
let activeLeagueSlug = "";
let loading = false;

const leagues = {
  "super-lig": {
    search: "Super Lig",
    name: "Türkiye Süper Lig"
  },
  "1-lig": {
    search: "TFF 1. Lig",
    name: "Türkiye 1. Lig"
  },
  "premier-league": {
    search: "Premier League",
    name: "Premier League"
  },
  "la-liga": {
    search: "La Liga",
    name: "La Liga"
  },
  "serie-a": {
    search: "Serie A",
    name: "Serie A"
  },
  "bundesliga": {
    search: "Bundesliga",
    name: "Bundesliga"
  },
  "ligue-1": {
    search: "Ligue 1",
    name: "Ligue 1"
  },
  "champions-league": {
    search: "UEFA Champions League",
    name: "Şampiyonlar Ligi"
  }
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function getJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("API hatası: " + response.status);
  }

  return response.json();
}

/*
  Arama sonucundaki lig nesnesini bulur.
  API yanıtında ligler farklı gruplar içinde gelebileceği
  için nesneleri iç içe tarar.
*/
function findCompetition(data, searchName) {
  const found = [];
  const visited = new Set();

  function scan(value, parentKey = "") {
    if (!value || typeof value !== "object") return;
    if (visited.has(value)) return;

    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach(item => scan(item, parentKey));
      return;
    }

    const slug = value.slug;
    const name =
      value.name ||
      value.title ||
      value.label ||
      value.competition_name ||
      "";

    if (slug && name) {
      const type = normalize(
        value.type || value.entity_type || parentKey
      );

      const isCompetition =
        type.includes("competition") ||
        type.includes("league") ||
        type.includes("tournament") ||
        normalize(name).includes(normalize(searchName));

      if (isCompetition) {
        found.push({
          slug: String(slug),
          name: String(name),
          score: normalize(name) === normalize(searchName) ? 10 : 1
        });
      }
    }

    Object.entries(value).forEach(([key, child]) => {
      scan(child, key);
    });
  }

  scan(data);

  found.sort((a, b) => b.score - a.score);

  return found[0] || null;
}

async function resolveLeagueSlug(league) {
  const url = new URL(`${API}/search/`);

  url.searchParams.set("q", league.search);
  url.searchParams.set("sport", "football");
  url.searchParams.set("limit", "20");

  const data = await getJSON(url.toString());
  const result = findCompetition(data, league.search);

  if (!result) {
    console.error("Lig arama yanıtı:", data);
    throw new Error(
      league.name + " için lig kodu bulunamadı."
    );
  }

  return result.slug;
}

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function updateDate() {
  const today = new Date();

  matchDate.textContent = today.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function extractMatches(data) {
  if (Array.isArray(data)) return data;

  return (
    data.fixtures ||
    data.matches ||
    data.results ||
    data.data?.fixtures ||
    data.data?.matches ||
    []
  );
}

function getTeamName(team) {
  if (typeof team === "string") return team;

  return (
    team?.name ||
    team?.short_name ||
    team?.title ||
    "Takım"
  );
}

function getTeamLogo(team, fallback) {
  if (typeof team === "object" && team) {
    return team.logo || team.image || team.logo_url || fallback || "";
  }

  return fallback || "";
}

function getStatus(match) {
  const status = String(
    match.status ||
    match.state ||
    match.fixture_status ||
    ""
  ).toLowerCase();

  if (
    status.includes("live") ||
    status.includes("progress") ||
    status.includes("half")
  ) {
    return "live";
  }

  if (
    status.includes("finish") ||
    status.includes("ended") ||
    status.includes("full")
  ) {
    return "finished";
  }

  return "upcoming";
}

function getScore(match) {
  const home =
    match.home_score ??
    match.home_goals ??
    match.score?.home ??
    match.scores?.home ??
    "-";

  const away =
    match.away_score ??
    match.away_goals ??
    match.score?.away ??
    match.scores?.away ??
    "-";

  return `${home} - ${away}`;
}

function getCompetitionName(match) {
  return (
    match.competition?.name ||
    match.competition_name ||
    match.league?.name ||
    match.tournament?.name ||
    leagues[leagueSelect.value]?.name ||
    "Futbol"
  );
}

function getMatchTime(match) {
  const date =
    match.time ||
    match.start_time ||
    match.date ||
    match.starting_at;

  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return String(date);
  }

  return parsed.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul"
  });
}

function renderMatches() {
  const filtered = allMatches.filter(match => {
    return activeFilter === "all" ||
      getStatus(match) === activeFilter;
  });

  if (!filtered.length) {
    matchesElement.innerHTML = `
      <div class="empty-state">
        Bu ligde seçilen kategoride maç bulunamadı.
      </div>
    `;
    return;
  }

  matchesElement.innerHTML = filtered.map(match => {
    const homeTeam = match.home || match.home_team;
    const awayTeam = match.away || match.away_team;

    const homeName = getTeamName(homeTeam);
    const awayName = getTeamName(awayTeam);

    const homeLogo = getTeamLogo(
      homeTeam,
      match.home_logo
    );

    const awayLogo = getTeamLogo(
      awayTeam,
      match.away_logo
    );

    const status = getStatus(match);
    const statusText =
      match.status_text ||
      match.status_name ||
      (status === "live"
        ? "CANLI"
        : status === "finished"
          ? "MAÇ BİTTİ"
          : "BAŞLAMADI");

    return `
      <article class="match-card">

        <div class="match-league">
          <span>${escapeHTML(getCompetitionName(match))}</span>
          <span>${escapeHTML(getMatchTime(match))}</span>
        </div>

        <div class="match-main">

          <div class="team">
            ${
              homeLogo
                ? `<img src="${escapeHTML(homeLogo)}" alt="" loading="lazy">`
                : ""
            }
            <span>${escapeHTML(homeName)}</span>
          </div>

          <div class="score">
            ${escapeHTML(getScore(match))}
          </div>

          <div class="team">
            <span>${escapeHTML(awayName)}</span>
            ${
              awayLogo
                ? `<img src="${escapeHTML(awayLogo)}" alt="" loading="lazy">`
                : ""
            }
          </div>

        </div>

        <div class="match-status ${status}">
          ${escapeHTML(statusText)}
        </div>

      </article>
    `;
  }).join("");
}

async function loadMatches() {
  if (loading) return;

  loading = true;

  const selected = leagueSelect.value;
  const league = leagues[selected];

  if (!league) {
    loading = false;
    return;
  }

  matchesElement.innerHTML =
    '<div class="loading">Lig bilgileri ve maçlar yükleniyor...</div>';

  try {
    // Önce seçilen ligin gerçek slug değerini bul.
    activeLeagueSlug = await resolveLeagueSlug(league);

    // Seçilen ligin bugünkü maçlarını getir.
    const url = new URL(`${API}/fixtures/`);

    url.searchParams.set("sport", "football");
    url.searchParams.set("date", getTodayUTC());
    url.searchParams.set("competition", activeLeagueSlug);
    url.searchParams.set("limit", "200");

    const data = await getJSON(url.toString());

    allMatches = extractMatches(data);

    console.log("Seçilen lig:", league.name);
    console.log("Lig kodu:", activeLeagueSlug);
    console.log("Maç verileri:", data);

    renderMatches();

  } catch (error) {
    console.error("SPORIX maç hatası:", error);

    allMatches = [];

    matchesElement.innerHTML = `
      <div class="error-state">
        <strong>Maçlar yüklenemedi.</strong>
        <p>${escapeHTML(error.message)}</p>
        <p>Biraz sonra tekrar deneyebilirsin.</p>
      </div>
    `;

  } finally {
    loading = false;
  }
}

// Lig seçildiğinde sadece seçilen ligin maçlarını yükle.
leagueSelect.addEventListener("change", () => {
  loadMatches();
});

// Canlı / biten / yaklaşan filtreleri.
document.querySelectorAll(".match-tabs button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelector(
      ".match-tabs button.selected"
    )?.classList.remove("selected");

    button.classList.add("selected");
    activeFilter = button.dataset.filter;

    renderMatches();
  });
});

// Elle yenileme.
refreshButton.addEventListener("click", () => {
  loadMatches();
});

// Mobil menü.
const menuBtn = document.getElementById("menuBtn");
const mainNav = document.getElementById("mainNav");

menuBtn?.addEventListener("click", () => {
  mainNav.classList.toggle("open");
});

// Tarih ve ilk maç yüklemesi.
updateDate();
loadMatches();

// Her 60 saniyede maçları yenile.
setInterval(() => {
  if (!document.hidden) {
    loadMatches();
  }
}, 60000);
