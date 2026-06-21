"""
Monte Carlo dashboard page builder.

Organigram reference:
- Persistence & Backend
  -> Admin Dashboard
     -> Monte Carlo Analysis
     -> Page Rendering

Responsibility:
Builds the full HTML page for the Monte Carlo dashboard

This module contains:
- dashboard HTML structure,
- inline CSS for the dashboard layout,
- inline JavaScript for protocol loading and simulation controls.

Important:
This module does not perform Monte Carlo simulation in Python. The simulation
is executed in the browser by importing frontend functions from
/static/javascript/modules/monteCarlo.js

Design note:
This file still contains inline HTML, CSS and JavaScript. Later, this can be
split into:
- templates/montecarlo_dashboard.html
- static/javascript/dashboard/monteCarloDashboard.js
"""
from __future__ import annotations


def build_montecarlo_dashboard_page(
    *,
    qs: str,
    session_rows_html: str,
) -> str:
    """
    Build the full Monte Carlo dashboard HTML page.

    Args:
        qs (str): Admin query string, usually used to preserve ?token=...
            in dashboard and export links
        session_rows_html (str): Pre-rendered HTML table rows for recently saved
            sessions. Usually built by session_rows.build_session_rows_html()

    Returns:
        str: Complete HTML document for the Monte Carlo dashboard

    Side effects:
        None. This function only returns an HTML string

    Related modules:
        Called by app.routes.montecarlo_dashboard.dashboard_montecarlo()
        Session rows are created in app.routes.montecarlo.session_rows
        Simulation functions are imported in the generated page from
        static/javascript/modules/monteCarlo.js

    Important:
        Dynamic HTML fragments passed into this function must already be escaped
        by the caller where necessary
    """

    # The page is returned as one complete HTML string because the current
    # dashboard is generated without a Jinja template
    # Keep dynamic values escaped before passing them into this function
    return f"""
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Fitts Monte Carlo Analyse</title>

        <style>
          body {{
            font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
            margin: 20px;
            color: #111;
            background: #f6f6f6;
          }}

          h1 {{ margin: 0 0 8px; }}
          h2 {{ margin: 22px 0 10px; font-size: 18px; }}

          .muted {{ color: #666; line-height: 1.45; }}

          .top {{
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;
            margin-bottom: 14px;
          }}

          .btn {{
            display: inline-block;
            padding: 8px 10px;
            border: 1px solid #ddd;
            border-radius: 10px;
            background: #fff;
            color: #0b62d6;
            text-decoration: none;
            cursor: pointer;
          }}

          .btn:hover {{ background: #f2f2f2; }}

          .grid {{
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(4, minmax(180px, 1fr));
            max-width: 1400px;
          }}

          @media (max-width: 900px) {{
            .grid {{ grid-template-columns: repeat(2, minmax(180px, 1fr)); }}
          }}

          @media (max-width: 520px) {{
            .grid {{ grid-template-columns: 1fr; }}
          }}

          .card,
          .kpi {{
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            padding: 14px;
          }}

          .kpi b {{
            display: block;
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
          }}

          .kpi span {{
            font-size: 16px;
            font-variant-numeric: tabular-nums;
          }}

          .controls {{
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(4, minmax(160px, 1fr));
            max-width: 1400px;
          }}

          @media (max-width: 900px) {{
            .controls {{ grid-template-columns: repeat(2, minmax(160px, 1fr)); }}
          }}

          @media (max-width: 520px) {{
            .controls {{ grid-template-columns: 1fr; }}
          }}

          label {{
            display: block;
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
          }}

          input,
          select {{
            width: 100%;
            padding: 9px 10px;
            border-radius: 10px;
            border: 1px solid #ddd;
            font: inherit;
            box-sizing: border-box;
          }}

          table {{
            border-collapse: collapse;
            width: 100%;
            min-width: 1100px;
          }}

          th,
          td {{
            border-bottom: 1px solid #e5e5e5;
            padding: 8px 6px;
            text-align: right;
            font-variant-numeric: tabular-nums;
          }}

          th {{
            background: #fafafa;
            position: sticky;
            top: 0;
            z-index: 1;
          }}

          th:first-child,
          td:first-child {{
            text-align: left;
          }}

          .tableWrap {{ overflow-x: auto; }}

          .barRow {{
            display: grid;
            grid-template-columns: 110px 1fr 70px;
            gap: 10px;
            align-items: center;
            margin: 5px 0;
          }}

          .barBg {{
            height: 20px;
            background: #eee;
            border-radius: 999px;
            overflow: hidden;
            position: relative;
          }}

          .bar {{
            height: 100%;
            position: absolute;
            left: 0;
            top: 0;
          }}

          .bar.planned {{ background: rgba(120, 120, 120, 0.35); }}
          .bar.effective {{ background: #7cc4ff; }}

          .legend {{
            display: flex;
            gap: 18px;
            margin-bottom: 12px;
            font-size: 13px;
            flex-wrap: wrap;
          }}

          .legendItem {{
            display: flex;
            align-items: center;
            gap: 8px;
          }}

          .legendColor {{
            width: 14px;
            height: 14px;
            border-radius: 4px;
          }}

          .plannedColor {{ background: rgba(120, 120, 120, 0.35); }}
          .effectiveColor {{ background: #7cc4ff; }}

          svg {{
            width: 100%;
            height: 260px;
            background: #fff;
            border: 1px solid #eee;
            border-radius: 12px;
          }}

          .profileCard {{
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            padding: 14px;
          }}

          .profileCard b {{
            display: block;
            margin-bottom: 8px;
          }}
          
          .diag-low {{
            color: #166534;
            background: #dcfce7;
            border-radius: 999px;
            padding: 2px 8px;
          }}
          
          .diag-medium {{
            color: #92400e;
            background: #fef3c7;
            border-radius: 999px;
            padding: 2px 8px;
          }}
          
          .diag-high {{
            color: #991b1b;
            background: #fee2e2;
            border-radius: 999px;
            padding: 2px 8px;
          }}
          
        </style>
      </head>

      <body>
        <div class="top">
          <a class="btn" href="/dashboard{qs}">← Dashboard</a>
          <button class="btn" id="btnRun">Analyse starten</button>
        </div>

        <h1>Monte Carlo Analyse</h1>

        <p class="muted">
          Diese Seite simuliert geplante und effektive Zielbreiten unter
          Berücksichtigung von Viewport-, Touchability- und Clamp-Grenzen.
          Die Analyse verändert keine gespeicherten Experimente.
        </p>

        <h2>Gespeicherte Sessions</h2>
        <div class="card tableWrap">
          <table>
            <thead>
              <tr>
                <th>Teilnehmer</th>
                <th>Session</th>
                <th>Start</th>
                <th>Protokoll</th>
                <th style="text-align:right;">Warnungen</th>
                <th style="text-align:right;">Worst Clamp</th>
                <th>Diagnose</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {''.join(session_rows_html) if session_rows_html else '<tr><td colspan="8">Keine gespeicherten Sessions.</td></tr>'}
            </tbody>
          </table>
        </div>

        <h2>Blöcke des geladenen Protokolls</h2>
        <h2>Monte-Carlo-Diagnose pro Block</h2>
        <div class="card tableWrap">
          <table>
            <thead>
              <tr>
                <th>Block</th>
                <th>Form</th>
                <th>Modus</th>
                <th>Clamp min</th>
                <th>Clamp max</th>
                <th>Clamp total</th>
                <th>Diagnose</th>
              </tr>
            </thead>
            <tbody id="blockDiagnosticsRows">
              <tr><td colspan="7">Kein Protokoll geladen.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="card tableWrap">
          <table>
            <thead>
              <tr>
                <th>Block</th>
                <th>Form</th>
                <th>Modus</th>
                <th>A</th>
                <th>W</th>
                <th>ID</th>
                <th>Overlap</th>
                <th>A-Verteilung</th>
                <th>W-Verteilung</th>
                <th>ID-Verteilung</th>
              </tr>
            </thead>
            <tbody id="protocolBlocksRows">
              <tr><td colspan="10">Kein Protokoll geladen.</td></tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="controls">
            <div>
              <label>Samples</label>
              <input id="n" type="number" value="50000" min="100" max="100000">
            </div>

            <div>
              <label>Histogram bins</label>
              <input id="histogramBins" type="number" value="100" min="10" max="200">
            </div>

            <div>
              <label>A-Verteilung</label>
              <select id="aSampling">
                <option value="uniform">Uniform</option>
                <option value="truncated_uniform">Uniform trunkiert</option>
                <option value="normal">Normal</option>
                <option value="truncated_normal">Normal trunkiert</option>
              </select>
            </div>
            
            <div>
              <label>W-Verteilung</label>
              <select id="wSampling">
                <option value="uniform">Uniform</option>
                <option value="truncated_uniform">Uniform trunkiert</option>
                <option value="normal">Normal</option>
                <option value="truncated_normal">Normal trunkiert</option>
              </select>
            </div>
            
            <div>
              <label>ID-Verteilung</label>
              <select id="idSampling">
                <option value="uniform">Uniform</option>
                <option value="truncated_uniform">Uniform trunkiert</option>
                <option value="normal">Normal</option>
                <option value="truncated_normal">Normal trunkiert</option>
              </select>
            </div>

            <div>
              <label>Protokoll-Block</label>
              <select id="protocolBlock">
                <option value="0">Block 1</option>
              </select>
            </div>

            <div>
              <label>Modus</label>
              <select id="mode">
                <option value="A_W">A_W</option>
                <option value="ID_W">ID_W</option>
                <option value="ID_A">ID_A</option>
              </select>
            </div>

            <div>
              <label>Viewport W</label>
              <input id="viewportW" type="number" value="1920">
            </div>

            <div>
              <label>Viewport H</label>
              <input id="viewportH" type="number" value="1080">
            </div>

            <div>
              <label>Touch Ø px</label>
              <input id="touchPx" type="number" value="40">
            </div>

            <div>
              <label>Required overlap</label>
              <input id="overlap" type="number" value="1" min="0" max="1" step="0.05">
            </div>

            <div>
              <label>A min relativ</label>
              <input id="aMin" type="number" value="0.05" step="0.01">
            </div>

            <div>
              <label>A max relativ</label>
              <input id="aMax" type="number" value="0.8" step="0.01">
            </div>

            <div>
              <label>W min relativ</label>
              <input id="wMin" type="number" value="0.02" step="0.01">
            </div>

            <div>
              <label>W max relativ</label>
              <input id="wMax" type="number" value="0.3" step="0.01">
            </div>

            <div>
              <label>ID min</label>
              <input id="idMin" type="number" value="1" step="0.1">
            </div>

            <div>
              <label>ID max</label>
              <input id="idMax" type="number" value="7" step="0.1">
            </div>
          </div>
        </div>

        <h2>Kontext</h2>
        <div class="grid" id="contextGrid"></div>

        <h2>Statistik</h2>
        <div class="grid" id="statsGrid"></div>

        <h2>Histogramm / PDF-Annäherung</h2>
        <div class="card">
          <div class="legend">
            <div class="legendItem">
              <div class="legendColor plannedColor"></div>
              <span>Planned distribution</span>
            </div>
            <div class="legendItem">
              <div class="legendColor effectiveColor"></div>
              <span>Effective distribution</span>
            </div>
          </div>
          <div id="histogram"></div>
        </div>

        <h2>CDF</h2>
        <div class="card">
          <p class="muted">
            Die CDF zeigt kumulative Wahrscheinlichkeiten. Sprünge an den Grenzen
            zeigen die durch Clamp erzeugte Masse an den Rändern.
          </p>
          <div id="cdf"></div>
        </div>

        <h2>Alternative W-Sampling-Profile</h2>
        <div class="grid" id="profileGrid"></div>

        <h2>Beispiel-Tabelle</h2>
        <div class="card tableWrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>A / W / ID Sampling</th>
                <th>A px</th>
                <th>W planned px</th>
                <th>W effective px</th>
                <th>Radius px</th>
                <th>ID</th>
                <th>Clamp min</th>
                <th>Clamp max</th>
              </tr>
            </thead>
            <tbody id="sampleRows"></tbody>
          </table>
        </div>

        <script type="module">
          import {{ runMonteCarloW,  runMonteCarloProtocol, }} from "/static/javascript/modules/monteCarlo.js";

          let loadedProtocol = null;

          // Read a numeric value from a dashboard input field
          function val(id) {{
            return Number(document.getElementById(id).value);
          }}

          function kpi(label, value) {{
            return `
              <div class="kpi">
                <b>${{label}}</b>
                <span>${{value}}</span>
              </div>
            `;
          }}

          // Run a Monte Carlo analysis for every block of the loaded protocol and show
          // clamp/diagnostic values in the block diagnostics table
          function renderBlockDiagnostics(protocol) {{
            const viewportW = val("viewportW") || window.innerWidth;
            const viewportH = val("viewportH") || window.innerHeight;
          
            const result = runMonteCarloProtocol({{
              protocol,
              n: Math.max(100, Math.min(100000, val("n") || 50000)),
              histogramBins: val("histogramBins") || 100,
              overrideViewport: {{
                width: viewportW,
                height: viewportH,
                minSide: Math.min(viewportW, viewportH),
              }},
              state: {{
                touchDiameterPx: val("touchPx") || 40,
                mmPerPx: null,
              }},
            }});
          
            document.getElementById("blockDiagnosticsRows").innerHTML =
              result.blocks.length
                ? result.blocks.map((item) => {{
                    const c = item.result.counts;
                    const d = item.result.summary.diagnostic;

                    const diagClass =
                      d === "strong_distortion"
                        ? "diag-high"
                        : d === "moderate_distortion"
                          ? "diag-medium"
                          : "diag-low";
          
                    return `
                      <tr>
                        <td>${{item.block_no}}</td>
                        <td>${{item.shape}}</td>
                        <td>${{item.param_mode}}</td>
                        <td>${{c.clamped_min_pct.toFixed(2)}}%</td>
                        <td>${{c.clamped_max_pct.toFixed(2)}}%</td>
                        <td>${{c.clamped_total_pct.toFixed(2)}}%</td>
                        <td><span class="${{diagClass}}">${{d}}</span></td>
                      </tr>
                    `;
                  }}).join("")
                : `<tr><td colspan="7">Keine Blöcke im Protokoll.</td></tr>`;
          }}

          function applyProtocolToControls(protocol, blockIndex = 0) {{
            loadedProtocol = protocol;

            renderProtocolBlocks(protocol);
            renderBlockDiagnostics(protocol);

            const blocks = protocol.sessionBlocks || [];
            const block = blocks[blockIndex];
          
            if (!block) return;

            const blockSelect = document.getElementById("protocolBlock");

            blockSelect.innerHTML = blocks.map((_, index) =>
              `<option value="${{index}}">Block ${{index + 1}}</option>`
            ).join("");
          
            blockSelect.value = String(blockIndex);
          
            document.getElementById("aSampling").value =
              protocol.a_sampling || "uniform";
            
            document.getElementById("wSampling").value =
              protocol.w_sampling || "uniform";
            
            document.getElementById("idSampling").value =
              protocol.id_sampling || "uniform";
          
            document.getElementById("mode").value =
              block.param_mode || "A_W";
          
            document.getElementById("overlap").value =
              block.required_overlap ?? 1;
          
            document.getElementById("aMin").value =
              Number(String(block.dist_entered).replace("[", "").split(",")[0]) || 0.05;
          
            document.getElementById("aMax").value =
              Number(String(block.dist_entered).replace("]", "").split(",").at(-1)) || 0.8;
          
            document.getElementById("wMin").value =
              Number(String(block.width_entered).replace("[", "").split(",")[0]) || 0.02;
          
            document.getElementById("wMax").value =
              Number(String(block.width_entered).replace("]", "").split(",").at(-1)) || 0.3;
          
            document.getElementById("idMin").value =
              Number(String(block.id_entered).replace("[", "").split(",")[0]) || 1;
          
            document.getElementById("idMax").value =
              Number(String(block.id_entered).replace("]", "").split(",").at(-1)) || 7;
          
            render(runDashboardSimulation());
          }}
          
          document.getElementById("protocolBlock").addEventListener("change", () => {{
              if (!loadedProtocol) return;
            
              const index = Number(document.getElementById("protocolBlock").value) || 0;
              applyProtocolToControls(loadedProtocol, index);
          }});

          document.querySelectorAll(".btnLoadProtocol").forEach((btn) => {{
            btn.addEventListener("click", () => {{
              try {{
                const protocol = JSON.parse(btn.dataset.protocol || "{{}}");
                applyProtocolToControls(protocol);
              }} catch (err) {{
                alert("Protokoll konnte nicht geladen werden.");
                console.error(err);
              }}
              }});
          }});

          function renderProtocolBlocks(protocol) {{
            const rows = protocol.sessionBlocks || [];
          
            document.getElementById("protocolBlocksRows").innerHTML = rows.length
              ? rows.map((b, index) => `
                <tr>
                  <td>${{index + 1}}</td>
                  <td>${{b.shape || "circle"}}</td>
                  <td>${{b.param_mode || "A_W"}}</td>
                  <td>${{b.dist_entered ?? "—"}}</td>
                  <td>${{b.width_entered ?? "—"}}</td>
                  <td>${{b.id_entered ?? "—"}}</td>
                  <td>${{b.required_overlap ?? "1.0"}}</td>
                  <td>${{protocol.a_sampling || "uniform"}}</td>
                  <td>${{protocol.w_sampling || "uniform"}}</td>
                  <td>${{protocol.id_sampling || "uniform"}}</td>
                </tr>
              `).join("")
              : `<tr><td colspan="10">Keine Blöcke im Protokoll.</td></tr>`;
          }}

          // Build the configuration object expected by runMonteCarloW()
          function getSimulationConfig(samplingOverride = null) {{
            const viewportW = val("viewportW") || window.innerWidth;
            const viewportH = val("viewportH") || window.innerHeight;
            const minSide = Math.min(viewportW, viewportH);

            return {{
              n: Math.max(100, Math.min(100000, val("n") || 50000)),
              mode: document.getElementById("mode").value,
              unit: "relative",
              ARange: [val("aMin"), val("aMax")],
              WRange: [val("wMin"), val("wMax")],
              IDRange: [val("idMin"), val("idMax")],
              requiredOverlap: val("overlap") || 1,
              aSampling: document.getElementById("aSampling").value,
              wSampling: samplingOverride || document.getElementById("wSampling").value,
              idSampling: document.getElementById("idSampling").value,
              histogramBins: val("histogramBins") || 100,
              overrideViewport: {{
                width: viewportW,
                height: viewportH,
                minSide,
              }},
              state: {{
                touchDiameterPx: val("touchPx") || 40,
                mmPerPx: null,
              }},
            }};
          }}

          function runDashboardSimulation() {{
            return runMonteCarloW(getSimulationConfig());
          }}

          function runProfileComparison() {{
            const profiles = [
              "uniform",
              "truncated_uniform",
              "normal",
              "truncated_normal",
            ];

            return profiles.map((profile) =>
              runMonteCarloW(getSimulationConfig(profile))
            );
          }}

          function renderHistogram(sim) {{
            const planned = sim.distributions.planned_histogram;
            const effective = sim.distributions.effective_histogram;

            const maxValue = Math.max(
              ...planned.map(b => b.pct),
              ...effective.map(b => b.pct),
              1
            );

            document.getElementById("histogram").innerHTML =
              effective.map((bin, i) => {{
                const label = `${{bin.min.toFixed(0)}}–${{bin.max.toFixed(0)}}`;

                const p = maxValue
                  ? (100 * (planned[i]?.pct ?? 0) / maxValue)
                  : 0;

                const e = maxValue
                  ? (100 * bin.pct / maxValue)
                  : 0;

                return `
                  <div class="barRow">
                    <div>${{label}}</div>
                    <div class="barBg">
                      <div class="bar planned" style="width:${{p}}%"></div>
                      <div class="bar effective" style="width:${{e}}%"></div>
                    </div>
                    <div>${{bin.pct.toFixed(2)}}%</div>
                  </div>
                `;
              }}).join("");
          }}

          function makeSvgPolyline(points, minX, maxX, width, height, margin) {{
            return points.map((p) => {{
              const x = margin + ((p.x - minX) / (maxX - minX)) * (width - 2 * margin);
              const y = height - margin - p.y * (height - 2 * margin);
              return `${{x.toFixed(1)}},${{y.toFixed(1)}}`;
            }}).join(" ");
          }}

          function renderCDF(sim) {{
            const planned = sim.distributions.planned_cdf;
            const effective = sim.distributions.effective_cdf;

            const width = 900;
            const height = 260;
            const margin = 32;
            const minX = sim.meta.chart_min_px;
            const maxX = sim.meta.chart_max_px;

            const plannedPoints = makeSvgPolyline(planned, minX, maxX, width, height, margin);
            const effectivePoints = makeSvgPolyline(effective, minX, maxX, width, height, margin);

            document.getElementById("cdf").innerHTML = `
              <svg viewBox="0 0 ${{width}} ${{height}}" preserveAspectRatio="none">
                <line x1="${{margin}}" y1="${{height - margin}}" x2="${{width - margin}}" y2="${{height - margin}}" stroke="#ccc" />
                <line x1="${{margin}}" y1="${{margin}}" x2="${{margin}}" y2="${{height - margin}}" stroke="#ccc" />

                <text x="${{margin}}" y="18" font-size="12" fill="#666">CDF</text>
                <text x="${{width - margin - 90}}" y="${{height - 8}}" font-size="12" fill="#666">W px</text>

                <polyline points="${{plannedPoints}}" fill="none" stroke="rgba(120,120,120,0.8)" stroke-width="3" />
                <polyline points="${{effectivePoints}}" fill="none" stroke="#1687d9" stroke-width="3" />
              </svg>
            `;
          }}

          function renderProfileComparison() {{
            const profileSims = runProfileComparison();

            document.getElementById("profileGrid").innerHTML =
              profileSims.map((p) => `
                <div class="profileCard">
                  <b>${{p.meta.sampling}}</b>
                  <div class="muted">
                    Clamp total: ${{p.counts.clamped_total_pct.toFixed(2)}}%<br>
                    Clamp min: ${{p.counts.clamped_min_pct.toFixed(2)}}%<br>
                    Clamp max: ${{p.counts.clamped_max_pct.toFixed(2)}}%<br>
                    Mean effective W: ${{p.summary.effective_w_px.mean.toFixed(1)}} px<br>
                    SD effective W: ${{p.summary.effective_w_px.sd.toFixed(1)}} px<br>
                    Diagnostic: ${{p.summary.diagnostic}}
                  </div>
                </div>
              `).join("");
          }}

          // Render the main dashboard sections from one Monte Carlo simulation result
          function render(sim) {{
            const m = sim.meta;
            const c = sim.counts;
            const s = sim.summary;

            document.getElementById("contextGrid").innerHTML = [
              kpi("Machine", navigator.platform || "—"),
              kpi("Viewport", `${{m.viewport_w}}×${{m.viewport_h}}`),
              kpi("Touch Ø", `${{m.touch_diameter_px.toFixed(1)}} px`),
              kpi("W min", `${{m.min_target_px.toFixed(1)}} px`),
              kpi("W max", `${{m.max_target_px.toFixed(1)}} px`),
              kpi("Mode", m.mode),
              kpi("Samples", c.total),
              kpi("A Sampling", m.a_sampling),
              kpi("W Sampling", m.w_sampling),
              kpi("ID Sampling", m.id_sampling),
            ].join("");

            document.getElementById("statsGrid").innerHTML = [
              kpi("Clamp min", `${{c.clamped_min_pct.toFixed(2)}}%`),
              kpi("Clamp max", `${{c.clamped_max_pct.toFixed(2)}}%`),
              kpi("Clamp total", `${{c.clamped_total_pct.toFixed(2)}}%`),
              kpi("Diagnostic", s.diagnostic),
              kpi("Planned mean", `${{s.planned_w_px.mean.toFixed(1)}} px`),
              kpi("Effective mean", `${{s.effective_w_px.mean.toFixed(1)}} px`),
              kpi("Planned SD", `${{s.planned_w_px.sd.toFixed(1)}} px`),
              kpi("Effective SD", `${{s.effective_w_px.sd.toFixed(1)}} px`),
            ].join("");

            renderHistogram(sim);
            renderCDF(sim);
            renderProfileComparison();

            document.getElementById("sampleRows").innerHTML =
              sim.rows.slice(0, 120).map((r) => `
                <tr>
                  <td>${{r.index}}</td>
                  <td>${{r.a_sampling}} / ${{r.w_sampling}} / ${{r.id_sampling}} </td>
                  <td>${{Number.isFinite(r.A_px) ? r.A_px.toFixed(1) : "—"}}</td>
                  <td>${{r.W_px_planned.toFixed(1)}}</td>
                  <td>${{r.W_px_effective.toFixed(1)}}</td>
                  <td>${{r.radius_px_effective.toFixed(1)}}</td>
                  <td>${{Number.isFinite(r.ID_in) ? r.ID_in.toFixed(2) : "—"}}</td>
                  <td>${{r.clamped_min ? "yes" : "no"}}</td>
                  <td>${{r.clamped_max ? "yes" : "no"}}</td>
                </tr>
              `).join("");
          }}

          document.getElementById("btnRun").addEventListener("click", () => {{
            render(runDashboardSimulation());
          }});

          render(runDashboardSimulation());
        </script>
      </body>
    </html>
    """