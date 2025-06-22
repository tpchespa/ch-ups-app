
export function saveRowChanges(entryId, button, SwalWithDarkTheme) {
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

export function deleteEntry(entryId, SwalWithDarkTheme, socket) {
  const row = document.querySelector(`tr[data-id="${entryId}"]`);
  if (!row) return;

  const json = row.getAttribute("data-json");
  if (!json) return;

  let recentlyDeleted = null;

  try {
    recentlyDeleted = JSON.parse(json);
  } catch (e) {
    console.error("Failed to parse row data for undo", e);
    return;
  }

  SwalWithDarkTheme.fire({
    title: 'Are you sure?',
    text: 'This shipment will be deleted.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it',
    cancelButtonText: 'Cancel',
  }).then((result) => {
    if (result.isConfirmed) {
      row.classList.add("fading-out");
      setTimeout(() => {
        row.remove();
        socket.emit("delete_entry", { id: entryId });

        SwalWithDarkTheme.fire({
          toast: true,
          position: 'bottom-end',
          icon: 'info',
          title: 'Deleted. Click to undo.',
          showConfirmButton: true,
          confirmButtonText: 'Undo',
          timer: 5000,
          timerProgressBar: true,
        }).then(result => {
          if (result.isConfirmed && recentlyDeleted) {
            socket.emit("submit_form", recentlyDeleted);
          }
        });

      }, 300);
    }
  });
}
