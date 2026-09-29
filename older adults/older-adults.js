const sourceFile = "data/produktion_Juli_2026.json";
const excluded = new Set([
  "Hydro pumped storage consumption", "Cross border electricity trading", "Load",
  "Residual load", "Renewable share of load", "Renewable share of generation"
]);
const categoryGroups = new Map([
  ["Wasserkraft", ["Hydro Run-of-River", "Hydro water reservoir", "Hydro pumped storage"]],
  ["Kohle", ["Fossil brown coal / lignite", "Fossil hard coal"]],
  ["Wind", ["Wind offshore", "Wind onshore"]],
  ["Gas", ["Fossil gas", "Fossil coal-derived gas"]],
  ["Sonstige", ["Others", "Waste", "Geothermal", "Fossil oil"]]
]);
const palette = ["#317873", "#5b9d75", "#93bd64", "#d5b84c", "#db8c42", "#c95c4b", "#8f5369", "#6b5b95", "#6c8496", "#a9a075", "#5793a2", "#ae6e4b", "#788f58", "#cb786d", "#4d7770"];
const color = d3.scaleOrdinal(palette);
const categoryColors = new Map([
  ["Kohle", "#9a7665"],
  ["Wasserkraft", "#69b8d1"],
  ["Biomasse", "#2f6b3f"],
  ["Wind", "#1f9aa5"],
  ["Gas", "#8b6fc4"],
  ["Kernkraft", "#6c8496"],
  ["Sonstige", "#6b6d70"],
  ["Solar", "#e0bd18"]
]);
const lineColors = new Map([
  ["Kohle", "var(--line-kohle)"], ["Wasserkraft", "var(--line-wasserkraft)"], ["Biomasse", "var(--line-biomasse)"], ["Wind", "var(--line-wind)"],
  ["Gas", "var(--line-gas)"], ["Kernkraft", "var(--line-kernkraft)"], ["Sonstige", "var(--line-sonstige)"], ["Solar", "var(--line-solar)"],
  ["Großspeicher", "var(--line-grossspeicher)"], ["Gewerbespeicher", "var(--line-gewerbespeicher)"], ["Heimspeicher", "var(--line-heimspeicher)"]
]);
const renewableKeys = new Set(["Wasserkraft", "Biomasse", "Wind", "Solar"]);
const germanNumber = d3.formatLocale({ decimal: ",", thousands: ".", grouping: [3] });
const formatPercent = germanNumber.format(".1f");
const formatMWh = germanNumber.format(",.0f");
const tooltip = d3.select("#tooltip");
// Remember the tooltip's normal place in the document so it can be moved back after fullscreen.
const tooltipHomeParent = tooltip.node().parentNode;
const tooltipHomeNext = tooltip.node().nextSibling;
const selectedLegendKeys = new Map();
const batteryColors = new Map([["Großspeicher", "#387fc1"], ["Gewerbespeicher", "#bd596d"], ["Heimspeicher", "#a87300"]]);
const savedTheme = localStorage.getItem("electricity-chart-theme") || "light";
const redrawFns = new Map();

function requestFullscreenCompat(element) {
  const request = element.requestFullscreen || element.webkitRequestFullscreen || element.msRequestFullscreen;
  request?.call(element);
}
function exitFullscreenCompat() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  exit?.call(document);
}
function fullscreenElementCompat() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
}
// Computes how tall a chart's drawing area can be while fullscreen, so it fills the screen instead of
// keeping its normal (capped) height. Measured directly from the surrounding elements' real layout —
// the chart <div> itself is excluded from the math (it's typically empty/just-cleared at this point),
// so this doesn't depend on flex-grow or any CSS timing having already resized it.
function computeFullscreenChartHeight(panel) {
  const heading = panel.querySelector(".chart-heading");
  const footer = panel.querySelector(".chart-footer");
  if (!heading || !footer) return null;
  const source = panel.querySelector(".chart-source");
  const panelPaddingBottom = parseFloat(getComputedStyle(panel).paddingBottom) || 0;
  const panelBottomInner = panel.getBoundingClientRect().bottom - panelPaddingBottom;
  const topOfChartArea = heading.getBoundingClientRect().bottom;
  const footerHeight = footer.getBoundingClientRect().height;
  const sourceHeight = source ? source.getBoundingClientRect().height : 0;
  const breathingRoom = 10;
  return Math.max(320, Math.floor(panelBottomInner - topOfChartArea - footerHeight - sourceHeight - breathingRoom));
}

