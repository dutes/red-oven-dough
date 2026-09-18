/* ===== Red Oven Dough calculator ===== */

const FORMULA = {
  perBall: {
    doughGrams: 250,
    salt: { sea_salt: 3.3, table_salt: 2.7 },
    oilMl: 5,
    oilGramsPerMl: 0.91,
  },
  baseHydration: 65, // percent of flour weight
  yeastRules: [
    { min: 2,  max: 3,  rate: 0.5  },
    { min: 3,  max: 5,  rate: 0.3  },
    { min: 5,  max: 8,  rate: 0.12 },
    { min: 8,  max: 12, rate: 0.08 },
    { min: 12, max: 24, rate: 0.04 },
    { min: 24, max: 72, rate: 0.02 },
  ],
  secondProofPercent: 0.30,
  minSecondProofMin: 60,
  maxSecondProofMin: 90,
  coldRetardThresholdHours: 12,
};

/* Flour modes:
   - 00bread: free blend of 00 + bread, base hydration
   - 00 / bread: single flour, base hydration
   - plain: lower-protein flour absorbs less water → 62%
   - wholemeal: 10–40% wholemeal + bread flour; bran drinks more
     water → +0.15% hydration per 1% wholemeal (20% → 68%) */
const FLOUR_MODES = {
  "00bread": {
    note: "00 flour brings tenderness; bread flour adds chew. A 50/50 blend is a good starting point.",
    hydration: () => FORMULA.baseHydration,
    split: (total, s) => ({ "00 flour": total * s.ratio00 / 100, "Bread flour": total * (100 - s.ratio00) / 100 }),
  },
  "00": {
    note: "A softer, more delicate dough made entirely with 00 flour.",
    hydration: () => FORMULA.baseHydration,
    split: (total) => ({ "00 flour": total }),
  },
  "bread": {
    note: "Bread flour gives the crust a little more structure and chew.",
    hydration: () => FORMULA.baseHydration,
    split: (total) => ({ "Bread flour": total }),
  },
  "plain": {
    note: "Plain flour makes a softer crust. Hydration drops to 62% to keep the dough manageable.",
    hydration: () => 62,
    split: (total) => ({ "Plain flour": total }),
  },
  "wholemeal": {
    note: "Wholemeal absorbs more water, so hydration rises with the blend. Keep it between 10% and 40%.",
    hydration: (s) => FORMULA.baseHydration + 0.15 * s.wholemealPct,
    split: (total, s) => ({ "Wholemeal flour": total * s.wholemealPct / 100, "Bread flour": total * (100 - s.wholemealPct) / 100 }),
  },
};

const FLOUR_EMOJI = {
  "00 flour": "✨", "Bread flour": "🍞", "Plain flour": "🥡", "Wholemeal flour": "🌾",
};

const state = {
  balls: 2,
  salt: "sea_salt",
  flourMode: "00bread",
  ratio00: 50,       // % of 00 in the 00+bread blend
  wholemealPct: 20,  // % wholemeal in the wholemeal blend
  hours: 5,          // proof window: now → pizza time
};

// Shared links store choices, not a fixed clock time. Each visitor gets their
// own schedule starting from when they open the link.
const sharedParams = new URLSearchParams(window.location.search);
function sharedNumber(key, min, max, step) {
  const raw = sharedParams.get(key);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  if (Math.abs((value - min) / step - Math.round((value - min) / step)) > 1e-9) return null;
  return value;
}
state.balls = sharedNumber("balls", 1, 12, 1) ?? state.balls;
state.ratio00 = sharedNumber("ratio", 0, 100, 5) ?? state.ratio00;
state.wholemealPct = sharedNumber("wholemeal", 10, 40, 5) ?? state.wholemealPct;
state.hours = sharedNumber("hours", 2, 72, 0.5) ?? state.hours;
if (["sea_salt", "table_salt"].includes(sharedParams.get("salt"))) state.salt = sharedParams.get("salt");
if (Object.hasOwn(FLOUR_MODES, sharedParams.get("flour"))) state.flourMode = sharedParams.get("flour");

function shareUrl() {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({
    balls: String(state.balls), salt: state.salt, flour: state.flourMode,
    ratio: String(state.ratio00), wholemeal: String(state.wholemealPct),
    hours: String(state.hours),
  }).toString();
  url.hash = "";
  return url.toString();
}

function update() {
  calculate();
  els.copyStatus.textContent = "";
  history.replaceState(null, "", shareUrl());
}

let latestRecipe;

