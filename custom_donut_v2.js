looker.plugins.visualizations.add({
  id: "custom_donut_v4",
  label: "Custom Donut v4",

  options: {
    chart_title: {
      type: "string",
      label: "Title",
      default: "Sales by Category",
      section: "Style"
    },

    title_font_size: {
      type: "number",
      label: "Header Font Size",
      default: 18,
      section: "Style"
    },

    donut_thickness: {
      type: "number",
      label: "Ring Thickness",
      default: 26,
      section: "Style"
    },

    legend_position: {
      type: "string",
      label: "Legend Position",
      display: "select",
      values: [
        { "Right": "right" },
        { "Left": "left" },
        { "Top": "top" },
        { "Bottom": "bottom" }
      ],
      default: "bottom",
      section: "Legend"
    },

    show_legend: {
      type: "boolean",
      label: "Show Legend",
      default: true,
      section: "Legend"
    },

    decimals: {
      type: "number",
      label: "Decimals",
      default: 1,
      section: "Formatting"
    },

    currency_prefix: {
      type: "string",
      label: "Prefix",
      default: "$",
      section: "Formatting"
    }
  },

  create: function (element) {
    element.innerHTML = `
      <style>
        *{
          box-sizing:border-box;
          font-family:Roboto, Arial, sans-serif;
        }

        html, body{
          margin:0;
          padding:0;
          overflow:hidden;
        }

        .wrap{
          width:100%;
          height:100%;
          padding:12px;
          background:#fff;
          display:flex;
          flex-direction:column;
          overflow:hidden;
        }

        .title{
          font-weight:700;
          color:#111827;
          margin-bottom:8px;
          flex:0 0 auto;
        }

        .body{
          flex:1;
          display:flex;
          min-height:0;
          gap:12px;
          overflow:hidden;
        }

        .body.right{flex-direction:row;}
        .body.left{flex-direction:row-reverse;}
        .body.top{flex-direction:column-reverse;}
        .body.bottom{flex-direction:column;}

        .chart{
          flex:1;
          display:flex;
          align-items:center;
          justify-content:center;
          min-height:0;
        }

        .legend{
          display:flex;
          flex-direction:column;
          gap:6px;
          overflow:hidden;
          font-size:13px;
          justify-content:center;
        }

        .legend.top,
        .legend.bottom{
          flex-direction:row;
          flex-wrap:wrap;
        }

        .row{
          display:grid;
          grid-template-columns:12px auto auto auto;
          gap:8px;
          align-items:center;
          white-space:nowrap;
        }

        .dot{
          width:10px;
          height:10px;
          border-radius:50%;
        }

        .name{color:#111827;}
        .pct{color:#6b7280;}
        .val{font-weight:600;color:#111827;}

        .center-small{
          font-size:11px;
          fill:#6b7280;
        }

        .center-big{
          font-size:28px;
          font-weight:700;
          fill:#111827;
        }

        path{
          cursor:pointer;
          transition:opacity .15s ease;
        }
      </style>

      <div class="wrap">
        <div class="title" id="title"></div>

        <div class="body" id="body">
          <div class="chart" id="chart"></div>
          <div class="legend" id="legend"></div>
        </div>
      </div>
    `;
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    try {
      const title = element.querySelector("#title");
      const body = element.querySelector("#body");
      const chart = element.querySelector("#chart");
      const legend = element.querySelector("#legend");

      title.innerText = config.chart_title || "Donut";
      title.style.fontSize = (config.title_font_size || 18) + "px";

      const pos = config.legend_position || "bottom";
      body.className = "body " + pos;
      legend.className = "legend " + pos;

      const dim = queryResponse.fields.dimension_like[0].name;
      const measure = queryResponse.fields.measure_like[0].name;

      const rows = data.map(r => ({
        label: String(r[dim].value),
        value: Number(r[measure].value || 0)
      }));

      const total = rows.reduce((a, b) => a + b.value, 0);

      const colors = [
        "#7c4ce0",
        "#1298b8",
        "#0aa84f",
        "#d99a00",
        "#c94398",
        "#ef4444",
        "#14b8a6",
        "#6366f1"
      ];

      const size = Math.min(
        chart.clientWidth || 260,
        chart.clientHeight || 260,
        260
      );

      const cx = size / 2;
      const cy = size / 2;
      const outer = size * 0.42;
      const inner = outer - (config.donut_thickness || 26);

      let start = -Math.PI / 2;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", size);
      svg.setAttribute("height", size);

      const t1 = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t1.setAttribute("x", cx);
      t1.setAttribute("y", cy - 8);
      t1.setAttribute("text-anchor", "middle");
      t1.setAttribute("class", "center-small");
      t1.textContent = "TOTAL";

      const t2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t2.setAttribute("x", cx);
      t2.setAttribute("y", cy + 20);
      t2.setAttribute("text-anchor", "middle");
      t2.setAttribute("class", "center-big");
      t2.textContent = compact(total);

      rows.forEach((row, i) => {
        const ang = total === 0 ? 0 : (row.value / total) * Math.PI * 2;
        const end = start + ang;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", arc(cx, cy, inner, outer, start, end));
        path.setAttribute("fill", colors[i % colors.length]);

        path.addEventListener("mouseenter", function () {
          path.style.opacity = "0.85";
          t1.textContent = row.label;
          t2.textContent = fmt(row.value);
        });

        path.addEventListener("mouseleave", function () {
          path.style.opacity = "1";
          t1.textContent = "TOTAL";
          t2.textContent = compact(total);
        });

        svg.appendChild(path);
        start = end;
      });

      svg.appendChild(t1);
      svg.appendChild(t2);

      chart.innerHTML = "";
      chart.appendChild(svg);

      if (config.show_legend === false) {
        legend.innerHTML = "";
      } else {
        legend.innerHTML = rows.map((r, i) => {
          const pct = total === 0 ? 0 : (r.value / total) * 100;

          return `
            <div class="row">
              <div class="dot" style="background:${colors[i % colors.length]}"></div>
              <div class="name">${escapeHtml(r.label)}</div>
              <div class="pct">${pct.toFixed(1)}%</div>
              <div class="val">${fmt(r.value)}</div>
            </div>
          `;
        }).join("");
      }

      done();

      function arc(cx, cy, r1, r2, a0, a1) {
        const large = a1 - a0 > Math.PI ? 1 : 0;

        const p1 = pt(r2, a0);
        const p2 = pt(r2, a1);
        const p3 = pt(r1, a1);
        const p4 = pt(r1, a0);

        return `
          M ${cx + p1.x} ${cy + p1.y}
          A ${r2} ${r2} 0 ${large} 1 ${cx + p2.x} ${cy + p2.y}
          L ${cx + p3.x} ${cy + p3.y}
          A ${r1} ${r1} 0 ${large} 0 ${cx + p4.x} ${cy + p4.y}
          Z
        `;
      }

      function pt(r, a) {
        return {
          x: r * Math.cos(a),
          y: r * Math.sin(a)
        };
      }

      function compact(n) {
        const d = Number(config.decimals || 1);

        if (Math.abs(n) >= 1000000000) return (n / 1000000000).toFixed(d) + "B";
        if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(d) + "M";
        if (Math.abs(n) >= 1000) return (n / 1000).toFixed(d) + "k";
        return Number(n).toFixed(d);
      }

      function fmt(n) {
        return (config.currency_prefix || "$") + compact(n);
      }

      function escapeHtml(str) {
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

    } catch (e) {
      element.innerHTML =
        "<div style='padding:12px;color:red'>Error: " + e.message + "</div>";
      done();
    }
  }
});
