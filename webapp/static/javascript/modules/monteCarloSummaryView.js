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

/**
 * Render a Monte Carlo simulation summary into the experiment design UI.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   simulation: Monte Carlo protocol simulation result object.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Replaces dom.monteCarloSummary.innerHTML and makes the summary panel visible.
 *
 * Expected simulation structure:
 *   - simulation.meta: global Monte Carlo metadata and diagnostics
 *   - simulation.blocks: per-block Monte Carlo result objects
 *
 * Rendered information:
 *   - global KPI summary
 *   - warning messages
 *   - per-block clamp statistics
 *   - link to the extended Monte Carlo dashboard
 *
 * Important:
 *   This function only displays results. The simulation itself is computed in
 *   monteCarlo.js before this renderer is called.
 */
export function renderMonteCarloSummary(dom, simulation) {
  if (!dom.monteCarloSummary) return;

  // Global metadata produced by the Monte Carlo simulation.
  const meta = simulation.meta ?? {};

  // Per-block simulation results.
  const blocks = simulation.blocks ?? [];

  // Warning list collected during the Monte Carlo protocol analysis.
  const warnings = meta.warnings ?? [];

  /**
   * Build table rows for per-block Monte Carlo diagnostics.
   *
   * Each row shows how much of the planned W distribution was clamped to the
   * minimum or maximum target-size constraints.
   */
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

  /**
   * Build the warning section.
   *
   * If warnings exist, each warning is shown with the corresponding block
   * number. Otherwise, a neutral message is displayed.
   */
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

  // Render the complete summary panel.
  // UI text is German by design.
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

  // Make the summary visible after content has been rendered.
  dom.monteCarloSummary.style.display = "block";
}