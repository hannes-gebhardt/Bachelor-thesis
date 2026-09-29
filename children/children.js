const categories = [
  { key: "Wind", label: "Wind", emoji: "💨", color: "var(--color-wind)" },
  { key: "Solar", label: "Sonne", emoji: "☀️", color: "var(--color-solar)" },
  { key: "SonstigeErneuerbare", label: "sonstige Erneuerbare", emoji: "🌱", color: "var(--color-erneuerbare-sonst)" },
  { key: "SonstigeFossile", label: "sonstige Fossile", emoji: "🪨", color: "var(--color-fossile-sonst)" }
];

// --- Diagramm 1: die vier Monate Januar, April, Juli und Oktober 2025 ---
const chartData = [
  { month: "Januar", label: "Januar", shares: { Wind: 33, Solar: 6, SonstigeErneuerbare: 13, SonstigeFossile: 48 } },
  { month: "April", label: "April", shares: { Wind: 18, Solar: 28, SonstigeErneuerbare: 14, SonstigeFossile: 40 } },
  { month: "Juli", label: "Juli", shares: { Wind: 20, Solar: 28, SonstigeErneuerbare: 15, SonstigeFossile: 37 } },
  { month: "Oktober", label: "Oktober", shares: { Wind: 38, Solar: 11, SonstigeErneuerbare: 12, SonstigeFossile: 39 } }
];

// --- Diagramm 2: dieselben vier Monate, im Vergleich über die Jahre 2016, 2019, 2022 und 2025 ---
const yearsData = {
  Winter: [
    { label: "2016", shares: { Wind: 17, Solar: 1, SonstigeErneuerbare: 10, SonstigeFossile: 72 } },
    { label: "2019", shares: { Wind: 25, Solar: 1, SonstigeErneuerbare: 11, SonstigeFossile: 63 } },
    { label: "2022", shares: { Wind: 29, Solar: 2, SonstigeErneuerbare: 11, SonstigeFossile: 58 } },
    { label: "2025", shares: { Wind: 33, Solar: 6, SonstigeErneuerbare: 13, SonstigeFossile: 48 } }
  ],
  Frühling: [
    { label: "2016", shares: { Wind: 13, Solar: 9, SonstigeErneuerbare: 13, SonstigeFossile: 65 } },
    { label: "2019", shares: { Wind: 19, Solar: 11, SonstigeErneuerbare: 13, SonstigeFossile: 57 } },
    { label: "2022", shares: { Wind: 24, Solar: 13, SonstigeErneuerbare: 12, SonstigeFossile: 51 } },
    { label: "2025", shares: { Wind: 18, Solar: 28, SonstigeErneuerbare: 14, SonstigeFossile: 40 } }
  ],
  Sommer: [
    { label: "2016", shares: { Wind: 10, Solar: 11, SonstigeErneuerbare: 14, SonstigeFossile: 65 } },
    { label: "2019", shares: { Wind: 14, Solar: 13, SonstigeErneuerbare: 13, SonstigeFossile: 60 } },
    { label: "2022", shares: { Wind: 16, Solar: 19, SonstigeErneuerbare: 14, SonstigeFossile: 51 } },
    { label: "2025", shares: { Wind: 20, Solar: 28, SonstigeErneuerbare: 15, SonstigeFossile: 37 } }
  ],
  Herbst: [
    { label: "2016", shares: { Wind: 10, Solar: 3, SonstigeErneuerbare: 11, SonstigeFossile: 76 } },
    { label: "2019", shares: { Wind: 23, Solar: 5, SonstigeErneuerbare: 12, SonstigeFossile: 60 } },
    { label: "2022", shares: { Wind: 25, Solar: 9, SonstigeErneuerbare: 15, SonstigeFossile: 51 } },
    { label: "2025", shares: { Wind: 38, Solar: 11, SonstigeErneuerbare: 12, SonstigeFossile: 39 } }
  ]
};
const seasonDates = { Winter: "Januar", Frühling: "April", Sommer: "Juli", Herbst: "Oktober" };
const seasons = ["Winter", "Frühling", "Sommer", "Herbst"];
const seasonEmoji = { Winter: "❄️", Frühling: "🌸", Sommer: "☀️", Herbst: "🍂" };

// --- Regler-Diagramme
const solarOnlyCategories = [
  { key: "Solar", label: "Sonne", emoji: "☀️", color: "var(--color-solar)" },
  { key: "SonstigeErneuerbare", label: "sonstige Erneuerbare", emoji: "🌱", color: "var(--color-erneuerbare-sonst)" },
  { key: "SonstigeFossile", label: "sonstige Fossile", emoji: "🪨", color: "var(--color-fossile-sonst)" }
];
const windOnlyCategories = [
  { key: "Wind", label: "Wind", emoji: "💨", color: "var(--color-wind)" },
  { key: "SonstigeErneuerbare", label: "sonstige Erneuerbare", emoji: "🌱", color: "var(--color-erneuerbare-sonst)" },
  { key: "SonstigeFossile", label: "sonstige Fossile", emoji: "🪨", color: "var(--color-fossile-sonst)" }
];

