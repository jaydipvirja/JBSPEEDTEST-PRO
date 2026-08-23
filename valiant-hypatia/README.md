# 🚀 PC Speed Test Pro (Internet Speedometer)

PC (Windows) માટે એક સુંદર, રીઅલ-ટાઇમ અને એક્યુરેટ ઇન્ટરનેટ સ્પીડ ટેસ્ટ ટૂલ.

---

## ✨ મુખ્ય ફીચર્સ (Features)
- ⚡ **Download Speed Test**: Multi-stream parallel chunk downloads (Gigabit ready).
- 📤 **Upload Speed Test**: High-throughput multi-stream upload test.
- ⏱️ **Ping & Jitter Analysis**: Accurate latency and network stability measurement.
- 🧭 **Interactive Animated Speedometer**: Glowing 60fps Canvas Speedometer Dial with spring-damping needle motion.
- 📈 **Live Bandwidth Graph**: Real-time bandwidth curve during testing.
- 🌐 **ISP & Geo Detection**: Displays public IP, ISP provider, and client location.
- 🎯 **Experience Rating Score**: Automatic rating for Online Gaming (A+), 4K Streaming (A+), and Video Calls.
- 📋 **Test History & CSV Export**: Automatic local & server history logging with one-click CSV export.
- 💻 **Dual Mode**:
  - **Global WAN (Internet)**: Cloudflare Global CDN Edge testing.
  - **Local LAN (PC Hub)**: Local Node.js high-speed engine testing.

---

## 🚀 કેવી રીતે રન કરવું (How to Run on PC)

### પદ્ધતિ 1 (સૌથી સરળ - One Click):
1. `run_app.bat` ફાઈલ પર ડબલ ક્લિક કરો.
2. ટૂલ આપમેળે બ્રાઉઝરમાં `http://localhost:3000` પર ખુલી જશે.

### પદ્ધતિ 2 (Terminal):
```bash
node server.js
```
અને બ્રાઉઝરમાં `http://localhost:3000` ઓપન કરો.

---

## 🛠️ ફાઈલ સ્ટ્રક્ચર (File Structure)
- `server.js` - Zero-dependency Node.js HTTP backend server, API proxy, streaming download/upload endpoints, system info, and history database.
- `public/index.html` - Modern Cyberpunk/Glassmorphic dashboard UI.
- `public/style.css` - Dark theme design, glowing meters, gradient badges, and responsive layouts.
- `public/speedtest.js` - High-precision speed test measurement engine, dynamic log gauge, and live graph visualizer.
- `public/history.js` - History tracking, statistics calculations, and CSV export.
- `run_app.bat` - Windows launcher script.
