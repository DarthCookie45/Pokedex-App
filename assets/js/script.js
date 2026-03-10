/* -- DOM elements -- */
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const randomBtn = document.getElementById("randomBtn");
const historyContainer = document.getElementById("history");

const spriteContainer = document.getElementById("spriteContainer");
const pokemonName = document.getElementById("pokemonName");
const pokemonTypes = document.getElementById("pokemonTypes");
const pokemonId = document.getElementById("pokemonId");
const pokemonHabitat = document.getElementById("pokemonHabitat");
const abilitiesList = document.getElementById("pokemonAbilities");
const statsContainer = document.getElementById("pokemonStats");
const weaknessesContainer = document.getElementById("pokemonWeaknesses");
const evolutionDiv = document.getElementById("pokemonEvolution");

let searchHistory = [];

/* -- Event listeners -- */
searchBtn.addEventListener("click", () => {
  const q = String(searchInput.value || "").trim();
  if (!q) return showError("Please type a Pokémon name or dex number (1 - 1025)");
  fetchPokemon(q);
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});
randomBtn.addEventListener("click", () => {
  const randomId = Math.floor(Math.random() * 1025) + 1;
  fetchPokemon(randomId);
});

/* -- Fetch pipeline -- */
async function fetchPokemon(nameOrId) {
  clearAllLoading();
  const query = String(nameOrId).trim();
  const urlSafe = encodeURIComponent(query);

  try {
    const pRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${urlSafe}`);
    if (!pRes.ok) throw new Error("Pokémon not found");
    const pokemon = await pRes.json();

    let speciesData = null;
    try {
      const sRes = await fetch(pokemon.species.url);
      if (sRes.ok) speciesData = await sRes.json();
    } catch (e) {}

    let evoData = null;
    if (speciesData && speciesData.evolution_chain?.url) {
      try {
        const evoRes = await fetch(speciesData.evolution_chain.url);
        if (evoRes.ok) evoData = await evoRes.json();
      } catch (e) {}
    }

    renderPokemonCard(pokemon, speciesData, evoData);
    updateHistory(pokemon.name);
  } catch (err) {
    console.error(err);
    showError(err.message || "Error fetching Pokémon");
  }
}

/* -- Render helpers -- */
function renderPokemonCard(pokemon, speciesData, evoData) {
  /*-- Sprites --*/
  spriteContainer.innerHTML = "";
  const front = pokemon.sprites?.front_default;
  const shiny = pokemon.sprites?.front_shiny;
  if (front) spriteContainer.insertAdjacentHTML("beforeend", `<img src="${front}" alt="${pokemon.name}">`);
  if (shiny) spriteContainer.insertAdjacentHTML("beforeend", `<img src="${shiny}" alt="${pokemon.name} shiny">`);
  if (!front && !shiny) spriteContainer.textContent = "No image";

  /* -- Basic info -- */
  pokemonName.textContent = capitalize(pokemon.name);
  pokemonId.textContent = pokemon.id ? `#${pokemon.id}` : "Unknown";
  pokemonTypes.textContent = pokemon.types?.length ? pokemon.types.map(t => capitalize(t.type.name)).join(", ") : "Unknown";
  pokemonHabitat.textContent = speciesData?.habitat ? capitalize(speciesData.habitat.name) : "Unknown";

  /* -- Abilities -- */
  abilitiesList.innerHTML = pokemon.abilities?.length
    ? pokemon.abilities.map(a => `<li>${capitalize(a.ability.name)}${a.is_hidden ? " (hidden)" : ""}</li>`).join("")
    : "<li>Unknown</li>";

  /* -- Stats -- */
  statsContainer.innerHTML = "";
  pokemon.stats.forEach(s => {
    const value = s.base_stat;
    const cls = statColourClass(value);
    statsContainer.insertAdjacentHTML("beforeend", `
      <div class="stat-row">
        <span class="stat-name">${capitalize(s.stat.name)}</span>
        <div class="stat-bar">
          <div class="stat-fill ${cls}" data-value="${value}" style="width:0%"></div>
        </div>
        <span class="stat-val">${value}</span>
      </div>
    `);
  });
  requestAnimationFrame(() => animateStatFills());

  /* -- Weaknesses -- */
  weaknessesContainer.innerHTML = "<p>Loading...</p>";
  computeAndRenderWeaknesses(pokemon.types).then(html => {
    weaknessesContainer.innerHTML = html;
  }).catch(() => {
    weaknessesContainer.innerHTML = "<p>—</p>";
  });

  /* -- Evolution -- */
if (evoData?.chain) {
  const chainStr = flattenEvolutionChain(evoData.chain)
    .replace(/\b\w/g, char => char.toUpperCase());
  evolutionDiv.innerHTML = `<p>${chainStr}</p>`;
} else {
  evolutionDiv.innerHTML = "<p>No evolution data</p>";
}
}

/* -- Utility functions -- */
function clearAllLoading() {
  spriteContainer.innerHTML = "<p>Loading…</p>";
  pokemonName.textContent = "";
  pokemonId.textContent = "";
  pokemonTypes.textContent = "";
  pokemonHabitat.textContent = "";
  abilitiesList.innerHTML = "";
  statsContainer.innerHTML = "";
  weaknessesContainer.innerHTML = "";
  evolutionDiv.innerHTML = "";
}

function showError(msg = "Pokémon not found") {
  spriteContainer.innerHTML = "";
  pokemonName.textContent = msg;
  pokemonId.textContent = "";
  pokemonTypes.textContent = "";
  pokemonHabitat.textContent = "";
  abilitiesList.innerHTML = "<li>—</li>";
  statsContainer.innerHTML = "<p>—</p>";
  weaknessesContainer.innerHTML = "<p>—</p>";
  evolutionDiv.innerHTML = "<p>—</p>";
}

function animateStatFills() {
  document.querySelectorAll(".stat-fill").forEach(fill => {
    const val = Number(fill.dataset.value) || 0;
    const targetPercent = Math.min(val / 2, 100);
    requestAnimationFrame(() => { fill.style.width = targetPercent + "%"; });
  });
}

async function computeAndRenderWeaknesses(typesArray = []) {
  const typeNames = ["normal","fire","water","electric","grass","ice","fighting","poison",
    "ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"];
  const multipliers = {};
  typeNames.forEach(t => multipliers[t] = 1);

  for (const t of typesArray) {
    const res = await fetch(t.type.url);
    if (!res.ok) continue;
    const typeData = await res.json();
    typeData.damage_relations.double_damage_from.forEach(d => multipliers[d.name] *= 2);
    typeData.damage_relations.half_damage_from.forEach(d => multipliers[d.name] *= 0.5);
    typeData.damage_relations.no_damage_from.forEach(d => multipliers[d.name] *= 0);
  }

  const rows = typeNames.map(t => {
    const m = multipliers[t];
    const label = capitalize(t);
    let colourClass = "";
    if (m === 0) colourClass = "weak-immune";
    else if (m === 0.25 || m === 0.5) colourClass = "weak-resist";
    else if (m === 1) colourClass = "weak-neutral";
    else if (m === 2 || m === 4) colourClass = "weak-strong";
    return `<div class="weakness-item ${colourClass}"><strong>${label}</strong>: x${m}</div>`;
  }).join("");

  return `<div class="weakness-grid">${rows}</div>`;
}

function flattenEvolutionChain(chain) {
  function recurse(node) {
    let str = node.species.name;
    if (node.evolution_details?.length) {
      const d = node.evolution_details[0];
      const parts = [];
      if (d.min_level) parts.push(`Lv ${d.min_level}`);
      if (d.item) parts.push(d.item.name);
      if (d.trigger) parts.push(d.trigger.name);
      if (parts.length) str += ` (${parts.join(", ")})`;
    }
    if (node.evolves_to?.length) {
      return str + " → " + node.evolves_to.map(recurse).join(" / ");
    }
    return str;
  }
  return recurse(chain);
}

function updateHistory(name) {
  const key = String(name).trim().toLowerCase();
  searchHistory = searchHistory.filter(x => x !== key);
  searchHistory.unshift(key);
  if (searchHistory.length > 5) searchHistory.pop();
  historyContainer.innerHTML = "";
  searchHistory.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = capitalize(item);
    btn.addEventListener("click", () => fetchPokemon(item));
    historyContainer.appendChild(btn);
  });
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
function statColourClass(value) {
  if (value < 60) return "red";
  if (value < 90) return "yellow";
  if (value < 120) return "lightgreen";
  return "darkgreen";
}
