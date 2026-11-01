
"use strict";

// ========================================
// SPORIX - FUTBOL MAÇ MERKEZİ
// SportScore API entegrasyonu
// ========================================

const competitions = [
  "turkish-super-league",
  "english-premier-league",
  "spanish-la-liga",
  "bundesliga",
  "italian-serie-a",
  "uefa-champions-league"
];

let selectedDate = getTurkeyDate();
let refreshTimer = null;

// ========================================
// TARİH İŞLEMLERİ
// ========================================

function getTurkeyDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const part = type =>
    parts.find(item => item.type === type).value;

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
    weekday: "long",
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

  // Dün ve sonraki 6 gün.
  for (let offset = -1; offset <= 6; offset++) {
    const date = addDays(today, offset);
    const parsed = dateFromString(date);

    const dayName =
      offset === -1 ? "DÜN" :
      offset === 0 ? "BUGÜN" :
      offset === 1 ? "YARIN" :
      parsed.toLocaleDateString("tr-TR", {
        weekday: "short",
        timeZone: "Europe/Istanbul"
      });

    const button = document.createElement("button");

    button.type = "button";
    button.className = "date-button";
    button.classList.toggle("active", date === selectedDate);
    button.setAttribute(
      "aria-pressed",
      String(date === selectedDate)
    );

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
      if (selectedDate === date) return;

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

// ========================================
// GÖRSEL URL KONTROLÜ
// ========================================

function cleanImageUrl(value) {
  if (typeof value !== "string") return "";

  let url = value.trim();

  // Markdown bağlantısı biçiminde gelirse URL'yi ayıkla.
  const markdown = url.match(/\]\((https?:\/\/[^)]+)\)/);

  if (markdown) {
    url = markdown[1];
  }

  if (!/^https?:\/\//i.test(url)) return "";

  return url;
}

// ========================================
// TAKIM BİLGİLERİ
// ========================================

function getTeam(team) {
  if (typeof team === "string") {
    return {
      name: team,
      logo: ""
    };
  }

  return {
    name:
      team?.name ||
      team?.shortName ||
      team?.title ||
      "Takım",

    logo: cleanImageUrl(
      team?.logo ||
      team?.image ||
      team?.crest ||
      team?.logoUrl ||
      ""
    )
  };
}

function getTeams(match) {
  // SportScore API'nin doğrudan gönderdiği alanlar.
  if (match.home !== undefined && match.away !== undefined) {
    return [
      {
        name: getTeam(match.home).name,
        logo: cleanImageUrl(
          match.home_logo || getTeam(match.home).logo
        )
      },
      {
        name: getTeam(match.away).name,
        logo: cleanImageUrl(
          match.away_logo || getTeam(match.away).logo
        )
      }
    ];
  }

  // Alternatif API formatları.
  const participants = Array.isArray(match.participants)
    ? match.participants
    : [];

  const home =
    match.homeTeam ||
    match.home_team ||
    participants.find(p => p?.meta?.location === "home") ||
    participants[0] ||
    {};

  const away =
    match.awayTeam ||
    match.away_team ||
    participants.find(p => p?.meta?.location === "away") ||
    participants[1] ||
    {};

  return [
    {
      ...getTeam(home),
      logo: cleanImageUrl(
        match.home_logo || getTeam(home).logo
      )
    },
    {
      ...getTeam(away),
      logo: cleanImageUrl(
        match.away_logo || getTeam(away).logo
      )
    }
  ];
}

// ========================================
// LİG LOGOSU
// ========================================

function getCompetitionLogo(match) {
  return cleanImageUrl(
    match.competition_logo ||
    match.competitionLogo ||
    match.league_logo ||
    match.leagueLogo ||
    match.competition?.logo ||
    match.competition?.image ||
    match.league?.logo ||
    ""
  );
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

  if (logo.dataset.currentSrc === url) return;

  logo.dataset.currentSrc = url;
  logo.hidden = false;

  if (fallback) fallback.hidden = true;

  logo.onload = () => {
    logo.hidden = false;
    if (fallback) fallback.hidden = true;
  };

  logo.onerror = () => {
    logo.hidden = true;
    logo.dataset.currentSrc = "";

    if (fallback) fallback.hidden = false;
  };

  logo.src = url;
}

// ========================================
// SKOR BİLGİLERİ
// ========================================

function getScore(match) {
  const home =
    match.home_score ??
    match.homeScore ??
    match.scores?.home ??
    match.score?.home ??
    match.result?.home ??
    null;

  const away =
    match.away_score ??
    match.awayScore ??
    match.scores?.away ??
    match.score?.away ??
    match.result?.away ??
    null;

  return [home, away];
}

// ========================================
// MAÇ TARİHİ VE SAATİ
// ========================================

function getMatchDate(match) {
  return (
    match.time ||
    match.startTime ||
    match.start_time ||
    match.datetime ||
    match.date ||
    match.start_at ||
    match.timestamp ||
    null
  );
}

function parseMatchDate(match) {
  const value = getMatchDate(match);

  if (!value) return null;

  const date = typeof value === "number"
    ? new Date(value < 10000000000 ? value * 1000 : value)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getMatchTime(match) {
  const date = parseMatchDate(match);

  if (!date) return "--:--";

  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul"
  });
}

// ========================================
// MAÇ DURUMU
// ========================================

