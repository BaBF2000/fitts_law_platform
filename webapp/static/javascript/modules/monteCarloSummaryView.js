/**
 * Monte Carlo summary view.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *   → Summary View
 *   → Protocol Diagnostics
 *
 * Responsibility:
 * Renders the Monte Carlo protocol summary into the experiment design UI.
 *
 * Important:
 * This module only renders already-computed simulation results.
 * It does not run the simulation.
 */

export function renderMonteCarloSummary(dom, simulation) {
  if (!dom.monteCarloSummary) return;

  const meta = simulation.meta ?? {};
  const blocks = simulation.blocks ?? [];
  const warnings = meta.warnings ?? [];

  const blockRows =
    blocks.map((block) => {
      const counts = block.result?.counts ?? {};
      const blockMeta = block.result?.meta ?? {};

      return `
        <tr>
          <td>Block ${block.block_no}</td>
          <td>${block.shape}</td>
          <td>${block.param_mode}</td>
          <td>${(counts.clamped_min_pct ?? 0).toFixed(1)}%</td>
          <td>${(counts.clamped_max_pct ?? 0).toFixed(1)}%</td>
          <td>${(counts.clamped_total_pct ?? 0).toFixed(1)}%</td>
          <td>${blockMeta.sampling ?? "—"}</td>
        </tr>
      `;
    }).join("");

  const warningHtml =
    warnings.length
      ? `
        <div class="monteCarloWarnings">
          <h4>Warnungen</h4>
          ${warnings.map((warning) => `
            <p class="muted">
              <b>Block ${warning.block_no}</b>: ${warning.message}
            </p>
          `).join("")}
        </div>
      `
      : `<p class="muted">Keine kritischen Monte-Carlo-Warnungen.</p>`;

  dom.monteCarloSummary.innerHTML = `
    <h3>Monte-Carlo-Analyse</h3>

    <div class="kpi">
      <div><b>Blöcke</b><span>${meta.block_count ?? blocks.length}</span></div>
      <div><b>Samples / Block</b><span>${meta.n ?? "—"}</span></div>
      <div><b>Wmin Clamp Ø</b><span>${(meta.mean_clamped_min_pct ?? 0).toFixed(1)}%</span></div>
      <div><b>Wmax Clamp Ø</b><span>${(meta.mean_clamped_max_pct ?? 0).toFixed(1)}%</span></div>
      <div><b>Schlechtester Block</b><span>${meta.worst_block_no ?? "—"}</span></div>
      <div><b>Clamp max.</b><span>${(meta.worst_clamp_pct ?? 0).toFixed(1)}%</span></div>
      <div><b>Diagnose</b><span>${meta.worst_diagnostic ?? "—"}</span></div>
      <div><b>Warnungen</b><span>${meta.warning_count ?? warnings.length}</span></div>
    </div>

    ${warningHtml}

    <h4>Analyse pro Block</h4>

    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Block</th>
            <th>Form</th>
            <th>Parametermodus</th>
            <th>W → Wmin</th>
            <th>W → Wmax</th>
            <th>Clamp gesamt</th>
            <th>Verteilung</th>
          </tr>
        </thead>
        <tbody>
          ${blockRows || `<tr><td colspan="7">Keine Blöcke.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="row">
      <button type="button" onclick="window.open('/dashboard/montecarlo', '_blank')">
        Dashboard öffnen
      </button>
    </div>
  `;

  dom.monteCarloSummary.style.display = "block";
}