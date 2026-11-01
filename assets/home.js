
const competitions = [
  "turkish-super-league",
  "english-premier-league",
  "spanish-la-liga",
  "bundesliga",
  "italian-serie-a",
  "uefa-champions-league"
];

const today = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

function getTeam(team) {
  if (typeof team === "string") return { name: team, logo: "" };
  return {
    name: team?.name || team?.shortName || team?.title || "Takım",
    logo: team?.logo || team?.image || team?.crest || ""
  };
}

function getTeams(match) {
  const home = match.homeTeam || match.home || match.home_team || match.participants?.[0] || {};
  const away = match.awayTeam || match.away || match.away_team || match.participants?.[1] || {};
  return [getTeam(home), getTeam(away)];
}

function getScore(match) {
  const home = match.homeScore ?? match.home_score ?? match.scores?.home ?? match.score?.home;
  const away = match.awayScore ?? match.away_score ?? match.scores?.away ?? match.score?.away;
  return [home ?? "-", away ?? "-"];
}

function getStatus(match) {
  const status = String(match.status?.name || match.status || match.state || "").toLowerCase();
  if (status.includes("live") || status.includes("in_play") || status.includes("progress")) {
    return { text: "CANLI", live: true };
  }
  if (status.includes("finish") || status.includes("ended")) {
    return { text: "BİTTİ", live: false };
  }
  const date = match.startTime || match.start_time || match.date || match.datetime;
  if (date) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        text: parsed.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Istanbul"
        }),
        live: false
      };
    }
  }
  return { text: "PROGRAM", live: false };
}

function createTeam(team) {
  const row = document.createElement("div");
  row.className = "match-team";

  if (team.logo) {
    const img = document.createElement("img");
    img.src = team.logo;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => img.remove();
    row.appendChild(img);
  }

  const name = document.createElement("span");
  name.textContent = team.name;
  row.appendChild(name);
  return row;
}

function renderMatches(element, matches) {
  element.replaceChildren();

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Bu ligde bugün listelenecek maç bulunamadı.";
    element.appendChild(empty);
    return;
  }

  matches.forEach(match => {
    const [home, away] = getTeams(match);
    const [homeScore, awayScore] = getScore(match);
    const status = getStatus(match);

    const card = document.createElement("article");
    card.className = "match-card";

    const statusBox = document.createElement("div");
    statusBox.className = "match-status" + (status.live ? " live" : "");
    statusBox.textContent = status.text;

    const teams = document.createElement("div");
    teams.className = "match-teams";
    teams.append(createTeam(home), createTeam(away));

    const score = document.createElement("div");
    score.className = "match-score";

    const score1 = document.createElement("span");
    score1.textContent = homeScore;
    const score2 = document.createElement("span");
    score2.textContent = awayScore;

    score.append(score1, score2);
    card.append(statusBox, teams, score);
    element.appendChild(card);
  });
}

async function loadLeague(competition) {
  const element = document.getElementById(`matches-${competition}`);
  if (!element) return;

  element.innerHTML = '<div class="loading">Maçlar yükleniyor...</div>';

  try {
    const url = `/api/matches?competition=${encodeURIComponent(competition)}&date=${today()}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error("API yanıt vermedi");

    const data = await response.json();
    const matches = Array.isArray(data)
      ? data
      : data.matches || data.fixtures || data.results || data.data?.matches || [];

    renderMatches(element, matches);
  } catch (error) {
    element.innerHTML = '<div class="empty-state">Maç bilgileri şu anda alınamadı.</div>';
    console.error(competition, error);
  }
}

async function loadAll() {
  const button = document.getElementById("refreshAll");
  if (button) {
    button.disabled = true;
    button.textContent = "Yükleniyor...";
  }

  await Promise.all(competitions.map(loadLeague));

  if (button) {
    button.disabled = false;
    button.textContent = "↻ Yenile";
  }
}

document.getElementById("refreshAll")?.addEventListener("click", loadAll);

document.getElementById("menuToggle")?.addEventListener("click", () => {
  const nav = document.getElementById("mainNav");
  const button = document.getElementById("menuToggle");
  const open = nav.classList.toggle("open");
  button.setAttribute("aria-expanded", String(open));
});

document.getElementById("year").textContent = new Date().getFullYear();

loadAll();
setInterval(loadAll, 60000);
