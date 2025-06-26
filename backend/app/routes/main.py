from flask import Blueprint, jsonify

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """Endpoint principale che verifica lo stato dell'API"""
    return jsonify({
        'status': 'success',
        'message': 'Red Teaming Toolkit API is running'
    }) 