#!/usr/bin/env python3
"""
RPi5 Monitor - Backend API Server
Real-time system monitoring for Raspberry Pi 5

Run with: python backend/app.py
API available at: http://localhost:5000
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import time
import os

# Import our modules
from metrics import (
    get_cpu_usage,
    get_cpu_frequency,
    get_memory_info,
    get_disk_info,
    get_disk_device,
    get_network_rates,
    get_network_interfaces,
    get_primary_interface,
    get_uptime,
    get_top_processes,
    get_load_average,
    add_to_history,
    get_history,
)
from rpi_sensors import (
    get_cpu_temperature,
    get_fan_speed,
    get_power_draw,
    get_throttle_status,
    get_system_info,
    is_raspberry_pi,
)

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Configuration
API_VERSION = '1.0.0'
DEFAULT_POLL_INTERVAL = 2  # seconds


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'rpi5-monitor-api',
        'version': API_VERSION,
        'timestamp': time.time(),
    })


@app.route('/api/system', methods=['GET'])
def get_system():
    """Get static system information"""
    info = get_system_info()
    info['is_raspberry_pi'] = is_raspberry_pi()
    info['hostname'] = os.uname().nodename
    info['kernel'] = os.uname().release
    return jsonify(info)


@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """
    Get current system metrics
    This is the main endpoint called by the frontend
    """
    try:
        # Collect all metrics
        cpu_usage = get_cpu_usage()
        cpu_temp = get_cpu_temperature()
        cpu_freq = get_cpu_frequency()
        memory = get_memory_info()
        disk = get_disk_info('/')
        network = get_network_rates()
        uptime = get_uptime()
        fan_speed = get_fan_speed()
        power_draw = get_power_draw()
        load = get_load_average()

        # Build response matching frontend expectations
        metrics = {
            # CPU metrics
            'cpuUsage': cpu_usage,
            'cpuTemp': cpu_temp if cpu_temp is not None else 0,
            'cpuFreq': cpu_freq,

            # Memory metrics
            'memoryUsage': memory['usage_percent'],
            'memoryTotal': memory['total_gb'],
            'memoryUsedGb': memory['used_gb'],
            'memoryAvailableGb': memory['available_gb'],

            # Disk metrics
            'diskUsed': disk['usage_percent'] if disk else 0,
            'diskTotal': disk['total_gb'] if disk else 0,
            'diskUsedGb': disk['used_gb'] if disk else 0,
            'diskFreeGb': disk['free_gb'] if disk else 0,
            'diskDevice': get_disk_device(),

            # Network metrics (MB/s for display)
            'networkUp': network['upload_mbps'],
            'networkDown': network['download_mbps'],

            # Network metrics (KB/s for charts)
            'networkInKbps': network['download_kbps'],
            'networkOutKbps': network['upload_kbps'],

            # System info
            'uptime': uptime,
            'fanSpeed': fan_speed if fan_speed is not None else 0,
            'powerDraw': power_draw if power_draw is not None else 0,

            # Additional info
            'networkInterface': get_primary_interface(),
            'loadAverage': load,
            'timestamp': time.time(),
        }

        # Add to history for charts
        add_to_history({
            'cpu_usage': cpu_usage,
            'cpu_temp': cpu_temp if cpu_temp is not None else 0,
            'memory_usage': memory['usage_percent'],
            'network_in_kbps': network['download_kbps'],
            'network_out_kbps': network['upload_kbps'],
        })

        return jsonify(metrics)

    except Exception as e:
        print(f"Error collecting metrics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/metrics/history', methods=['GET'])
def get_metrics_history():
    """
    Get historical metrics for charts
    Returns array of data points with time, cpu, temp, mem, netIn, netOut
    """
    try:
        history = get_history()
        return jsonify(history)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/processes', methods=['GET'])
def get_processes():
    """
    Get top processes sorted by CPU usage
    Optional query param: limit (default 10)
    """
    try:
        limit = request.args.get('limit', 10, type=int)
        limit = min(max(limit, 1), 50)  # Clamp between 1 and 50

        processes = get_top_processes(limit)

        # Format for frontend
        formatted = []
        for proc in processes:
            formatted.append({
                'pid': proc['pid'],
                'name': proc['name'],
                'cpu': f"{proc['cpu']:.1f}%",
                'mem': f"{proc['mem_mb']:.0f} MB",
                'cpu_raw': proc['cpu'],
                'mem_raw': proc['mem_mb'],
            })

        return jsonify(formatted)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/network', methods=['GET'])
def get_network():
    """Get detailed network interface information"""
    try:
        interfaces = get_network_interfaces()
        return jsonify({
            'interfaces': interfaces,
            'primary': get_primary_interface(),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/thermal', methods=['GET'])
def get_thermal():
    """Get thermal and power information"""
    try:
        data = {
            'cpu_temp': get_cpu_temperature(),
            'fan_speed': get_fan_speed(),
            'power_draw': get_power_draw(),
            'throttle_status': get_throttle_status(),
        }
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/disk', methods=['GET'])
def get_disk():
    """Get disk information"""
    try:
        path = request.args.get('path', '/')
        disk = get_disk_info(path)
        if disk:
            disk['device'] = get_disk_device()
            disk['path'] = path
            return jsonify(disk)
        else:
            return jsonify({'error': 'Unable to get disk info'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Error handlers
@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500


def print_startup_info():
    """Print startup information"""
    print("=" * 60)
    print("RPi5 Monitor - Backend API Server")
    print("=" * 60)
    print(f"\nVersion: {API_VERSION}")
    print(f"Running on Raspberry Pi: {is_raspberry_pi()}")

    sys_info = get_system_info()
    print(f"Model: {sys_info.get('model', 'Unknown')}")
    print(f"Memory: {sys_info.get('memory_gb', '?')} GB")
    print(f"CPU Cores: {sys_info.get('cpu_count', '?')}")

    print("\nAPI Endpoints:")
    print("  GET /api/health          - Health check")
    print("  GET /api/system          - System information")
    print("  GET /api/metrics         - Current metrics (main endpoint)")
    print("  GET /api/metrics/history - Historical data for charts")
    print("  GET /api/processes       - Top processes")
    print("  GET /api/network         - Network interfaces")
    print("  GET /api/thermal         - Temperature & power")
    print("  GET /api/disk            - Disk usage")

    print("\nStarting server on http://0.0.0.0:5000")
    print("Press Ctrl+C to stop\n")
    print("=" * 60)


if __name__ == '__main__':
    print_startup_info()

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True,
    )
