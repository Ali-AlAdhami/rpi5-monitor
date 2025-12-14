import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Cpu,
  Thermometer,
  HardDrive,
  Activity,
  Wifi,
  Wind,
  Zap,
  MemoryStick,
  Clock,
  Menu,
  X,
  Terminal,
  Settings
} from 'lucide-react';

// --- Color Palette Constants (Tailwind Slate-950 based theme) ---
const COLORS = {
  bg: 'bg-slate-950',
  card: 'bg-slate-900',
  cardHover: 'hover:bg-slate-800',
  textMain: 'text-slate-100',
  textMuted: 'text-slate-400',
  border: 'border-slate-800',
  accentPurple: '#8b5cf6', // Violet-500
  accentGreen: '#10b981',  // Emerald-500
  accentRed: '#ef4444',    // Red-500
  accentBlue: '#3b82f6',   // Blue-500
  accentOrange: '#f59e0b', // Amber-500
};

// --- API Configuration ---
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// --- Monitoring Configuration ---
// Adjust these values to change refresh rate and chart history
const UPDATE_INTERVAL_MS = 3000;  // How often to fetch data (1000ms = 1 second)
const CHART_HISTORY_MINUTES = 60;  // How many minutes of history to show (5 min = 300 points at 1s)
const CHART_MAX_POINTS = (CHART_HISTORY_MINUTES * 60 * 1000) / UPDATE_INTERVAL_MS;

// --- Helper Functions ---
const generateTimeLabel = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
};

// Initial empty history (will be populated from API)
const initialHistory = Array.from({ length: Math.min(CHART_MAX_POINTS, 20) }, (_, i) => ({
  time: `--:--:${String(i).padStart(2, '0')}`,
  cpu: 0,
  temp: 0,
  mem: 0,
  netIn: 0,
  netOut: 0,
}));

