from flask import Flask, render_template, request, redirect, url_for, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, login_required, logout_user, UserMixin, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask_socketio import SocketIO, emit
from datetime import datetime
from datetime import date
import pandas as pd
import io
import os
import json
import pytz
from datetime import datetime, date

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
    is_admin = db.Column(db.Boolean, default=False)
    role = db.Column(db.String(50), default="User") 

class UPSEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.JSON)

class SavedContact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_email = db.Column(db.String(150), index=True)
    contact_name = db.Column(db.String(100))
    company_name = db.Column(db.String(100))
    country = db.Column(db.String(10))
    address_1 = db.Column(db.String(150))
    city = db.Column(db.String(100))
    state = db.Column(db.String(100))
    postal_code = db.Column(db.String(20))
    telephone = db.Column(db.String(50))
    email = db.Column(db.String(100))

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/admin/users')
@login_required
def admin_users():
    if not current_user.is_admin:
        return "Unauthorized", 403
    users = User.query.all()
    return render_template('admin_users.html', users=users)

@app.route('/admin/change-role/<int:user_id>', methods=['POST'])
@login_required
def change_user_role(user_id):
    if not current_user.is_admin:
        return "Unauthorized", 403
    user = User.query.get_or_404(user_id)
    new_role = request.form['new_role']
    user.role = new_role
    db.session.commit()
    return redirect(url_for('admin_users'))

@app.route('/admin/reset-password/<int:user_id>', methods=['POST'])
@login_required
def reset_password(user_id):
    if not current_user.is_admin:
        return "Unauthorized", 403
    user = User.query.get_or_404(user_id)
    new_pw = request.form['new_password']
    user.password = generate_password_hash(new_pw)
    db.session.commit()
    return redirect(url_for('admin_users'))

@app.route('/admin/delete-user/<int:user_id>', methods=['POST'])
@login_required
def delete_user(user_id):
    if not current_user.is_admin:
        return "Unauthorized", 403

    user = User.query.get_or_404(user_id)

    # Prevent self-deletion
    if user.id == current_user.id:
        return "You cannot delete yourself.", 400

    db.session.delete(user)
    db.session.commit()
    return redirect(url_for('admin_users'))

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
        try:
            if user and check_password_hash(user.password, request.form['password']):
                login_user(user)
                return redirect(url_for('dashboard'))
            else:
                error = "Invalid email or password."
        except ValueError:
            error = "Corrupted password hash. Contact admin."


    return render_template('login.html', error=error)
@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def dashboard():
    warsaw = pytz.timezone("Europe/Warsaw")

    selected_date_str = request.args.get("date")
    selected_month_str = request.args.get("month")

    if not selected_date_str and not selected_month_str:
        selected_date_str = datetime.now(warsaw).strftime("%Y-%m-%d")

    entries = UPSEntry.query.all()
    filtered = []

    for e in entries:
        ts = e.data.get("_submitted_at")
        if not ts:
            continue

        utc_time = datetime.fromisoformat(ts).replace(tzinfo=pytz.utc)
        local_time = utc_time.astimezone(warsaw)

        if selected_date_str:
            selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
            if local_time.date() == selected_date:
                filtered.append((utc_time, e))  # include timestamp for sorting

        elif selected_month_str:
            y, m = map(int, selected_month_str.split("-"))
            if local_time.year == y and local_time.month == m:
                filtered.append((utc_time, e))

        elif not selected_date_str and not selected_month_str:
            if local_time.date() == datetime.now(warsaw).date():
                filtered.append((utc_time, e))

    # Sort by timestamp (oldest first)
    filtered.sort(key=lambda x: x[0])
    filtered_entries = [e for _, e in filtered]

    today_str = datetime.utcnow().date().isoformat()

    return render_template(
        'dashboard.html',
        entries=filtered_entries,
        current_email=current_user.email,
        selected_date=selected_date_str,
        selected_month=selected_month_str or '',
        today=today_str 
    )

@app.route('/download')
@login_required
def download():
    warsaw = pytz.timezone("Europe/Warsaw")
    selected_date_str = request.args.get("date")
    selected_month_str = request.args.get("month")

    entries = UPSEntry.query.all()
    filtered = []

    for e in entries:
        ts = e.data.get("_submitted_at")
        if not ts:
            continue

        utc_time = datetime.fromisoformat(ts).replace(tzinfo=pytz.utc)
        local_time = utc_time.astimezone(warsaw)

        if selected_date_str:
            selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
            if local_time.date() == selected_date:
                filtered.append(e)

        elif selected_month_str:
            y, m = map(int, selected_month_str.split("-"))
            if local_time.year == y and local_time.month == m:
                filtered.append(e)

    rows = []
    for e in filtered:
        row = [e.data.get(field, "") for field in FIELD_ORDER]
        rows.append(row)

    df = pd.DataFrame(rows)
    output = io.StringIO()
    df.to_csv(output, index=False, header=False)
    output.seek(0)
    now = datetime.now().strftime("%H-%M %d-%m")
    filename = f"{now}_UPS.csv"
    return send_file(io.BytesIO(output.getvalue().encode()), mimetype='text/csv', as_attachment=True, download_name=filename)


