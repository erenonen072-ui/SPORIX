const API_URL =
  "https://sportscore.com/api/widget/matches/?sport=football&limit=50";

const matchesElement = document.getElementById("matches");

let matches = [];
let activeFilter = "all";

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function loadMatches() {
  try {
    matchesElement.innerHTML = "<p>Maçlar yükleniyor...</p>";

    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("API bağlantısı başarısız.");
    }

    const data = await response.json();
    matches = data.matches || [];

    renderMatches();
  } catch (error) {
    matchesElement.innerHTML =
      "<p>Maç verileri şu anda yüklenemiyor. Lütfen daha sonra tekrar deneyin.</p>";

    console.error(error);
  }
}

function renderMatches() {
  const filtered = matches.filter(match =>
    activeFilter === "all" || match.status === activeFilter
  );

  if (!filtered.length) {
    matchesElement.innerHTML =
      "<p>Bu kategoride maç bulunamadı.</p>";
    return;
  }

  matchesElement.innerHTML = filtered.map(match => {
    const isLive = match.status === "live";

    return `
      <article class="match-card">
        <div class="match-league">
          ${safe(match.competition || "FUTBOL")}
        </div>

        <div class="match-main">
          <div class="team">
            ${match.home_logo
              ? `<img src="${safe(match.home_logo)}" alt="">`
              : ""}
            <span>${safe(match.home)}</span>
          </div>

          <div class="score">
            ${match.home_score ?? "-"} - ${match.away_score ?? "-"}
          </div>

          <div class="team">
            <span>${safe(match.away)}</span>
            ${match.away_logo
              ? `<img src="${safe(match.away_logo)}" alt="">`
              : ""}
          </div>
        </div>

        <div class="match-status ${isLive ? "live" : ""}">
          ${isLive ? "● " : ""}
          ${safe(match.status_text || match.status || "")}
        </div>
      </article>
    `;
  }).join("");
}

document.querySelectorAll(".match-tabs button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelector(".match-tabs .selected")
      ?.classList.remove("selected");

    button.classList.add("selected");
    activeFilter = button.dataset.filter;

    renderMatches();
  });
});

loadMatches();

// Verileri 60 saniyede bir yenile.
setInterval(loadMatches, 60000);
