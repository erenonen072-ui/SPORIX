
"use strict";

/* ==========================================
   SPORIX - MAÇ VE TAKIM DETAY SAYFALARI
   Dosya: /assets/veri.js
========================================== */

const $ = (id) => document.getElementById(id);

const pageTitle = $("pageTitle");
const pageDescription = $("pageDescription");
const dataForm = $("dataForm");
const slugInput = $("slugInput");
const idInput = $("idInput");
const statInput = $("statInput");
const resultTitle = $("resultTitle");
const resultStatus = $("resultStatus");
const dataOutput = $("dataOutput");

const params = new URLSearchParams(window.location.search);

let currentView = params.get("view") || "standings";
let currentSlug = params.get("slug") || "";
let currentId = params.get("id") || "";
let currentStat = params.get("stat") || "goals";

const views = {
  match: {
    title: "Maç Detayları",
    description: "Maçın tüm detaylarını, olaylarını ve kadrolarını görüntüle.",
    action: "match",
    needsSlug: true
  },

  team: {
    title: "Takım Profili",
    description: "Takım bilgileri, geçmiş maçlar ve gelecek karşılaşmalar.",
    action: "team",
    needsSlug: true
  },

  standings: {
    title: "Puan Durumu",
    description: "Lig puan tablosunu görüntüle.",
    action: "standings",
    needsSlug: true
  },

  topscorers: {
    title: "Gol Krallığı",
    description: "Gol ve asist sıralamalarını görüntüle.",
    action: "topscorers",
    needsSlug: true
  },

  player: {
    title: "Oyuncu Profili",
    description: "Oyuncu bilgilerini görüntüle.",
    action: "player",
    needsSlug: true
  },

  bracket: {
    title: "Turnuva Ağacı",
    description: "Turnuva eşleşmelerini görüntüle.",
    action: "bracket",
    needsSlug: true
  },

  tracker: {
    title: "Maç Takip",
    description: "Maç takip verilerini görüntüle.",
    action: "tracker",
    needsId: true
  }
};

/* ==========================================
   YARDIMCI FONKSİYONLAR
========================================== */

function node(tag, className = "", content = "") {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (content !== undefined && content !== null) {
    element.textContent = String(content);
  }

  return element;
}

