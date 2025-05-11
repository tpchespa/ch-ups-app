from flask import Flask, render_template, request, redirect, url_for, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, login_required, logout_user, UserMixin, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask_socketio import SocketIO, emit
from datetime import datetime
import pandas as pd
import io
import os
import json

FIELD_ORDER = [
    "Contact Name", "Company or Name", "Country", "Address 1", "Address 2", "Address 3", "City", "State/Prov/Other",
    "Postal Code", "Telephone", "Ext", "Residential Ind", "Consignee Email", "Packaging Type", "Customs Value",
    "Weight", "Length", "Width", "Height", "Unit of Measure", "Description of Goods", "Documents of No Commercial Value",
    "GNIFC", "Pkg Decl Value", "Service", "Delivery Confirm", "Shipper Release", "Ret of Documents", "Saturday Deliver",
    "Carbon Neutral", "Large Package", "Addl handling", "Reference 1", "Reference 2", "Reference 3", "QV Notif 1-Addr",
    "QV Notif 1-Ship", "QV Notif 1-Excp", "QV Notif 1-Delv", "QV Notif 2-Addr", "QV Notif 2-Ship", "QV Notif 2-Excp",
    "QV Notif 2-Delv", "QV Notif 3-Addr", "QV Notif 3-Ship", "QV Notif 3-Excp", "QV Notif 3-Delv", "QV Notif 4-Addr",
    "QV Notif 4-Ship", "QV Notif 4-Excp", "QV Notif 4-Delv", "QV Notif 5-Addr", "QV Notif 5-Ship", "QV Notif 5-Excp",
    "QV Notif 5-Delv", "QV Notif Msg", "QV Failure Addr", "UPS Premium Care", "ADL Location ID", "ADL Media Type",
    "ADL Language", "ADL Notification Addr", "ADL Failure Addr", "ADL COD Value", "ADL Deliver to Addressee",
    "ADL Shipper Media Type", "ADL Shipper Language", "ADL Shipper Notification Addr", "ADL Direct Delivery Only",
    "Electronic Package Release Authentication", "Lithium Ion Alone", "Lithium Ion In Equipment",
    "Lithium Ion With_Equipment", "Lithium Metal Alone", "Lithium Metal In Equipment",
    "Lithium Metal With Equipment", "Weekend Commercial Delivery", "Dry Ice Weight", "Merchandise Description",
    "UPS SurePost®Limited Quantity/Lithium Battery"
]

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret'
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
socketio = SocketIO(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True, index=True)
    password = db.Column(db.String(256))

class UPSEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.JSON)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']

        if User.query.filter_by(email=email).first():
            error = "Email already exists."
            return render_template('register.html', error=error)

        hashed_password = generate_password_hash(password)
        user = User(email=email, password=hashed_password)

        db.session.add(user)
        db.session.commit()

        # Automatically log the user in
        login_user(user)

        # Redirect straight to dashboard
        return redirect(url_for('dashboard'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        user = User.query.filter_by(email=request.form['email']).first()
        if user and check_password_hash(user.password, request.form['password']):
            login_user(user)
            return redirect(url_for('dashboard'))
        else:
            error = "Invalid email or password."

    return render_template('login.html', error=error)
@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def dashboard():
    entries = UPSEntry.query.all()
    return render_template('dashboard.html', entries=entries)

@app.route('/download')
@login_required
def download():
    entries = UPSEntry.query.all()
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
    try:
        # Updated required field checks
        required_fields = [
            "Company or Name",
            "Country",
            "Address 1",
            "City",
            "Packaging Type",
            "Service"
        ]

        errors = []

        for field in required_fields:
            if not data.get(field):
                errors.append(f"'{field}' is required.")

        if errors:
            emit('form_error', {'errors': errors})
            return

        # Add submission metadata
        data['_submitted_by'] = current_user.email
        data['_submitted_at'] = datetime.utcnow().isoformat()

        # Store in DB
        entry = UPSEntry(data=data)
        db.session.add(entry)
        db.session.commit()

        emit('new_entry', {'id': entry.id, 'data': entry.data}, broadcast=True)

    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('delete_entry')
def handle_delete(data):
    try:
        entry = UPSEntry.query.get_or_404(data['id'])
        db.session.delete(entry)
        db.session.commit()
        emit('entry_deleted', {'id': data['id']}, broadcast=True)
    except Exception as e:
        emit('error', {'message': str(e)})

@app.route('/init-db')
def init_db():
    db.create_all()
    return "✅ Database initialized."

if __name__ == '__main__':
    socketio.run(app, debug=True)
