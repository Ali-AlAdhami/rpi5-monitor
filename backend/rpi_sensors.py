"""
Raspberry Pi 5 specific sensor readings
Handles temperature, fan speed, and power estimation
"""
import os
import subprocess
import psutil

# Cache for static system info
_system_info_cache = None


def get_cpu_temperature():
    """
    Get CPU temperature from Raspberry Pi thermal zone
    Returns temperature in Celsius or None if unavailable
    """
    # Try Raspberry Pi thermal zone first
    thermal_paths = [
        '/sys/class/thermal/thermal_zone0/temp',
        '/sys/devices/virtual/thermal/thermal_zone0/temp',
    ]

    for path in thermal_paths:
        try:
            with open(path, 'r') as f:
                temp = float(f.read().strip()) / 1000.0
                return round(temp, 1)
        except (FileNotFoundError, PermissionError, ValueError):
            continue

    # Fallback: try psutil sensors_temperatures
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            # Look for common sensor names
            for name in ['cpu_thermal', 'cpu-thermal', 'coretemp', 'k10temp']:
                if name in temps and temps[name]:
                    return round(temps[name][0].current, 1)
            # Return first available
            for name, entries in temps.items():
                if entries:
                    return round(entries[0].current, 1)
    except Exception as e:
        print(f"Error reading temperature via psutil: {e}")

    return None


def get_fan_speed():
    """
    Get fan speed from Raspberry Pi 5 cooling system
    Returns RPM or None if no fan / not readable
    """
    # Raspberry Pi 5 fan speed paths (varies by kernel version)
    fan_paths = [
        '/sys/devices/platform/cooling_fan/hwmon/hwmon2/fan1_input',
        '/sys/devices/platform/cooling_fan/hwmon/hwmon3/fan1_input',
        '/sys/class/hwmon/hwmon2/fan1_input',
        '/sys/class/hwmon/hwmon3/fan1_input',
        '/sys/class/hwmon/hwmon1/fan1_input',
        '/sys/devices/platform/cooling_fan/hwmon/hwmon1/fan1_input',
    ]

    # Try each possible path
    for path in fan_paths:
        try:
            with open(path, 'r') as f:
                rpm = int(f.read().strip())
                return rpm
        except (FileNotFoundError, PermissionError, ValueError):
            continue

    # Try to find fan dynamically
    try:
        hwmon_base = '/sys/class/hwmon'
        if os.path.exists(hwmon_base):
            for hwmon in os.listdir(hwmon_base):
                fan_path = os.path.join(hwmon_base, hwmon, 'fan1_input')
                if os.path.exists(fan_path):
                    try:
                        with open(fan_path, 'r') as f:
                            rpm = int(f.read().strip())
                            return rpm
                    except:
                        continue
    except Exception as e:
        print(f"Error searching for fan sensor: {e}")

    return None


def get_power_draw():
    """
    Estimate power draw for Raspberry Pi 5

    Note: Raspberry Pi 5 PMIC doesn't directly expose power readings to userspace
    in a standardized way. This function provides an estimate based on:
    - CPU usage and frequency
    - Temperature (higher temp often correlates with higher power)

    For accurate readings, you would need:
    - External USB power meter
    - Custom kernel module
    - Direct I2C communication with the PMIC

    Returns estimated watts or None
    """
    try:
        # Get CPU usage
        cpu_percent = psutil.cpu_percent(interval=0.1)

        # Raspberry Pi 5 power profile (approximate):
        # - Idle: ~2.5-3W
        # - Light load: ~4-5W
        # - Full load: ~8-12W (can spike to 15W with peripherals)

        # Base idle power
        base_power = 2.7

        # CPU contribution (roughly 0-9W based on load)
        cpu_power = (cpu_percent / 100.0) * 9.0

        # Temperature adjustment (higher temp = more power typically)
        temp = get_cpu_temperature()
        temp_factor = 1.0
        if temp:
            if temp > 70:
                temp_factor = 1.15
            elif temp > 60:
                temp_factor = 1.08
            elif temp > 50:
                temp_factor = 1.02

        estimated_power = (base_power + cpu_power) * temp_factor

        # Clamp to reasonable range
        estimated_power = max(2.5, min(15.0, estimated_power))

        return round(estimated_power, 1)

    except Exception as e:
        print(f"Error estimating power: {e}")
        return None


def try_vcgencmd_power():
    """
    Try to get power info from vcgencmd (Raspberry Pi specific)
    This is experimental and may not work on all systems
    """
    try:
        # Try to read PMIC ADC values
        result = subprocess.run(
            ['vcgencmd', 'pmic_read_adc'],
            capture_output=True,
            text=True,
            timeout=2
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError):
        pass

    return None


def get_throttle_status():
    """
    Get throttling status from Raspberry Pi
    Returns dictionary with throttle flags
    """
    try:
        result = subprocess.run(
            ['vcgencmd', 'get_throttled'],
            capture_output=True,
            text=True,
            timeout=2
        )
        if result.returncode == 0:
            # Parse throttled=0x0 format
            output = result.stdout.strip()
            if '=' in output:
                hex_val = output.split('=')[1]
                val = int(hex_val, 16)
                return {
                    'raw': hex_val,
                    'under_voltage': bool(val & 0x1),
                    'freq_capped': bool(val & 0x2),
                    'throttled': bool(val & 0x4),
                    'soft_temp_limit': bool(val & 0x8),
                    'under_voltage_occurred': bool(val & 0x10000),
                    'freq_capped_occurred': bool(val & 0x20000),
                    'throttled_occurred': bool(val & 0x40000),
                    'soft_temp_limit_occurred': bool(val & 0x80000),
                }
    except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError):
        pass

    return None


def get_gpu_memory():
    """Get GPU memory allocation on Raspberry Pi"""
    try:
        result = subprocess.run(
            ['vcgencmd', 'get_mem', 'gpu'],
            capture_output=True,
            text=True,
            timeout=2
        )
        if result.returncode == 0:
            # Parse gpu=76M format
            output = result.stdout.strip()
            if '=' in output:
                mem_str = output.split('=')[1].rstrip('M')
                return int(mem_str)
    except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError, ValueError):
        pass

    return None


def get_system_info():
    """
    Get static system information (cached after first call)
    """
    global _system_info_cache

    if _system_info_cache is not None:
        return _system_info_cache

    info = {
        'model': 'Unknown',
        'serial': 'Unknown',
        'revision': 'Unknown',
        'memory_gb': round(psutil.virtual_memory().total / (1024**3), 1),
        'cpu_count': psutil.cpu_count(),
    }

    # Try to get Raspberry Pi model
    try:
        with open('/proc/device-tree/model', 'r') as f:
            info['model'] = f.read().strip().rstrip('\x00')
    except:
        try:
            with open('/sys/firmware/devicetree/base/model', 'r') as f:
                info['model'] = f.read().strip().rstrip('\x00')
        except:
            pass

    # Try to get serial number
    try:
        with open('/proc/cpuinfo', 'r') as f:
            for line in f:
                if line.startswith('Serial'):
                    info['serial'] = line.split(':')[1].strip()
                elif line.startswith('Revision'):
                    info['revision'] = line.split(':')[1].strip()
    except:
        pass

    _system_info_cache = info
    return info


def is_raspberry_pi():
    """Check if running on a Raspberry Pi"""
    try:
        with open('/proc/device-tree/model', 'r') as f:
            model = f.read().lower()
            return 'raspberry' in model
    except:
        pass

    try:
        with open('/proc/cpuinfo', 'r') as f:
            content = f.read().lower()
            return 'raspberry' in content or 'bcm' in content
    except:
        pass

    return False