// ---------- element refs ----------
const $ = (id) => document.getElementById(id);
const els = {
  ballCount: $("ballCount"), ballDisplay: $("ballDisplay"), ballRow: $("ballRow"),
  ballMinus: $("ballMinus"), ballPlus: $("ballPlus"),
  saltGroup: $("saltGroup"), flourGroup: $("flourGroup"),
  ratioRow: $("ratioRow"), ratioSlider: $("ratioSlider"), ratioLabel: $("ratioLabel"),
  wmRow: $("wmRow"), wmSlider: $("wmSlider"), wmLabel: $("wmLabel"),
  flourNote: $("flourNote"),
  hoursSlider: $("hoursSlider"), hoursDisplay: $("hoursDisplay"),
  hoursMinus: $("hoursMinus"), hoursPlus: $("hoursPlus"),
  readyNote: $("readyNote"),
  mamaMessage: $("mamaMessage"), results: $("results"),
  ingredientGrid: $("ingredientGrid"), timeline: $("timeline"), coldRetard: $("coldRetard"),
  copyRecipe: $("copyRecipe"), copyLink: $("copyLink"), copyStatus: $("copyStatus"),
};

// ---------- helpers ----------
function fmtTime(date) {
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (sameDay) return time;
  if (isTomorrow) return `tomorrow ${time}`;
  return `${date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
}

function fmtDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function fmtHours(h) {
  return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1)} h`;
}

function round1(n) { return Math.round(n * 10) / 10; }

function showMessage(html) {
  els.mamaMessage.innerHTML = html;
  els.mamaMessage.hidden = false;
  els.results.hidden = true;
}

// ---------- core calculation ----------
function calculate() {
  const start = new Date();
  const windowHours = state.hours;
  const ready = new Date(start.getTime() + windowHours * 3.6e6);

  els.readyNote.textContent = `🍕 Pizza time: ${fmtTime(ready)}`;

  // ingredients
  const n = state.balls;
  const mode = FLOUR_MODES[state.flourMode];
  const hydration = mode.hydration(state);
  const salt = FORMULA.perBall.salt[state.salt] * n;
  const oil = FORMULA.perBall.oilMl * n;

  const rule = FORMULA.yeastRules.find(
    (r, i) => windowHours >= r.min &&
      (windowHours < r.max || i === FORMULA.yeastRules.length - 1)
  );
  // Work backwards from the requested dough weight, including oil and yeast.
  const flourTotal = (FORMULA.perBall.doughGrams * n - salt - oil * FORMULA.perBall.oilGramsPerMl) /
    (1 + hydration / 100 + rule.rate / 100);
  const water = flourTotal * hydration / 100;
  const yeast = (rule.rate * flourTotal) / 100;

  const flours = mode.split(flourTotal, state);
  const ingredients = Object.entries(flours)
    .filter(([, g]) => g > 0)
    .map(([name, g]) => ({ emoji: FLOUR_EMOJI[name], amount: `${Math.round(g)} g`, name }));

  ingredients.push(
    { emoji: "💧", amount: `${Math.round(water)} ml`, name: `Water (${round1(hydration)}% hydration)` },
    { emoji: "🧂", amount: `${round1(salt)} g`, name: state.salt === "sea_salt" ? "Sea salt" : "Table salt" },
    { emoji: "🦠", amount: `${Math.round(yeast * 100) / 100} g`, name: "Instant yeast" },
    { emoji: "🫒", amount: `${Math.round(oil)} ml`, name: "Olive oil" },
    { emoji: "⚖️", amount: `${FORMULA.perBall.doughGrams * n} g`, name: `Approx. total dough (${n} ball${n > 1 ? "s" : ""})` },
  );

  els.ingredientGrid.innerHTML = ingredients.map((i) => `
    <div class="ingredient">
      <span class="emoji">${i.emoji}</span>
      <span class="amount">${i.amount}</span>
      <span class="name">${i.name}</span>
    </div>`).join("");

  // Short ferments finish at room temperature. Long ferments spend most of the wait cold.
  const windowMin = windowHours * 60;
  const secondProofMin = Math.min(
    Math.max(windowMin * FORMULA.secondProofPercent, FORMULA.minSecondProofMin),
    FORMULA.maxSecondProofMin
  );
  const coldRetard = windowHours > FORMULA.coldRetardThresholdHours;
  const bulkMin = coldRetard ? 60 : windowMin - secondProofMin;
  const ballTime = new Date(start.getTime() + bulkMin * 60000);
  const warmTime = new Date(ready.getTime() - 105 * 60000);
  const fridgeMin = (warmTime.getTime() - ballTime.getTime()) / 60000;

  const steps = [
    { emoji: "🥣", title: "Mix and knead", time: start, detail: "Combine the ingredients and knead until the dough is smooth." },
    { emoji: "🫧", title: "Bulk ferment", time: null, detail: `Cover and rest at room temperature for ${fmtDuration(bulkMin)}.` },
    { emoji: "🍡", title: "Divide and ball", time: ballTime, detail: `Shape ${n} dough ball${n > 1 ? "s" : ""} of about 250 g each.` },
    ...(coldRetard ? [{ emoji: "❄️", title: "Refrigerate", time: null, detail: `Cover the balls and refrigerate for about ${fmtDuration(fridgeMin)}.` }] : []),
    { emoji: "⏰", title: coldRetard ? "Warm the dough" : "Second proof", time: coldRetard ? warmTime : null, detail: coldRetard ? "Take the balls out of the fridge 1 hour 45 minutes before baking." : `Let the balls rest for ${fmtDuration(secondProofMin)}.` },
    { emoji: "🍕", title: "Ready to stretch", time: ready, detail: "Stretch, top, and bake." },
  ];
  latestRecipe = { ingredients, steps, ready, windowHours, n };

  els.timeline.innerHTML = steps.map((s) => `
    <li>
      <span class="step-emoji">${s.emoji}</span>
      <div class="step-body">
        <strong>${s.title}</strong>
        ${s.time ? ` — <span class="step-time">${fmtTime(s.time)}</span>` : ""}
        <div class="step-detail">${s.detail}</div>
      </div>
    </li>`).join("");

  els.coldRetard.hidden = !coldRetard;
  els.mamaMessage.hidden = true;
  els.results.hidden = false;
}

