const competitions = [
  "turkish-super-league",
  "english-premier-league",
  "spanish-la-liga",
  "bundesliga",
  "italian-serie-a",
  "uefa-champions-league"
];

let selectedDate = getTurkeyDate();

function getTurkeyDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const part = type => parts.find(item => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateFromString(value) {
  return new Date(`${value}T12:00:00+03:00`);
}

function addDays(value, amount) {
  const date = dateFromString(value);
  date.setDate(date.getDate() + amount);
  return getTurkeyDate(date);
}

function formatDate(value) {
  return dateFromString(value).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul"
  });
}

function renderDateStrip() {
  const strip = document.getElementById("dateStrip");
  const label = document.getElementById("selectedDateLabel");
  if (!strip) return;

  strip.replaceChildren();

  const today = getTurkeyDate();

  // Dünden başlayarak sonraki 6 günü göster.
  for (let offset = -1; offset <= 6; offset++) {
    const date = addDays(today, offset);
    const parsed = dateFromString(date);

    const dayName = offset === -1
      ? "DÜN"
      : offset === 0
        ? "BUGÜN"
        : offset === 1
          ? "YARIN"
          : parsed.toLocaleDateString("tr-TR", {
              weekday: "short",
              timeZone: "Europe/Istanbul"
            });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "date-button";
    button.classList.toggle("active", date === selectedDate);
    button.setAttribute("aria-pressed", String(date === selectedDate));

    const day = document.createElement("span");
    day.className = "day-name";
    day.textContent = dayName;

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = parsed.toLocaleDateString("tr-TR", {
      day: "2-digit",
      timeZone: "Europe/Istanbul"
    });

    const month = document.createElement("span");
    month.className = "day-month";
    month.textContent = parsed.toLocaleDateString("tr-TR", {
      month: "short",
      timeZone: "Europe/Istanbul"
    });

    button.append(day, number, month);

    button.addEventListener("click", () => {
      selectedDate = date;
      renderDateStrip();
      loadAllLeagues();
    });

    strip.appendChild(button);
  }

  if (label) {
    label.textContent = formatDate(selectedDate);
  }
}

function getTeam(team) {
  if (typeof team === "string") {
    return { name: team, logo: "" };
  }

  return {
    name: team?.name || team?.shortName || team?.title || "Takım",
    logo: team?.logo || team?.image || team?.crest || team?.logoUrl || ""
  };
}

function getTeams(match) {
  const participants = match.participants || [];

  const home =
    match.homeTeam ||
    match.home_team ||
    match.home ||
    participants.find(p => p?.meta?.location === "home") ||
    participants[0] ||
    {};

  const away =
    match.awayTeam ||
    match.away_team ||
    match.away ||
    participants.find(p => p?.meta?.location === "away") ||
    participants[1] ||
    {};

  return [getTeam(home), getTeam(away)];
}

function getCompetitionLogo(match) {
  const competition =
    match.competition ||
    match.league ||
    match.tournament ||
    {};

  if (typeof competition === "object") {
    return competition.logo || competition.image ||
      competition.crest || competition.logoUrl || "";
  }

  return match.competitionLogo || match.leagueLogo || "";
}

function updateLeagueLogo(competition, match) {
  const section = document.querySelector(
    `[data-competition="${competition}"]`
  );

  if (!section) return;

  const logo = section.querySelector(".league-logo");
  const fallback = section.querySelector(".league-fallback");
  const url = getCompetitionLogo(match);

  if (!url || !logo) return;

  logo.onload = () => {
    logo.hidden = false;
    if (fallback) fallback.hidden = true;
  };

  logo.onerror = () => {
    logo.hidden = true;
    if (fallback) fallback.hidden = false;
  };

  logo.src = url;
}

function getScore(match) {
  const home =
    match.homeScore ??
    match.home_score ??
    match.scores?.home ??
    match.score?.home ??
    match.result?.home;

  const away =
    match.awayScore ??
    match.away_score ??
    match.scores?.away ??
    match.score?.away ??
    match.result?.away;

  return [home, away];
}

function getMatchDate(match) {
  return (
    match.startTime ||
    match.start_time ||
    match.datetime ||
    match.date ||
    match.start_at ||
    match.timestamp ||
    null
  );
}

