import { clearForm } from './uiHelpers.js';
import { validateFields } from './formValidation.js';

let recentlyDeleted = null;

function resolveField(data, variants) {
  for (const key of variants) {
    if (key in data) return data[key];
  }
  return "";
}

export function initializeSocketHandlers(socket, currentUserEmail, SwalWithDarkTheme, table) {
  socket.on("new_entry", data => {
    // Log the actual raw value received for debugging
    console.log("Incoming:", data.data["state_prov_other"]);
      
    const rowData = {
      id: data.id,
      "Time": new Date(data.data._submitted_at + "Z").toLocaleString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        timeZone: "Europe/Warsaw"
      }).replace(",", "").replace(/\./g, "-"),
      "User": data.user_display || data.data._submitted_by,
      "Submitted By": data.data._submitted_by,
      "Contact Name": data.data["Contact Name"],
      "Company or Name": data.data["Company or Name"],
      "Country": data.data["Country"],
      "Address 1": data.data["Address 1"],
      "City": data.data["City"],
      "state_prov_other": data.data["state_prov_other"] || data.data["State/Prov/Other"] || "",
      "Postal Code": data.data["Postal Code"],
      "Telephone": data.data["Telephone"],
      "Consignee Email": data.data["Consignee Email"] || data.data["Consignee_Email"] || "",
      "Packaging Type": data.data["Packaging Type"],
      "Weight": data.data["Weight"],
      "Length": data.data["Length"],
      "Width": data.data["Width"],
      "Height": data.data["Height"],
      "Description of Goods": data.data["Description of Goods"],
      "Documents of No Commercial Value": data.data["Documents of No Commercial Value"] || data.data["Documents_of_No_Commercial_Value"] || "",
      "Service": data.data["Service"],
      "Reference 1": data.data["Reference 1"] || data.data["Reference_1"] || "",
      "Reference 2": data.data["Reference 2"] || data.data["Reference_2"] || "",
      "nr_zam": data.data["nr_zam"] || data.data["nr zam."] || data.data["nr zamówienia gdzie będzie doliczony koszt"] || "",
      "NR PROJEKTU": data.data["NR PROJEKTU"],
      "NR LISTU UPS": data.data["NR LISTU UPS"],
      "koszt": data.data["koszt"] || data.data["KOSZT (LOGISTYKA)"] || "",
      "DATA WYSYŁKI": data.data["DATA WYSYŁKI"]
    };
    console.log("RowData being inserted into table:", rowData);
    table.addData([rowData], true);

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

    const row = table.getRow(data.id);
    if (row) {
      const el = row.getElement();
      el.classList.add("new-row");
      setTimeout(() => el.classList.remove("new-row"), 2000);
    }

  });
}