// ---------- UI wiring ----------
function renderBalls() {
  els.ballDisplay.textContent = state.balls;
  els.ballCount.value = state.balls;
  els.ballRow.textContent = "●".repeat(state.balls);
}

function setBalls(n) {
  state.balls = Math.min(12, Math.max(1, n));
  renderBalls();
  update();
}

els.ballMinus.addEventListener("click", () => setBalls(state.balls - 1));
els.ballPlus.addEventListener("click", () => setBalls(state.balls + 1));
els.ballCount.addEventListener("input", () => setBalls(Number(els.ballCount.value)));

els.saltGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  els.saltGroup.querySelectorAll(".pill").forEach((p) => { p.classList.remove("selected"); p.setAttribute("aria-pressed", "false"); });
  btn.classList.add("selected");
  btn.setAttribute("aria-pressed", "true");
  state.salt = btn.dataset.value;
  update();
});

function renderFlourControls() {
  els.ratioRow.hidden = state.flourMode !== "00bread";
  els.wmRow.hidden = state.flourMode !== "wholemeal";
  els.ratioLabel.textContent = `${state.ratio00}% 00 / ${100 - state.ratio00}% bread`;
  els.wmLabel.textContent = `${state.wholemealPct}% wholemeal / ${100 - state.wholemealPct}% bread`;
  els.flourNote.textContent = FLOUR_MODES[state.flourMode].note;
}

els.flourGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  els.flourGroup.querySelectorAll(".pill").forEach((p) => { p.classList.remove("selected"); p.setAttribute("aria-pressed", "false"); });
  btn.classList.add("selected");
  btn.setAttribute("aria-pressed", "true");
  state.flourMode = btn.dataset.value;
  renderFlourControls();
  update();
});

els.ratioSlider.addEventListener("input", () => {
  state.ratio00 = Number(els.ratioSlider.value);
  renderFlourControls();
  update();
});

els.wmSlider.addEventListener("input", () => {
  state.wholemealPct = Number(els.wmSlider.value);
  renderFlourControls();
  update();
});

function renderHours() {
  els.hoursDisplay.textContent = fmtHours(state.hours);
  els.hoursSlider.value = state.hours;
}

function setHours(h) {
  state.hours = Math.min(72, Math.max(2, h));
  renderHours();
  update();
}

els.hoursMinus.addEventListener("click", () => setHours(state.hours - 1));
els.hoursPlus.addEventListener("click", () => setHours(state.hours + 1));
els.hoursSlider.addEventListener("input", () => setHours(Number(els.hoursSlider.value)));

function recipeText() {
  const { ingredients, steps, ready, windowHours, n } = latestRecipe;
  const ingredientLines = ingredients
    .filter((item) => !item.name.startsWith("Approx. total dough"))
    .map((item) => `- ${item.name}: ${item.amount}`);
  const stepLines = steps.map((step, index) =>
    `${index + 1}. ${step.title}${step.time ? ` (${fmtTime(step.time)})` : ""}: ${step.detail}`);
  return [
    `Red Oven Dough — ${n} × 250 g dough balls`,
    `Pizza ready in ${fmtHours(windowHours)} (around ${fmtTime(ready)})`,
    "", "Ingredients", ...ingredientLines,
    "", "Dough schedule", ...stepLines,
    "", "Timings are estimates; check the dough as it rises.",
  ].join("\n");
}

async function copyToClipboard(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
    els.copyStatus.textContent = successMessage;
  } catch {
    els.copyStatus.textContent = "Copy unavailable here. Try opening the site over HTTPS.";
  }
}
els.copyRecipe.addEventListener("click", () => copyToClipboard(recipeText(), "Recipe copied. Paste it into Discord or your notes."));
els.copyLink.addEventListener("click", () => copyToClipboard(shareUrl(), "Link copied with your current settings."));

// pizza time is "now + hours" — refresh every 30 s so the clock times stay honest
setInterval(calculate, 30000);

// ---------- init ----------
renderBalls();
function renderSelection(group, selectedValue) {
  group.querySelectorAll(".pill").forEach((button) => {
    const selected = button.dataset.value === selectedValue;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}
renderSelection(els.saltGroup, state.salt);
renderSelection(els.flourGroup, state.flourMode);
els.ratioSlider.value = state.ratio00;
els.wmSlider.value = state.wholemealPct;
renderFlourControls();
renderHours();
calculate();
