export const alphanumericRegex = /^[\p{L}0-9\s]*$/u;

export const validateFields = [
  { id: "Contact_Name", label: "Contact Name", max: 35, alphanumeric: true },
  { id: "Company_or_Name", label: "Company or Name", required: true, max: 35, alphanumeric: true },
  { id: "Country", label: "Country", required: true },
  { id: "Address_1", label: "Address 1", required: true, max: 35, alphanumeric: true },
  { id: "City", label: "City", required: true, max: 30, alphanumeric: true },
  { id: "Postal_Code", label: "Postal Code", max: 10, alphanumeric: true },
  { id: "State_Prov_Other", label: "State/Province/Other", max: 30, alphanumeric: true },
  { id: "Telephone", label: "Telephone", max: 15, alphanumeric: true },
  { id: "Packaging_Type", label: "Packaging Type", required: true },
  { id: "Weight", label: "Weight", conditionalWeight: true, max: 5 },
  { id: "Length", label: "Length", numeric: true, max: 4 },
  { id: "Width", label: "Width", numeric: true, max: 4 },
  { id: "Height", label: "Height", numeric: true, max: 4 },
  { id: "Description_of_Goods", label: "Description of Goods", max: 35, alphanumeric: true },
  { id: "Service", label: "Service", required: true },
  { id: "Reference_1", label: "Reference 1", max: 35, alphanumeric: true },
  { id: "Reference_2", label: "Reference 2", max: 35, alphanumeric: true }
];

export function cleanInputValue(value, isPostalCode = false) {
  let cleaned = value;
  let wasModified = false;

  if (isPostalCode) {
    const postalCleaned = cleaned.replace(/[^0-9]/g, '');
    if (postalCleaned !== cleaned) {
      wasModified = true;
      cleaned = postalCleaned;
    }
    return { cleaned, wasModified };
  }

  cleaned = cleaned.replace(/(\d)[^\p{L}\d\s]+(?=\d)/gu, (_, d) => {
    wasModified = true;
    return d + ' ';
  });

  cleaned = cleaned.replace(/(\p{L})[^\p{L}\d\s]+(?=\p{L})/gu, (_, letter) => {
    wasModified = true;
    return letter;
  });

  const finalCleaned = cleaned.replace(/[^\p{L}\d\s]/gu, '');
  if (finalCleaned !== cleaned) wasModified = true;

  return { cleaned: finalCleaned, wasModified };
}

export const validCountryCodes = new Set([
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GT", "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PT", "PW", "PY",
  "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW"
]);

export function validateAllFields() {
  let hasError = false;

  document.querySelectorAll(".field-error").forEach(div => {
    div.innerText = "";
    div.classList.remove("field-warning");
  });

  document.querySelectorAll("input").forEach(input => {
    input.classList.remove("input-error");
  });

  validateFields.forEach(field => {
    const input = document.getElementById(field.id);
    const errorDiv = document.getElementById("error-" + field.id);
    if (!input || !errorDiv) return;

    const value = input.value.trim();
    errorDiv.innerText = "";
    input.classList.remove("input-error");

    if (field.required && !value) {
      errorDiv.innerText = `${field.label} is required.`;
      input.classList.add("input-error");
      hasError = true;
      return;
    }

    if (field.max && value.length > field.max) {
      errorDiv.innerText = `${field.label} must be ${field.max} characters or fewer.`;
      input.classList.add("input-error");
      hasError = true;
      return;
    }

    if (field.alphanumeric) {
      const { wasModified } = cleanInputValue(value, field.label === "Postal Code");
      if (!/^[\p{L}0-9\s]*$/u.test(value)) {
        if (wasModified) {
          errorDiv.innerText = `${field.label} contains special characters and will be auto-corrected.`;
          errorDiv.classList.add("field-warning");
        } else {
          errorDiv.innerText = `${field.label} must contain only letters, numbers, and spaces.`;
          input.classList.add("input-error");
          hasError = true;
        }
        return;
      }
    }

    if (field.numeric && value && !/^\d+$/.test(value)) {
      errorDiv.innerText = `${field.label} must contain only numbers.`;
      input.classList.add("input-error");
      hasError = true;
      return;
    }

    if (field.conditionalWeight) {
      const packagingType = document.getElementById("Packaging_Type")?.value;
      if (packagingType === "2" && !value) {
        errorDiv.innerText = `Weight is required for Packaging Type "2".`;
        input.classList.add("input-error");
        hasError = true;
        return;
      }

      if (value && !/^\d+([.,]\d+)?$/.test(value)) {
        errorDiv.innerText = `Weight must be a number (e.g., 10 or 10.5).`;
        input.classList.add("input-error");
        hasError = true;
        return;
      }
    }

    if (field.id === "Country") {
      if (value.length !== 2) {
        errorDiv.innerText = "Country code must be exactly 2 characters.";
        input.classList.add("input-error");
        hasError = true;
      } else if (!validCountryCodes.has(value.toUpperCase())) {
        errorDiv.innerText = "Invalid ISO country code (e.g., US, DE, JP).";
        input.classList.add("input-error");
        hasError = true;
      }
    }
  });

  return !hasError;
}

