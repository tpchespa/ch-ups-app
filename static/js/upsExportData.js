// Keep field names and order identical to FIELD_ORDER in app.py.
// The visible table uses canonical names, while old records can use aliases.
const UPS_EXPORT_ALIASES = {
  "Consignee Email": ["Consignee Email", "Consignee_Email"],
  // The state column is edited under its legacy JS field name.
  "State/Prov/Other": ["state_prov_other", "State/Prov/Other"],
  "Documents of No Commercial Value": ["Documents of No Commercial Value", "Documents_of_No_Commercial_Value"],
};

export function getUPSExportValue(row, field) {
  // Preserve the existing fallback notification settings for older records.
  if (field === "QV Notif 1-Addr") {
    return row[field] || "justyna.nawrocka@chespa.eu";
  }
  if (field === "QV Notif 1-Excp") {
    return row[field] || "1";
  }

  for (const key of (UPS_EXPORT_ALIASES[field] || [field])) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

export function buildUPSExportRows(rows, fieldOrder) {
  return rows.map(row => fieldOrder.map(field => getUPSExportValue(row, field)));
}
