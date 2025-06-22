let pendingChanges = new Map();
let hasUnsavedChanges = false;

const fieldMap = [
  "Contact Name", "Company or Name", "Country", "Address 1", "City",
  "State/Prov/Other", "Postal Code", "Telephone", "Consignee Email", "Packaging Type",
  "Weight", "Length", "Width", "Height", "Description of Goods", "Documents of No Commercial Value",
  "Service", "Reference 1", "Reference 2", "nr zamówienia gdzie będzie doliczony koszt",
  "NR PROJEKTU", "NR LISTU UPS", "KOSZT (LOGISTYKA)", "DATA WYSYŁKI"
];

export function initializeCellTracking() {
  document.querySelectorAll('#horizontal-table td.editable-cell').forEach(cell => {
    cell.addEventListener('input', () => {
      const row = cell.closest("tr");
      const entryId = row.dataset.id;
      const columnIndex = [...cell.parentElement.children].indexOf(cell);
      const fieldName = fieldMap[columnIndex - 3]; // skip: delete, time, user
      const newValue = cell.textContent.trim();

      if (!entryId || !fieldName) return;
      if (!pendingChanges.has(entryId)) pendingChanges.set(entryId, {});
      pendingChanges.get(entryId)[fieldName] = newValue;

      cell.classList.add("unsaved-change");
      hasUnsavedChanges = true;
    });
  });
}

export function setupSaveAllButton(SwalWithDarkTheme) {
  const saveButton = document.getElementById("save-all-button");
  if (!saveButton) return;

  saveButton.addEventListener("click", () => {
    if (pendingChanges.size === 0) return;

    const promises = [];
    for (const [entryId, data] of pendingChanges.entries()) {
      promises.push(
        fetch(`/update-entry/${entryId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        })
      );
    }

    Promise.all(promises).then(responses => {
      if (responses.every(r => r.ok)) {
        SwalWithDarkTheme.fire({ icon: "success", text: "All changes saved!" });
        document.querySelectorAll(".unsaved-change").forEach(cell => cell.classList.remove("unsaved-change"));
        pendingChanges.clear();
        hasUnsavedChanges = false;
      } else {
        SwalWithDarkTheme.fire({ icon: "error", text: "Some changes failed to save." });
      }
    });
  });
}

export function warnOnExit() {
  window.addEventListener("beforeunload", (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}