function text(value, fallback = "-") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function image(src, alt, className) {
  if (!src || typeof src !== "string") return null;

  try {
    const url = new URL(src, window.location.origin);

    if (!["https:", "http:"].includes(url.protocol)) {
      return null;
    }

    const img = document.createElement("img");
    img.src = url.href;
    img.alt = text(alt, "");
    img.className = className || "";
    img.loading = "lazy";
    img.onerror = () => img.remove();

    return img;
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function makeTeamSlug(name) {
  return String(name || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getMatchSlug(match) {
  if (match.slug || match.match_slug || match.url_slug) {
    return match.slug || match.match_slug || match.url_slug;
  }

  const parts = String(match.url || "")
    .split("/")
    .filter(Boolean);

  // Örnek:
  // /football/match/coban-imperial-vs-guastatoya/jw2r09hkvdk9rz8/
  // Doğru slug: coban-imperial-vs-guastatoya

  return parts.length >= 2
    ? parts[parts.length - 2]
    : "";
}

function showMessage(message, type = "info") {
  if (!resultStatus) return;

  resultStatus.textContent = message;
  resultStatus.dataset.type = type;
}

function setLoading(message = "Veriler yükleniyor...") {
  if (dataOutput) {
    dataOutput.replaceChildren(
      node("div", "sx-empty", message)
    );
  }

  showMessage("Yükleniyor...", "loading");
}

function showError(message) {
  if (dataOutput) {
    dataOutput.replaceChildren(
      node("div", "sx-empty", message)
    );
  }

  showMessage("Bir hata oluştu.", "error");
}

/* ==========================================
   API İSTEĞİ
========================================== */

async function api(action, values = {}) {
  const query = new URLSearchParams({
    action,
    ...values
  });

  const response = await fetch(
    `/api/sportscore?${query.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    }
  );

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Sunucudan geçerli JSON yanıtı alınamadı.");
  }

  if (!response.ok || result.success === false) {
    throw new Error(
      result.error || "API isteği başarısız oldu."
    );
  }

  return result.data;
}

/* ==========================================
   SAYFA AYARLARI
========================================== */

function setPage() {
  const config = views[currentView] || views.standings;

  if (pageTitle) {
    pageTitle.textContent = config.title;
  }

  if (pageDescription) {
    pageDescription.textContent = config.description;
  }

  if (resultTitle) {
    resultTitle.textContent = config.title;
  }

  if (slugInput) {
    slugInput.value = currentSlug;
    slugInput.closest("label, .form-group")?.classList.toggle(
      "is-hidden",
      !config.needsSlug
    );
  }

  if (idInput) {
    idInput.value = currentId;
    idInput.closest("label, .form-group")?.classList.toggle(
      "is-hidden",
      !config.needsId
    );
  }

  if (statInput) {
    statInput.value = currentStat;
  }
}

/* ==========================================
   MAÇ DETAYLARI
========================================== */

function renderMatch(match) {
  dataOutput.replaceChildren();

  if (!match) {
    showError("Maç bilgisi bulunamadı.");
    return;
  }

  const wrapper = node("div", "sx-match-page");

  const hero = node("section", "sx-match-hero");

  hero.appendChild(
    node("div", "sx-match-competition", text(match.competition, "Futbol"))
  );

  const teams = node("div", "sx-hero-teams");

  function createHeroTeam(name, logo) {
    const team = node("a", "sx-hero-team");
    const slug = makeTeamSlug(name);

    team.href = `/veri.html?view=team&slug=${encodeURIComponent(slug)}`;

    const img = image(logo, name, "sx-hero-logo");

    if (img) {
      team.appendChild(img);
    }

    team.appendChild(
      node("h2", "", text(name, "Takım"))
    );

    team.appendChild(
      node("span", "sx-team-open", "Takım profilini aç →")
    );

    return team;
  }

  const score = node(
    "div",
    "sx-hero-score",
    `${text(match.home_score, "0")} - ${text(match.away_score, "0")}`
  );

  teams.append(
    createHeroTeam(match.home, match.home_logo),
    score,
    createHeroTeam(match.away, match.away_logo)
  );

  hero.appendChild(teams);

  hero.appendChild(
    node("div", "sx-hero-status", text(match.status_text, "Maç bilgisi"))
  );

  hero.appendChild(
    node("div", "sx-hero-date", formatDate(match.time))
  );

  if (match.live_minute !== null && match.live_minute !== undefined) {
    hero.appendChild(
      node("div", "sx-live-minute", `${match.live_minute}'`)
    );
  }

  if (
    match.home_ht_score !== undefined &&
    match.away_ht_score !== undefined
  ) {
    hero.appendChild(
      node(
        "div",
        "sx-halftime-score",
        `İlk Yarı: ${match.home_ht_score} - ${match.away_ht_score}`
      )
    );
  }

  wrapper.appendChild(hero);

  /* MAÇ OLAYLARI */

  const incidents = Array.isArray(match.incidents)
    ? match.incidents
    : [];

  const eventSection = createSection("Maçın Önemli Anları");

  if (incidents.length) {
    const timeline = node("div", "sx-timeline");

    incidents.forEach(event => {
      const item = node("div", "sx-event");

      const minute = node(
        "span",
        "sx-event-time",
        `${text(event.time, "?")}'`
      );

      let icon = "•";

      if (event.is_goal || /goal/i.test(event.type || "")) {
        icon = "⚽";
      } else if (
        event.is_card ||
        /card/i.test(event.type || "")
      ) {
        icon = "🟨";
      } else if (
        event.is_sub ||
        /substitution/i.test(event.type || "")
      ) {
        icon = "🔄";
      }

      const iconElement = node("span", "sx-event-icon", icon);
      const detail = node("div", "sx-event-detail");

      detail.appendChild(
        node("strong", "", text(event.type, "Maç olayı"))
      );

      if (event.player) {
        detail.appendChild(
          node("span", "", event.player)
        );
      }

      if (event.player_in || event.player_out) {
        detail.appendChild(
          node(
            "span",
            "",
            `Giren: ${text(event.player_in)}`
          )
        );

        detail.appendChild(
          node(
            "span",
            "",
            `Çıkan: ${text(event.player_out)}`
          )
        );
      }

      if (
        event.home_score !== undefined &&
        event.away_score !== undefined
      ) {
        detail.appendChild(
          node(
            "small",
            "",
            `Skor: ${event.home_score} - ${event.away_score}`
          )
        );
      }

      item.append(minute, iconElement, detail);
      timeline.appendChild(item);
    });

    eventSection.appendChild(timeline);
  } else {
    eventSection.appendChild(
      node("p", "sx-empty", "Bu maç için olay bilgisi bulunmuyor.")
    );
  }

  wrapper.appendChild(eventSection);

  /* KADROLAR */

  const lineups = match.lineups || {};

  const lineupSection = createSection("Takım Kadroları");

  if (lineups.confirmed === true) {
    lineupSection.appendChild(
      node("p", "sx-confirmed", "✓ Kadrolar açıklandı")
    );
  }

  const lineupGrid = node("div", "sx-lineup-grid");

  function renderPlayers(title, players) {
    const column = node("div", "sx-lineup-column");

    column.appendChild(
      node("h3", "", title)
    );

    if (!Array.isArray(players) || !players.length) {
      column.appendChild(
        node("p", "sx-empty", "Oyuncu bilgisi bulunmuyor.")
      );

      return column;
    }

    const list = node("div", "sx-player-list");

    players.forEach(player => {
      const item = node("div", "sx-player");

      item.appendChild(
        node("span", "sx-player-number", text(player.number, "-"))
      );

      const playerName = node(
        "strong",
        "sx-player-name",
        text(player.name, "Bilinmeyen oyuncu")
      );

      item.appendChild(playerName);

      if (player.position) {
        item.appendChild(
          node("span", "sx-player-position", player.position)
        );
      }

      if (player.captain) {
        item.appendChild(
          node("span", "sx-captain", "Kaptan")
        );
      }

      if (player.rating !== undefined && player.rating !== null) {
        item.appendChild(
          node("span", "sx-player-rating", player.rating)
        );
      }

      list.appendChild(item);
    });

    column.appendChild(list);

    return column;
  }

  lineupGrid.append(
    renderPlayers(
      `${text(match.home)} - İlk 11`,
      lineups.home_xi
    ),
    renderPlayers(
      `${text(match.away)} - İlk 11`,
      lineups.away_xi
    ),
    renderPlayers(
      `${text(match.home)} - Yedekler`,
      lineups.home_subs
    ),
    renderPlayers(
      `${text(match.away)} - Yedekler`,
      lineups.away_subs
    )
  );

  lineupSection.appendChild(lineupGrid);
  wrapper.appendChild(lineupSection);

  /* İSTATİSTİKLER */

  const statsSection = createSection("Maç İstatistikleri");

  const stats = match.stats;

  if (Array.isArray(stats) && stats.length) {
    stats.forEach(stat => {
      statsSection.appendChild(
        renderGenericValue(stat)
      );
    });
  } else if (stats && typeof stats === "object" && Object.keys(stats).length) {
    statsSection.appendChild(
      renderGenericObject(stats)
    );
  } else {
    statsSection.appendChild(
      node(
        "p",
        "sx-empty",
        "Bu maç için istatistik verisi henüz sağlanmadı."
      )
    );
  }

  wrapper.appendChild(statsSection);

  /* HAKEM VE STADYUM */

  const extra = [];

  if (match.referee) {
    extra.push(["Hakem", match.referee]);
  }

  if (match.venue || match.stadium) {
    extra.push(["Stadyum", match.venue || match.stadium]);
  }

  if (extra.length) {
    const extraSection = createSection("Maç Bilgileri");

    extra.forEach(([label, value]) => {
      extraSection.appendChild(
        renderField(label, value)
      );
    });

    wrapper.appendChild(extraSection);
  }

  dataOutput.appendChild(wrapper);
  showMessage("Maç detayları yüklendi.", "success");
}

/* ==========================================
   TAKIM DETAYLARI
========================================== */

function renderTeam(data) {
  dataOutput.replaceChildren();

  const team = data.team || {};
  const matches = Array.isArray(data.matches)
    ? data.matches
    : [];

  const wrapper = node("div", "sx-team-page");

  const hero = node("section", "sx-team-hero");

  const logo = image(
    team.logo,
    team.name,
    "sx-team-hero-logo"
  );

  if (logo) {
    hero.appendChild(logo);
  }

  hero.appendChild(
    node("h2", "", text(team.name, "Takım"))
  );

  if (team.slug) {
    hero.appendChild(
      node("p", "", `Takım kodu: ${team.slug}`)
    );
  }

  wrapper.appendChild(hero);

  const matchSection = createSection("Takımın Maçları");

  if (!matches.length) {
    matchSection.appendChild(
      node("p", "sx-empty", "Bu takım için maç bulunamadı.")
    );
  } else {
    const matchList = node("div", "sx-match-list");

    matches.forEach(match => {
      matchList.appendChild(
        renderMatchCard(match)
      );
    });

    matchSection.appendChild(matchList);
  }

  wrapper.appendChild(matchSection);

  dataOutput.appendChild(wrapper);
  showMessage(
    `${matches.length} maç listelendi.`,
    "success"
  );
}

/* ==========================================
   TAKIM MAÇ KARTI
========================================== */

function renderMatchCard(match) {
  const slug = getMatchSlug(match);

  const card = node("a", "sx-match-card");

  if (slug && /^[a-z0-9-]+$/i.test(slug)) {
    card.href =
      `/veri.html?view=match&slug=${encodeURIComponent(slug)}`;
  } else {
    card.href = "#";

    card.addEventListener("click", event => {
      event.preventDefault();
    });
  }

  const top = node("div", "sx-match-meta");

  top.append(
    node("span", "sx-league", text(match.competition, "Futbol")),
    node("span", "sx-date", formatDate(match.time))
  );

  const teams = node("div", "sx-match-teams");

  function addTeam(name, logo) {
    const item = node("div", "sx-match-team");
    const img = image(logo, name, "sx-team-logo");

    if (img) {
      item.appendChild(img);
    }

    item.appendChild(
      node("strong", "", text(name, "Takım"))
    );

    return item;
  }

  const hasScore =
    match.home_score !== null &&
    match.home_score !== undefined &&
    match.away_score !== null &&
    match.away_score !== undefined;

  const score = hasScore
    ? `${match.home_score} - ${match.away_score}`
    : "VS";

  teams.append(
    addTeam(match.home, match.home_logo),
    node("strong", "sx-match-score", score),
    addTeam(match.away, match.away_logo)
  );

  card.append(
    top,
    teams,
    node(
      "span",
      "sx-match-status",
      text(match.status_text, "Maç bilgisi")
    )
  );

  return card;
}

/* ==========================================
   ORTAK BÖLÜM VE ALANLAR
========================================== */

function createSection(title) {
  const section = node("section", "sx-section");

  section.appendChild(
    node("h2", "sx-section-title", title)
  );

  return section;
}

function renderField(label, value) {
  const field = node("div", "sx-generic-field");

  field.append(
    node("span", "", label),
    node("strong", "", text(value))
  );

  return field;
}

/* ==========================================
   GENEL JSON VERİSİNİ GÖSTERME
========================================== */

function renderGenericValue(value, label = "") {
  if (
    value === null ||
    value === undefined ||
    typeof value !== "object"
  ) {
    return renderField(label || "Bilgi", value);
  }

  const section = node("div", "sx-generic-field");
  const title = node("strong", "", label || "Detay");

  section.appendChild(title);

  const content = node("div", "sx-generic-content");

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      content.appendChild(
        renderGenericValue(item, `#${index + 1}`)
      );
    });
  } else {
    Object.entries(value).forEach(([key, item]) => {
      content.appendChild(
        renderGenericValue(item, key)
      );
    });
  }

  section.appendChild(content);

  return section;
}