let lastFullscreenChartId = null;
d3.selectAll(".fullscreen-chart").on("click", function() {
  lastFullscreenChartId = this.dataset.chartId;
  if (fullscreenElementCompat()) exitFullscreenCompat();
  else requestFullscreenCompat(this.closest(".chart-panel"));
});
["fullscreenchange", "webkitfullscreenchange", "msfullscreenchange"].forEach(eventName => {
  document.addEventListener(eventName, () => {
    const activePanel = fullscreenElementCompat();
    d3.selectAll(".fullscreen-chart").each(function() {
      const isActive = this.closest(".chart-panel") === activePanel;
      d3.select(this).text(isActive ? "Vollbild verlassen" : "Vollbild").attr("aria-pressed", isActive);
    });
    // The browser only paints the fullscreen element and its descendants, so the shared tooltip
    // (normally a sibling at the end of <body>) needs to move inside the fullscreen panel to stay visible,
    // and move back out again afterwards. Positioning itself is unaffected (tooltip uses position: fixed).
    tooltip.style("opacity", 0);
    if (activePanel) activePanel.appendChild(tooltip.node());
    else tooltipHomeParent.insertBefore(tooltip.node(), tooltipHomeNext);
    // Re-render the chart whose panel just changed size so it fills (or returns from) the fullscreen view;
    // all other interactive behaviour (tooltips, legend, zoom controls, slider) is untouched since it re-attaches via the normal render path.
    if (lastFullscreenChartId) requestAnimationFrame(() => redrawFns.get(lastFullscreenChartId)?.());
  });
});

function setTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  d3.selectAll(".theme-option").classed("is-active", function() { return this.dataset.theme === theme; }).attr("aria-pressed", function() { return this.dataset.theme === theme; });
  localStorage.setItem("electricity-chart-theme", theme);
}

setTheme(savedTheme);
d3.selectAll(".theme-option").on("click", function() { setTheme(this.dataset.theme); });
d3.selectAll(".reset-chart-highlights").on("click", function() {
  const chartId = this.dataset.chartId;
  selectedLegendKeys.delete(chartId);
  d3.select(`#${chartId}`).selectAll(".series, .load-line, .monthly-renewable-share-line").classed("is-dimmed", false).classed("is-selected", false);
  d3.select(`#${chartId.replace("-chart", "-legend")}`).selectAll(".legend-item").classed("is-dimmed", false).classed("is-selected", false);
  tooltip.style("opacity", 0);
});
const germanLocale = d3.timeFormatLocale({
  dateTime: "%A, der %e. %B %Y, %X",
  date: "%d.%m.%Y",
  time: "%H:%M:%S",
  periods: ["AM", "PM"],
  days: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
  shortDays: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
  months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  shortMonths: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
});

