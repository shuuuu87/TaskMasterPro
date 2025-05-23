from datetime import datetime, date
from app import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    score = db.Column(db.Integer, default=0)
    date_joined = db.Column(db.Date, default=date.today)
    
    # Relationship with tasks
    tasks = db.relationship('Task', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_daily_work_time(self, target_date):
        """Get total minutes worked on a specific date"""
        tasks = Task.query.filter_by(
            user_id=self.id, 
            date_created=target_date,
            is_complete=True
        ).all()
        return sum(task.time_taken or 0 for task in tasks)
    
    def update_score(self):
        """Update user score based on completed tasks"""
        completed_tasks = Task.query.filter_by(user_id=self.id, is_complete=True).all()
        total_minutes = sum(task.time_taken or 0 for task in completed_tasks)
        # 5 points per hour (60 minutes)
        self.score = int((total_minutes / 60) * 5)
        db.session.commit()

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    task_name = db.Column(db.String(200), nullable=False)
    duration = db.Column(db.Integer, nullable=False)  # Duration in minutes
    time_taken = db.Column(db.Integer)  # Actual time taken in minutes
    date_created = db.Column(db.Date, default=date.today)
    is_complete = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Task {self.task_name}>'
