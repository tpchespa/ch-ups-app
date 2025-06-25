export function exportVisibleTableToXLSX() {
  const table = document.getElementById("horizontal-table");
  if (!table) return;

  const rows = [];
  const trs = table.querySelectorAll("tr");

  trs.forEach(tr => {
    const cells = tr.querySelectorAll("th, td");
    const row = [];
    cells.forEach(cell => {
      row.push(cell.innerText.trim());
    });
    rows.push(row);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "VisibleTable");

  const now = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "-");
  XLSX.writeFile(workbook, `visible_table_${now}.xlsx`);
}