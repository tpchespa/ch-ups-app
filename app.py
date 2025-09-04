from flask import Flask, render_template, request, redirect, url_for, send_file, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
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
import ssl
import requests
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager
import xml.etree.ElementTree as ElementTree
from datetime import datetime, date

class TLSAdapter(HTTPAdapter):
    """Force TLS v1.2 or higher"""
    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.set_ciphers("DEFAULT:@SECLEVEL=1")  # avoids overly strict ciphers
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)

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
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))

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
    client_code = db.Column(db.String(50))

class WebCenterProject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.String(30), unique=True, index=True)
    name = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

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
    selected_user = request.args.get("user")

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

        if selected_user and e.data.get("_submitted_by") != selected_user:
            continue 

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

    users = User.query.all()
    user_display_names = {
        u.email: f"{u.first_name} {u.last_name[0]}." if u.first_name and u.last_name else u.email
        for u in users
    }

    return render_template(
        'dashboard.html',
        entries=filtered_entries,
        current_email=current_user.email,
        selected_date=selected_date_str,
        selected_month=selected_month_str or '',
        selected_user=selected_user,
        today=today_str,
        user_display_names=user_display_names,
        field_order=FIELD_ORDER
    )

@app.route('/download')
@login_required
def download():
    warsaw = pytz.timezone("Europe/Warsaw")
    selected_date_str = request.args.get("date")
    selected_month_str = request.args.get("month")
    selected_user = request.args.get("user")

    entries = UPSEntry.query.all()
    filtered = []

    for e in entries:
        ts = e.data.get("_submitted_at")
        if not ts:
            continue

        utc_time = datetime.fromisoformat(ts).replace(tzinfo=pytz.utc)
        local_time = utc_time.astimezone(warsaw)

        if selected_user and e.data.get("_submitted_by") != selected_user:
            continue

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
    selected_user = request.args.get("user")

    entries = UPSEntry.query.all()
    filtered = []

    for e in entries:
        ts = e.data.get("_submitted_at")
        if not ts:
            continue

        utc_time = datetime.fromisoformat(ts).replace(tzinfo=pytz.utc)
        local_time = utc_time.astimezone(warsaw)

        if selected_user and e.data.get("_submitted_by") != selected_user:
            continue

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
    contacts = [{
        "id": c.id,
        "contact_name": c.contact_name,
        "company_name": c.company_name,
        "country": c.country,
        "address_1": c.address_1,
        "city": c.city,
        "state": c.state,
        "postal_code": c.postal_code,
        "telephone": c.telephone,
        "email": c.email,
        "client_code": c.client_code  # ✅ make sure this matches your DB schema
    } for c in SavedContact.query.order_by(SavedContact.company_name.asc()).all()]
    return render_template('manage_contacts.html', contacts=contacts)