d3.json(sourceFile).then(data => {
  const loadSeries = data.series.find(item => item.name === "Load");
  const sourceSeries = data.series.filter(item => !excluded.has(item.name)).map(item => ({
    key: item.name,
    values: data.data.map(row => Math.max(0, Number(row.values[item.id]) || 0))
  }));
  const series = combineCategories(sourceSeries);
  const timestamps = data.data.map(row => new Date(row.timestamp));
  const rows = timestamps.map((date, index) => {
    const row = { date };
    series.forEach(item => { row[item.key] = item.values[index]; });
    row.Load = Math.max(0, Number(data.data[index].values[loadSeries.id]) || 0);
    return row;
  });
  const keys = series.map(item => item.key);
  color.domain(keys);
  const dailyRows = aggregateByDay(rows, keys);
  function setDailyChartType(chartType) {
    d3.selectAll(".daily-chart-type-option").classed("is-active", function() { return this.dataset.chartType === chartType; }).attr("aria-pressed", function() { return this.dataset.chartType === chartType; });
    d3.select("#daily-chart").selectAll("*").remove();
    d3.select("#daily-legend").selectAll("*").remove();
    renderChart("daily-chart", "daily-legend", "daily-summary", dailyRows, keys, "%d. %b %Y", "Tage", true, false, true, null, chartType, null, "%B %Y", null, true);
  }
  d3.selectAll(".daily-chart-type-option").on("click", function() { setDailyChartType(this.dataset.chartType); });
  setDailyChartType("area");
  redrawFns.set("daily-chart", () => setDailyChartType(d3.select(".daily-chart-type-option.is-active").attr("data-chart-type")));
  const windowSize = 7 * 24 * 4;
  const slider = d3.select("#interval-slider").attr("max", rows.length - windowSize);
  let intervalChartType = "area";
  function renderSelectedWeek(startIndex) {
    const weekRows = rows.slice(startIndex, startIndex + windowSize).map(row => {
      const energyRow = { date: row.date };
      keys.forEach(key => { energyRow[key] = row[key] * 0.25; });
      energyRow.Load = row.Load * 0.25;
      return energyRow;
    });
    d3.select("#interval-chart").selectAll("*").remove();
    d3.select("#interval-legend").selectAll("*").remove();
    renderChart("interval-chart", "interval-legend", "interval-summary", weekRows, keys, "%d. %b", "Intervalle", false, false, false, null, intervalChartType, "Load");
  }
  d3.selectAll(".interval-chart-type-option").on("click", function() {
    intervalChartType = this.dataset.chartType;
    d3.selectAll(".interval-chart-type-option").classed("is-active", function() { return this.dataset.chartType === intervalChartType; }).attr("aria-pressed", function() { return this.dataset.chartType === intervalChartType; });
    renderSelectedWeek(Number(slider.property("value")));
  });
  slider.on("input", function() { renderSelectedWeek(Number(this.value)); });
  renderSelectedWeek(0);
  redrawFns.set("interval-chart", () => renderSelectedWeek(Number(slider.property("value"))));
}).catch(error => {
  d3.selectAll(".summary").text("JSON-Daten konnten nicht geladen werden");
  d3.select(".charts").append("p").text(`Fehler: ${error.message}`);
});

d3.csv("data/batteriespeicher.csv", d3.autoType).then(data => {
  const rows = data.map(row => ({ ...row, Date: new Date(row.Date) })).filter(row => row.Date && row.Date.getFullYear() >= 2015).map(row => ({
    date: row.Date,
    "Großspeicher": row.Großspeicher,
    "Gewerbespeicher": row.Gewerbespeicher,
    "Heimspeicher": row.Heimspeicher
  }));
  const batteryKeys = ["Gewerbespeicher", "Großspeicher", "Heimspeicher"];
  function setBatteryChartType(chartType) {
    d3.selectAll(".battery-chart-type-option").classed("is-active", function() { return this.dataset.chartType === chartType; }).attr("aria-pressed", function() { return this.dataset.chartType === chartType; });
    d3.select("#battery-chart").selectAll("*").remove();
    d3.select("#battery-legend").selectAll("*").remove();
    renderChart("battery-chart", "battery-legend", "battery-summary", rows, batteryKeys, "%Y", "Monate", false, false, true, "GW", chartType);
  }
  d3.selectAll(".battery-chart-type-option").on("click", function() { setBatteryChartType(this.dataset.chartType); });
  setBatteryChartType("area");
  redrawFns.set("battery-chart", () => setBatteryChartType(d3.select(".battery-chart-type-option.is-active").attr("data-chart-type")));
}).catch(error => {
  d3.select("#battery-summary").text("Batteriedaten konnten nicht geladen werden");
  d3.select("#battery-chart").text(`Fehler: ${error.message}`);
});

