const COLORS = ["#c45c26", "#1f4f4a", "#3d4f7a", "#b0892e", "#6b3f69", "#4f6f54", "#8c4a3a", "#5a6b7a"];

let data = [];
let page = 0;
const PAGE = 8;
let algo = "kmeans";
let k = 5;
let view = "income-score";
let lastModel = null;
let clusterTimer = null;

const els = {
  gender: document.getElementById("filter-gender"),
  age: document.getElementById("filter-age"),
  ageLabel: document.getElementById("filter-age-label"),
  search: document.getElementById("filter-search"),
  count: document.getElementById("filter-count"),
  tbody: document.getElementById("table-body"),
  pageInfo: document.getElementById("page-info"),
  explore: document.getElementById("explore-chart"),
  cluster: document.getElementById("cluster-chart"),
  elbow: document.getElementById("elbow-chart"),
  sil: document.getElementById("sil-chart"),
  kSlider: document.getElementById("k-slider"),
  kValue: document.getElementById("k-value"),
  view: document.getElementById("view-select"),
  metrics: document.getElementById("cluster-metrics"),
  cards: document.getElementById("segment-cards"),
  hint: document.getElementById("algo-hint"),
  tooltip: document.getElementById("chart-tooltip"),
  dataMetrics: document.getElementById("data-metrics"),
  engine: document.getElementById("engine-badge"),
  dendroWrap: document.getElementById("dendro-wrap"),
  dendro: document.getElementById("dendrogram"),
};

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

function setupCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor((canvas.height / canvas.width) * rect.width));
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function niceRange(vals, pad = 0.08) {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  return [lo - span * pad, hi + span * pad];
}

function project(x, y, xr, yr, w, h, m = { l: 44, r: 16, t: 16, b: 36 }) {
  const px = m.l + ((x - xr[0]) / (xr[1] - xr[0])) * (w - m.l - m.r);
  const py = m.t + (1 - (y - yr[0]) / (yr[1] - yr[0])) * (h - m.t - m.b);
  return [px, py];
}

function drawAxes(ctx, w, h, xr, yr, xl) {
  const m = { l: 44, r: 16, t: 16, b: 36 };
  ctx.strokeStyle = "rgba(28,25,21,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m.l, m.t);
  ctx.lineTo(m.l, h - m.b);
  ctx.lineTo(w - m.r, h - m.b);
  ctx.stroke();
  ctx.fillStyle = "#6f675c";
  ctx.font = "12px Outfit, sans-serif";
  ctx.fillText(xl, m.l, h - 10);
  ctx.fillText(xr[0].toFixed(0), m.l, h - 20);
  ctx.textAlign = "right";
  ctx.fillText(xr[1].toFixed(0), w - m.r, h - 20);
  ctx.textAlign = "left";
}

function drawScatter(canvas, points, opts = {}) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xr = niceRange(xs);
  const yr = niceRange(ys);
  drawAxes(ctx, w, h, xr, yr, opts.xl || "");
  const hit = [];
  points.forEach((p) => {
    const [px, py] = project(p.x, p.y, xr, yr, w, h);
    ctx.beginPath();
    ctx.fillStyle = p.color || "rgba(28,25,21,0.55)";
    ctx.arc(px, py, p.r || 4.2, 0, Math.PI * 2);
    ctx.fill();
    hit.push({ px, py, data: p.data });
  });
  if (opts.centroids) {
    opts.centroids.forEach((c) => {
      const [px, py] = project(c.x, c.y, xr, yr, w, h);
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 6, py - 6, 12, 12);
    });
  }
  canvas._hit = hit;
}