@app.route('/contacts/add', methods=['POST'])
@login_required
def add_contact():
    form = request.form
    existing = SavedContact.query.filter_by(
        user_email=current_user.email,
        contact_name=form.get("contact_name")
    ).first()
    if existing:
        return redirect(url_for('manage_contacts'))

    contact = SavedContact(
        user_email=current_user.email,
        contact_name=form.get("contact_name"),
        company_name=form.get("company_name"),
        country=form.get("country"),
        address_1=form.get("address_1"),
        city=form.get("city"),
        state=form.get("state_prov_other"),
        postal_code=form.get("postal_code"),
        telephone=form.get("telephone"),
        email=form.get("email"),
        client_code=form.get("client_code")
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

    existing = SavedContact.query.filter_by(
        user_email=current_user.email,
        contact_name=data.get("Contact Name")
    ).first()
    if existing:
        return {"success": False, "message": "Contact already exists."}, 409

    contact = SavedContact(
        user_email=current_user.email,
        contact_name=data.get("Contact Name"),
        company_name=data.get("Company or Name"),
        country=data.get("Country"),
        address_1=data.get("Address 1"),
        city=data.get("City"),
        state=data.get("state_prov_other"),
        postal_code=data.get("Postal Code"),
        telephone=data.get("Telephone"),
        email=data.get("Consignee Email"),
        client_code=data.get("Reference 1")
    )
    db.session.add(contact)
    db.session.commit()
    return {"success": True}


@app.route('/contacts/update/<int:contact_id>', methods=['POST'])
@login_required
def update_contact(contact_id):
    contact = SavedContact.query.get_or_404(contact_id)
    data = request.json

    contact.contact_name = data.get("contact_name", contact.contact_name)
    contact.company_name = data.get("company_name", contact.company_name)
    contact.country = data.get("country", contact.country)
    contact.address_1 = data.get("address_1", contact.address_1)
    contact.city = data.get("city", contact.city)
    contact.state = data.get("state", contact.state)
    contact.postal_code = data.get("postal_code", contact.postal_code)
    contact.telephone = data.get("telephone", contact.telephone)
    contact.email = data.get("email", contact.email)
    contact.client_code = data.get("client_code", contact.client_code)

    db.session.commit()
    return {"success": True}


@app.route('/get_contacts')
@login_required
def get_contacts():
    contacts = SavedContact.query.all()
    return [{
        "id": c.id,
        "Contact Name": c.contact_name,
        "Company or Name": c.company_name,
        "Country": c.country,
        "Address 1": c.address_1,
        "City": c.city,
        "state_prov_other": c.state,
        "Postal Code": c.postal_code,
        "Telephone": c.telephone,
        "Consignee Email": c.email,
        "Reference 1": c.client_code
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

        # Always set Sales Rep Code
        data["Reference 2"] = "80005"

        warsaw = pytz.timezone("Europe/Warsaw")
        if "_scheduled_for" in data:
            # Parse the desired future date and set the submission time to that day's midnight UTC
            future_date = datetime.strptime(data["_scheduled_for"], "%Y-%m-%d")
            local_dt = warsaw.localize(datetime.combine(future_date, datetime.min.time()))
            data['_submitted_at'] = local_dt.astimezone(pytz.utc).isoformat()
        else:
            data['_submitted_at'] = datetime.utcnow().isoformat()

        # Remove _scheduled_for so it's not stored in the database
        data.pop("_scheduled_for", None)

        # Set default notification values if not provided
        if not data.get("QV Notif 1-Addr"):
            data["QV Notif 1-Addr"] = "justyna.nawrocka@chespa.eu"

        if not data.get("QV Notif 1-Excp"):
            data["QV Notif 1-Excp"] = "1"

        # Store in DB
        entry = UPSEntry(data=data)
        db.session.add(entry)
        db.session.commit()

        # Format name
        full_name = (
            f"{current_user.first_name} {current_user.last_name[0]}."
            if current_user.first_name and current_user.last_name
            else current_user.email
        )

        emit('new_entry', {
            'id': entry.id,
            'data': entry.data,
            'user_display': full_name
        }, broadcast=True)

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
    new_data = dict(entry.data)

    # Normalize keys
    field_aliases = {
        "state_prov_other": "State/Prov/Other",
        "Consignee_Email": "Consignee Email",
        "Documents_of_No_Commercial_Value": "Documents of No Commercial Value",
        "Reference_1": "Reference 1",
        "Reference_2": "Reference 2",
    }

    for key, value in updated_data.items():
        # Prefer the alias if it points to a legacy key that exists
        alias_key = field_aliases.get(key)
        if alias_key and alias_key in entry.data:
            real_key = alias_key
        else:
            real_key = key  # fallback

        if real_key not in protected_keys:
            new_data[real_key] = value

    new_data.update(preserved)
    entry.data = new_data
    db.session.commit()

    tracking_number = new_data.get("NR LISTU UPS", "").strip()
    raw_ids = new_data.get("NR PROJEKTU", "").strip()
    fallback_id = new_data.get("nr_zam", "").strip()

    if not tracking_number:
        return {"success": True}  # nothing to send

    # Use ProjectsIDs or fallback
    source_text = raw_ids if raw_ids else fallback_id

    import re
    # Match 9-digit project numbers like 202500001, 202612345
    # Year-based format: 20YYNNNNN
    company_ids = re.findall(r'(?<!\d)20\d{2}\d{5}(?!\d)', source_text)

    if not company_ids:
        print("[WebCenter update] ❌ No valid project numbers found.")
        return {"success": True}

    updated_count = 0
    for code in company_ids:
        match = WebCenterProject.query.filter(WebCenterProject.name.contains(code)).first()
        if match:
            success, msg = send_ups_tracking_to_webcenter(match.project_id, tracking_number)
            print(f"[WebCenter update] ▶ {code} → {match.project_id} → success={success}")
            updated_count += 1
        else:
            print(f"[WebCenter update] ⚠ No match found for {code}")

    return {"success": True, "updated_projects": updated_count}

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

@app.route('/admin/update-name/<int:user_id>', methods=['POST'])
@login_required
def update_user_name(user_id):
    if not current_user.is_admin:
        return "Unauthorized", 403
    user = User.query.get_or_404(user_id)
    user.first_name = request.form['first_name']
    user.last_name = request.form['last_name']
    db.session.commit()
    return redirect(url_for('admin_users'))


@app.route("/get_user_display_names")
@login_required
def get_user_display_names():
    users = User.query.all()
    return {
        u.email: f"{u.first_name} {u.last_name[0]}." if u.first_name and u.last_name else u.email
        for u in users
    }

@app.route("/changelog")
def changelog():
    return render_template("changelog.html")

@app.route('/admin/test-webcenter-modify')
@login_required
def test_webcenter_modify():
    if not current_user.is_admin:
        return "Unauthorized", 403

    jwt = os.environ.get("WEBCENTER_JWT") or "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIwMDAwMl8wMDAwMDE5NjI2IiwiZXhwIjoxNzYxMzQ3NTAyfQ.iqRPnEnglJgv2PN2PnnVLxsfTj_KntqRwQFtOvAvto5yX4c09jrUT9RMjeE63Sn7UqUyrbmdJVbk9XjVEO2NXA"
    ssoiid = os.environ.get("WEBCENTER_SSOIID") or "00002_0000000201"

    url = "https://cdc.chespa.eu/pl/CreateProject.jsp"
    params = {
        "action": "modify",
        "ssoiid": ssoiid,
        "jwt": jwt,
    }
    data = {
        "projectid": "00002_0000226492",
        "attribute": (
            'CRS - UPS - Tracking: '
            '<a href="https://www.ups.com/track?loc=en_US&tracknum=1ZV5358A6894985343" '
            'target="_blank" '
            'style="color: dodgerblue; font-size: 10px;">'
            '1ZV5358A6894985343</a>'
        )
    }

    try:
        session = requests.Session()
        session.mount("https://", TLSAdapter())  # use our custom TLS adapter

        response = session.post(url, params=params, data=data, timeout=20)
        response.raise_for_status()
        return f"✅ Modify request sent. Response: {response.text[:500]}..."
    except Exception as e:
        import traceback
        return f"❌ WebCenter modify test failed:\n{traceback.format_exc()}"

def send_ups_tracking_to_webcenter(project_id, tracking_number):
    jwt = os.environ.get("WEBCENTER_JWT") or "your-fallback-jwt"
    ssoiid = os.environ.get("WEBCENTER_SSOIID") or "your-fallback-ssoiid"

    url = "https://cdc.chespa.eu/pl/CreateProject.jsp"
    params = {
        "action": "modify",
        "ssoiid": ssoiid,
        "jwt": jwt,
    }

    link = (
        f'<a href="https://www.ups.com/track?loc=en_US&tracknum={tracking_number}" '
        f'target="_blank" style="color: dodgerblue; font-size: 10px;">{tracking_number}</a>'
    )

    data = {
        "projectid": project_id,
        "attribute": ( f"CRS - UPS - Tracking:{link}"
        )
    }

    try:
        session = requests.Session()
        session.mount("https://", TLSAdapter())
        response = session.post(url, params=params, data=data, timeout=15)
        response.raise_for_status()
        return True, response.text
    except Exception as e:
        print(f"[WebCenter update ERROR] {e}")
        return None

@app.route('/api/projects')
@login_required
def get_projects():
    if not current_user.is_admin:
        return "Unauthorized", 403

    projects = WebCenterProject.query.all()
    return jsonify([
        {
            "id": p.id,
            "project_id": p.project_id,
            "name": p.name,
            "created_at": p.created_at.isoformat() if p.created_at else None
        }
        for p in projects
    ])

@app.route("/admin/projects")
@login_required
def admin_projects():
    if not current_user.is_admin:
        return "Unauthorized", 403
    return render_template("projects.html")

@app.route('/api/projects/update', methods=['POST'])
@login_required
def update_project():
    if not current_user.is_admin:
        return "Unauthorized", 403

    data = request.json
    project = WebCenterProject.query.get(data["id"])
    if not project:
        return "Not found", 404

    project.project_id = data.get("project_id", project.project_id)
    project.name = data.get("name", project.name)
    db.session.commit()
    return jsonify(success=True)

@app.route('/api/projects/add', methods=['POST'])
@login_required
def add_project():
    if not current_user.is_admin:
        return "Unauthorized", 403

    data = request.json
    new_proj = WebCenterProject(
        project_id=data["project_id"],
        name=data["name"]
    )
    db.session.add(new_proj)
    db.session.commit()
    return jsonify(success=True, id=new_proj.id, created_at=new_proj.created_at.isoformat())


@app.route('/api/projects/delete', methods=['POST'])
@login_required
def delete_project():
    if not current_user.is_admin:
        return "Unauthorized", 403

    data = request.json
    project = WebCenterProject.query.get(data["id"])
    if project:
        db.session.delete(project)
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False)


@app.route('/api/projects/ae-add', methods=['POST'])
def ae_add_project():
    # Get values from form data
    token = request.form.get("token")
    project_id = request.form.get("project_id")
    name = request.form.get("name")

    # Validate token
    expected_token = os.environ.get("AE_API_TOKEN") or "hardcoded-token"
    if token != expected_token:
        return jsonify(success=False, error="Unauthorized"), 403

    if not project_id or not name:
        return jsonify(success=False, error="Missing fields"), 400

    # Check if project already exists
    existing = WebCenterProject.query.filter_by(project_id=project_id).first()
    if existing:
        existing.name = name  # Optional update
        db.session.commit()
        return jsonify(success=True, updated=True)

    # Create new project
    new_proj = WebCenterProject(project_id=project_id, name=name)
    db.session.add(new_proj)
    db.session.commit()

    return jsonify(success=True, id=new_proj.id, updated=False)


@app.route('/init-projects-table')
@login_required
def init_projects_table():
    if not current_user.is_admin:
        return "Unauthorized", 403
    db.create_all()
    return "✅ WebCenterProject table created."

@app.route('/import-projects')
@login_required
def import_projects():
    if not current_user.is_admin:
        return "Unauthorized", 403

    df = pd.read_excel("data/projects.xlsx")

    added = 0
    for _, row in df.iterrows():
        project = WebCenterProject(
            project_id=str(row["Project ID"]).strip(),
            name=str(row["Name"]).strip()
        )
        db.session.add(project)
        added += 1

    db.session.commit()
    return f"✅ Imported {added} projects into the database."

@app.route('/admin/migrate-projects-created-at')
@login_required
def migrate_projects_created_at():
    if not current_user.is_admin:
        return "Unauthorized", 403

    engine = db.engine.name  # 'postgresql', 'sqlite', etc.
    try:
        if engine == "postgresql":
            db.session.execute(text("""
                ALTER TABLE web_center_project
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
            """))
            db.session.execute(text("""
                UPDATE web_center_project SET created_at = NOW() WHERE created_at IS NULL
            """))
        else:
            # sqlite / other: add column if missing (wrapped in try)
            try:
                db.session.execute(text("ALTER TABLE web_center_project ADD COLUMN created_at TIMESTAMP"))
            except Exception:
                pass
            db.session.execute(text("""
                UPDATE web_center_project
                SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
            """))
        db.session.commit()
        return "✅ Migration complete."
    except Exception as e:
        db.session.rollback()
        return f"❌ Migration failed: {e}", 500

@app.route('/init-db')
def init_db():
    db.create_all()
    return "Database initialized."

if __name__ == '__main__':
    socketio.run(app, debug=True)
