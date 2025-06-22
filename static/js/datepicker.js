export function initDatePicker() {
  const pickerInput = document.getElementById("unified-picker");
  const viewMode = document.getElementById("view-mode");

  if (!pickerInput || !viewMode) return;

  const urlParams = new URLSearchParams(window.location.search);
  let initialMode = urlParams.has("month") ? "month" : "date";
  viewMode.value = initialMode;

  function setupPicker(mode) {
    if (window.pickerInstance) {
      window.pickerInstance.destroy();
    }

    if (mode === "month") {
      window.pickerInstance = flatpickr(pickerInput, {
        dateFormat: "Y-m",
        defaultDate: window.selectedMonth || window.selectedDate,
        plugins: [new monthSelectPlugin({
          shorthand: true,
          dateFormat: "Y-m",
          altFormat: "F Y"
        })],
        onChange: (selectedDates, dateStr) => {
          window.location.href = `/?month=${dateStr}`;
        }
      });
    } else {
      window.pickerInstance = flatpickr(pickerInput, {
        dateFormat: "Y-m-d",
        defaultDate: window.selectedDate || '',
        onChange: (selectedDates, dateStr) => {
          window.location.href = `/?date=${dateStr}`;
        }
      });
    }
  }

  setupPicker(initialMode);

  viewMode.addEventListener("change", function () {
    setupPicker(this.value);
  });
}