d3.json("data/production-shares-monthly-2015-2026-07.json").then(async data => {
  const renewableData = await d3.json("data/renewable-share-monthly.json");
  const renewableShares = new Map(renewableData.data.map(row => [row.date.slice(0, 7), Number(row.renewableShare) / 100]));
  const monthlySource = data.series.map(series => ({
    key: series.name,
    values: data.data.map(row => Number(row.shares[series.id]) || 0)
  }));
  const monthlySeries = combineCategories(monthlySource);
  const monthlyKeys = monthlySeries.map(series => series.key);
  const monthlyRows = data.data.map((row, index) => {
    const monthlyRow = { date: new Date(`${row.month}-01T00:00:00`), renewableShare: renewableShares.get(row.month) };
    monthlySeries.forEach(series => { monthlyRow[series.key] = series.values[index]; });
    return monthlyRow;
  });
  let showMonthlyRenewableShare = false;
  const monthlyRenewableHighlightKeys = new Set([...renewableKeys, "renewableShare"]);
  let monthlyAutoHighlightActive = false;
  function applyMonthlyAutoHighlight(chartType) {
    const shouldAutoHighlight = showMonthlyRenewableShare && chartType === "line";
    if (shouldAutoHighlight) {
      selectedLegendKeys.set("monthly-chart", new Set(monthlyRenewableHighlightKeys));
      monthlyAutoHighlightActive = true;
    } else if (monthlyAutoHighlightActive) {
      selectedLegendKeys.delete("monthly-chart");
      monthlyAutoHighlightActive = false;
    }
  }
  function setMonthlyChartType(chartType) {
    d3.selectAll(".monthly-chart-type-option").classed("is-active", function() { return this.dataset.chartType === chartType; }).attr("aria-pressed", function() { return this.dataset.chartType === chartType; });
    d3.select("#monthly-chart").selectAll("*").remove();
    d3.select("#monthly-legend").selectAll("*").remove();
    const visibleKeys = showMonthlyRenewableShare && chartType === "area" ? [...monthlyKeys.filter(key => renewableKeys.has(key)), "Kohle", ...monthlyKeys.filter(key => !renewableKeys.has(key) && key !== "Kohle")] : monthlyKeys;
    const tooltipExtra = showMonthlyRenewableShare ? { key: "renewableShare", label: "Anteil erneuerbarer Energien", color: "#17221f" } : null;
    applyMonthlyAutoHighlight(chartType);
    renderChart("monthly-chart", "monthly-legend", "monthly-summary", monthlyRows, visibleKeys, "%b %Y", "Monate", true, false, true, null, chartType, null, "%B %Y", "%B %Y", false, monthlyKeys, tooltipExtra);
    if (showMonthlyRenewableShare) renderMonthlyRenewableShareLine(monthlyRows, chartType);
  }
  d3.selectAll(".monthly-chart-type-option").on("click", function() { setMonthlyChartType(this.dataset.chartType); });
  d3.select("#show-monthly-renewable-share").property("checked", false);
  d3.select("#show-monthly-renewable-share").on("change", function() { showMonthlyRenewableShare = this.checked; setMonthlyChartType(d3.select(".monthly-chart-type-option.is-active").attr("data-chart-type")); });
  setMonthlyChartType("area");
  redrawFns.set("monthly-chart", () => setMonthlyChartType(d3.select(".monthly-chart-type-option.is-active").attr("data-chart-type")));
}).catch(error => {
  d3.select("#monthly-summary").text("Monatliche Erzeugungsdaten konnten nicht geladen werden");
  d3.select("#monthly-chart").text(`Fehler: ${error.message}`);
});

d3.json("data/renewable-share-monthly.json").then(data => {
  const rows = data.data.map(row => ({ date: new Date(`${row.date}T00:00:00`), value: Number(row.renewableShare) })).filter(row => Number.isFinite(row.value));
  function setRenewableChartType(chartType) {
    d3.selectAll(".renewable-chart-type-option").classed("is-active", function() { return this.dataset.chartType === chartType; }).attr("aria-pressed", function() { return this.dataset.chartType === chartType; });
    d3.select("#renewable-chart").selectAll("*").remove();
    renderRenewableShareChart(rows, chartType);
  }
  d3.selectAll(".renewable-chart-type-option").on("click", function() { setRenewableChartType(this.dataset.chartType); });
  setRenewableChartType("line");
}).catch(error => {
  d3.select("#renewable-summary").text("Daten zu erneuerbaren Energien konnten nicht geladen werden");
  d3.select("#renewable-chart").text(`Fehler: ${error.message}`);
});

function combineCategories(series) {
  const groupedNames = new Set(Array.from(categoryGroups.values()).flat());
  const combined = [];
  categoryGroups.forEach((members, category) => {
    const memberSeries = series.filter(item => members.includes(item.key));
    if (memberSeries.length) {
      combined.push({ key: category, values: memberSeries[0].values.map((_, index) => d3.sum(memberSeries, item => item.values[index])) });
    }
  });
  series.filter(item => !groupedNames.has(item.key)).forEach(item => combined.push(item));
  const labels = new Map([["Biomass", "Biomasse"], ["Nuclear", "Kernkraft"]]);
  const desiredOrder = ["Kernkraft", "Biomasse", "Sonstige", "Wasserkraft", "Gas", "Kohle", "Wind", "Solar"];
  return combined.map(item => ({ ...item, key: labels.get(item.key) || item.key })).sort((a, b) => desiredOrder.indexOf(a.key) - desiredOrder.indexOf(b.key));
}