export default function App() {
  // --- State ---
  const [history, setHistory] = useState(initialHistory);
  const [metrics, setMetrics] = useState({
    cpuUsage: 0,
    cpuTemp: 0,
    memoryUsage: 0,
    memoryTotal: 8,
    uptime: 'Connecting...',
    diskUsed: 0,
    diskTotal: 0,
    diskUsedGb: 0,
    diskFreeGb: 0,
    fanSpeed: 0,
    powerDraw: 0,
    networkUp: 0,
    networkDown: 0,
    networkInterface: 'eth0',
    diskDevice: '/dev/root',
  });
  const [processes, setProcesses] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- Fetch Metrics from Backend API ---
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/metrics`);
        if (!response.ok) throw new Error('Failed to fetch metrics');
        const data = await response.json();

        setMetrics({
          cpuUsage: data.cpuUsage || 0,
          cpuTemp: data.cpuTemp || 0,
          memoryUsage: data.memoryUsage || 0,
          memoryTotal: data.memoryTotal || 8,
          uptime: data.uptime || 'Unknown',
          diskUsed: data.diskUsed || 0,
          diskTotal: data.diskTotal || 0,
          diskUsedGb: data.diskUsedGb || 0,
          diskFreeGb: data.diskFreeGb || 0,
          fanSpeed: data.fanSpeed || 0,
          powerDraw: data.powerDraw || 0,
          networkUp: data.networkUp || 0,
          networkDown: data.networkDown || 0,
          networkInterface: data.networkInterface || 'eth0',
          diskDevice: data.diskDevice || '/dev/root',
        });

        // Update history for charts
        const newDataPoint = {
          time: generateTimeLabel(),
          cpu: data.cpuUsage || 0,
          temp: data.cpuTemp || 0,
          mem: data.memoryUsage || 0,
          netIn: data.networkInKbps || 0,
          netOut: data.networkOutKbps || 0,
        };

        setHistory(prev => [...prev.slice(-(CHART_MAX_POINTS - 1)), newDataPoint]);
        setIsConnected(true);

      } catch (err) {
        console.error('Failed to fetch metrics:', err);
        setIsConnected(false);
      }
    };

    const fetchProcesses = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/processes?limit=5`);
        if (!response.ok) throw new Error('Failed to fetch processes');
        const data = await response.json();
        setProcesses(data);
      } catch (err) {
        console.error('Failed to fetch processes:', err);
      }
    };

    // Initial fetch
    fetchMetrics();
    fetchProcesses();

    // Poll at configured interval
    const metricsInterval = setInterval(fetchMetrics, UPDATE_INTERVAL_MS);
    const processesInterval = setInterval(fetchProcesses, UPDATE_INTERVAL_MS * 5);

    return () => {
      clearInterval(metricsInterval);
      clearInterval(processesInterval);
    };
  }, []);

  // --- Components ---

  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        activeTab === id
          ? 'bg-gradient-to-r from-indigo-600 to-indigo-800 text-white shadow-lg shadow-indigo-900/50'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  const StatCard = ({ title, value, subtext, icon: Icon, color, trend }) => (
    <div className={`${COLORS.card} border ${COLORS.border} p-5 rounded-2xl relative overflow-hidden group`}>
      <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity`}>
        <Icon size={64} color={color} />
      </div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-2 rounded-lg bg-slate-950/50 border border-slate-800`}>
          <Icon size={20} color={color} />
        </div>
        {trend && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
        )}
      </div>
      <div className="relative z-10">
        <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
        <div className="text-2xl font-bold text-slate-100 mb-1">{value}</div>
        <p className="text-xs text-slate-500">{subtext}</p>
      </div>
    </div>
  );

  const ChartWidget = ({ title, children, height = 250 }) => (
    <div className={`${COLORS.card} border ${COLORS.border} p-6 rounded-2xl shadow-xl shadow-black/20`}>
      <h3 className="text-slate-100 font-semibold mb-6 flex items-center gap-2">
        <Activity size={18} className="text-indigo-400" />
        {title}
      </h3>
      <div style={{ height: height, width: '100%' }}>
        <ResponsiveContainer>
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );

  // --- Views ---

  const DashboardView = () => (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="CPU Usage"
          value={`${metrics.cpuUsage.toFixed(1)}%`}
          subtext="Quad-Core Cortex-A76"
          icon={Cpu}
          color={COLORS.accentPurple}
          trend={(metrics.cpuUsage - 20).toFixed(0)}
        />
        <StatCard
          title="Temperature"
          value={`${metrics.cpuTemp.toFixed(1)}°C`}
          subtext={`Fan: ${metrics.fanSpeed} RPM`}
          icon={Thermometer}
          color={metrics.cpuTemp > 65 ? COLORS.accentRed : COLORS.accentOrange}
        />
        <StatCard
          title="Memory"
          value={`${(metrics.memoryUsage / 100 * metrics.memoryTotal).toFixed(1)} GB`}
          subtext={`${metrics.memoryUsage.toFixed(1)}% of ${metrics.memoryTotal}GB`}
          icon={MemoryStick}
          color={COLORS.accentBlue}
        />
        <StatCard
          title="Power Draw"
          value={`${metrics.powerDraw.toFixed(1)} W`}
          subtext="Estimated"
          icon={Zap}
          color={COLORS.accentGreen}
        />
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* CPU & Temp Combined History */}
        <div className="lg:col-span-2">
          <ChartWidget title="Processor Performance History">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.accentPurple} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.accentPurple} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.accentOrange} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.accentOrange} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                tick={{fontSize: 12}}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis stroke="#64748b" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend
                iconType="line"
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value) => <span style={{ color: '#e2e8f0', fontSize: '13px' }}>{value}</span>}
              />
              <Area
                type="monotone"
                dataKey="cpu"
                stroke={COLORS.accentPurple}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCpu)"
                name="CPU Load %"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="temp"
                stroke={COLORS.accentOrange}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorTemp)"
                name="Temp °C"
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartWidget>
        </div>

        {/* Disk Usage */}
        <div className="lg:col-span-1">
          <div className={`${COLORS.card} border ${COLORS.border} p-6 rounded-2xl h-full flex flex-col justify-between`}>
             <div>
                <h3 className="text-slate-100 font-semibold mb-2 flex items-center gap-2">
                  <HardDrive size={18} className="text-emerald-400" />
                  Storage
                </h3>
                <p className="text-slate-400 text-sm mb-6">{metrics.diskDevice}</p>
             </div>

             <div className="flex-1 flex items-center justify-center relative overflow-hidden">
                {/* Custom Circular Progress Simulation */}
                <div className="relative w-48 h-48 overflow-hidden">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 192 192">
                        <circle cx="96" cy="96" r="88" stroke="#1e293b" strokeWidth="12" fill="none" />
                        <circle
                            cx="96"
                            cy="96"
                            r="88"
                            stroke={COLORS.accentGreen}
                            strokeWidth="12"
                            fill="none"
                            strokeDasharray={553}
                            strokeDashoffset={553 * (1 - metrics.diskUsed/100)}
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-white">{Math.round(metrics.diskUsed)}%</span>
                        <span className="text-xs text-slate-400">Used</span>
                    </div>
                </div>
             </div>

             <div className="mt-6 space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Used</span>
                    <span className="text-emerald-400 font-medium">{metrics.diskUsedGb} GB</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Free</span>
                    <span className="text-slate-200 font-medium">{metrics.diskFreeGb} GB</span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-800 pt-2">
                    <span className="text-slate-400">Total</span>
                    <span className="text-slate-200 font-medium">{metrics.diskTotal} GB</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Network & Processes Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Network Activity */}
          <div className={`${COLORS.card} border ${COLORS.border} p-6 rounded-2xl shadow-xl shadow-black/20`}>
            <h3 className="text-slate-100 font-semibold mb-6 flex items-center gap-2">
              <Activity size={18} className="text-indigo-400" />
              Network Traffic ({metrics.networkInterface})
            </h3>
            <div style={{ height: 250, width: '100%' }}>
              <ResponsiveContainer>
                <LineChart data={history} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    tick={{fontSize: 12}}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis stroke="#64748b" tick={{fontSize: 12}} tickLine={false} axisLine={false} domain={['auto', 'auto']} dx={-5} />
                  <Tooltip
                     contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                     itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend
                    iconType="line"
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => <span style={{ color: '#e2e8f0', fontSize: '13px' }}>{value}</span>}
                  />
                  <Line type="monotone" dataKey="netIn" stroke={COLORS.accentBlue} strokeWidth={2} dot={false} name="Download (Kbps)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="netOut" stroke={COLORS.accentGreen} strokeWidth={2} dot={false} name="Upload (Kbps)" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-6 mt-4 justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-slate-400">In: {metrics.networkDown.toFixed(2)} MB/s</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-sm text-slate-400">Out: {metrics.networkUp.toFixed(2)} MB/s</span>
                </div>
            </div>
          </div>

          {/* Top Processes Table */}
          <div className={`${COLORS.card} border ${COLORS.border} rounded-2xl overflow-hidden flex flex-col`}>
             <div className="p-6 pb-2">
                <h3 className="text-slate-100 font-semibold flex items-center gap-2">
                    <Terminal size={18} className="text-slate-400" />
                    Top Processes
                </h3>
             </div>
             <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950/50 text-slate-200 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">PID</th>
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3">CPU</th>
                            <th className="px-6 py-3">Mem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {processes.length > 0 ? processes.map((proc) => (
                            <tr key={proc.pid} className="hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-3 font-mono text-slate-500">{proc.pid}</td>
                                <td className="px-6 py-3 font-medium text-slate-200">{proc.name}</td>
                                <td className="px-6 py-3 text-emerald-400">{proc.cpu}</td>
                                <td className="px-6 py-3 text-blue-400">{proc.mem}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="4" className="px-6 py-3 text-center text-slate-500">
                                    {isConnected ? 'Loading processes...' : 'Connecting to backend...'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
             </div>
          </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${COLORS.bg} ${COLORS.textMain} font-sans selection:bg-indigo-500/30 overflow-x-hidden`}>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-72 ${COLORS.card} border-r ${COLORS.border}
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <img src="https://assets.ubuntu.com/v1/4b99b50e-ubuntu-logo-icon.svg" alt="Pi" className="w-6 h-6 invert opacity-90" />
                    {/* Using Ubuntu logo as placeholder for generic linux icon */}
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Pi Monitor</h1>
                    <p className="text-xs text-slate-500">Raspberry Pi 5 (8GB)</p>
                </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400">
                <X size={24} />
            </button>
        </div>

        <nav className="px-4 py-4 space-y-2">
            <SidebarItem id="dashboard" icon={Activity} label="Dashboard" />
            <SidebarItem id="network" icon={Wifi} label="Network" />
            <SidebarItem id="storage" icon={HardDrive} label="Storage" />
            <SidebarItem id="cooling" icon={Wind} label="Thermal & Power" />
        </nav>

        <div className="absolute bottom-0 left-0 w-full p-6 border-t border-slate-800">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                <div className="flex-1">
                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">API Status</div>
                    <div className={`text-sm font-medium ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                </div>
            </div>
            <p className="mt-4 text-center text-xs text-slate-600">v1.0.5 • Live Data</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="lg:ml-72 min-h-screen transition-all">
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/50 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="lg:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-lg"
                >
                    <Menu size={24} />
                </button>
                <h2 className="text-lg font-semibold text-slate-200 hidden sm:block">
                   {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Overview
                </h2>
            </div>

            <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center gap-2 text-sm text-slate-400 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
                    <Clock size={14} />
                    <span>Uptime: {metrics.uptime}</span>
                </div>
                <button className="p-2 text-slate-400 hover:text-white transition-colors">
                    <Settings size={20} />
                </button>
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold ring-2 ring-slate-950 ring-offset-2 ring-offset-indigo-600">
                    AD
                </div>
            </div>
        </header>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab !== 'dashboard' && (
                <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
                    <Activity size={48} className="mb-4 opacity-20" />
                    <p>The {activeTab} view is under construction in this concept demo.</p>
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                    >
                        Return to Dashboard
                    </button>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}
