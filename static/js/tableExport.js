document.getElementById("download-visible-xlsx").addEventListener("click", () => {
  table.download("xlsx", `visible_table_${new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "-")}.xlsx`, {
    sheetName: "VisibleTable"
  });
});