export function setupFieldValidation() {
  validateFields.forEach(field => {
    const input = document.getElementById(field.id);
    if (!input) return;

    input.addEventListener("input", () => validateFieldDirect(field.id));
    input.addEventListener("blur", () => validateFieldDirect(field.id));
  });
}

export function validateFieldDirect(fieldId) {
  const fieldDef = validateFields.find(f => f.id === fieldId);
  const input = document.getElementById(fieldId);
  const errorDiv = document.getElementById("error-" + fieldId);
  if (!fieldDef || !input || !errorDiv) return;

  const value = input.value.trim();
  errorDiv.innerText = "";
  input.classList.remove("input-error");
  errorDiv.classList.remove("field-warning");

  if (fieldDef.required && !value) {
    errorDiv.innerText = `${fieldDef.label} is required.`;
    input.classList.add("input-error");
    return;
  }

  if (fieldDef.max && value.length > fieldDef.max) {
    errorDiv.innerText = `${fieldDef.label} must be ${fieldDef.max} characters or fewer.`;
    input.classList.add("input-error");
    return;
  }

  if (fieldDef.alphanumeric) {
    const { wasModified } = cleanInputValue(value, fieldId === "Postal_Code");
    if (!/^[\p{L}0-9\s]*$/u.test(value)) {
      if (wasModified) {
        errorDiv.innerText = `${fieldDef.label} contains special characters and will be auto-corrected.`;
        errorDiv.classList.add("field-warning");
      } else {
        errorDiv.innerText = `${fieldDef.label} must contain only letters, numbers, and spaces.`;
        input.classList.add("input-error");
      }
      return;
    }
  }

  if (fieldDef.numeric && value && !/^\d+$/.test(value)) {
    errorDiv.innerText = `${fieldDef.label} must contain only numbers.`;
    input.classList.add("input-error");
    return;
  }

  if (fieldDef.conditionalWeight) {
    const packagingType = document.getElementById("Packaging_Type")?.value;
    if (packagingType === "2" && !value) {
      errorDiv.innerText = `Weight is required for Packaging Type "2".`;
      input.classList.add("input-error");
      return;
    }

    if (value && !/^\d+([.,]\d+)?$/.test(value)) {
      errorDiv.innerText = `Weight must be a number (e.g., 10 or 10.5).`;
      input.classList.add("input-error");
      return;
    }
  }

  if (fieldId === "Country") {
    if (value.length !== 2) {
      errorDiv.innerText = "Country code must be exactly 2 characters.";
      input.classList.add("input-error");
    } else if (!validCountryCodes.has(value.toUpperCase())) {
      errorDiv.innerText = "Invalid ISO country code (e.g., US, DE, JP).";
      input.classList.add("input-error");
    }
  }
}