export async function fetchSavedContacts() {
  const res = await fetch("/get_contacts");
  const contacts = await res.json();
  const list = document.getElementById("contactList");
  list.innerHTML = "";
  contacts.forEach(contact => {
    const opt = document.createElement("option");
    opt.value = contact["Company or Name"] + " | " + contact["Contact Name"];
    opt.dataset.json = JSON.stringify(contact);
    list.appendChild(opt);
  });
}

export function setupContactSelection() {
  const searchInput = document.getElementById("contactSearch");
  const contactList = document.getElementById("contactList");

  if (!searchInput || !contactList) return;

  searchInput.addEventListener("change", e => {
    const selected = Array.from(contactList.options)
      .find(opt => opt.value === e.target.value);
    if (!selected) return;

    const data = JSON.parse(selected.dataset.json);
    Object.entries(data).forEach(([field, value]) => {
      const customIdMap = {
        "state_prov_other": "state_prov_other",
        "State/Prov/Other": "state_prov_other",
        "Postal Code": "Postal_Code",
        "Contact Name": "Contact_Name",
        "Company or Name": "Company_or_Name",
        "Address 1": "Address_1",
        "City": "City",
        "Country": "Country",
        "Telephone": "Telephone",
        "Consignee Email": "Consignee_Email"
      };

      const id = customIdMap[field] || field.replace(/\s|\//g, "_");
      const input = document.getElementById(id);
      if (input) {
        input.value = value;

        if (typeof window.validateFieldDirect === "function") {
          window.validateFieldDirect(id);
        }
      }
    });

    searchInput.value = "";
  });
}
