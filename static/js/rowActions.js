
export function saveRowChanges(entryId, button) {
  const row = button.closest("tr");
  const cells = row.querySelectorAll("td");

  const fieldMap = [
    "Contact Name", "Company or Name", "Country", "Address 1", "City",
    "State/Prov/Other", "Postal Code", "Telephone", "Consignee Email", "Packaging Type",
    "Weight", "Length", "Width", "Height", "Description of Goods", "Documents of No Commercial Value",
    "Service", "Reference 1", "Reference 2", "nr zamówienia gdzie będzie doliczony koszt",
    "NR PROJEKTU", "NR LISTU UPS", "KOSZT (LOGISTYKA)", "DATA WYSYŁKI"
  ];

  const data = {};
  for (let i = 0; i < fieldMap.length; i++) {
    const cell = cells[i + 3]; // skip delete, time, user
    data[fieldMap[i]] = cell?.textContent.trim() || "";
  }

  fetch(`/update-entry/${entryId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(res => {
    if (res.ok) {
      SwalWithDarkTheme.fire({ icon: "success", text: "Changes saved!" });
    } else {
      SwalWithDarkTheme.fire({ icon: "error", text: "Failed to save changes." });
    }
  });
}
