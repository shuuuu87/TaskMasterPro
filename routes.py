from datetime import datetime, date, timedelta
from flask import render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash
from app import app, db
from models import User, Task

@app.before_request
def before_request():
    """Update user's last seen timestamp"""
    if current_user.is_authenticated:
        current_user.update_last_seen()

@app.route('/')
@login_required
def index():
    """Home page with tasks"""
    tasks = Task.query.filter_by(user_id=current_user.id, is_complete=False).order_by(Task.created_at.desc()).all()
    completed_tasks = current_user.get_today_completed_tasks()
    
    return render_template('index.html', 
                         tasks=tasks, 
                         completed_tasks=completed_tasks,
                         user_rank=current_user.get_rank(),
                         rank_color=current_user.get_rank_color())

@app.route('/add_task', methods=['POST'])
@login_required
def add_task():
    """Add a new task"""
    task_name = request.form.get('task_name', '').strip()
    duration = request.form.get('duration', type=int)
    
    if not task_name:
        flash('Task name is required!', 'error')
        return redirect(url_for('index'))
    
    if not duration or duration <= 0:
        flash('Valid duration is required!', 'error')
        return redirect(url_for('index'))
    
    # Check if user has any active tasks
    active_tasks = Task.query.filter_by(user_id=current_user.id, is_complete=False).count()
    if active_tasks >= 10:  # Limit to 10 active tasks
        flash('You can have maximum 10 active tasks!', 'warning')
        return redirect(url_for('index'))
    
    task = Task(
        user_id=current_user.id,
        task_name=task_name,
        duration=duration
    )
    
    db.session.add(task)
    db.session.commit()
    
    flash('Task added successfully!', 'success')
    return redirect(url_for('index'))

@app.route('/complete_task/<int:task_id>', methods=['POST'])
@login_required
def complete_task(task_id):
    """Complete a task"""
    task = Task.query.get_or_404(task_id)
    
    if task.user_id != current_user.id:
        flash('Unauthorized action!', 'error')
        return redirect(url_for('index'))
    
    if task.is_complete:
        flash('Task is already completed!', 'warning')
        return redirect(url_for('index'))
    
    # Get actual time taken from form (in minutes)
    actual_minutes = request.form.get('actual_minutes', type=float, default=task.duration)
    if actual_minutes <= 0:
        actual_minutes = task.duration
    
    points_earned = task.mark_complete(actual_minutes)
    
    flash(f'Task completed! You earned {points_earned} points.', 'success')
    return redirect(url_for('index'))

@app.route('/delete_task/<int:task_id>', methods=['POST'])
@login_required
def delete_task(task_id):
    """Delete a task"""
    task = Task.query.get_or_404(task_id)
    
    if task.user_id != current_user.id:
        flash('Unauthorized action!', 'error')
        return redirect(url_for('index'))
    
    db.session.delete(task)
    db.session.commit()
    
    flash('Task deleted successfully!', 'info')
    return redirect(url_for('index'))

@app.route('/progress')
@login_required
def progress():
    """Progress page with charts"""
    labels, data = current_user.get_last_7_days_data()
    
    # Calculate total stats
    total_tasks = Task.query.filter_by(user_id=current_user.id, is_complete=True).count()
    total_time = sum(task.time_taken or 0 for task in Task.query.filter_by(user_id=current_user.id, is_complete=True))
    
    return render_template('progress.html', 
                         labels=labels, 
                         data=data,
                         total_tasks=total_tasks,
                         total_time=total_time,
                         user_rank=current_user.get_rank(),
                         rank_color=current_user.get_rank_color())

@app.route('/leaderboard')
@login_required
def leaderboard():
    """Leaderboard page"""
    users = User.query.order_by(User.score.desc()).limit(50).all()
    
    # Get current user's rank
    user_rank = User.query.filter(User.score > current_user.score).count() + 1
    
    return render_template('leaderboard.html', 
                         users=users, 
                         user_rank=user_rank,
                         current_user_rank=current_user.get_rank(),
                         rank_color=current_user.get_rank_color())

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login page"""
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        remember = bool(request.form.get('remember'))
        
        if not username or not password:
            flash('Username and password are required!', 'error')
            return render_template('login.html')
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user, remember=remember)
            flash(f'Welcome back, {user.username}!', 'success')
            
            next_page = request.args.get('next')
            if next_page:
                return redirect(next_page)
            return redirect(url_for('index'))
        else:
            flash('Invalid username or password!', 'error')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    """Registration page"""
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        # Validation
        if not username or not email or not password:
            flash('All fields are required!', 'error')
            return render_template('register.html')
        
        if len(username) < 3:
            flash('Username must be at least 3 characters long!', 'error')
            return render_template('register.html')
        
        if len(password) < 6:
            flash('Password must be at least 6 characters long!', 'error')
            return render_template('register.html')
        
        if password != confirm_password:
            flash('Passwords do not match!', 'error')
            return render_template('register.html')
        
        # Check if user exists
        if User.query.filter_by(username=username).first():
            flash('Username already exists!', 'error')
            return render_template('register.html')
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered!', 'error')
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
    """Logout user"""
    logout_user()
    flash('You have been logged out successfully!', 'info')
    return redirect(url_for('login'))

@app.errorhandler(404)
def not_found_error(error):
    """Handle 404 errors"""
    return render_template('base.html'), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    db.session.rollback()
    return render_template('base.html'), 500
