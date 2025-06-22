export function clearForm() {
  const form = document.getElementById("form");
  if (!form) return;

  form.reset();

  const customIds = [
    "Custom_Order_Number",
    "Custom_Project_Number",
    "Custom_UPS_Number",
    "Custom_Cost",
    "Custom_Ship_Date"
  ];

  customIds.forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });

  document.querySelectorAll(".field-error").forEach(div => {
    div.innerText = "";
    div.classList.remove("field-warning");
  });

  document.querySelectorAll("input").forEach(input => {
    input.classList.remove("input-error");
  });
}

export function setupTooltipHandlers() {
  document.querySelectorAll('.tooltip-icon').forEach(icon => {
    let tooltip;

    icon.addEventListener('mouseenter', e => {
      const contentEl = icon.querySelector('.tooltip-content');
      if (!contentEl) return;

      tooltip = document.createElement('div');
      tooltip.className = 'floating-tooltip';
      tooltip.textContent = contentEl.textContent;
      tooltip.style.opacity = "0";
      document.body.appendChild(tooltip);

      tooltip.style.position = 'absolute';
      tooltip.style.pointerEvents = 'none';

      const moveTooltip = (evt) => {
        const xOffset = 15;
        const yOffset = 20;
        tooltip.style.top = `${evt.clientY + yOffset + window.scrollY}px`;
        tooltip.style.left = `${evt.clientX + xOffset + window.scrollX}px`;
      };

      document.addEventListener('mousemove', moveTooltip);
      tooltip._moveHandler = moveTooltip;

      requestAnimationFrame(() => {
        if (tooltip) {
          tooltip.style.opacity = "1";
        }
      });
    });

    icon.addEventListener('mouseleave', () => {
      if (tooltip) {
        document.removeEventListener('mousemove', tooltip._moveHandler);
        tooltip.remove();
        tooltip = null;
      }
    });
  });
}