@app.route('/download_xlsx')
@login_required
def download_xlsx():
    warsaw = pytz.timezone("Europe/Warsaw")
    selected_date_str = request.args.get("date")
    selected_month_str = request.args.get("month")

    entries = UPSEntry.query.all()
    filtered = []

    for e in entries:
        ts = e.data.get("_submitted_at")
        if not ts:
            continue

        utc_time = datetime.fromisoformat(ts).replace(tzinfo=pytz.utc)
        local_time = utc_time.astimezone(warsaw)

        if selected_date_str:
            selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
            if local_time.date() == selected_date:
                filtered.append(e)

        elif selected_month_str:
            y, m = map(int, selected_month_str.split("-"))
            if local_time.year == y and local_time.month == m:
                filtered.append(e)

    rows = []
    for e in filtered:
        row = [e.data.get(field, "") for field in FIELD_ORDER]
        rows.append(row)

    df = pd.DataFrame(rows, columns=FIELD_ORDER)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='UPS Export')
    output.seek(0)
    now = datetime.now().strftime("%H-%M %d-%m")
    filename = f"{now}_UPS.xlsx"
    return send_file(output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                     as_attachment=True, download_name=filename)

@app.route('/contacts/manage')
@login_required
def manage_contacts():
    contacts = SavedContact.query.order_by(SavedContact.company_name.asc()).all()
    return render_template('manage_contacts.html', contacts=contacts)

@app.route('/contacts/add', methods=['POST'])
@login_required
def add_contact():
    form = request.form
    filters = {
        "company_name": form.get("company_name"),
        "address_1": form.get("address_1"),
        "country": form.get("country")
    }

    existing = SavedContact.query.filter_by(**filters).first()
    if existing:
        return redirect(url_for('manage_contacts'))

    contact = SavedContact(
        user_email=current_user.email,
        contact_name=form.get("contact_name"),
        company_name=form.get("company_name"),
        country=form.get("country"),
        address_1=form.get("address_1"),
        city=form.get("city"),
        state=form.get("state"),
        postal_code=form.get("postal_code"),
        telephone=form.get("telephone"),
        email=form.get("email")
    )
    db.session.add(contact)
    db.session.commit()
    return redirect(url_for('manage_contacts'))

@app.route('/contacts/delete/<int:contact_id>', methods=['POST'])
@login_required
def delete_contact(contact_id):
    contact = SavedContact.query.get_or_404(contact_id)
    db.session.delete(contact)
    db.session.commit()
    return redirect(url_for('manage_contacts'))

@app.route('/save_contact', methods=['POST'])
@login_required
def save_contact():
    data = request.json

    filters = {
        "company_name": data.get("Company or Name"),
        "address_1": data.get("Address 1"),
        "country": data.get("Country")
    }

    existing = SavedContact.query.filter_by(**filters).first()
    if existing:
        return {"success": False, "message": "Contact already exists."}, 409

    contact = SavedContact(
        user_email=current_user.email,
        contact_name=data.get("Contact Name"),
        company_name=data.get("Company or Name"),
        country=data.get("Country"),
        address_1=data.get("Address 1"),
        city=data.get("City"),
        state=data.get("State/Prov/Other"),
        postal_code=data.get("Postal Code"),
        telephone=data.get("Telephone"),
        email=data.get("Consignee Email")
    )
    db.session.add(contact)
    db.session.commit()
    return {"success": True}

@app.route('/get_contacts')
@login_required
def get_contacts():
    contacts = SavedContact.query.all()
    return [{
        "Contact Name": c.contact_name,
        "Company or Name": c.company_name,
        "Country": c.country,
        "Address 1": c.address_1,
        "City": c.city,
        "State/Prov/Other": c.state,
        "Postal Code": c.postal_code,
        "Telephone": c.telephone,
        "Consignee Email": c.email
    } for c in contacts]

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

@app.route('/update-entry/<int:entry_id>', methods=['POST'])
@login_required
def update_entry(entry_id):
    entry = UPSEntry.query.get_or_404(entry_id)

    is_authorized = (
        current_user.is_admin or
        current_user.role == "Logistics" or
        entry.data.get("_submitted_by") == current_user.email
    )

    if not is_authorized:
        return {"error": "Unauthorized"}, 403

    updated_data = request.json

    protected_keys = {"_submitted_by", "_submitted_at"}
    preserved = {k: entry.data.get(k) for k in protected_keys}

    allowed_keys = set(entry.data.keys()) - protected_keys
    new_data = dict(entry.data)

    for key in allowed_keys:
        if key in updated_data:
            new_data[key] = updated_data[key]

    new_data.update(preserved)
    entry.data = new_data  # trigger SQLAlchemy to detect change

    db.session.commit()
    return {"success": True}


@socketio.on('delete_entry')
def handle_delete(data):
    try:
        entry = UPSEntry.query.get_or_404(data['id'])

        if not current_user.is_admin:
            if entry.data.get('_submitted_by') != current_user.email:
                emit('form_error', {'errors': ["❌ You can only delete your own entries."]})
                return

            # Prevent deleting old entries
            ts = entry.data.get('_submitted_at')
            if ts:
                entry_date = datetime.fromisoformat(ts).date()
                if entry_date != datetime.utcnow().date():
                    emit('form_error', {'errors': ["❌ You can only delete today's entries."]})
                    return

        db.session.delete(entry)
        db.session.commit()
        emit('entry_deleted', {'id': data['id']}, broadcast=True)

    except Exception as e:
        emit('error', {'message': str(e)})

@app.route('/init-db')
def init_db():
    db.create_all()
    return "Database initialized."

if __name__ == '__main__':
    socketio.run(app, debug=True)