function aggregateByDay(rows, keys) {
  return Array.from(d3.group(rows, row => d3.timeDay.floor(row.date).getTime()), ([, dayRows]) => {
    const row = { date: d3.timeDay.floor(dayRows[0].date) };
    keys.forEach(key => { row[key] = d3.mean(dayRows, item => item[key]); });
    return row;
  });
}

function renderMonthlyRenewableShareLine(rows, chartType) {
  // Read the main chart's actual rendered geometry (margin, width, height) instead of recomputing it here,
  // so this overlay always lines up exactly with the stacked area/line chart, even if renderChart's margin
  // calculation (e.g. the dynamic left margin sized to the y-axis labels) ever changes.
  const container = document.querySelector("#monthly-chart");
  const svg = d3.select(container).select("svg");
  const plot = svg.select("g");
  const [, transformLeft, transformTop] = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(plot.attr("transform")) || [];
  const marginLeft = Number(transformLeft) || 48;
  const marginTop = Number(transformTop) || 12;
  const marginRight = 12, marginBottom = 38; // must match renderChart's fixed right/bottom margins
  const svgWidth = Number(svg.attr("width"));
  const svgHeight = Number(svg.attr("height"));
  const x = d3.scaleTime().domain(d3.extent(rows, row => row.date)).range([0, svgWidth - marginLeft - marginRight]);
  const y = d3.scaleLinear().domain([0, 1]).range([svgHeight - marginTop - marginBottom, 0]);
  const lineColor = "var(--monthly-renewable-line)";
  const curve = chartType === "area" ? d3.curveStepAfter : d3.curveMonotoneX;
  plot.append("path").datum(rows.filter(row => Number.isFinite(row.renewableShare))).attr("class", "monthly-renewable-share-line").attr("fill", "none").attr("stroke", lineColor).attr("stroke-width", 3).attr("d", d3.line().x(row => x(row.date)).y(row => y(row.renewableShare)).curve(curve));
  const shareKey = "renewableShare";
  d3.select("#monthly-legend").append("div").datum(shareKey).attr("class", "legend-item").on("pointerenter", highlightShare).on("pointerleave", restoreSelectedHighlight).on("click", () => {
    const selectedKeys = selectedLegendKeys.get("monthly-chart") || new Set();
    if (selectedKeys.has(shareKey)) selectedKeys.delete(shareKey);
    else selectedKeys.add(shareKey);
    if (selectedKeys.size) selectedLegendKeys.set("monthly-chart", selectedKeys);
    else selectedLegendKeys.delete("monthly-chart");
    restoreSelectedHighlight();
  }).html(`<span class="swatch" style="background:${lineColor}"></span>Anteil erneuerbarer Energien`);

  function highlightShare() {
    d3.select(container).selectAll(".series").classed("is-dimmed", true).classed("is-selected", false);
    d3.select(container).selectAll(".monthly-renewable-share-line").classed("is-dimmed", false).classed("is-selected", true);
    d3.select("#monthly-legend").selectAll(".legend-item").classed("is-dimmed", key => key !== shareKey).classed("is-selected", key => key === shareKey);
  }

  function restoreSelectedHighlight() {
    const selectedKeys = selectedLegendKeys.get("monthly-chart") || new Set();
    d3.select(container).selectAll(".series").classed("is-dimmed", layer => selectedKeys.size && !selectedKeys.has(layer.key)).classed("is-selected", layer => selectedKeys.has(layer.key));
    d3.select(container).selectAll(".monthly-renewable-share-line").classed("is-dimmed", selectedKeys.size && !selectedKeys.has(shareKey)).classed("is-selected", selectedKeys.has(shareKey));
    d3.select("#monthly-legend").selectAll(".legend-item").classed("is-dimmed", key => selectedKeys.size && !selectedKeys.has(key)).classed("is-selected", key => selectedKeys.has(key));
  }
  restoreSelectedHighlight();
}

