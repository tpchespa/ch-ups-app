export function setupAutocomplete(inputId, suggestionsId, map) {
  const input = document.getElementById(inputId);
  const suggestionsBox = document.getElementById(suggestionsId);
  const layer = document.getElementById("autocomplete-layer");
  if (!input || !suggestionsBox || !layer) return;

  function renderSuggestions(query) {
    suggestionsBox.innerHTML = "";
    const matches = Object.entries(map)
      .filter(([code, name]) =>
        code.includes(query) || name.toUpperCase().includes(query)
      )
      .slice(0, 25);

    if (matches.length === 0) {
      suggestionsBox.style.display = "none";
      return;
    }

    matches.forEach(([code, name]) => {
      const li = document.createElement("li");
      li.textContent = `${code} - ${name}`;
      li.addEventListener("click", () => {
        input.value = code;
        suggestionsBox.style.display = "none";
        if (typeof window.validateAllFields === "function") window.validateAllFields();
      });
      suggestionsBox.appendChild(li);
    });

    if (!layer.contains(suggestionsBox)) {
      layer.appendChild(suggestionsBox);
    }

    const inputRect = input.getBoundingClientRect();
    suggestionsBox.style.position = "absolute";
    suggestionsBox.style.top = `${window.scrollY + inputRect.bottom}px`;
    suggestionsBox.style.left = `${window.scrollX + inputRect.left}px`;
    suggestionsBox.style.width = `${inputRect.width}px`;
    suggestionsBox.style.display = "block";
  }

  input.addEventListener("input", () => {
    const query = input.value.toUpperCase();
    renderSuggestions(query);
  });

  input.addEventListener("focus", () => {
    renderSuggestions("");
  });

  document.addEventListener("click", e => {
    if (!suggestionsBox.contains(e.target) && e.target !== input) {
      suggestionsBox.style.display = "none";
    }
  });
}