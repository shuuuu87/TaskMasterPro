from datetime import datetime, date, timedelta
from flask import render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash
from app import app, db
from models import User, Task

@app.route('/')
@login_required
def index():
    # Get today's tasks for the current user
    today = date.today()
    tasks = Task.query.filter_by(user_id=current_user.id, date_created=today).order_by(Task.created_at.desc()).all()
    return render_template('index.html', tasks=tasks, user_score=current_user.score)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user)
            flash('Logged in successfully!', 'success')
            return redirect(url_for('index'))
        else:
            flash('Invalid username or password', 'error')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        
        # Validation
        if password != confirm_password:
            flash('Passwords do not match', 'error')
            return render_template('register.html')
        
        # Check if user already exists
        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'error')
            return render_template('register.html')
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'error')
            return render_template('register.html')
        
        # Create new user
        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))

@app.route('/add_task', methods=['POST'])
@login_required
def add_task():
    task_name = request.form['task_name']
    duration = int(request.form['duration'])
    
    if task_name and duration > 0:
        task = Task(
            user_id=current_user.id,
            task_name=task_name,
            duration=duration
        )
        db.session.add(task)
        db.session.commit()
        flash('Task added successfully!', 'success')
    else:
        flash('Please provide valid task name and duration', 'error')
    
    return redirect(url_for('index'))

@app.route('/complete_task/<int:task_id>', methods=['POST'])
@login_required
def complete_task(task_id):
    task = Task.query.get_or_404(task_id)
    
    # Ensure the task belongs to the current user
    if task.user_id != current_user.id:
        flash('Unauthorized action', 'error')
        return redirect(url_for('index'))
    
    # Get the actual time taken from the form (sent by JavaScript)
    time_taken = request.form.get('time_taken', type=int)
    
    if time_taken is not None:
        task.time_taken = time_taken
        task.is_complete = True
        db.session.commit()
        
        # Update user score
        current_user.update_score()
        
        flash(f'Task completed! You worked for {time_taken} minutes and earned points!', 'success')
    else:
        flash('Error completing task - time not recorded', 'error')
    
    return redirect(url_for('index'))

@app.route('/delete_task/<int:task_id>', methods=['POST'])
@login_required
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    
    # Ensure the task belongs to the current user
    if task.user_id != current_user.id:
        flash('Unauthorized action', 'error')
        return redirect(url_for('index'))
    
    db.session.delete(task)
    db.session.commit()
    flash('Task deleted successfully!', 'info')
    
    return redirect(url_for('index'))

@app.route('/progress')
@login_required
def progress():
    # Get data for the last 7 days
    today = date.today()
    dates = []
    work_times = []
    
    for i in range(6, -1, -1):  # Last 7 days including today
        target_date = today - timedelta(days=i)
        dates.append(target_date.strftime('%m/%d'))
        work_time = current_user.get_daily_work_time(target_date)
        work_times.append(work_time)
    
    return render_template('progress.html', dates=dates, work_times=work_times)

@app.route('/leaderboard')
@login_required
def leaderboard():
    # Get top users by score
    top_users = User.query.order_by(User.score.desc()).limit(10).all()
    return render_template('leaderboard.html', top_users=top_users)

@app.route('/fullscreen_timer/<int:task_id>')
@login_required
def fullscreen_timer(task_id):
    task = Task.query.get_or_404(task_id)
    
    # Ensure the task belongs to the current user
    if task.user_id != current_user.id:
        flash('Unauthorized action', 'error')
        return redirect(url_for('index'))
    
    return render_template('fullscreen_timer.html', task=task)