function renderRenewableShareChart(rows, chartType) {
  const margin = { top: 12, right: 12, bottom: 38, left: 48 };
  const container = document.querySelector("#renewable-chart");
  const width = container.clientWidth;
  const height = Math.max(390, Math.min(560, width * .42));
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const x = d3.scaleTime().domain(d3.extent(rows, row => row.date)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height).attr("role", "img").attr("aria-label", `${chartType === "bar" ? "Balkendiagramm" : "Liniendiagramm"} des monatlichen Anteils erneuerbarer Energien an der Stromerzeugung seit 2015`);
  const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  plot.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""));
  if (chartType === "bar") {
    const barWidth = Math.max(1, d3.min(rows.slice(1), (row, index) => x(row.date) - x(rows[index].date)) - 1);
    plot.selectAll(".renewable-bar").data(rows).join("rect").attr("class", "renewable-bar").attr("x", row => Math.max(0, x(row.date) - barWidth / 2)).attr("y", row => y(row.value)).attr("width", barWidth).attr("height", row => innerHeight - y(row.value)).attr("fill", "#2c964f");
  } else {
    plot.append("path").datum(rows).attr("fill", "none").attr("stroke", "var(--renewable-share-line)").attr("stroke-width", 3).attr("d", d3.line().x(row => x(row.date)).y(row => y(row.value)).curve(d3.curveMonotoneX));
  }
  plot.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(width < 600 ? 4 : 7).tickFormat(germanLocale.format("%Y")));
  plot.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(value => `${value} %`));
  const focus = plot.append("line").attr("class", "focus-line").attr("y1", 0).attr("y2", innerHeight).style("display", "none");
  plot.append("rect").attr("width", innerWidth).attr("height", innerHeight).attr("fill", "transparent").on("pointermove", function(event) {
    const index = d3.leastIndex(rows, row => Math.abs(row.date - x.invert(d3.pointer(event, plot.node())[0])));
    const row = rows[index];
    focus.attr("x1", x(row.date)).attr("x2", x(row.date)).style("display", null);
    tooltip.html(`<strong>${germanLocale.format("%B %Y")(row.date)}</strong><div class="tooltip-row"><span><i class="tooltip-dot" style="background:#2c964f"></i>Erneuerbare Energien</span><span>${formatPercent(row.value)} %</span></div>`).style("left", `${event.clientX}px`).style("top", `${event.clientY}px`).style("opacity", 1);
  }).on("pointerleave", () => { focus.style("display", "none"); tooltip.style("opacity", 0); });
  const dateRange = `${germanLocale.format("%B %Y")(rows[0].date)} – ${germanLocale.format("%B %Y")(rows.at(-1).date)}`;
  d3.select("#renewable-summary").text(dateRange);
}

