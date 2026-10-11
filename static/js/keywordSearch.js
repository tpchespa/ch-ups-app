// Search only the user-facing columns in the day/month dataset provided by Flask.
// All words must match, but they may occur in different columns and any order.
export function normalizeSearchText(value) {
  return String(value ?? "")
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}

export function matchesKeywordSearch(row, params) {
  const { terms, fields } = params;
  if (!terms.length) return true;
  const searchable = normalizeSearchText(
    fields.map(field => row[field] ?? "").join(" ")
  );
  return terms.every(term => searchable.includes(term));
}

export function setupKeywordSearch(table, root = document) {
  const input = root.getElementById("keyword-search");
  const clearButton = root.getElementById("keyword-search-clear");
  const count = root.getElementById("keyword-search-count");
  if (!input || !clearButton || !count || !table) return;

  // Dynamically collect the displayed fields, avoiding private/backend metadata
  // and keeping search in sync if more table columns are added later.
  const fields = table.getColumns()
    .map(column => column.getField())
    .filter(Boolean);

  let debounceTimer;
  const updateCount = () => {
    const shown = table.getData("active").length;
    const total = table.getData().length;
    count.textContent = `Showing ${shown} of ${total} shipments`;
  };

  const applySearch = () => {
    const terms = normalizeSearchText(input.value).trim().split(/\s+/).filter(Boolean);
    if (terms.length) {
      // Programmatic filters combine with Tabulator's UPS tracking/User header filters.
      table.setFilter(matchesKeywordSearch, { terms, fields });
    } else {
      // No other programmatic filters exist; header filters are preserved.
      table.clearFilter();
    }
    clearButton.hidden = !input.value;
    updateCount();
  };

  input.addEventListener("input", () => {
    clearButton.hidden = !input.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applySearch, 150);
  });

  clearButton.addEventListener("click", () => {
    clearTimeout(debounceTimer);
    input.value = "";
    applySearch();
    input.focus();
  });

  // Update counter when a separate header filter changes (e.g. UPS tracking).
  table.on("dataFiltered", updateCount);
  table.on("tableBuilt", updateCount);
  clearButton.hidden = true;
  updateCount();
}
