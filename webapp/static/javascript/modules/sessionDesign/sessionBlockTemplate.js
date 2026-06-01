/**
 * Session block HTML template.
 *
 * Organigram reference:
 * - Experiment Design
 *   → Session Block Editor
 *   → Block Template
 *
 * Responsibility:
 * Builds the HTML markup for one editable protocol block.
 *
 * Important:
 * This module only creates markup.
 * It does not read UI values or update application state.
 */

export function blockTemplate(idx, block) {
  const id = (suffix) => `blk_${idx}_${suffix}`;

  const shape =
    block.shape ?? "circle";

  const requiredOverlap =
    block.required_overlap ?? "1.0";

  return `
  <div class="sessionBlock" data-idx="${idx}">
    <div class="row">
      <div>
        <label>Zielform</label>
        <select id="${id("shape")}">
          <option value="circle" ${shape === "circle" ? "selected" : ""}>Kreis</option>
          <option value="square" ${shape === "square" ? "selected" : ""}>Quadrat</option>
          <option value="triangle" ${shape === "triangle" ? "selected" : ""}>Dreieck</option>
          <option value="pentagon" ${shape === "pentagon" ? "selected" : ""}>Fünfeck</option>
          <option value="hexagon" ${shape === "hexagon" ? "selected" : ""}>Sechseck</option>
          <option value="octagon" ${shape === "octagon" ? "selected" : ""}>Achteck</option>
          <option value="diamond" ${shape === "diamond" ? "selected" : ""}>Raute</option>
          <option value="shuffle" ${shape === "shuffle" ? "selected" : ""}>Zufällig / Shuffle</option>
          <option value="band1d_h" ${shape === "band1d_h" ? "selected" : ""}>1D Band horizontal</option>
          <option value="band1d_v" ${shape === "band1d_v" ? "selected" : ""}>1D Band vertikal</option>
        </select>
      </div>

      <div>
        <label>Parametermodus</label>
        <select id="${id("param_mode")}">
          <option value="A_W" ${block.param_mode === "A_W" ? "selected" : ""}>A + W</option>
          <option value="ID_W" ${block.param_mode === "ID_W" ? "selected" : ""}>ID + W</option>
          <option value="ID_A" ${block.param_mode === "ID_A" ? "selected" : ""}>ID + A</option>
        </select>
      </div>

      ${parameterFieldTemplate({
        id,
        key: "A",
        label: "A",
        inputId: "dist",
        randomId: "random_A",
        value: block.dist_entered ?? "0.50",
        random: !!block.random_A,
        placeholder: "0.5 oder [0.1,0.3,0.5]",
      })}

      ${parameterFieldTemplate({
        id,
        key: "W",
        label: "W",
        inputId: "width",
        randomId: "random_W",
        value: block.width_entered ?? "0.05",
        random: !!block.random_W,
        placeholder: "0.05 oder [0.03,0.05]",
      })}

      ${parameterFieldTemplate({
        id,
        key: "ID",
        label: "ID",
        inputId: "id",
        randomId: "random_ID",
        value: block.id_entered ?? "5",
        random: !!block.random_ID,
        placeholder: "5 oder [3,4,5,6]",
      })}

      <div>
        <label>Required Overlap</label>
        <input
          id="${id("required_overlap")}"
          type="number"
          min="0"
          max="1"
          step="0.05"
          value="${requiredOverlap}">
      </div>

      <button type="button" id="${id("remove")}">Entfernen</button>
    </div>
  </div>
  `;
}

function parameterFieldTemplate({
  id,
  label,
  inputId,
  randomId,
  value,
  random,
  placeholder,
}) {
  return `
    <div>
      <label class="fieldLabel">
        <span>${label}</span>

        <button
          type="button"
          id="${id(randomId)}"
          class="randomToggle"
          data-active="${random ? "1" : "0"}"
          title="Random ${label}">
        </button>
      </label>

      <input
        id="${id(inputId)}"
        type="text"
        value="${value}"
        placeholder="${placeholder}">
    </div>
  `;
}