function renderChart(chartId, legendId, summaryId, rows, keys, tickFormat, summaryLabel, normalized, showCount = true, stepped = false, unit = null, chartType = "area", overlayKey = null, summaryDateFormat = null, tooltipDateFormat = null, summarySingleDate = false, legendKeys = keys, tooltipExtra = null) {
  const stack = d3.stack().keys(keys);
  const layers = (normalized ? stack.offset(d3.stackOffsetExpand) : stack)(rows);
  const margin = { top: 12, right: 12, bottom: 38, left: 48 };
  const container = document.querySelector(`#${chartId}`);
  const panel = container.closest(".chart-panel");
  const isFullscreen = panel === fullscreenElementCompat();
  const width = container.clientWidth;
  const height = isFullscreen ? (computeFullscreenChartHeight(panel) ?? Math.max(390, Math.min(560, width * .42))) : Math.max(390, Math.min(560, width * .42));
  const innerHeight = height - margin.top - margin.bottom;
  const yMax = normalized ? 1 : d3.max([d3.max(layers, layer => d3.max(layer, point => point[1])), overlayKey && d3.max(rows, row => row[overlayKey])]);
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);
  const yTickFormat = d => normalized ? `${d * 100} %` : `${formatMWh(d)} ${unit || "MWh"}`;
  const ariaLabel = unit === "GW" ? "Entwicklung der Batteriespeicher in Gigawatt" : normalized ? "Anteile der Stromerzeugung" : "Stromerzeugung in MWh im 15-Minuten-Takt";
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height).attr("role", "img").attr("aria-label", ariaLabel);
  const measureGroup = svg.append("g").attr("class", "axis").style("visibility", "hidden");
  const maxLabelWidth = d3.max(y.ticks(5), tickValue => {
    const textNode = measureGroup.append("text").text(yTickFormat(tickValue)).node();
    return textNode.getComputedTextLength();
  }) || 0;
  measureGroup.remove();
  margin.left = Math.max(48, Math.ceil(maxLabelWidth) + 20);
  const innerWidth = width - margin.left - margin.right;
  const x = d3.scaleTime().domain(d3.extent(rows, row => row.date)).range([0, innerWidth]);
  const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const area = d3.area().x((point, index) => x(rows[index].date)).y0(point => y(point[0])).y1(point => y(point[1])).curve(stepped ? d3.curveStepAfter : d3.curveMonotoneX);
  plot.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""));
  if (chartType === "line") {
    const line = d3.line().x((point, index) => x(rows[index].date)).y(point => y(point[1] - point[0])).curve(d3.curveMonotoneX);
    plot.selectAll(".line-series").data(layers, layer => layer.key).join("path").attr("class", "series line-series").attr("stroke", layer => lineColors.get(layer.key) || batteryColors.get(layer.key) || categoryColors.get(layer.key) || color(layer.key)).attr("d", line).on("pointerenter", function(event, layer) { highlight(new Set([layer.key])); showTooltip(event, layers, rows, nearestIndex(event), normalized, unit, tooltipDateFormat, tooltipExtra, overlayKey, selectedLegendKeys.get(chartId) || new Set()); }).on("pointermove", event => showTooltip(event, layers, rows, nearestIndex(event), normalized, unit, tooltipDateFormat, tooltipExtra, overlayKey, selectedLegendKeys.get(chartId) || new Set())).on("pointerleave", () => { const activeKeys = selectedLegendKeys.get(chartId) || new Set(); if (activeKeys.size) highlight(activeKeys); else clearHighlight(); });
  } else {
    plot.selectAll(".area").data(layers, layer => layer.key).join("path").attr("class", stepped ? "series area stepped-area" : "series area").attr("fill", layer => batteryColors.get(layer.key) || categoryColors.get(layer.key) || color(layer.key)).attr("d", area).on("pointerenter", function(event, layer) { highlight(new Set([layer.key])); showTooltip(event, layers, rows, nearestIndex(event), normalized, unit, tooltipDateFormat, tooltipExtra, overlayKey, selectedLegendKeys.get(chartId) || new Set()); }).on("pointermove", event => showTooltip(event, layers, rows, nearestIndex(event), normalized, unit, tooltipDateFormat, tooltipExtra, overlayKey, selectedLegendKeys.get(chartId) || new Set())).on("pointerleave", () => { const activeKeys = selectedLegendKeys.get(chartId) || new Set(); if (activeKeys.size) highlight(activeKeys); else clearHighlight(); });
  }
  if (overlayKey) plot.append("path").datum(rows).attr("class", "load-line").attr("fill", "none").attr("stroke", "var(--load-line)").attr("stroke-width", 3).attr("d", d3.line().x(row => x(row.date)).y(row => y(row[overlayKey])).curve(d3.curveMonotoneX));
  plot.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(width < 600 ? 4 : 7).tickFormat(germanLocale.format(tickFormat)));
  plot.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(yTickFormat));
  const focus = plot.append("line").attr("class", "focus-line").attr("y1", 0).attr("y2", innerHeight).style("display", "none");
  plot.append("rect").attr("width", innerWidth).attr("height", innerHeight).attr("fill", "transparent").on("pointermove", function(event) { const index = nearestIndex(event); focus.attr("x1", x(rows[index].date)).attr("x2", x(rows[index].date)).style("display", null); showTooltip(event, layers, rows, index, normalized, unit, tooltipDateFormat, tooltipExtra, overlayKey, selectedLegendKeys.get(chartId) || new Set()); }).on("pointerleave", () => { focus.style("display", "none"); tooltip.style("opacity", 0); });
  const dateFormat = summaryDateFormat || (unit === "GW" ? "%B %Y" : "%d. %B %Y");
  const dateRange = summarySingleDate ? germanLocale.format(dateFormat)(rows[0].date) : `${germanLocale.format(dateFormat)(rows[0].date)} – ${germanLocale.format(dateFormat)(rows.at(-1).date)}`;
  d3.select(`#${summaryId}`).html(showCount ? `<strong>${rows.length} ${summaryLabel}</strong>${dateRange}` : dateRange);
  const selectedKeys = selectedLegendKeys.get(chartId) || new Set();
  d3.select(`#${legendId}`).selectAll(".legend-item").data(overlayKey ? [...legendKeys, overlayKey] : legendKeys).join("div").attr("class", "legend-item").on("pointerenter", (_, key) => highlight(new Set([key]))).on("pointerleave", () => { const activeKeys = selectedLegendKeys.get(chartId) || new Set(); if (activeKeys.size) highlight(activeKeys); else clearHighlight(); }).on("click", (_, key) => { const activeKeys = selectedLegendKeys.get(chartId) || new Set(); if (activeKeys.has(key)) activeKeys.delete(key); else activeKeys.add(key); if (activeKeys.size) selectedLegendKeys.set(chartId, activeKeys); else selectedLegendKeys.delete(chartId); if (activeKeys.size) highlight(activeKeys); else clearHighlight(); }).html(key => `<span class="swatch" style="background:${key === overlayKey ? "var(--load-line)" : batteryColors.get(key) || categoryColors.get(key) || color(key)}"></span>${key === "Load" ? "Verbrauch" : key}`);
  function nearestIndex(event) { return d3.leastIndex(rows, row => Math.abs(row.date - x.invert(d3.pointer(event, plot.node())[0]))); }
  function highlight(keysToHighlight) { plot.selectAll(".series").classed("is-dimmed", layer => !keysToHighlight.has(layer.key)).classed("is-selected", layer => keysToHighlight.has(layer.key)); plot.selectAll(".load-line").classed("is-dimmed", !keysToHighlight.has(overlayKey)); plot.selectAll(".monthly-renewable-share-line").classed("is-dimmed", !keysToHighlight.has("renewableShare")).classed("is-selected", keysToHighlight.has("renewableShare")); d3.select(`#${legendId}`).selectAll(".legend-item").classed("is-dimmed", legendKey => !keysToHighlight.has(legendKey)).classed("is-selected", legendKey => keysToHighlight.has(legendKey)); }
  function clearHighlight() { plot.selectAll(".series, .load-line, .monthly-renewable-share-line").classed("is-dimmed", false).classed("is-selected", false); d3.select(`#${legendId}`).selectAll(".legend-item").classed("is-dimmed", false).classed("is-selected", false); }
  if (selectedKeys.size) highlight(selectedKeys);
}