const exploreWidgets = [
  {
    prefix: "solar-explore",
    focusKey: "Solar",
    categoryList: solarOnlyCategories,
    unit: "Sonne",
    iconRange: [20, 78],
    low: { name: "Trüber Tag", label: "5. Jan. 2025", value: 1, shares: { Solar: 1, SonstigeErneuerbare: 60, SonstigeFossile: 39 } },
    high: { name: "Sonniger Tag", label: "20. Jun. 2025", value: 46, shares: { Solar: 46, SonstigeErneuerbare: 25, SonstigeFossile: 29 } }
  },
  {
    prefix: "wind-explore",
    focusKey: "Wind",
    categoryList: windOnlyCategories,
    unit: "Wind",
    iconRange: [20, 78],
    low: { name: "Windstiller Tag", label: "8. Nov. 2025", value: 3, shares: { Wind: 3, SonstigeErneuerbare: 23, SonstigeFossile: 74 } },
    high: { name: "Stürmischer Tag", label: "26. Okt. 2025", value: 68, shares: { Wind: 68, SonstigeErneuerbare: 18, SonstigeFossile: 14 } }
  }

];

function setupExploreWidget(config) {
  const { prefix, focusKey, categoryList, low, high, iconRange } = config;
  const slider = document.getElementById(`${prefix}-slider`);
  const iconEl = document.getElementById(`${prefix}-icon`);
  const percentEl = document.getElementById(`${prefix}-percent`);
  const barEl = document.getElementById(`${prefix}-bar`);
  const legendEl = document.getElementById(`${prefix}-legend`);
  const lowLabelEl = document.getElementById(`${prefix}-low-label`);
  const highLabelEl = document.getElementById(`${prefix}-high-label`);

  lowLabelEl.innerHTML = `${low.name}<br>(${low.label})`;
  highLabelEl.innerHTML = `${high.name}<br>(${high.label})`;

  const segmentEls = {};
  categoryList.forEach(category => {
    const segment = document.createElement("div");
    segment.className = "bar-segment explore-segment";
    segment.style.background = category.color;
    barEl.appendChild(segment);
    segmentEls[category.key] = segment;

    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-swatch" style="background:${category.color}"></span>${category.emoji} ${category.label}`;
    legendEl.appendChild(item);
  });

  function update() {
    const t = Number(slider.value) / 100;
    let focusValue = 0;
    categoryList.forEach(category => {
      const lo = low.shares[category.key] || 0;
      const hi = high.shares[category.key] || 0;
      const value = lo + (hi - lo) * t;
      segmentEls[category.key].style.height = `${value}%`;
      if (category.key === focusKey) focusValue = value;
    });
    percentEl.textContent = `${Math.round(focusValue)} %`;
    iconEl.style.fontSize = `${iconRange[0] + (iconRange[1] - iconRange[0]) * t}px`;
  }

  slider.addEventListener("input", update);
  update();
}

function renderExploreWidgets() {
  exploreWidgets.forEach(setupExploreWidget);
}

const tooltip = document.getElementById("tooltip");

function renderBarChart(chartEl, legendEl, categoryList, dataPoints, captionFor) {
  chartEl.innerHTML = "";
  legendEl.innerHTML = "";

  dataPoints.forEach(point => {
    const group = document.createElement("div");
    group.className = "bar-group";

    const barCol = document.createElement("div");
    barCol.className = "bar-col";

    categoryList.forEach(category => {
      const percent = point.shares[category.key] || 0;
      if (percent <= 0) return;
      const segment = document.createElement("button");
      segment.type = "button";
      segment.className = "bar-segment";
      segment.style.background = category.color;
      segment.style.height = `${percent}%`;
      segment.setAttribute("aria-label", `${category.label}: ${percent} Prozent, ${point.label}`);
      segment.addEventListener("pointerenter", event => showTooltip(event, category, percent, point));
      segment.addEventListener("pointermove", event => showTooltip(event, category, percent, point));
      segment.addEventListener("pointerleave", hideTooltip);
      segment.addEventListener("focus", event => showTooltip(event, category, percent, point));
      segment.addEventListener("blur", hideTooltip);
      barCol.appendChild(segment);
    });

    group.appendChild(barCol);

    const caption = document.createElement("p");
    caption.className = "bar-caption";
    caption.innerHTML = captionFor(point);
    group.appendChild(caption);

    chartEl.appendChild(group);
  });

  categoryList.forEach(category => {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-swatch" style="background:${category.color}"></span>${category.emoji} ${category.label}`;
    legendEl.appendChild(item);
  });
}

function showTooltip(event, category, percent, point) {
  tooltip.innerHTML = `${category.emoji} ${category.label}: ${percent} %<span>${point.label}</span>`;
  tooltip.style.left = `${event.clientX ?? event.target.getBoundingClientRect().left + event.target.offsetWidth / 2}px`;
  tooltip.style.top = `${event.clientY ?? event.target.getBoundingClientRect().top}px`;
  tooltip.style.opacity = 1;
}

function hideTooltip() {
  tooltip.style.opacity = 0;
}

function renderYearsChart(season) {
  const chartEl = document.getElementById("years-chart");
  const legendEl = document.getElementById("years-legend");
  renderBarChart(chartEl, legendEl, categories, yearsData[season], point => point.label);
}

function renderSeasonPicker() {
  const picker = document.getElementById("season-picker");
  seasons.forEach(season => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "season-button";
    button.textContent = `${seasonEmoji[season]} ${season}`;
    button.dataset.season = season;
    button.setAttribute("aria-pressed", season === "Winter" ? "true" : "false");
    if (season === "Winter") button.classList.add("is-active");
    button.addEventListener("click", () => {
      picker.querySelectorAll(".season-button").forEach(btn => {
        btn.classList.toggle("is-active", btn === button);
        btn.setAttribute("aria-pressed", btn === button ? "true" : "false");
      });
      renderYearsChart(season);
    });
    picker.appendChild(button);
  });
}

renderExploreWidgets();
renderBarChart(document.getElementById("mix-chart"), document.getElementById("mix-legend"), categories, chartData, point => point.month);
renderSeasonPicker();
renderYearsChart("Winter");