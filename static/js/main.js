import { countryMap, packagingMap, serviceMap } from './fieldMappings.js';
import { validateAllFields, validateFields, cleanInputValue } from './formValidation.js';
import { initializeSocketHandlers } from './socketHandlers.js';
import { clearForm, setupTooltipHandlers } from './uiHelpers.js';
import { setupAutocomplete } from './autocomplete.js';
import { fetchSavedContacts, setupContactSelection } from './contacts.js';
import { initDatePicker } from './datepicker.js';
import { saveRowChanges } from './rowActions.js';
import { deleteEntry } from './rowActions.js';
window.saveRowChanges = saveRowChanges;
window.deleteEntry = (id) => deleteEntry(id, SwalWithDarkTheme, socket);

document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const currentUserEmail = window.currentUserEmail || "{{ current_user.email }}";

  // SweetAlert2 mixin
  const SwalWithDarkTheme = Swal.mixin({
    customClass: {
      popup: 'swal2-popup'
    }
  });
  window.SwalWithDarkTheme = SwalWithDarkTheme;

  // Initialize core modules
  initDatePicker();
  setupTooltipHandlers();
  setupContactSelection();
  fetchSavedContacts();
  initializeSocketHandlers(socket, currentUserEmail, SwalWithDarkTheme);

  // Autocomplete fields
  setupAutocomplete("Country", "country-suggestions", countryMap);
  setupAutocomplete("Packaging_Type", "packaging-suggestions", packagingMap);
  setupAutocomplete("Service", "service-suggestions", serviceMap);

  // Set up paste handling for Excel-style input
  const firstField = validateFields[0]?.id;
  const firstInput = document.getElementById(firstField);
  if (firstInput) {
    firstInput.addEventListener('paste', (e) => {
      e.preventDefault();
      const clipboard = e.clipboardData.getData('text/plain');
      const values = clipboard.split('\t').map(v => v.trim());

      let valueIndex = 0;
      validateFields.forEach(field => {
        const input = document.getElementById(field.id);
        if (input && valueIndex < values.length) {
          input.value = values[valueIndex].replace(/\s+/g, " ");
          valueIndex++;
        }
      });

      validateAllFields();
    });
  }

  // Handle form submission
  const form = document.getElementById("form");
  if (form) {
    form.onsubmit = e => {
      e.preventDefault();
      if (!validateAllFields()) return;

      let altered = false;

      // Sanitize inputs before submission
      validateFields.forEach(field => {
        const input = document.getElementById(field.id);
        if (!input) return;
        if (field.alphanumeric) {
          const { cleaned, wasModified } = cleanInputValue(input.value, field.id === "Postal_Code");
          if (wasModified) {
            input.value = cleaned;
            altered = true;
          }
        }
      });

      // Collect all form data
      const data = {};
      validateFields.forEach(field => {
        const input = document.getElementById(field.id);
        if (input) data[field.label] = input.value.trim();
      });

      // Add custom fields
      data["nr zamówienia gdzie będzie doliczony koszt"] = document.getElementById("Custom_Order_Number")?.value.trim() || "";
      data["NR PROJEKTU"] = document.getElementById("Custom_Project_Number")?.value.trim() || "";
      data["NR LISTU UPS"] = document.getElementById("Custom_UPS_Number")?.value.trim() || "";
      data["KOSZT (LOGISTYKA)"] = document.getElementById("Custom_Cost")?.value.trim() || "";
      data["DATA WYSYŁKI"] = document.getElementById("Custom_Ship_Date")?.value.trim() || "";

      // Submit via socket
      const submit = () => socket.emit("submit_form", data);
      if (altered) {
        SwalWithDarkTheme.fire({
          icon: 'info',
          title: 'Input Adjusted',
          text: 'Some fields contained special characters and were auto-corrected before submission.',
          confirmButtonText: 'Continue'
        }).then(submit);
      } else {
        submit();
      }

      // Optionally save contact
      if (document.getElementById("saveContactCheckbox")?.checked) {
        fetch("/save_contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        }).then(res => {
          if (res.status === 409) {
            SwalWithDarkTheme.fire({
              icon: "info",
              title: "Contact already exists",
              text: "This contact is already in the saved list.",
              timer: 3000,
              showConfirmButton: false
            });
          } else {
            fetchSavedContacts();
          }
        });
      }
    };
  }

  // Restore advanced toggle state
  const wrapper = document.getElementById("advanced-wrapper");
  const toggleBtn = document.getElementById("toggle-advanced");
  if (wrapper && toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const isVisible = wrapper.classList.toggle("show");
      toggleBtn.textContent = isVisible ? "Hide Advanced Fields" : "Show Advanced Fields";
      localStorage.setItem("advancedVisible", isVisible);
      if (isVisible) wrapper.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    if (localStorage.getItem("advancedVisible") === "true") {
      wrapper.classList.add("show");
      toggleBtn.textContent = "Hide Advanced Fields";
    }
  }
});
