const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static assets
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 10MB pre-allocated chunk of non-compressible random bytes for upload/download testing
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const randomChunkBuffer = crypto.randomBytes(CHUNK_SIZE);

// In-memory history persistence
const HISTORY_FILE = path.join(__dirname, 'speedtest_history.json');

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading history file:', e);
    }
    return [];
}

function saveHistory(history) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving history file:', e);
    }
}

const server = http.createServer((req, res) => {
    // Enable CORS for speed test measurement
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, X-Requested-With');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // --- API Endpoints ---

    // 0. Server List Registry (Stage 1 & Stage 2 Candidate Selection)
    if (pathname === '/api/servers') {
        const servers = [
            {
                id: 'srv-amd-in',
                name: 'Ahmedabad (India)',
                provider: 'SpeedTest Pro Node 1',
                location: 'Ahmedabad, Gujarat, IN',
                lat: 23.0225,
                lon: 72.5714,
                baseUrl: '',
                pingUrl: '/api/ping',
                downloadUrl: '/api/download',
                uploadUrl: '/api/upload',
                capacityGbps: 10,
                status: 'online'
            },
            {
                id: 'srv-bom-in',
                name: 'Mumbai (India)',
                provider: 'SpeedTest Pro Edge 2',
                location: 'Mumbai, Maharashtra, IN',
                lat: 19.0760,
                lon: 72.8777,
                baseUrl: 'https://speed.cloudflare.com',
                pingUrl: 'https://speed.cloudflare.com/__down?bytes=0',
                downloadUrl: 'https://speed.cloudflare.com/__down',
                uploadUrl: 'https://speed.cloudflare.com/__up',
                capacityGbps: 100,
                status: 'online'
            },
            {
                id: 'srv-del-in',
                name: 'Delhi (India)',
                provider: 'SpeedTest Pro Edge 3',
                location: 'New Delhi, IN',
                lat: 28.6139,
                lon: 77.2090,
                baseUrl: 'https://speed.cloudflare.com',
                pingUrl: 'https://speed.cloudflare.com/__down?bytes=0',
                downloadUrl: 'https://speed.cloudflare.com/__down',
                uploadUrl: 'https://speed.cloudflare.com/__up',
                capacityGbps: 50,
                status: 'online'
            },
            {
                id: 'srv-blr-in',
                name: 'Bengaluru (India)',
                provider: 'SpeedTest Pro Edge 4',
                location: 'Bengaluru, Karnataka, IN',
                lat: 12.9716,
                lon: 77.5946,
                baseUrl: 'https://speed.cloudflare.com',
                pingUrl: 'https://speed.cloudflare.com/__down?bytes=0',
                downloadUrl: 'https://speed.cloudflare.com/__down',
                uploadUrl: 'https://speed.cloudflare.com/__up',
                capacityGbps: 50,
                status: 'online'
            },
            {
                id: 'srv-sin-sg',
                name: 'Singapore (SEA Hub)',
                provider: 'SpeedTest Pro Edge 5',
                location: 'Singapore, SG',
                lat: 1.3521,
                lon: 103.8198,
                baseUrl: 'https://speed.cloudflare.com',
                pingUrl: 'https://speed.cloudflare.com/__down?bytes=0',
                downloadUrl: 'https://speed.cloudflare.com/__down',
                uploadUrl: 'https://speed.cloudflare.com/__up',
                capacityGbps: 100,
                status: 'online'
            }
        ];
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(servers));
        return;
    }

    // 0.1 Health Check Endpoint
    if (pathname === '/api/health') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'online',
            uptimeSec: Math.floor(process.uptime()),
            timestamp: Date.now(),
            loadAvg: os.loadavg()
        }));
        return;
    }

    // 1. Ping / Latency check endpoint
    if (pathname === '/api/ping') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
        return;
    }

    // 2. Download Speed Test Data Stream
    if (pathname === '/api/download') {
        const sizeParam = parseInt(parsedUrl.searchParams.get('size')) || (25 * 1024 * 1024); // default 25MB
        const targetSize = Math.min(Math.max(sizeParam, 1024), 200 * 1024 * 1024); // Cap between 1KB and 200MB

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', targetSize);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.writeHead(200);

        let sentBytes = 0;
        function sendMore() {
            while (sentBytes < targetSize) {
                const remaining = targetSize - sentBytes;
                const toSend = Math.min(remaining, CHUNK_SIZE);
                const chunk = randomChunkBuffer.subarray(0, toSend);
                sentBytes += toSend;
                const canContinue = res.write(chunk);
                if (!canContinue) {
                    res.once('drain', sendMore);
                    return;
                }
            }
            res.end();
        }
        sendMore();
        return;
    }

    // 3. Upload Speed Test Sink Endpoint
    if (pathname === '/api/upload' && req.method === 'POST') {
        let totalBytes = 0;
        const startTime = Date.now();

        req.on('data', (chunk) => {
            totalBytes += chunk.length;
        });

        req.on('end', () => {
            const durationMs = Math.max(1, Date.now() - startTime);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            res.writeHead(200);
            res.end(JSON.stringify({
                status: 'ok',
                receivedBytes: totalBytes,
                durationMs: durationMs,
                mbps: ((totalBytes * 8) / (durationMs / 1000) / (1024 * 1024)).toFixed(2)
            }));
        });
        return;
    }

    // 4. System & Network Info
    if (pathname === '/api/system-info') {
        const networkInterfaces = os.networkInterfaces();
        const activeInterfaces = [];

        for (const [name, nets] of Object.entries(networkInterfaces)) {
            for (const net of nets) {
                if (!net.internal && net.family === 'IPv4') {
                    activeInterfaces.push({
                        name: name,
                        ip: net.address,
                        netmask: net.netmask,
                        mac: net.mac
                    });
                }
            }
        }

        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
            hostname: os.hostname(),
            platform: os.platform(),
            release: os.release(),
            activeInterfaces: activeInterfaces
        }));
        return;
    }

    // 5. Test History API (Get & Add)
    if (pathname === '/api/history') {
        if (req.method === 'GET') {
            const history = loadHistory();
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify(history));
            return;
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const newEntry = JSON.parse(body);
                    newEntry.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                    newEntry.timestamp = new Date().toISOString();
                    const history = loadHistory();
                    history.unshift(newEntry);
                    // Keep up to 100 recent tests
                    if (history.length > 100) history.pop();
                    saveHistory(history);
                    res.setHeader('Content-Type', 'application/json');
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, entry: newEntry }));
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
            return;
        }
    }

    // 6. Static File Serving
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    // Prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        const stream = fs.createReadStream(filePath);
        res.writeHead(200);
        stream.pipe(res);
    });
});

function getActiveLocalIP() {
    if (process.env.CUSTOM_IP) {
        return process.env.CUSTOM_IP;
    }
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const activeIP = getActiveLocalIP();

function startListening(portToUse) {
    server.listen(portToUse, '0.0.0.0', () => {
        console.log(`\n======================================================`);
        console.log(`🚀 SPEEDTEST PRO SERVER IS ACTIVE!`);
        console.log(`------------------------------------------------------`);
        console.log(`💻 This PC URL      : http://localhost:${portToUse}`);
        console.log(`📱 Mobile/Other PC  : http://${activeIP}:${portToUse}`);
        console.log(`======================================================`);
        console.log(`👉 Open http://${activeIP}:${portToUse} on your mobile/other PC.\n`);
    });
}

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        const nextPort = (parseInt(server.address()?.port || PORT) || 3000) + 1;
        console.log(`⚠️ Port ${err.port} is already busy/in use. Trying Port ${nextPort}...`);
        setTimeout(() => {
            startListening(nextPort);
        }, 500);
    } else {
        console.error('Server error:', err);
    }
});

startListening(PORT);
