
from flask import Flask, render_template, request, redirect, url_for, session, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, login_required, logout_user, UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from flask_socketio import SocketIO, emit
import pandas as pd
import io
import json
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'supersecretkey'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.sqlite'
db = SQLAlchemy(app)
socketio = SocketIO(app)

with app.app_context():
    try:
        db.create_all()
    except Exception as e:
        print("DB Init Error:", e)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True)
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
        password = generate_password_hash(request.form['password'])
        if User.query.filter_by(email=email).first():
            return 'Email already exists.'
        user = User(email=email, password=password)
        db.session.add(user)
        db.session.commit()
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        user = User.query.filter_by(email=request.form['email']).first()
        if user and check_password_hash(user.password, request.form['password']):
            login_user(user)
            return redirect(url_for('dashboard'))
        return 'Invalid credentials.'
    return render_template('login.html')

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
def download_csv():
    entries = UPSEntry.query.all()
    rows = [e.data for e in entries]
    df = pd.DataFrame(rows)
    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)
    return send_file(io.BytesIO(output.getvalue().encode()), mimetype='text/csv', as_attachment=True, download_name='ups_data.csv')

@socketio.on('add_entry')
def handle_add_entry(data):
    entry = UPSEntry(data=data)
    db.session.add(entry)
    db.session.commit()
    emit('new_entry', {'id': entry.id, 'data': entry.data}, broadcast=True)

@socketio.on('update_entry')
def handle_update_entry(data):
    entry = UPSEntry.query.get(data['id'])
    entry.data = data['data']
    db.session.commit()
    emit('entry_updated', data, broadcast=True)

@socketio.on('delete_entry')
def handle_delete_entry(data):
    entry = UPSEntry.query.get(data['id'])
    db.session.delete(entry)
    db.session.commit()
    emit('entry_deleted', {'id': data['id']}, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True)
