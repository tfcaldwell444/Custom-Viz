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
    colors: {
      type: "array",
      display: "colors",
      label: "Slice colors",
      default: DEFAULT_COLORS,
      section: "Style",
      order: 2,
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
        .dct-root {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          padding: 6px;
          font-family: "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
        }
        .dct-chart { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; }
        .dct-chart svg { width: 100%; height: 100%; }
        .dct-slice { cursor: pointer; transition: opacity 0.15s ease; }
        .dct-slice:hover { opacity: 0.75; }
        .dct-legend {
          flex: 0 0 auto;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 3px 14px;
          padding-top: 6px;
          font-size: 11px;
          color: #3A4245;
        }
        .dct-legend-item { display: flex; align-items: center; gap: 5px; max-width: 160px; }
        .dct-legend-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dct-swatch { width: 9px; height: 9px; border-radius: 2px; flex: 0 0 auto; }
      </style>
      <div class="dct-root">
        <div class="dct-chart"></div>
        <div class="dct-legend"></div>
      </div>`;
    this._chartEl = element.querySelector(".dct-chart");
    this._legendEl = element.querySelector(".dct-legend");
  },

  updateAsync(data, element, config, queryResponse, details, doneRendering) {
    this.clearErrors();

    const dimensions = queryResponse.fields.dimension_like;
    const measures = queryResponse.fields.measure_like;

    if (dimensions.length < 1 || measures.length < 1) {
      this.addError({
        title: "Needs one dimension and one measure",
        message: "Add at least one dimension and one measure to this query.",
      });
      doneRendering();
      return;
    }
    if (queryResponse.pivots && queryResponse.pivots.length > 0) {
      this.addError({
        title: "Pivots are not supported",
        message: "Remove the pivot to use this visualization.",
      });
      doneRendering();
      return;
    }

    const dimension = dimensions[0];
    const measure = measures[0];
    const innerPercent = Math.min(
      90,
      Math.max(20, Number(config.inner_radius) || 70)
    );
    const innerRadius = (OUTER_RADIUS * innerPercent) / 100;
    const colors =
      Array.isArray(config.colors) && config.colors.length
        ? config.colors
        : DEFAULT_COLORS;

    const { slices, total } = buildSlices(
      data,
      dimension.name,
      measure.name,
      innerRadius,
      colors
    );

    if (!slices.length) {
      this.addError({
        title: "No positive values to chart",
        message: `${measure.label_short || measure.label} has no values greater than zero.`,
      });
      doneRendering();
      return;
    }

    const sliceMarkup =
      slices.length === 1
        ? fullRingMarkup(slices[0])
        : slices
            .map(
              (slice) =>
                `<path class="dct-slice" d="${ringSegmentPath(
                  slice.startAngle,
                  slice.endAngle,
                  innerRadius
                )}" fill="${slice.color}" data-row="${slice.rowIndex}"
                  ><title>${escapeHtml(slice.tooltip)}</title></path>`
            )
            .join("");

    const labelMarkup = config.show_slice_percentages
      ? slices.map(sliceLabelMarkup).join("")
      : "";

    const centerMarkup =
      config.show_center_total === false
        ? ""
        : centerTextMarkup(
            formatTotal(total, config),
            config.center_label || measure.label_short || measure.label,
            innerRadius
          );

    this._chartEl.innerHTML = `
      <svg viewBox="0 0 ${VIEW_SIZE} ${VIEW_SIZE}" preserveAspectRatio="xMidYMid meet">
        ${sliceMarkup}${labelMarkup}${centerMarkup}
      </svg>`;

    this._legendEl.innerHTML =
      config.show_legend === false
        ? ""
        : slices
            .map(
              (slice) =>
                `<span class="dct-legend-item">
                  <span class="dct-swatch" style="background:${slice.color}"></span>
                  <span class="dct-legend-label" title="${escapeHtml(slice.label)}">${escapeHtml(
                    slice.label
                  )}</span>
                </span>`
            )
            .join("");

    const slicesByRow = new Map(slices.map((slice) => [slice.rowIndex, slice]));
    this._chartEl.querySelectorAll(".dct-slice").forEach((node) => {
      node.addEventListener("click", (event) => {
        const slice = slicesByRow.get(Number(node.dataset.row));
        if (!slice || !slice.links.length) return;
        LookerCharts.Utils.openDrillMenu({ links: slice.links, event });
      });
    });

    doneRendering();
  },
});
