
const matchesElement = document.getElementById("matches");
const standingsElement = document.getElementById("standings");

const demoMatches = [
  { home: "Galatasaray", away: "Fenerbahçe", hs: 2, as: 1, status: "BİTTİ", type: "finished" },
  { home: "Beşiktaş", away: "Trabzonspor", hs: 0, as: 0, status: "20:00", type: "upcoming" },
  { home: "Liverpool", away: "Arsenal", hs: 1, as: 1, status: "CANLI", type: "live" },
  { home: "Real Madrid", away: "Barcelona", hs: 3, as: 2, status: "BİTTİ", type: "finished" }
];

const demoStandings = [
  ["Galatasaray", 8, 22],
  ["Fenerbahçe", 8, 20],
  ["Trabzonspor", 8, 17],
  ["Beşiktaş", 8, 16],
  ["Başakşehir", 8, 14]
];

function renderMatches(filter = "all") {
  const filtered = demoMatches.filter(m => filter === "all" || m.type === filter);

  matchesElement.innerHTML = filtered.map(m => `
    <article class="match-card">
      <div class="match-league">⚽ FUTBOL • MAÇ MERKEZİ</div>
      <div class="match-main">
        <div class="team">${m.home}</div>
        <div class="score">${m.type === "upcoming" ? "VS" : `${m.hs} - ${m.as}`}</div>
        <div class="team">${m.away}</div>
      </div>
      <div class="match-status ${m.type === "live" ? "live" : ""}">
        ${m.type === "live" ? "● " : ""}${m.status}
      </div>
    </article>
  `).join("") || '<p class="loading">Bu kategoride maç bulunamadı.</p>';
}

function renderStandings() {
  standingsElement.innerHTML = demoStandings.map((team, index) => `
    <div class="table-row">
      <span>${index + 1}</span>
      <strong>${team[0]}</strong>
      <span>${team[1]}</span>
      <strong>${team[2]}</strong>
    </div>
  `).join("");
}

document.querySelectorAll(".match-tabs button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelector(".match-tabs .selected")?.classList.remove("selected");
    button.classList.add("selected");
    renderMatches(button.dataset.filter);
  });
});

document.getElementById("menuBtn").addEventListener("click", () => {
  document.querySelector(".nav").classList.toggle("open");
});

renderMatches();
renderStandings();

// GERÇEK API BAĞLANTISI İÇİN:
// API-Football veya başka bir futbol veri sağlayıcısı kullanılabilir.
// API anahtarını asla bu dosyada herkese açık şekilde tutma.
