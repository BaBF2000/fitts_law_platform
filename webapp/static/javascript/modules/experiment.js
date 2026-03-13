import {
  clamp, nowMs, isoNow,
  computeID, computeWFromID,
  convertToPxAndMm, placeTarget,
  toCSV, sampleFromSpec, parseNumberOrList
} from "../core/helpers.js";

import { getDeviceContext } from "../core/device.js";

export function initExperiment(dom, state, ui, server) {

  // Demo fixed config (IGNORES session blocks)
  const DEMO_BLOCKS = [{
    n: 12,

    // Force fixed shape behavior for demo
    shape_mode: "shuffle",
    shape_base: "circle",

    // A/W fixed
    dist_set: false,
    dist_entered: "0.35",
    width_set: false,
    width_entered: "0.06",

    // Optional ID disabled
    id_set: false,
    id_entered: "5"
  }];

  function pickTrialShape(trial) {
    const base = trial?.shape_base || "circle";
    const shuffle = (trial?.shape_mode === "shuffle");

    // 1D bands are excluded from random shape shuffle.
    const pool = ["circle", "square", "triangle", "pentagon", "hexagon", "octagon", "diamond"];

    if (!shuffle) return base;

    // If the user selected a 1D band, keep it (no shuffle).
    if (base === "band1d_h" || base === "band1d_v") return base;

    // Otherwise pick a random polygon/circle/square from the pool.
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function applyTargetShape(shape) {
    if (!dom.target) return;

    dom.target.classList.remove(
      "shape-triangle",
      "shape-pentagon",
      "shape-hexagon",
      "shape-octagon",
      "shape-diamond",
      "shape-band1d_h",
      "shape-band1d_v"
    );

    // circle/square use border-radius; polygons rely on CSS clip-path classes.
    if (shape === "circle") {
      dom.target.style.borderRadius = "999px";
    } else if (shape === "square") {
      dom.target.style.borderRadius = "12px";
    } else if (shape === "band1d_h" || shape === "band1d_v") {
      dom.target.style.borderRadius = "12px";
      dom.target.classList.add(`shape-${shape}`);
    } else {
      dom.target.style.borderRadius = "0";
      dom.target.classList.add(`shape-${shape}`);
    }
  }

  // ---------------- Demo end overlay ----------------
  function showDemoEndOverlay() {
    let overlay = document.getElementById("demoEndOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "demoEndOverlay";
      overlay.className = "panel";
      overlay.style.zIndex = "9999";
      overlay.innerHTML = `
        <div class="card">
          <div class="cardScroll">
            <h1>Demo abgeschlossen ✅</h1>
            <p class="muted">Sie können die Demo wiederholen oder zum Start zurückkehren.</p>
            <div class="row">
              <button id="demoAgainBtn">Wiederholen</button>
              <button id="demoBackBtn">Zurück</button>
            </div>
          </div>
        </div>
      `;
      dom.app?.appendChild(overlay);

      overlay.querySelector("#demoAgainBtn").onclick = () => {
        overlay.style.display = "none";
        startRun(true);
      };
      overlay.querySelector("#demoBackBtn").onclick = () => {
        overlay.style.display = "none";
        resetRun();
        dom.app?.classList.remove("running");
        ui.show(dom, "start");
      };
    }
    overlay.style.display = "flex";
  }

  function deriveSessionTargetMode(items) {
    if (!items?.length) return "unknown";
    const modes = new Set(items.map(x => x.shape_mode ?? "fixed"));
    const bases = new Set(items.map(x => x.shape_base ?? "circle"));
    if (modes.size === 1 && [...modes][0] === "shuffle") return "shuffle";
    if (modes.size === 1 && [...modes][0] === "fixed" && bases.size === 1) return "fixed";
    return "mixed";
  }

  // ---------------- Run state helpers ----------------
  function resetRun() {
    state.trials = [];
    state.trialIndex = -1;
    state.current = null;
    state.results = [];
    state.errorCount = 0;
    state.startTime = 0;
    state.isDemoRun = false;

    if (state.timeoutHandle) { clearTimeout(state.timeoutHandle); state.timeoutHandle = null; }
    if (dom.target) dom.target.style.display = "none";
    if (dom.crosshair) dom.crosshair.style.display = "none";
    if (dom.hudLeft) dom.hudLeft.textContent = "Bereit";
  }

  function buildTrials(N, demo = false) {
    const unit = dom.distanceMode?.value;
    const formula = dom.IDFormula?.value;
    const strict = !!dom.strictMode?.checked;

    // Blocks are the single source of truth for the run configuration.
    let blocks = null;

    // Demo uses a fixed configuration (ignores session blocks).
    if (demo) {
      blocks = DEMO_BLOCKS;
    } else {
      blocks = (state.sessionBlocks && state.sessionBlocks.length) ? state.sessionBlocks : null;
    }

    // Normal experiment: session blocks are required.
    if (!blocks && !demo) {
      alert("Bitte zuerst \"Session konfigurieren\" und mindestens einen Block definieren.");
      return null;
    }

    if (unit === "mm" && !state.mmPerPx) {
      alert("Einheit mm gewählt, aber nicht kalibriert. Bitte kalibrieren oder px/rel wählen.");
      return null;
    }

    // Validate each block before generating trials.
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const bn = Number(b.n);

      if (!Number.isFinite(bn) || bn <= 0 || bn > 5000) {
        alert(`Block ${i + 1} → Trials ungültig (1–5000).`);
        return null;
      }

      if (strict && !demo) {
        if (bn < 5 || bn > 25) {
          alert(`Strict-Modus: Block ${i + 1} → Trials müssen zwischen 5 und 25 liegen.`);
          return null;
        }

        const Aok = isStrictSingleValue(b.dist_entered);
        const Wok = isStrictSingleValue(b.width_entered);
        const Iok = isStrictSingleValue(b.id_entered);

        if (!Aok || !Wok || (b.id_set && !Iok)) {
          alert(`Strict-Modus: Block ${i + 1} → Listen sind nicht erlaubt (nur einzelne Werte).`);
          return null;
        }
      }

      // A is required (single value or list).
      const As = parseNumberOrList(b.dist_entered);
      if (As.kind === "invalid") {
        alert(`Block ${i + 1} → A (Abstand) ist ungültig. Bitte Zahl oder Liste ≥ 0.`);
        return null;
      }

      // W is required (single value or list).
      const Ws = parseNumberOrList(b.width_entered);
      if (Ws.kind === "invalid") {
        alert(`Block ${i + 1} → W (Zielbreite) ist ungültig. Bitte Zahl oder Liste ≥ 0.`);
        return null;
      }

      // ID is optional: validate only if enabled.
      if (b.id_set) {
        const Is = parseNumberOrList(b.id_entered);
        if (Is.kind === "invalid") {
          alert(`Block ${i + 1} → ID ist aktiviert, aber ungültig. Bitte Zahl oder Liste ≥ 0.`);
          return null;
        }
      }
    }

    // Build trials
    const trials = [];
    let k = 1;

    for (const b of blocks) {
      const bn = clamp(Number(b.n) || 0, 0, 5000);
      for (let i = 0; i < bn; i++) {
        trials.push({
          trial_no: k++,
          unit,
          formula,
          shape_mode: b.shape_mode ?? "fixed",
          shape_base: b.shape_base ?? "circle",
          dist_set: !!b.dist_set,
          dist_entered: b.dist_entered,
          width_set: !!b.width_set,
          width_entered: b.width_entered,
          id_set: !!b.id_set,
          id_entered: b.id_entered,
          demo
        });
      }
    }

    return trials;

    function isStrictSingleValue(v) {
      const s = (v ?? "").toString().trim();
      if (!s) return false;
      if (s.startsWith("[") || s.includes(",")) return false;
      const x = Number(s);
      return Number.isFinite(x) && x >= 0;
    }
  }

  function setTrialTimeout(ms) {
    if (state.timeoutHandle) { clearTimeout(state.timeoutHandle); state.timeoutHandle = null; }
    if (!ms || ms <= 0) return;
    state.timeoutHandle = setTimeout(() => {
      markError("timeout");
      nextTrial();
    }, ms);
  }

  function markError(reason) {
    if (!state.current) return;
    state.current.errors += 1;
    state.current.error_reasons.push(reason);
    state.errorCount += 1;
  }

  function isInsideTarget(clientX, clientY) {
    if (!dom.target || !state.current) return false;

    const r = dom.target.getBoundingClientRect();
    const shape = state.current.target_shape;

    if (r.width <= 0 || r.height <= 0) return false;

    const hitRect = (px, py, rect) =>
      px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom;

    const hitCircle = (px, py, rect) => {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rad = Math.min(rect.width, rect.height) / 2;
      const dx = px - cx, dy = py - cy;
      return dx * dx + dy * dy <= rad * rad;
    };

    const hitPolygon = (px, py, verts) => {
      let inside = false;
      for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i][0], yi = verts[i][1];
        const xj = verts[j][0], yj = verts[j][1];

        const intersect =
          ((yi > py) !== (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
      }
      return inside;
    };

    const polyFromPct = (rect, pctVerts) =>
      pctVerts.map(([x, y]) => [
        rect.left + (x / 100) * rect.width,
        rect.top + (y / 100) * rect.height
      ]);

    // Must match CSS clip-path coordinates exactly
    const polys = {
      triangle: [[50, 0], [0, 100], [100, 100]],
      pentagon: [[50, 0], [95, 35], [78, 100], [22, 100], [5, 35]],
      hexagon: [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]],
      octagon: [[30, 0], [70, 0], [100, 30], [100, 70], [70, 100], [30, 100], [0, 70], [0, 30]],
      diamond: [[50, 0], [100, 50], [50, 100], [0, 50]],
    };

    if (!hitRect(clientX, clientY, r)) return false;

    if (shape === "circle") return hitCircle(clientX, clientY, r);
    if (shape === "square") return true;
    if (shape === "band1d_h") return true;
    if (shape === "band1d_v") return true;

    if (polys[shape]) {
      const verts = polyFromPct(r, polys[shape]);
      return hitPolygon(clientX, clientY, verts);
    }

    // Fallback for unknown shapes: treat bbox as a hit region
    return true;
  }

  function nextTrial() {
    if (state.trialIndex + 1 >= state.trials.length) {
      finishRun();
      return;
    }
    state.trialIndex++;

    const t = state.trials[state.trialIndex];

    // Sample inputs using the block spec:
    // - list => random item
    // - single number => fixed if "*_set" is enabled, otherwise random in [0, value]
    const A_in = sampleFromSpec(t.dist_set, t.dist_entered);

    // Optional ID: only sample when enabled.
    const ID_in = t.id_set ? sampleFromSpec(true, t.id_entered) : null;

    // W: either sampled from W spec, or derived from A+ID if ID is enabled.
    let W_in = null;

    // Convert A to px/mm depending on unit mode.
    const Aconv = convertToPxAndMm(A_in, t.unit, state.mmPerPx);
    const Apx = Aconv.px;

    let Wpx = NaN;

    // If ID is set: derive W from A and ID in the same measurement space.
    if (t.id_set && Number.isFinite(ID_in)) {
      if (t.unit === "mm") {
        const Amm = Aconv.mm;
        const WmmDerived = (Number.isFinite(Amm) ? computeWFromID(Amm, ID_in, t.formula) : NaN);
        if (Number.isFinite(WmmDerived)) {
          Wpx = state.mmPerPx ? (WmmDerived / state.mmPerPx) : NaN;
          W_in = WmmDerived; // store derived W in mm as "input"
        }
      } else if (t.unit === "px") {
        const WpxDerived = (Number.isFinite(Apx) ? computeWFromID(Apx, ID_in, t.formula) : NaN);
        Wpx = WpxDerived;
        W_in = WpxDerived; // store derived W in px as "input"
      } else {
        const WpxDerived = (Number.isFinite(Apx) ? computeWFromID(Apx, ID_in, t.formula) : NaN);
        Wpx = WpxDerived;
        const minSide = Math.min(window.innerWidth, window.innerHeight);
        W_in = Number.isFinite(WpxDerived) ? (WpxDerived / minSide) : null; // store derived W as relative
      }
    } else {
      // Normal mode: sample W from the block spec.
      W_in = sampleFromSpec(t.width_set, t.width_entered);
      const Wconv = convertToPxAndMm(W_in, t.unit, state.mmPerPx);
      Wpx = Wconv.px;
    }

    // Clamp W in pixels to keep targets usable and avoid extreme sizes.
    const minSide = Math.min(window.innerWidth, window.innerHeight);
    Wpx = clamp(Wpx, 18, minSide * 0.25);

    const Amm = Aconv.mm;
    const Wmm = state.mmPerPx ? Wpx * state.mmPerPx : (t.unit === "mm" ? W_in : null);

    // Planned ID is always derived from A and W (even if ID_in exists).
    const ID_planned = (Number.isFinite(Amm) && Number.isFinite(Wmm))
      ? computeID(Amm, Wmm, t.formula)
      : null;

    const prev = state.current
      ? { x: state.current.x, y: state.current.y }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const pos = placeTarget(prev.x, prev.y, Number.isFinite(Apx) ? Apx : 0, Wpx / 2);
    const trialShape = pickTrialShape(t);

    // 1D horizontal band: full width, limited y range, centered x.
    if (trialShape === "band1d_h") {
      const marginY = Math.max(12, (Wpx / 2) + 6);
      pos.x = window.innerWidth / 2;
      pos.y = clamp(pos.y, marginY, window.innerHeight - marginY);
    }

    // 1D vertical band: full height, limited x range, centered y.
    if (trialShape === "band1d_v") {
      const marginX = Math.max(12, (Wpx / 2) + 6);
      pos.x = clamp(pos.x, marginX, window.innerWidth - marginX);
      pos.y = window.innerHeight / 2;
    }

    state.current = {
      participant_id: dom.participantId?.value?.trim() || "P?",
      session_id: dom.sessionId?.value?.trim() || "S?",
      trial_no: t.trial_no,
      demo: t.demo,

      unit: t.unit,
      formula: t.formula,
      shape_mode: t.shape_mode,
      shape_base: t.shape_base,

      target_shape: trialShape,

      A_in, W_in, ID_in,
      A_px_planned: Apx,
      W_px: Wpx,
      A_mm_planned: Amm,
      W_mm: Wmm,
      ID_planned,

      dist_set: t.dist_set,
      width_set: t.width_set,
      id_set: t.id_set,

      prev_x: prev.x,
      prev_y: prev.y,
      x: pos.x,
      y: pos.y,
      placed: pos.placed,

      errors: 0,
      error_reasons: [],
      clicks_before_hit: 0
    };

    if (dom.target) {
      dom.target.classList.remove("hit");
      applyTargetShape(trialShape);

      if (trialShape === "band1d_h") {
        dom.target.style.width = `${window.innerWidth}px`;
        dom.target.style.height = `${Wpx}px`; // thickness
      } else if (trialShape === "band1d_v") {
        dom.target.style.width = `${Wpx}px`;  // thickness
        dom.target.style.height = `${window.innerHeight}px`;
      } else {
        dom.target.style.width = `${Wpx}px`;
        dom.target.style.height = `${Wpx}px`;
      }

      dom.target.style.left = `${pos.x}px`;
      dom.target.style.top = `${pos.y}px`;
      dom.target.style.display = "block";
    }

    if (dom.crosshair) dom.crosshair.style.display = "block";

    state.startTime = nowMs();
    if (dom.hudLeft) {
      const idTxt = Number.isFinite(state.current.ID_planned) ? state.current.ID_planned.toFixed(2) : "—";
      dom.hudLeft.textContent = `${t.demo ? "Demo" : "Versuch"} ${state.current.trial_no} / ${state.trials.length} • ID ${idTxt}`;
    }

    const tmo = Number(dom.timeoutMs?.value) || 0;
    setTrialTimeout(tmo);
  }

  function finishRun() {
    if (state.timeoutHandle) { clearTimeout(state.timeoutHandle); state.timeoutHandle = null; }
    if (dom.target) dom.target.style.display = "none";
    if (dom.crosshair) dom.crosshair.style.display = "none";
    if (dom.hudLeft) dom.hudLeft.textContent = "Fertig";

    dom.app?.classList.remove("running");

    if (state.isDemoRun) {
      showDemoEndOverlay();
      return;
    }

    if (dom.btnSaveServer) dom.btnSaveServer.style.display = "inline-block";

    const mts = state.results.map(r => r.mt_ms).filter(Number.isFinite);
    const ids = state.results.map(r => (r.ID_effective ?? r.ID_planned)).filter(Number.isFinite);
    const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;

    document.getElementById("sumTrials").textContent = String(state.results.length);
    document.getElementById("sumErrors").textContent = String(state.errorCount);
    document.getElementById("sumMT").textContent = Number.isFinite(mean(mts)) ? mean(mts).toFixed(1) + " ms" : "—";
    document.getElementById("sumID").textContent = Number.isFinite(mean(ids)) ? mean(ids).toFixed(3) : "—";

    state.savedToPC = false;
    state.savedSessionRowId = null;

    // Reset the save button for the next run (keep UI text consistent with the HTML)
    if (dom.btnSaveServer) {
      dom.btnSaveServer.disabled = false;
      dom.btnSaveServer.textContent = "Auf Server speichern";
    }

    ui.show(dom, "end");
  }

  function onPointerMove(e) {
    if (!dom.crosshair) return;
    const p = (e.touches ? e.touches[0] : e);
    dom.crosshair.style.left = `${p.clientX}px`;
    dom.crosshair.style.top = `${p.clientY}px`;
  }

  function computeHitboxGeom(shape, rect) {
    if (!rect) return null;

    // Must match CSS clip-path coordinates exactly
    const polysPct = {
      triangle: [[50, 0], [0, 100], [100, 100]],
      pentagon: [[50, 0], [95, 35], [78, 100], [22, 100], [5, 35]],
      hexagon: [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]],
      octagon: [[30, 0], [70, 0], [100, 30], [100, 70], [70, 100], [30, 100], [0, 70], [0, 30]],
      diamond: [[50, 0], [100, 50], [50, 100], [0, 50]],
    };

    if (shape === "square" || shape === "band1d_h" || shape === "band1d_v") {
      return { type: "rect" };
    }

    if (shape === "circle") {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const r = Math.min(rect.width, rect.height) / 2;
      return { type: "circle", cx, cy, r };
    }

    if (polysPct[shape]) {
      const verts = polysPct[shape].map(([x, y]) => ([
        rect.left + (x / 100) * rect.width,
        rect.top + (y / 100) * rect.height
      ]));
      return { type: "polygon", verts };
    }

    return { type: "rect" };
  }

  function onPointerDown(e) {
    const tag = (e.target?.tagName || "").toLowerCase();
    if (["input", "select", "button", "textarea", "label"].includes(tag)) return;
    if (!state.current) return;

    e.preventDefault();

    const p = (e.touches ? e.touches[0] : e);
    state.current.clicks_before_hit += 1;

    if (!isInsideTarget(p.clientX, p.clientY)) { markError("miss"); return; }

    dom.target?.classList.add("hit");

    const end = nowMs();
    const MT = end - state.startTime;

    const DpxEff = Math.hypot(state.current.x - state.current.prev_x, state.current.y - state.current.prev_y);
    const DmmEff = (state.mmPerPx ? DpxEff * state.mmPerPx : null);
    const IDeff = (state.mmPerPx && Number.isFinite(DmmEff) && Number.isFinite(state.current.W_mm))
      ? computeID(DmmEff, state.current.W_mm, state.current.formula)
      : null;

    const dev = getDeviceContext();

    const rect = dom.target?.getBoundingClientRect?.() || null;

    const bbox = rect ? {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    } : null;

    const hitGeom = rect ? computeHitboxGeom(state.current.target_shape, rect) : null;

    state.results.push({
      // device context
      ua: dev.ua,
      platform: dev.platform,
      mobile_ua: dev.mobile_ua,

      screen_w: dev.screen_w,
      screen_h: dev.screen_h,
      viewport_w: dev.viewport_w,
      viewport_h: dev.viewport_h,
      dpr: dev.dpr,

      touch_support: dev.touch_support,
      max_touch_points: dev.max_touch_points,
      pointer_coarse: dev.pointer_coarse,
      pointer_fine: dev.pointer_fine,
      hover_capable: dev.hover_capable,

      hardware_concurrency: dev.hardware_concurrency,
      device_memory_gb: dev.device_memory_gb,

      prefers_reduced_motion: dev.prefers_reduced_motion,
      language: dev.language,
      timezone: dev.timezone,

      participant_id: state.current.participant_id,
      session_id: state.current.session_id,
      trial_no: state.current.trial_no,
      demo: state.current.demo,
      timestamp_iso: isoNow(),

      unit: state.current.unit,
      formula: state.current.formula,
      session_target_mode: state.session_target_mode ?? null,
      shape_mode: state.current.shape_mode ?? "fixed",
      shape_base: state.current.shape_base ?? "circle",

      target_shape: state.current.target_shape,

      target_bbox_left: bbox?.left ?? null,
      target_bbox_top: bbox?.top ?? null,
      target_bbox_w: bbox?.width ?? null,
      target_bbox_h: bbox?.height ?? null,

      target_hit_geom_json: hitGeom ? JSON.stringify(hitGeom) : null,

      dist_set: state.current.dist_set,
      width_set: state.current.width_set,
      id_set: state.current.id_set,

      A_in: state.current.A_in,
      W_in: state.current.W_in,
      ID_in: state.current.ID_in,

      A_px_planned: state.current.A_px_planned,
      W_px: state.current.W_px,
      A_mm_planned: state.current.A_mm_planned,
      W_mm: state.current.W_mm,
      ID_planned: state.current.ID_planned,

      D_px_effective: DpxEff,
      D_mm_effective: DmmEff,
      ID_effective: IDeff,

      prev_x: state.current.prev_x,
      prev_y: state.current.prev_y,
      x: state.current.x,
      y: state.current.y,
      placed: state.current.placed,

      mt_ms: MT,
      errors: state.current.errors,
      error_reasons: state.current.error_reasons.join("|"),
      clicks_before_hit: state.current.clicks_before_hit,

      mm_per_px: state.mmPerPx
    });

    setTimeout(() => {
      nextTrial();
    }, 120);
  }

  function downloadCSV() {
    const csv = toCSV(state.results);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    const fname = `fitts_${dom.participantId?.value || "P"}_${dom.sessionId?.value || "S"}_${new Date().toISOString().replaceAll(":", "-")}.csv`;
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function startRun(demo = false) {
    resetRun();
    state.isDemoRun = demo;

    state.session_target_mode = demo
      ? "demo"
      : deriveSessionTargetMode(state.sessionBlocks || []);

    dom.app?.classList.add("running");

    // Use ui.show() so fullscreen enforcement + wake lock are enabled consistently.
    // "run" is not a visible panel; it simply means "experiment is running".
    ui.show(dom, "run");

    const built = buildTrials(demo ? 0 : Number(dom.trialCount?.value), demo);

    if (!built) {
      dom.app?.classList.remove("running");
      ui.show(dom, "start");
      return;
    }

    state.trials = built;
    if (dom.hudLeft) dom.hudLeft.textContent = `${demo ? "Demo" : "Versuch"} 0 / ${state.trials.length}`;
    nextTrial();
  }

  function startDemo() { startRun(true); }

  function bind() {
    dom.app?.addEventListener("mousemove", onPointerMove, { passive: false });
    dom.app?.addEventListener("touchmove", onPointerMove, { passive: false });
    dom.app?.addEventListener("mousedown", onPointerDown, { passive: false });
    dom.app?.addEventListener("touchstart", onPointerDown, { passive: false });

    // Prevent double-tap zoom on touch devices
    let lastTouchEnd = 0;
    document.addEventListener("touchend", (event) => {
      const t = Date.now();
      if (t - lastTouchEnd <= 300) event.preventDefault();
      lastTouchEnd = t;
    }, { passive: false });

    return { startRun, startDemo, resetRun, downloadCSV };
  }

  return { bind };
}