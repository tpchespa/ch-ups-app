import { clearForm } from './uiHelpers.js';
import { validateFields } from './formValidation.js';

let recentlyDeleted = null;

export function initializeSocketHandlers(socket, currentUserEmail, SwalWithDarkTheme) {
  socket.on("new_entry", data => {
    const tbody = document.getElementById("submission-body");
    if (!tbody) return;

    if ((data.data["_submitted_by"] || "") === currentUserEmail) {
      clearForm();
      SwalWithDarkTheme.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Shipment added and form cleared.',
        showConfirmButton: false,
        timer: 2000
      });
    }

    const createdBy = data.data["_submitted_by"] || "?";
    const canDelete = createdBy === currentUserEmail;
    let timestamp = "?";
    if (data.data["_submitted_at"]) {
      const date = new Date(data.data["_submitted_at"] + "Z");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      timestamp = `${hours}:${minutes}`;
    }

    const tr = document.createElement("tr");
    tr.setAttribute("data-id", data.id);
    tr.setAttribute("data-json", JSON.stringify(data.data)); // helpful for delete/undo

    const deleteTd = document.createElement("td");
    if (canDelete) {
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "✖";
      deleteBtn.className = "tiny-delete";

      deleteBtn.addEventListener("click", () => {
        SwalWithDarkTheme.fire({
          title: 'Are you sure?',
          text: 'This shipment will be deleted.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, delete it',
          cancelButtonText: 'Cancel',
        }).then((result) => {
          if (result.isConfirmed) {
            // store the data for potential undo
            recentlyDeleted = data.data;

            tr.classList.add("fading-out");
            setTimeout(() => {
              tr.remove();
              socket.emit("delete_entry", { id: data.id });

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
                  recentlyDeleted = null;
                }
              });

            }, 300);
          }
        });
      });

      deleteTd.appendChild(deleteBtn);
    } else {
      deleteTd.innerHTML = "&mdash;";
    }
    tr.appendChild(deleteTd);

    const shownFields = [timestamp, createdBy,
      data.data["Contact Name"], data.data["Company or Name"], data.data["Country"], data.data["Address 1"],
      data.data["City"], data.data["State/Prov/Other"], data.data["Postal Code"], data.data["Telephone"],
      data.data["Consignee Email"], data.data["Packaging Type"], data.data["Weight"], data.data["Length"],
      data.data["Width"], data.data["Height"], data.data["Description of Goods"],
      data.data["Documents of No Commercial Value"], data.data["Service"],
      data.data["Reference 1"], data.data["Reference 2"],
      data.data["nr zamówienia gdzie będzie doliczony koszt"],
      data.data["NR PROJEKTU"], data.data["NR LISTU UPS"],
      data.data["KOSZT (LOGISTYKA)"], data.data["DATA WYSYŁKI"]
    ];

    shownFields.forEach(val => {
      const td = document.createElement("td");
      td.textContent = val || "";
      if (canDelete) td.classList.add("own-entry-cell");
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  socket.on("entry_deleted", data => {
    const row = document.querySelector(`tr[data-id="${data.id}"]`);
    if (row) {
      row.classList.add("fading-out");
      setTimeout(() => row.remove(), 300);
    }
  });

  socket.on('form_error', (payload) => {
  
  const errorBox = document.getElementById("form-errors");

  // Clear global box and any previous field errors
  document.getElementById("form-errors").style.display = "none";
  document.querySelectorAll("input").forEach(input => input.classList.remove("input-error"));
  document.querySelectorAll(".field-error").forEach(div => div.innerText = "");

    payload.errors.forEach(msg => {
      let matched = false;

      // Match to known fields and display inline error
      validateFields.forEach(field => {
        if (msg.includes(field.label)) {
          const input = document.getElementById(field.id);
          const errorDiv = document.getElementById("error-" + field.id);
          if (input && errorDiv) {
            input.classList.add("input-error");
            errorDiv.innerText = msg;
            matched = true;
          }
        }
      });

      // If not matched to a field, fall back to general error box
      if (!matched) {
        errorBox.innerText += msg + "\n";
        errorBox.style.display = "block";
      }
    });
  });
}