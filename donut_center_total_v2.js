const VIEW_SIZE = 300;
const CENTER = VIEW_SIZE / 2;
const OUTER_RADIUS = 112;

const PALETTES = {
  classic: [
    "#32AD10",
    "#FFFFFF",
    "#F6F6F6",
    "#D9D8D6",
    "#434141",
    "#48762B",
    "#136232",
    "#558BDB",
    "#FF671D",
    "#61CC45",
    "#9DB9E6",
    "#FFB28C",
    "#BCEDAF",
    "#DBE6F7",
    "#FFD9B2",
  ],
  ocean: [
    "#1D3557",
    "#457B9D",
    "#A8DADC",
    "#E63946",
    "#F1FAEE",
    "#2A9D8F",
    "#264653",
    "#7EC8E3",
    "#90E0EF",
    "#F4A261",
    "#2D6A4F",
    "#4CC9F0",
    "#BDE0FE",
    "#CDB4DB",
    "#FFC8DD",
  ],
  warm: [
    "#F94144",
    "#F3722C",
    "#F8961E",
    "#F9C74F",
    "#90BE6D",
    "#577590",
    "#E76F51",
    "#FFB703",
    "#FB8500",
    "#A3B18A",
    "#E9C46A",
    "#F4A261",
    "#2A9D8F",
    "#7F5539",
    "#D4A373",
  ],
  forest: [
    "#1B4332",
    "#2D6A4F",
    "#40916C",
    "#74C69D",
    "#95D5B2",
    "#B7E4C7",
    "#D8F3DC",
    "#081C15",
    "#52B788",
    "#40916C",
    "#2D6A4F",
    "#1B4332",
    "#74C69D",
    "#95D5B2",
    "#B7E4C7",
  ],
  dexcom = [
    "#32AD10", 
    "#FFFFFF", 
    "#F6F6F6", 
    "#D9D8D6", 
    "#434141", 
    "#48762B", 
    "#136232", 
    "#558BDB", 
    "#FF671D", 
    "#61CC45", 
    "#9DB9E6", 
    "#FFB28C", 
    "#BCEDAF", 
    "#DBE6F7", 
    "#FFD9B2",
];

};

