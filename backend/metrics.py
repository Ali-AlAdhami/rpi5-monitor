"""
System metrics collection using psutil
"""
import psutil
import time
from datetime import timedelta
from collections import deque
from threading import Lock

# Store previous network readings for rate calculation
_prev_net_io = None
_prev_net_time = None
_net_lock = Lock()

# History storage
_metrics_history = deque(maxlen=60)  # Keep last 60 readings
_history_lock = Lock()


def get_cpu_usage():
    """Get current CPU usage percentage"""
    return round(psutil.cpu_percent(interval=0.1), 1)


def get_cpu_frequency():
    """Get current CPU frequency in MHz"""
    freq = psutil.cpu_freq()
    if freq:
        return round(freq.current, 0)
    return None


def get_memory_info():
    """Get memory usage information"""
    mem = psutil.virtual_memory()
    return {
        'usage_percent': round(mem.percent, 1),
        'total_gb': round(mem.total / (1024**3), 2),
        'used_gb': round(mem.used / (1024**3), 2),
        'available_gb': round(mem.available / (1024**3), 2),
    }


def get_disk_info(path='/'):
    """Get disk usage information for specified path"""
    try:
        disk = psutil.disk_usage(path)
        return {
            'usage_percent': round(disk.percent, 1),
            'total_gb': round(disk.total / (1024**3), 1),
            'used_gb': round(disk.used / (1024**3), 1),
            'free_gb': round(disk.free / (1024**3), 1),
        }
    except Exception as e:
        print(f"Error getting disk info: {e}")
        return None


def get_disk_device():
    """Get the primary disk device name"""
    try:
        partitions = psutil.disk_partitions()
        for p in partitions:
            if p.mountpoint == '/':
                return p.device
        return '/dev/root'
    except:
        return '/dev/root'


def get_network_rates():
    """
    Get network upload/download rates in MB/s and KB/s
    Returns rates calculated from difference since last call
    """
    global _prev_net_io, _prev_net_time

    with _net_lock:
        current_io = psutil.net_io_counters()
        current_time = time.time()

        if _prev_net_io is None or _prev_net_time is None:
            # First call - store values and return zeros
            _prev_net_io = current_io
            _prev_net_time = current_time
            return {
                'upload_mbps': 0.0,
                'download_mbps': 0.0,
                'upload_kbps': 0.0,
                'download_kbps': 0.0,
                'bytes_sent': current_io.bytes_sent,
                'bytes_recv': current_io.bytes_recv,
            }

        # Calculate time difference
        time_diff = current_time - _prev_net_time
        if time_diff <= 0:
            time_diff = 1  # Prevent division by zero

        # Calculate bytes per second
        bytes_sent_per_sec = (current_io.bytes_sent - _prev_net_io.bytes_sent) / time_diff
        bytes_recv_per_sec = (current_io.bytes_recv - _prev_net_io.bytes_recv) / time_diff

        # Update previous values
        _prev_net_io = current_io
        _prev_net_time = current_time

        return {
            'upload_mbps': round(bytes_sent_per_sec / (1024 * 1024), 2),
            'download_mbps': round(bytes_recv_per_sec / (1024 * 1024), 2),
            'upload_kbps': round(bytes_sent_per_sec / 1024, 1),
            'download_kbps': round(bytes_recv_per_sec / 1024, 1),
            'bytes_sent': current_io.bytes_sent,
            'bytes_recv': current_io.bytes_recv,
        }


def get_network_interfaces():
    """Get information about network interfaces"""
    interfaces = []
    try:
        stats = psutil.net_if_stats()
        addrs = psutil.net_if_addrs()
        io_counters = psutil.net_io_counters(pernic=True)

        for iface, stat in stats.items():
            # Skip loopback
            if iface == 'lo':
                continue

            info = {
                'name': iface,
                'is_up': stat.isup,
                'speed': stat.speed,  # Mbps
                'mtu': stat.mtu,
            }

            # Get IP addresses
            if iface in addrs:
                for addr in addrs[iface]:
                    if addr.family.name == 'AF_INET':
                        info['ipv4'] = addr.address
                    elif addr.family.name == 'AF_INET6':
                        info['ipv6'] = addr.address

            # Get IO stats
            if iface in io_counters:
                io = io_counters[iface]
                info['bytes_sent'] = io.bytes_sent
                info['bytes_recv'] = io.bytes_recv

            interfaces.append(info)
    except Exception as e:
        print(f"Error getting network interfaces: {e}")

    return interfaces


def get_primary_interface():
    """Get the name of the primary network interface (eth0, wlan0, etc.)"""
    try:
        stats = psutil.net_if_stats()
        # Prefer eth0, then wlan0, then first active interface
        for preferred in ['eth0', 'wlan0', 'end0', 'wlan1']:
            if preferred in stats and stats[preferred].isup:
                return preferred

        # Return first active non-loopback interface
        for iface, stat in stats.items():
            if iface != 'lo' and stat.isup:
                return iface

        return 'eth0'
    except:
        return 'eth0'


def get_uptime():
    """Get system uptime as formatted string"""
    try:
        uptime_seconds = time.time() - psutil.boot_time()
        uptime_delta = timedelta(seconds=uptime_seconds)

        days = uptime_delta.days
        hours = uptime_delta.seconds // 3600
        minutes = (uptime_delta.seconds % 3600) // 60

        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        elif hours > 0:
            return f"{hours}h {minutes}m"
        else:
            return f"{minutes}m"
    except:
        return "Unknown"


def get_top_processes(limit=10):
    """Get top processes sorted by CPU usage"""
    processes = []

    try:
        # Get all processes with their info
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
            try:
                pinfo = proc.info
                mem_mb = pinfo['memory_info'].rss / (1024 * 1024) if pinfo['memory_info'] else 0

                processes.append({
                    'pid': pinfo['pid'],
                    'name': pinfo['name'] or 'Unknown',
                    'cpu': round(pinfo['cpu_percent'] or 0, 1),
                    'mem_mb': round(mem_mb, 1),
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass

        # Sort by CPU usage and return top N
        processes.sort(key=lambda x: x['cpu'], reverse=True)
        return processes[:limit]

    except Exception as e:
        print(f"Error getting processes: {e}")
        return []


def add_to_history(metrics_snapshot):
    """Add a metrics snapshot to history"""
    with _history_lock:
        _metrics_history.append({
            'timestamp': time.time(),
            'time': time.strftime('%H:%M:%S'),
            'cpu': metrics_snapshot.get('cpu_usage', 0),
            'temp': metrics_snapshot.get('cpu_temp', 0),
            'mem': metrics_snapshot.get('memory_usage', 0),
            'netIn': metrics_snapshot.get('network_in_kbps', 0),
            'netOut': metrics_snapshot.get('network_out_kbps', 0),
        })


def get_history():
    """Get metrics history for charts"""
    with _history_lock:
        return list(_metrics_history)


def get_load_average():
    """Get system load average"""
    try:
        load1, load5, load15 = psutil.getloadavg()
        return {
            'load1': round(load1, 2),
            'load5': round(load5, 2),
            'load15': round(load15, 2),
        }
    except:
        return None
