import os

class Config:
    """Configuration class for the Flask application"""
    
    # Basic Flask configuration
    SECRET_KEY = os.environ.get('SESSION_SECRET') or 'dev-secret-key-change-in-production'
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///task_manager.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
    }
    
    # Flask-Login configuration
    LOGIN_DISABLED = False
    
    # Application specific settings
    MAX_ACTIVE_TASKS = 10
    POINTS_PER_HOUR = 5
    
    # Ranking thresholds
    RANK_THRESHOLDS = {
        'Bronze': 0,
        'Silver': 51,
        'Gold': 101,
        'Platinum': 151,
        'Diamond': 201,
        'Heroic': 251,
        'Master': 301,
        'Elite Master': 351,
        'Grandmaster': 401
    }

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///task_manager_dev.db'

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    
class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