function renderGenericObject(data) {
  const wrapper = node("div", "sx-generic-list");

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      wrapper.appendChild(
        renderGenericValue(item, `#${index + 1}`)
      );
    });
  } else {
    Object.entries(data || {}).forEach(([key, value]) => {
      wrapper.appendChild(
        renderGenericValue(value, key)
      );
    });
  }

  return wrapper;
}

function renderGeneric(data) {
  dataOutput.replaceChildren();

  if (
    data === null ||
    data === undefined ||
    (
      typeof data === "object" &&
      !Object.keys(data).length
    )
  ) {
    showMessage("Gösterilecek veri bulunamadı.", "warning");
    return;
  }

  const section = createSection("Veriler");

  section.appendChild(
    renderGenericObject(data)
  );

  dataOutput.appendChild(section);
  showMessage("Veriler yüklendi.", "success");
}

/* ==========================================
   VERİLERİ YÜKLE
========================================== */

async function loadData() {
  const config = views[currentView];

  if (!config) {
    showError("Geçersiz sayfa türü.");
    return;
  }

  if (config.needsSlug && !currentSlug) {
    showError("Bu sayfayı görüntülemek için slug bilgisi gerekli.");
    return;
  }

  if (config.needsId && !currentId) {
    showError("Maç ID bilgisi gerekli.");
    return;
  }

  setLoading();

  try {
    let data;

    if (currentView === "tracker") {
      data = await api(config.action, {
        id: currentId
      });
    } else if (currentView === "topscorers") {
      data = await api(config.action, {
        slug: currentSlug,
        stat: currentStat
      });
    } else {
      data = await api(config.action, {
        slug: currentSlug
      });
    }

    if (currentView === "match") {
      renderMatch(data.match || data);
    } else if (currentView === "team") {
      renderTeam(data);
    } else {
      renderGeneric(data);
    }

  } catch (error) {
    console.error("SPORIX veri hatası:", error);

    showError(
      error.message || "Veriler yüklenirken hata oluştu."
    );
  }
}

/* ==========================================
   FORM GÖNDERİMİ
========================================== */

if (dataForm) {
  dataForm.addEventListener("submit", event => {
    event.preventDefault();

    const config = views[currentView] || views.standings;

    const nextParams = new URLSearchParams();

    nextParams.set("view", currentView);

    if (config.needsSlug && slugInput?.value.trim()) {
      nextParams.set("slug", slugInput.value.trim());
    }

    if (config.needsId && idInput?.value.trim()) {
      nextParams.set("id", idInput.value.trim());
    }

    if (currentView === "topscorers" && statInput) {
      nextParams.set(
        "stat",
        statInput.value === "assists" ? "assists" : "goals"
      );
    }

    window.location.href =
      `${window.location.pathname}?${nextParams.toString()}`;
  });
}

/* ==========================================
   MOBİL MENÜ
========================================== */

const menuToggle = $("menuToggle");
const mainNav = $("mainNav");

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("active");

    menuToggle.setAttribute(
      "aria-expanded",
      String(isOpen)
    );
  });
}

/* ==========================================
   FOOTER TARİHİ
========================================== */

const yearElement = $("year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

/* ==========================================
   BAŞLAT
========================================== */

setPage();
loadData();