function getMatchTime(match) {
  const date = getMatchDate(match);

  if (!date) return "--:--";

  // API zamanı ISO tarih biçimindeyse Türkiye saatine çevir.
  const parsed = typeof date === "number"
    ? new Date(date < 10000000000 ? date * 1000 : date)
    : new Date(date);

  if (Number.isNaN(parsed.getTime())) return "--:--";

  return parsed.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul"
  });
}

function getMatchStatus(match) {
  const raw = match.status?.name || match.status?.type ||
    match.status || match.state || "";

  const status = String(raw).toLowerCase();

  if (
    status.includes("live") ||
    status.includes("in_play") ||
    status.includes("progress")
  ) {
    return { text: "CANLI", live: true, finished: false };
  }

  if (
    status.includes("finish") ||
    status.includes("ended") ||
    status.includes("complete")
  ) {
    return { text: "BİTTİ", live: false, finished: true };
  }

  return { text: "MAÇ SAATİ", live: false, finished: false };
}

function createTeam(team) {
  const row = document.createElement("div");
  row.className = "match-team";

  if (team.logo) {
    const img = document.createElement("img");
    img.src = team.logo;
    img.alt = team.name;
    img.loading = "lazy";

    img.onerror = () => img.remove();
    row.appendChild(img);
  }

  const name = document.createElement("span");
  name.textContent = team.name;
  row.appendChild(name);

  return row;
}

function createMatchCard(match) {
  const [home, away] = getTeams(match);
  const [homeScore, awayScore] = getScore(match);
  const status = getMatchStatus(match);
  const time = getMatchTime(match);

  const card = document.createElement("article");
  card.className = "match-card";

  const statusBox = document.createElement("div");
  statusBox.className = "match-status";
  if (status.live) statusBox.classList.add("live");

  const statusText = document.createElement("span");
  statusText.textContent = status.text;

  const dateText = document.createElement("span");
  dateText.className = "match-date";
  dateText.textContent = time;

  statusBox.append(statusText, dateText);

  const teams = document.createElement("div");
  teams.className = "match-teams";
  teams.append(createTeam(home), createTeam(away));

  const score = document.createElement("div");
  score.className = "match-score";

  const first = document.createElement("span");
  const second = document.createElement("span");

  if (status.finished || status.live) {
    first.textContent = homeScore ?? "-";
    second.textContent = awayScore ?? "-";
  } else {
    first.textContent = "–";
    second.textContent = "–";
  }

  score.append(first, second);

  card.append(statusBox, teams, score);
  return card;
}

function getMatches(data) {
  if (Array.isArray(data)) return data;

  return (
    data.matches ||
    data.fixtures ||
    data.results?.fixtures ||
    data.results ||
    data.data?.matches ||
    data.data?.fixtures ||
    data.data ||
    []
  );
}

async function loadLeague(competition) {
  const element = document.getElementById(`matches-${competition}`);
  if (!element) return;

  element.innerHTML = '<div class="loading">Maçlar yükleniyor...</div>';

  try {
    const url =
      `/api/matches?competition=${encodeURIComponent(competition)}` +
      `&date=${encodeURIComponent(selectedDate)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API hatası: ${response.status}`);
    }

    const data = await response.json();
    const matches = getMatches(data);

    element.replaceChildren();

    if (!Array.isArray(matches) || matches.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Bu tarihte maç bulunmuyor.";
      element.appendChild(empty);
      return;
    }

    matches.sort((a, b) => {
      const aDate = new Date(getMatchDate(a) || 0).getTime();
      const bDate = new Date(getMatchDate(b) || 0).getTime();
      return aDate - bDate;
    });

    matches.forEach(match => {
      updateLeagueLogo(competition, match);
      element.appendChild(createMatchCard(match));
    });

  } catch (error) {
    console.error(`${competition}:`, error);

    element.innerHTML =
      '<div class="empty-state">Maç bilgileri şu anda alınamadı.</div>';
  }
}

async function loadAllLeagues() {
  await Promise.all(competitions.map(loadLeague));
}

document.addEventListener("DOMContentLoaded", () => {
  renderDateStrip();
  loadAllLeagues();

  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");

  menuToggle?.addEventListener("click", () => {
    const open = mainNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Her dakika otomatik güncelleme.
  setInterval(loadAllLeagues, 60000);
});