looker.plugins.visualizations.add({
  id: "donut_center_total",
  label: "Donut (Center Total)",

  options: {
    inner_radius: {
      type: "number",
      label: "Donut hole (% of radius)",
      default: 70,
      section: "Style",
      order: 1,
    },
    palette_mode: {
      type: "enum",
      label: "Color palette",
      default: "classic",
      section: "Style",
      order: 2,
      values: [
        { Classic: "classic" },
        { Ocean: "ocean" },
        { Warm: "warm" },
        { Forest: "forest" },
      ],
    },
    show_slice_percentages: {
      type: "boolean",
      label: "Percentage on slices",
      default: true,
      section: "Style",
      order: 3,
    },
    show_legend: {
      type: "boolean",
      label: "Show legend",
      default: true,
      section: "Style",
      order: 4,
    },
    show_center_total: {
      type: "boolean",
      label: "Show center total",
      default: true,
      section: "Center",
      order: 1,
    },
    center_label: {
      type: "string",
      label: "Center caption (blank uses measure name)",
      default: "",
      section: "Center",
      order: 2,
      placeholder: "Total Revenue",
    },
    value_prefix: {
      type: "string",
      label: "Value prefix",
      default: "",
      section: "Center",
      order: 3,
      placeholder: "$",
    },
    value_suffix: {
      type: "string",
      label: "Value suffix",
      default: "",
      section: "Center",
      order: 4,
    },
    decimals: {
      type: "number",
      label: "Decimals",
      default: 0,
      section: "Center",
      order: 5,
    },
    abbreviate: {
      type: "boolean",
      label: "Abbreviate (1.2M)",
      default: false,
      section: "Center",
      order: 6,
    },
  },

  create(element) {
    element.innerHTML = `
      <style>
        .dct-root { display:flex; flex-direction:column; width:100%; height:100%; box-sizing:border-box; padding:6px; font-family:"Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif; }
        .dct-chart { flex:1 1 auto; min-height:0; display:flex; align-items:center; justify-content:center; }
        .dct-chart svg { width:100%; height:100%; }
        .dct-slice { cursor:pointer; transition:opacity .15s ease; }
        .dct-slice:hover { opacity:.75; }
        .dct-legend { flex:0 0 auto; display:flex; flex-wrap:wrap; justify-content:center; gap:3px 14px; padding-top:6px; font-size:11px; color:#3A4245; }
        .dct-legend-item { display:flex; align-items:center; gap:5px; max-width:160px; }
        .dct-legend-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .dct-swatch { width:9px; height:9px; border-radius:2px; flex:0 0 auto; }
      </style>
      <div class="dct-root">
        <div class="dct-chart"></div>
        <div class="dct-legend"></div>
      </div>
    `;
    this._chartEl = element.querySelector(".dct-chart");
    this._legendEl = element.querySelector(".dct-legend");
  },

  updateAsync(data, element, config, queryResponse, details, doneRendering) {
    this.clearErrors();

    const dimensions = (queryResponse.fields && queryResponse.fields.dimension_like) || [];
    const measures = (queryResponse.fields && queryResponse.fields.measure_like) || [];

    if (!dimensions.length || !measures.length) {
      this.addError({
        title: "Needs one dimension and one measure",
        message: "Add at least one dimension and one measure to this query.",
      });
      doneRendering();
      return;
    }

    if (queryResponse.pivots && queryResponse.pivots.length) {
      this.addError({
        title: "Pivots are not supported",
        message: "Remove the pivot to use this visualization.",
      });
      doneRendering();
      return;
    }

    const dimension = dimensions[0];
    const measure = measures[0];
    const innerPercent = Math.min(90, Math.max(20, Number(config.inner_radius) || 70));
    const innerRadius = (OUTER_RADIUS * innerPercent) / 100;
    const colors = getPaletteColors(config.palette_mode);
    const result = buildSlices(data || [], dimension.name, measure.name, innerRadius, colors);

    if (!result.slices.length) {
      this.addError({
        title: "No positive values to chart",
        message: `${measure.label_short || measure.label || measure.name} has no values greater than zero.`,
      });
      this._chartEl.innerHTML = "";
      this._legendEl.innerHTML = "";
      doneRendering();
      return;
    }

    const sliceMarkup =
      result.slices.length === 1
        ? fullRingMarkup(result.slices[0], innerRadius)
        : result.slices
            .map(
              (slice) =>
                `<path class="dct-slice" d="${ringSegmentPath(slice.startAngle, slice.endAngle, innerRadius)}" fill="${escapeAttr(slice.color)}" data-row="${slice.rowIndex}"><title>${escapeHtml(slice.tooltip)}</title></path>`
            )
            .join("");

    const labelMarkup =
      config.show_slice_percentages === false
        ? ""
        : result.slices.map(sliceLabelMarkup).join("");

    const centerMarkup =
      config.show_center_total === false
        ? ""
        : centerTextMarkup(
            formatTotal(result.total, config),
            config.center_label || measure.label_short || measure.label || measure.name,
            innerRadius
          );

    this._chartEl.innerHTML = `
      <svg viewBox="0 0 ${VIEW_SIZE} ${VIEW_SIZE}" preserveAspectRatio="xMidYMid meet">
        ${sliceMarkup}
        ${labelMarkup}
        ${centerMarkup}
      </svg>
    `;

    this._legendEl.innerHTML =
      config.show_legend === false
        ? ""
        : result.slices
            .map(
              (slice) =>
                `<span class="dct-legend-item">
                  <span class="dct-swatch" style="background:${escapeAttr(slice.color)}"></span>
                  <span class="dct-legend-label">${escapeHtml(slice.label)}</span>
                </span>`
            )
            .join("");

    const slicesByRow = new Map(result.slices.map((slice) => [slice.rowIndex, slice]));
    this._chartEl.querySelectorAll(".dct-slice").forEach((node) => {
      node.addEventListener("click", (event) => {
        const slice = slicesByRow.get(Number(node.dataset.row));
        if (slice && slice.links.length && window.LookerCharts && LookerCharts.Utils) {
          LookerCharts.Utils.openDrillMenu({ links: slice.links, event });
        }
      });
    });

    doneRendering();
  },
});