function drawLineChart(canvas, series, markX) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const xs = series.map((s) => s.x);
  const ys = series.map((s) => s.y);
  const xr = [Math.min(...xs) - 0.2, Math.max(...xs) + 0.2];
  const yr = niceRange(ys, 0.15);
  const m = { l: 40, r: 12, t: 12, b: 28 };
  ctx.strokeStyle = "rgba(28,25,21,0.12)";
  ctx.beginPath();
  ctx.moveTo(m.l, m.t);
  ctx.lineTo(m.l, h - m.b);
  ctx.lineTo(w - m.r, h - m.b);
  ctx.stroke();
  ctx.strokeStyle = "#c45c26";
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach((s, i) => {
    const [px, py] = project(s.x, s.y, xr, yr, w, h, m);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  series.forEach((s) => {
    const [px, py] = project(s.x, s.y, xr, yr, w, h, m);
    ctx.fillStyle = s.x === markX ? "#1c1915" : "#c45c26";
    ctx.beginPath();
    ctx.arc(px, py, s.x === markX ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#6f675c";
  ctx.font = "11px Outfit, sans-serif";
  ctx.fillText("K", w - 22, h - 10);
}

function filtered() {
  const g = els.gender.value;
  const ageMax = Number(els.age.value);
  const q = els.search.value.trim();
  return data.filter((d) => {
    if (g !== "all" && d.gender !== g) return false;
    if (d.age > ageMax) return false;
    if (q && !String(d.id).includes(q)) return false;
    return true;
  });
}

function renderExplore() {
  const rows = filtered();
  els.ageLabel.textContent = `18–${els.age.value}`;
  els.count.textContent = `${rows.length} shown`;
  const maxPage = Math.max(0, Math.ceil(rows.length / PAGE) - 1);
  if (page > maxPage) page = maxPage;
  const slice = rows.slice(page * PAGE, page * PAGE + PAGE);
  els.tbody.innerHTML = slice
    .map(
      (r) =>
        `<tr><td>${r.id}</td><td>${r.gender}</td><td>${r.age}</td><td>${r.income}</td><td>${r.score}</td></tr>`
    )
    .join("");
  els.pageInfo.textContent = `Page ${page + 1} / ${maxPage + 1}`;
  drawScatter(
    els.explore,
    rows.map((d) => ({
      x: d.income,
      y: d.score,
      color: d.gender === "Female" ? "rgba(196,92,38,0.7)" : "rgba(31,79,74,0.7)",
      data: d,
    })),
    { xl: "Income (k$)" }
  );
}

function viewPoints() {
  if (view === "pca") {
    return {
      pts: lastModel.pca.map((c, i) => ({ x: c[0], y: c[1], i })),
      xl: "PC1 (sklearn.decomposition.PCA)",
    };
  }
  const map = {
    "income-score": ["income", "score", "Income (k$)"],
    "age-score": ["age", "score", "Age"],
    "age-income": ["age", "income", "Age"],
  };
  const [xk, yk, xl] = map[view];
  return {
    pts: data.map((d, i) => ({ x: d[xk], y: d[yk], i })),
    xl,
    xk,
    yk,
  };
}

function renderClusterView() {
  const { labels, groups, silhouette, inertia, engine, library, elbow, silhouette_curve, dendrogram } = lastModel;
  els.engine.textContent = engine;
  els.metrics.innerHTML = `
    <div><span>Silhouette</span><b>${silhouette.toFixed(3)}</b></div>
    <div><span>WCSS (inertia)</span><b>${inertia.toFixed(1)}</b></div>
    <div><span>Largest group</span><b>${groups[0].size}</b></div>
  `;
  els.hint.textContent =
    algo === "kmeans"
      ? `${library} on standardized age, income, and spending score. Elbow often bends near K = 5.`
      : `${library} with Ward linkage. The dendrogram below is built in SciPy.`;

  const colorOf = {};
  groups.forEach((g, idx) => {
    colorOf[g.ci] = COLORS[idx % COLORS.length];
  });

  const vc = viewPoints();
  const scatterPts = vc.pts.map((p) => ({
    x: p.x,
    y: p.y,
    color: colorOf[labels[p.i]],
    data: { ...data[p.i], cluster: labels[p.i] },
  }));

  const centsPlot = groups.map((g) => {
    if (view === "pca") {
      const idxs = data.map((d, i) => (labels[i] === g.ci ? i : -1)).filter((i) => i >= 0);
      return {
        x: mean(idxs.map((i) => vc.pts[i].x)),
        y: mean(idxs.map((i) => vc.pts[i].y)),
        color: colorOf[g.ci],
      };
    }
    return { x: g.centroid[vc.xk], y: g.centroid[vc.yk], color: colorOf[g.ci] };
  });

  drawScatter(els.cluster, scatterPts, { xl: vc.xl, centroids: centsPlot });
  drawLineChart(els.elbow, elbow, k);
  drawLineChart(els.sil, silhouette_curve, k);

  if (dendrogram) {
    els.dendroWrap.hidden = false;
    els.dendro.src = dendrogram;
  } else {
    els.dendroWrap.hidden = true;
  }

  els.cards.innerHTML = groups
    .map((g) => {
      const c = g.centroid;
      const womenPct = g.size ? Math.round((g.women / g.size) * 100) : 0;
      return `<article class="card" style="--c:${colorOf[g.ci]}">
        <div class="count">${g.size} people · ${womenPct}% women</div>
        <h3>${g.persona.name}</h3>
        <ul>
          <li>Avg age ${c.age.toFixed(0)}</li>
          <li>Income $${c.income.toFixed(0)}k</li>
          <li>Spend score ${c.score.toFixed(0)}</li>
        </ul>
        <p class="play">${g.persona.play}</p>
      </article>`;
    })
    .join("");
}

async function runClustering() {
  els.hint.textContent = "Running Python clustering…";
  try {
    const res = await fetch(`/api/cluster?algo=${encodeURIComponent(algo)}&k=${k}`);
    if (!res.ok) throw new Error("Cluster request failed");
    lastModel = await res.json();
    renderClusterView();
  } catch (err) {
    els.hint.textContent =
      "Python server is not running. From this folder run: python3 server.py";
  }
}

function scheduleCluster() {
  clearTimeout(clusterTimer);
  clusterTimer = setTimeout(runClustering, 120);
}

els.gender.addEventListener("change", () => {
  page = 0;
  renderExplore();
});
els.age.addEventListener("input", renderExplore);
els.search.addEventListener("input", () => {
  page = 0;
  renderExplore();
});
document.getElementById("page-prev").onclick = () => {
  page = Math.max(0, page - 1);
  renderExplore();
};
document.getElementById("page-next").onclick = () => {
  page += 1;
  renderExplore();
};

document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    algo = btn.dataset.algo;
    runClustering();
  };
});
els.kSlider.addEventListener("input", () => {
  k = Number(els.kSlider.value);
  els.kValue.textContent = k;
  scheduleCluster();
});
els.view.addEventListener("change", () => {
  view = els.view.value;
  if (lastModel) renderClusterView();
});

els.cluster.addEventListener("mousemove", (e) => {
  const rect = els.cluster.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const hit = (els.cluster._hit || []).find((h) => Math.hypot(h.px - x, h.py - y) < 8);
  const tip = els.tooltip;
  if (!hit) {
    tip.hidden = true;
    return;
  }
  const d = hit.data;
  tip.hidden = false;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
  tip.innerHTML = `#${d.id} · ${d.gender}, ${d.age}<br>Income $${d.income}k · Score ${d.score}`;
});
els.cluster.addEventListener("mouseleave", () => {
  els.tooltip.hidden = true;
});

document.getElementById("predict-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const age = Number(document.getElementById("p-age").value);
  const income = Number(document.getElementById("p-income").value);
  const score = Number(document.getElementById("p-score").value);
  const gender = document.getElementById("p-gender").value;
  const box = document.getElementById("predict-result");
  box.innerHTML = `<p class="muted">Asking Python to assign the segment…</p>`;
  try {
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ algo, k, age, income, score, gender }),
    });
    const out = await res.json();
    const g = out.group;
    const color = COLORS[lastModel.groups.findIndex((x) => x.ci === g.ci) % COLORS.length];
    box.innerHTML = `
      <p class="muted">${out.engine}</p>
      <h3><span class="swatch" style="background:${color}"></span>${g.persona.name}</h3>
      <p>${g.persona.play}</p>
      <p class="muted">${gender}, ${age} · $${income}k · score ${score}. Assigned with ${
        algo === "kmeans" ? "sklearn K-Means" : "SciPy Ward"
      } · K = ${k}. Cluster averages age ${g.centroid.age.toFixed(0)}, income $${g.centroid.income.toFixed(
        0
      )}k, score ${g.centroid.score.toFixed(0)}.</p>
    `;
  } catch {
    box.innerHTML = `<p class="muted">Could not reach the Python API. Start it with python3 server.py</p>`;
  }
});

window.addEventListener("resize", () => {
  if (data.length) renderExplore();
  if (lastModel) renderClusterView();
});

async function boot() {
  try {
    const res = await fetch("/api/customers");
    const payload = await res.json();
    data = payload.customers;
    const s = payload.stats;
    els.dataMetrics.innerHTML = [
      ["Shoppers", s.n],
      ["Women / men", `${s.women} / ${s.men}`],
      ["Age span", `${s.age_min} – ${s.age_max}`],
      ["Mean income", `$${s.income_mean}k`],
    ]
      .map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`)
      .join("");
    renderExplore();
    await runClustering();
  } catch {
    els.hint.textContent = "Start the Python server: python3 server.py";
    els.dataMetrics.innerHTML = `<div><dt>Data</dt><dd>Server offline</dd></div>`;
  }
}

boot();
