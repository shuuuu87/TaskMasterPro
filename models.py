from datetime import datetime, date
from app import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    score = db.Column(db.Integer, default=0)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to tasks
    tasks = db.relationship('Task', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        """Set password hash"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check password against hash"""
        return check_password_hash(self.password_hash, password)
    
    def get_rank(self):
        """Get user rank based on score"""
        if self.score < 51:
            return "Bronze"
        elif self.score < 101:
            return "Silver"
        elif self.score < 151:
            return "Gold"
        elif self.score < 201:
            return "Platinum"
        elif self.score < 251:
            return "Diamond"
        elif self.score < 301:
            return "Heroic"
        elif self.score < 351:
            return "Master"
        elif self.score < 401:
            return "Elite Master"
        else:
            return "Grandmaster"
    
    def get_rank_color(self):
        """Get color for rank badge"""
        rank_colors = {
            "Bronze": "#CD7F32",
            "Silver": "#C0C0C0",
            "Gold": "#FFD700",
            "Platinum": "#E5E4E2",
            "Diamond": "#B9F2FF",
            "Heroic": "#FF6B6B",
            "Master": "#9B59B6",
            "Elite Master": "#8E44AD",
            "Grandmaster": "#FF1744"
        }
        return rank_colors.get(self.get_rank(), "#6C757D")
    
    def is_online(self):
        """Check if user is online (last seen within 5 minutes)"""
        from datetime import timedelta
        return self.last_seen and (datetime.utcnow() - self.last_seen) < timedelta(minutes=5)
    
    def update_last_seen(self):
        """Update last seen timestamp"""
        self.last_seen = datetime.utcnow()
        db.session.commit()
    
    def get_today_completed_tasks(self):
        """Get tasks completed today"""
        today = date.today()
        return Task.query.filter(
            Task.user_id == self.id,
            Task.is_complete == True,
            db.func.date(Task.completed_at) == today
        ).all()
    
    def get_last_7_days_data(self):
        """Get last 7 days progress data for charts"""
        from datetime import timedelta
        data = []
        labels = []
        
        for i in range(6, -1, -1):
            target_date = date.today() - timedelta(days=i)
            day_tasks = Task.query.filter(
                Task.user_id == self.id,
                Task.is_complete == True,
                db.func.date(Task.completed_at) == target_date
            ).all()
            
            total_minutes = sum(task.time_taken or 0 for task in day_tasks)
            data.append(total_minutes)
            labels.append(target_date.strftime('%a'))
        
        return labels, data

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    task_name = db.Column(db.String(200), nullable=False)
    duration = db.Column(db.Integer, nullable=False)  # Duration in minutes
    time_taken = db.Column(db.Integer)  # Actual time taken in minutes
    is_complete = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    def mark_complete(self, actual_minutes):
        """Mark task as complete and update user score"""
        self.is_complete = True
        self.time_taken = actual_minutes
        self.completed_at = datetime.utcnow()
        
        # Calculate points (5 points per hour)
        points = int((actual_minutes / 60) * 5)
        self.user.score += points
        
        db.session.commit()
        return points
    
    def get_status_badge(self):
        """Get status badge class"""
        if self.is_complete:
            return "success"
        return "primary"
