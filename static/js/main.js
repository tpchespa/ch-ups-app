import { countryMap, packagingMap, serviceMap } from './fieldMappings.js';
import { validateAllFields, validateFields, cleanInputValue } from './formValidation.js';
import { setupFieldValidation } from './formValidation.js';
import { validateFieldDirect } from './formValidation.js';
import { initializeSocketHandlers } from './socketHandlers.js';
import { clearForm, setupTooltipHandlers } from './uiHelpers.js';
import { setupAutocomplete } from './autocomplete.js';
import { fetchSavedContacts, setupContactSelection } from './contacts.js';
import { initDatePicker } from './datepicker.js';
import { saveRowChanges } from './rowActions.js';
import { deleteEntry } from './rowActions.js';
import { initializeCellTracking, setupSaveAllButton, warnOnExit } from './tableChangeTracker.js';



document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const currentUserEmail = window.currentUserEmail || "{{ current_user.email }}";

  // SweetAlert2 mixin
  const SwalWithDarkTheme = Swal.mixin({
    customClass: {
      popup: 'swal2-popup'
    }
  });

  window.saveRowChanges = saveRowChanges;
  window.SwalWithDarkTheme = SwalWithDarkTheme;
  window.deleteEntry = (id) => deleteEntry(id, SwalWithDarkTheme, socket);

  // Initialize core modules
  initDatePicker();
  setupTooltipHandlers();
  setupContactSelection();
  fetchSavedContacts();
  setupFieldValidation();
  initializeSocketHandlers(socket, currentUserEmail, SwalWithDarkTheme);
  window.validateFieldDirect = validateFieldDirect;

  // Autocomplete fields
  const enablePackagingAutocomplete = false;
  const enableServiceAutocomplete = false;
  const enableCountryAutocomplete = true;
  if (enableCountryAutocomplete) {
    setupAutocomplete("Country", "country-suggestions", countryMap);
  }
  if (enablePackagingAutocomplete) {
    setupAutocomplete("Packaging_Type", "packaging-suggestions", packagingMap);
  }
  if (enableServiceAutocomplete) {
    setupAutocomplete("Service", "service-suggestions", serviceMap);
  }
  

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

 document.querySelectorAll('td[data-ts]').forEach(td => {
  const raw = td.getAttribute('data-ts');
  if (!raw) return;

  const d = new Date(raw.endsWith("Z") ? raw : raw + "Z");
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("month")) {
    const day = String(d.getDate()).padStart(2, '0');
    td.textContent = `${day}; ${timeStr}`;
  } else {
    td.textContent = timeStr;
  }
});

 document.getElementById('user-filter')?.addEventListener('change', () => {
   const selectedUser = document.getElementById('user-filter').value;
   const selectedDate = document.getElementById('unified-picker')?.value;
   const viewMode = document.getElementById('view-mode')?.value;

   const params = new URLSearchParams();

   if (selectedUser) params.set('user', selectedUser);
   if (selectedDate && viewMode === 'date') params.set('date', selectedDate);
   if (selectedDate && viewMode === 'month') params.set('month', selectedDate);

   window.location.href = `/?${params.toString()}`;
 });

 initializeCellTracking();
 setupSaveAllButton(SwalWithDarkTheme);
 warnOnExit(SwalWithDarkTheme);
 
});