function getMatchStatus(match) {
  const raw =
    match.status?.name ||
    match.status?.type ||
    match.status ||
    match.state ||
    "";

  const status = String(raw).toLowerCase();

  if (
    status.includes("live") ||
    status.includes("in_play") ||
    status.includes("progress") ||
    status.includes("1h") ||
    status.includes("2h")
  ) {
    return {
      text: "CANLI",
      live: true,
      finished: false
    };
  }

  if (
    status.includes("finish") ||
    status.includes("ended") ||
    status.includes("complete")
  ) {
    return {
      text: "BİTTİ",
      live: false,
      finished: true
    };
  }

  if (
    status.includes("postponed") ||
    status.includes("cancelled") ||
    status.includes("abandoned")
  ) {
    return {
      text: match.status_text || "ERTELENDİ",
      live: false,
      finished: false
    };
  }

  return {
    text: "MAÇ SAATİ",
    live: false,
    finished: false
  };
}

// ========================================
// TAKIM TASARIMI
// ========================================

function createTeam(team) {
  const row = document.createElement("div");
  row.className = "match-team";

  if (team.logo) {
    const img = document.createElement("img");

    img.src = team.logo;
    img.alt = team.name;
    img.loading = "lazy";

    img.onerror = () => {
      img.remove();
    };

    row.appendChild(img);
  }

  const name = document.createElement("span");
  name.textContent = team.name;

  row.appendChild(name);

  return row;
}

// ========================================
// MAÇ KARTI
// ========================================

function createMatchCard(match) {
  const [home, away] = getTeams(match);
  const [homeScore, awayScore] = getScore(match);

  const status = getMatchStatus(match);
  const time = getMatchTime(match);

  const card = document.createElement("article");
  card.className = "match-card";

  if (status.live) {
    card.classList.add("match-live");
  }

  const statusBox = document.createElement("div");
  statusBox.className = "match-status";

  if (status.live) {
    statusBox.classList.add("live");
  }

  const statusText = document.createElement("span");
  statusText.textContent = status.text;

  const dateText = document.createElement("span");
  dateText.className = "match-date";
  dateText.textContent = time;

  statusBox.append(statusText, dateText);

  const teams = document.createElement("div");
  teams.className = "match-teams";

  teams.append(
    createTeam(home),
    createTeam(away)
  );

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

// ========================================
// API VERİSİNİ OKU
// ========================================

function getMatches(data) {
  if (Array.isArray(data)) return data;

  const candidates = [
    data?.matches,
    data?.fixtures,
    data?.results?.matches,
    data?.results?.fixtures,
    data?.data?.matches,
    data?.data?.fixtures,
    data?.data?.results
  ];

  return candidates.find(Array.isArray) || [];
}

// ========================================
// MAÇLARI SIRALA
// ========================================

function sortMatches(matches) {
  return [...matches].sort((a, b) => {
    const dateA = parseMatchDate(a)?.getTime() || 0;
    const dateB = parseMatchDate(b)?.getTime() || 0;

    return dateA - dateB;
  });
}

// ========================================
// LİG MAÇLARINI YÜKLE
// ========================================

async function loadLeague(competition) {
  const element = document.getElementById(
    `matches-${competition}`
  );

  if (!element) return;

  // Eski isteklerin yeni sonuçları ezmesini engelle.
  const requestId = String(
    Number(element.dataset.requestId || 0) + 1
  );

  element.dataset.requestId = requestId;

  if (!element.querySelector(".match-card")) {
    element.innerHTML =
      '<div class="loading">Maçlar yükleniyor...</div>';
  }

  try {
    const url =
      `/api/matches?competition=${encodeURIComponent(competition)}` +
      `&date=${encodeURIComponent(selectedDate)}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`API hatası: ${response.status}`);
    }

    const data = await response.json();

    if (element.dataset.requestId !== requestId) return;

    if (data.success === false) {
      throw new Error(data.error || "API başarısız.");
    }

    const matches = getMatches(data);

    element.replaceChildren();

    if (matches.length === 0) {
      const empty = document.createElement("div");

      empty.className = "empty-state";
      empty.textContent = "Bu tarihte maç bulunmuyor.";

      element.appendChild(empty);
      return;
    }

    const sortedMatches = sortMatches(matches);

    sortedMatches.forEach(match => {
      updateLeagueLogo(competition, match);

      element.appendChild(
        createMatchCard(match)
      );
    });

  } catch (error) {
    if (element.dataset.requestId !== requestId) return;

    console.error(`SPORIX ${competition}:`, error);

    element.innerHTML =
      '<div class="empty-state">Maç bilgileri şu anda alınamadı.</div>';
  }
}

// ========================================
// TÜM LİGLERİ YÜKLE
// ========================================

async function loadAllLeagues() {
  await Promise.all(
    competitions.map(competition =>
      loadLeague(competition)
    )
  );
}

// ========================================
// MOBİL MENÜ VE BAŞLANGIÇ
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  renderDateStrip();

  loadAllLeagues();

  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");

  menuToggle?.addEventListener("click", () => {
    if (!mainNav) return;

    const open = mainNav.classList.toggle("open");

    menuToggle.setAttribute(
      "aria-expanded",
      String(open)
    );
  });

  const year = document.getElementById("year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  // Önceki zamanlayıcı varsa temizle.
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  // Her 60 saniyede otomatik güncelle.
  refreshTimer = setInterval(() => {
    loadAllLeagues();
  }, 60000);
});
