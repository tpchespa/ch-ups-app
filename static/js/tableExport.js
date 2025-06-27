  export function exportVisibleTableToXLSX() {
    const now = new Date().toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Warsaw"
    }).replace(/\./g, "-").replace(",", "").replace(/:/g, "-").trim();

    window.table.download("xlsx", `visible_table_${now}.xlsx`, {
      sheetName: "VisibleTable"
    });
  }

