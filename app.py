
from flask import Flask, render_template, request, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, emit
import pandas as pd
import io
import os
import json

FIELD_ORDER = [
  "Contact Name",
  "Company or Name",
  "Country",
  "Address 1",
  "Address 2",
  "Address 3",
  "City",
  "State/Prov/Other",
  "Postal Code",
  "Telephone",
  "Ext",
  "Residential Ind",
  "Consignee Email",
  "Packaging Type",
  "Customs Value",
  "Weight",
  "Length",
  "Width",
  "Height",
  "Unit of Measure",
  "Description of Goods",
  "Documents of No Commercial Value",
  "GNIFC",
  "Pkg Decl Value",
  "Service",
  "Delivery Confirm",
  "Shipper Release",
  "Ret of Documents",
  "Saturday Deliver",
  "Carbon Neutral",
  "Large Package",
  "Addl handling",
  "Reference 1",
  "Reference 2",
  "Reference 3",
  "QV Notif 1-Addr",
  "QV Notif 1-Ship",
  "QV Notif 1-Excp",
  "QV Notif 1-Delv",
  "QV Notif 2-Addr",
  "QV Notif 2-Ship",
  "QV Notif 2-Excp",
  "QV Notif 2-Delv",
  "QV Notif 3-Addr",
  "QV Notif 3-Ship",
  "QV Notif 3-Excp",
  "QV Notif 3-Delv",
  "QV Notif 4-Addr",
  "QV Notif 4-Ship",
  "QV Notif 4-Excp",
  "QV Notif 4-Delv",
  "QV Notif 5-Addr",
  "QV Notif 5-Ship",
  "QV Notif 5-Excp",
  "QV Notif 5-Delv",
  "QV Notif Msg",
  "QV Failure Addr",
  "UPS Premium Care",
  "ADL Location ID",
  "ADL Media Type",
  "ADL Language",
  "ADL Notification Addr",
  "ADL Failure Addr",
  "ADL COD Value",
  "ADL Deliver to Addressee",
  "ADL Shipper Media Type",
  "ADL Shipper Language",
  "ADL Shipper Notification Addr",
  "ADL Direct Delivery Only",
  "Electronic Package Release Authentication",
  "Lithium Ion Alone",
  "Lithium Ion In Equipment",
  "Lithium Ion With_Equipment",
  "Lithium Metal Alone",
  "Lithium Metal In Equipment",
  "Lithium Metal With Equipment",
  "Weekend Commercial Delivery",
  "Dry Ice Weight",
  "Merchandise Description",
  "UPS SurePost\u00aeLimited Quantity/Lithium Battery"
]

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret'
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
socketio = SocketIO(app)

class Entry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.JSON)

@app.route('/')
def index():
    entries = Entry.query.all()
    return render_template('dashboard.html', entries=entries)

@app.route('/download')
def download():
    entries = Entry.query.all()
    rows = []
    for e in entries:
        row = [e.data.get(field, "") for field in FIELD_ORDER]
        rows.append(row)
    df = pd.DataFrame(rows)
    output = io.StringIO()
    df.to_csv(output, index=False, header=False)
    output.seek(0)
    return send_file(io.BytesIO(output.getvalue().encode()), mimetype='text/csv', as_attachment=True, download_name='ups_export.csv')

@socketio.on('submit_form')
def handle_submit(data):
    entry = Entry(data=data)
    db.session.add(entry)
    db.session.commit()
    emit('new_entry', {'id': entry.id, 'data': entry.data}, broadcast=True)

@socketio.on('delete_entry')
def handle_delete(data):
    entry = Entry.query.get(data['id'])
    db.session.delete(entry)
    db.session.commit()
    emit('entry_deleted', {'id': data['id']}, broadcast=True)

@app.route('/init-db')
def init_db():
    db.create_all()
    return "DB initialized!"

if __name__ == '__main__':
    socketio.run(app, debug=True)
