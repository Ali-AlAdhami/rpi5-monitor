# RPi5 Monitor

A real-time system monitoring dashboard for Raspberry Pi 5, built with React and Flask. Monitor CPU, temperature, memory, disk, network, and more with beautiful, responsive charts.

## Features

### Real-Time Monitoring
- **CPU**: Usage percentage, frequency, and load averages
- **Temperature**: Live CPU temperature readings
- **Memory**: RAM usage with detailed breakdown
- **Disk**: Storage usage and available space
- **Network**: Upload/download rates with historical graphs
- **Fan Speed**: RPM monitoring for Raspberry Pi 5 cooling fan
- **Power**: Estimated power draw (2.5W - 15W range)
- **Uptime**: System uptime tracking
- **Top Processes**: Real-time view of CPU-intensive processes

### UI Features
- Dark theme optimized for 24/7 monitoring
- Responsive design - works on desktop, tablet, and mobile
- Color-coded metrics with visual indicators
- Historical performance charts (customizable time range)
- Auto-refresh with configurable intervals
- Network access - monitor from any device on your network

## Tech Stack

### Frontend
- **React** - UI framework
- **Recharts** - Beautiful, responsive charts
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icons

### Backend
- **Flask** - Python web framework
- **psutil** - System metrics collection
- **Flask-CORS** - Cross-origin resource sharing

### Deployment
- **systemd** - Production service management
- **Rotating logs** - Automatic log management (50MB max)
- **Virtual environment** - Isolated Python dependencies

## Requirements

- Raspberry Pi 5 (or other Linux system)
- Python 3.9+
- Node.js 14+
- 4GB RAM recommended
- 2GB swap recommended (for reliability)

## Quick Start

### 1. Clone the Repository

```bash
git clone REPO_URL
cd rpi5-monitor
```

### 2. Backend Setup

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
pip install -r backend-requirements.txt
```

### 3. Frontend Setup

```bash
# Install Node.js dependencies
npm install

# Build production version
npm run build
```

### 4. Run the Application

**Option A: Quick Start (Recommended)**
```bash
./scripts/build-and-run.sh
```

Access at: http://localhost:5000

**Option B: Development Mode**
```bash
# Terminal 1 - Backend
source venv/bin/activate
python backend/app.py

# Terminal 2 - Frontend
npm start
```

Access at: http://localhost:3000

## Production Deployment

### Using systemd

**1. Install the service:**
```bash
sudo cp rpi5-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
```

**2. Enable and start:**
```bash
sudo systemctl enable rpi5-monitor
sudo systemctl start rpi5-monitor
```

**3. Check status:**
```bash
sudo systemctl status rpi5-monitor
```

### Service Management

```bash
# View live logs
sudo journalctl -u rpi5-monitor -f

# Restart service
sudo systemctl restart rpi5-monitor

# Stop service
sudo systemctl stop rpi5-monitor

# Disable auto-start
sudo systemctl disable rpi5-monitor
```

## Configuration

### API Configuration

The app uses relative URLs by default, so it works from any device on your network.

To use a different API endpoint, set environment variable:
```bash
export REACT_APP_API_URL=http://YOUR_PI_IP:5000
```

Or edit [src/App.js](src/App.js) line 38:
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || '';
```

### Logging

Logs are automatically rotated:
- Location: `backend.log`
- Max size: 10MB per file
- Backups: 5 files (50MB total)
- Auto-cleanup: Oldest logs deleted automatically

View logs:
```bash
# File logs
tail -f backend.log

# systemd logs
sudo journalctl -u rpi5-monitor -f
```

See [claude/logging-guide.md](claude/logging-guide.md) for detailed logging documentation.

## API Endpoints

### GET /api/health
Health check endpoint

**Response:**
```json
{
  "service": "rpi5-monitor-api",
  "status": "ok",
  "timestamp": 1765690033.148069,
  "version": "1.0.0"
}
```

### GET /api/metrics
Current system metrics

**Response:**
```json
{
  "cpuUsage": 7.7,
  "cpuTemp": 55.6,
  "cpuFreq": 1800.0,
  "memoryUsage": 49.8,
  "memoryUsedGb": 1.79,
  "memoryAvailableGb": 1.98,
  "memoryTotal": 3.95,
  "diskUsed": 13.5,
  "diskUsedGb": 14.6,
  "diskFreeGb": 93.7,
  "diskTotal": 112.9,
  "diskDevice": "/dev/mmcblk0p2",
  "networkUp": 0.02,
  "networkDown": 0.02,
  "networkOutKbps": 20.5,
  "networkInKbps": 19.2,
  "networkInterface": "eth0",
  "fanSpeed": 2175,
  "powerDraw": 4.1,
  "uptime": "23h 24m",
  "loadAverage": {
    "load1": 0.6,
    "load5": 0.56,
    "load15": 0.47
  },
  "timestamp": 1765690493.9340284
}
```

### GET /api/system-info
System information

**Response:**
```json
{
  "model": "Raspberry Pi 5 Model B Rev 1.0",
  "memory_gb": 4,
  "cpu_count": 4,
  "cpu_arch": "aarch64",
  "os": "Linux",
  "hostname": "raspberrypi"
}
```

### GET /api/processes
Top CPU-consuming processes

**Query params:**
- `limit` (optional): Number of processes (default: 10)

**Response:**
```json
{
  "processes": [
    {
      "pid": 1234,
      "name": "python",
      "cpu": 15.2,
      "mem_mb": 125.4
    }
  ]
}
```

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Built with [Create React App](https://create-react-app.dev/)
- Charts powered by [Recharts](https://recharts.org/)
- System metrics via [psutil](https://github.com/giampaolo/psutil)
- Icons by [Lucide](https://lucide.dev/)

---
