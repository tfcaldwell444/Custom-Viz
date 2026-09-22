looker.plugins.visualizations.add({
  id: "donut_center_total",
  label: "Donut with Center Total",
  create(element) {
    element.innerHTML = '<div class="chart" style="width:100%;height:100%"></div>';
  },
  updateAsync(data, element, config, queryResponse, details, done) {
    const dim = queryResponse.fields.dimension_like[0];
    const mea = queryResponse.fields.measure_like[0];
    const points = data.map((row) => ({
      name: row[dim.name].rendered ?? row[dim.name].value,
      y: row[mea.name].value,
    }));
    const total = points.reduce((sum, p) => sum + p.y, 0);

    Highcharts.chart(element.querySelector(".chart"), {
      chart: { type: "pie" },
      title: {
        useHTML: true,
        text:
          `<div style="text-align:center">` +
          `<div style="font-size:28px;font-weight:600">${total.toLocaleString()}</div>` +
          `<div style="font-size:12px;color:#707780">${mea.label_short}</div></div>`,
        align: "center",
        verticalAlign: "middle",
        floating: true,
        y: 0,
      },
      plotOptions: { pie: { innerSize: "70%" } },
      series: [{ data: points }],
    });
    done();
  },
});