function showTooltip(event, layers, rows, index, normalized, unit = null, tooltipDateFormat = null, tooltipExtra = null, overlayKey = null, selectedKeys = new Set()) {
  const values = layers.map(layer => ({ name: layer.key, value: layer[index][1] - layer[index][0] })).filter(item => item.value > 0 && (!selectedKeys.size || selectedKeys.has(item.name))).sort((a, b) => b.value - a.value);
  const dateFormat = tooltipDateFormat || (unit === "GW" ? "%B %Y" : rows.length <= 100 ? "%d. %b %Y" : "%d. %b · %H:%M Uhr");
  const extra = tooltipExtra && selectedKeys.has(tooltipExtra.key) && Number.isFinite(rows[index][tooltipExtra.key]) ? `<div class="tooltip-row"><span><i class="tooltip-dot" style="background:${tooltipExtra.color}"></i>${tooltipExtra.label}</span><span>${formatPercent(rows[index][tooltipExtra.key] * 100)} %</span></div>` : "";
  const overlayRow = overlayKey && Number.isFinite(rows[index][overlayKey]) && (!selectedKeys.size || selectedKeys.has(overlayKey)) ? `<div class="tooltip-row"><span><i class="tooltip-dot" style="background:var(--load-line)"></i>${overlayKey === "Load" ? "Verbrauch" : overlayKey}</span><span>${normalized ? `${formatPercent(rows[index][overlayKey] * 100)} %` : `${formatMWh(rows[index][overlayKey])} ${unit || "MWh"}`}</span></div>` : "";
  tooltip.html(`<strong>${germanLocale.format(dateFormat)(rows[index].date)}</strong>${values.map(item => `<div class="tooltip-row"><span><i class="tooltip-dot" style="background:${batteryColors.get(item.name) || categoryColors.get(item.name) || color(item.name)}"></i>${item.name}</span><span>${normalized ? `${formatPercent(item.value * 100)} %` : `${formatMWh(item.value)} ${unit || "MWh"}`}</span></div>`).join("")}${overlayRow}${extra}`).style("left", `${event.clientX}px`).style("top", `${event.clientY}px`).style("opacity", 1);
}