"""
Utility functions for the application.
"""
from functools import wraps
from flask import request, jsonify, current_app
import os

def require_api_key(f):
    """
    Decorator to require API key for routes.
    In development mode, skip API key validation.
    In production mode, enforce API key validation only if API_KEY is configured.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # In development mode, skip API key validation
        if os.getenv('FLASK_ENV') == 'development':
            return f(*args, **kwargs)
        
        # Check if API_KEY is configured
        app_api_key = current_app.config.get('API_KEY')
        if not app_api_key:
            # If API_KEY is not configured, skip validation even in production
            return f(*args, **kwargs)
        
        # In production mode with API_KEY configured, enforce API key validation
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != app_api_key:
            return jsonify({
                'status': 'error',
                'message': 'Invalid or missing API key'
            }), 401
            
        return f(*args, **kwargs)
    return decorated_function 