function getPaletteColors(mode) {
  return PALETTES[mode] || PALETTES.classic;
}

function buildSlices(data, dimensionName, measureName, innerRadius, colors) {
  const rows = data
    .map((row, rowIndex) => {
      const dimCell = row[dimensionName] || {};
      const measureCell = row[measureName] || {};
      const value = Number(measureCell.value);
      return {
        rowIndex,
        label: String(dimCell.rendered ?? dimCell.value ?? ""),
        value,
        links: dimCell.links || measureCell.links || [],
      };
    })
    .filter((row) => Number.isFinite(row.value) && row.value > 0);

  const total = rows.reduce((sum, row) => sum + row.value, 0);

  let angle = -Math.PI / 2;
  const slices = rows.map((row, index) => {
    const endAngle = angle + (row.value / total) * Math.PI * 2;
    const slice = {
      ...row,
      color: String(colors[index % colors.length]),
      startAngle: angle,
      endAngle,
      percent: (row.value / total) * 100,
      tooltip: `${row.label}: ${row.value}`,
    };
    angle = endAngle;
    return slice;
  });

  return { slices, total };
}

function point(radius, angle) {
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

function ringSegmentPath(start, end, innerRadius) {
  const outerStart = point(OUTER_RADIUS, start);
  const outerEnd = point(OUTER_RADIUS, end);
  const innerEnd = point(innerRadius, end);
  const innerStart = point(innerRadius, start);
  const large = end - start > Math.PI ? 1 : 0;
  return `M${outerStart.x} ${outerStart.y} A${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y} L${innerEnd.x} ${innerEnd.y} A${innerRadius} ${innerRadius} 0 ${large} 0 ${innerStart.x} ${innerStart.y} Z`;
}

function fullRingMarkup(slice, innerRadius) {
  const top = ringSegmentPath(slice.startAngle, slice.startAngle + Math.PI, innerRadius);
  const bottom = ringSegmentPath(slice.startAngle + Math.PI, slice.startAngle + Math.PI * 2, innerRadius);
  return `<path class="dct-slice" d="${top} ${bottom}" fill="${escapeAttr(slice.color)}" data-row="${slice.rowIndex}"><title>${escapeHtml(slice.tooltip)}</title></path>`;
}

function sliceLabelMarkup(slice) {
  const mid = (slice.startAngle + slice.endAngle) / 2;
  const p = point((OUTER_RADIUS + OUTER_RADIUS * 0.7) / 2, mid);
  return `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="11" font-weight="600">${slice.percent.toFixed(1)}%</text>`;
}

function centerTextMarkup(value, label, innerRadius) {
  const size = Math.max(12, Math.min(24, innerRadius / 3.2));
  return `
    <text x="${CENTER}" y="${CENTER - 5}" text-anchor="middle" fill="#3A4245" font-size="11">${escapeHtml(label)}</text>
    <text x="${CENTER}" y="${CENTER + size}" text-anchor="middle" fill="#111827" font-size="${size}" font-weight="700">${escapeHtml(value)}</text>
  `;
}

function formatTotal(value, config) {
  let decimals = Math.max(0, Math.min(20, Number(config.decimals) || 0));
  let number = Number(value);
  let suffix = "";

  if (config.abbreviate) {
    const units = [
      [1e9, "B"],
      [1e6, "M"],
      [1e3, "K"],
    ];
    for (const [threshold, unit] of units) {
      if (Math.abs(number) >= threshold) {
        number /= threshold;
        suffix = unit;
        break;
      }
    }
  }

  return `${config.value_prefix || ""}${number.toFixed(decimals)}${suffix}${config.value_suffix || ""}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
