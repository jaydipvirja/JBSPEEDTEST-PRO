// Speed Test Pro - Core Engine & Interactive Visualization

// --- State Variables ---
let currentMode = 'internet'; // 'internet' or 'local'
let isRunning = false;
let isTurboRunning = false;
let currentTurboType = 'download'; // 'download' or 'upload'
let abortController = null;
let turboAbortController = null;

let gaugeSpeed = 0;
let targetSpeed = 0;
let chartPoints = [];
let peakSpeedRecorded = 0;

let turboTimerInterval = null;
let turboStartTime = 0;
let turboTotalBytes = 0;
let turboPeakMbps = 0;

let testResults = {
    ping: 0,
    jitter: 0,
    download: 0,
    upload: 0,
    isp: '',
    ip: '',
    location: '',
    dataUsed: '0 MB',
    rating: 'A+'
};

// --- DOM Elements ---
const canvas = document.getElementById('gaugeCanvas');
const ctx = canvas.getContext('2d');
const chartCanvas = document.getElementById('liveChartCanvas');
const chartCtx = chartCanvas.getContext('2d');

const liveSpeedNum = document.getElementById('liveSpeedNumber');
const speedStageLabel = document.getElementById('speedStageLabel');
const startBtn = document.getElementById('startTestBtn');
const btnLabel = document.getElementById('btnLabel');

const turboDownBtn = document.getElementById('turboDownBtn');
const turboDownBtnLabel = document.getElementById('turboDownBtnLabel');
const turboUpBtn = document.getElementById('turboUpBtn');
const turboUpBtnLabel = document.getElementById('turboUpBtnLabel');

const turboStatsBar = document.getElementById('turboStatsBar');
const turboTimer = document.getElementById('turboTimer');
const turboAvgSpeed = document.getElementById('turboAvgSpeed');
const turboPeakSpeed = document.getElementById('turboPeakSpeed');
const turboLimitSelect = document.getElementById('turboLimitSelect');

const dataHeroCard = document.getElementById('dataHeroCard');
const dataHeroLabel = document.getElementById('dataHeroLabel');
const dataHeroVal = document.getElementById('dataHeroVal');
const dataHeroUnit = document.getElementById('dataHeroUnit');
const dataBurnRate = document.getElementById('dataBurnRate');
const pulseDotType = document.getElementById('pulseDotType');

const mainGaugeCard = document.getElementById('mainGaugeCard');
const ambientCyan = document.getElementById('ambientCyan');
const ambientPurple = document.getElementById('ambientPurple');

const testStateBadge = document.getElementById('testStateBadge');
const testProgressText = document.getElementById('testProgressText');
const chartPeakSpeed = document.getElementById('chartPeakSpeed');
const chartModeLabel = document.getElementById('chartModeLabel');
const deviceSubtitle = document.getElementById('deviceSubtitle');

const valPing = document.getElementById('valPing');
const valJitter = document.getElementById('valJitter');
const valDownload = document.getElementById('valDownload');
const valUpload = document.getElementById('valUpload');

const infoIsp = document.getElementById('infoIsp');
const infoIp = document.getElementById('infoIp');
const infoLocation = document.getElementById('infoLocation');
const infoOs = document.getElementById('infoOs');

const gradeGaming = document.getElementById('gradeGaming');
const gradeStreaming = document.getElementById('gradeStreaming');
const gradeVideoCall = document.getElementById('gradeVideoCall');

const qrModalBackdrop = document.getElementById('qrModalBackdrop');
const qrCodeImg = document.getElementById('qrCodeImg');
const qrModalUrlText = document.getElementById('qrModalUrlText');

function openQrModal() {
    triggerHaptic('light');
    const port = location.port || '8000';
    let host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        host = '192.168.1.115';
    }
    const mobileUrl = `http://${host}:${port}`;
    qrModalUrlText.innerText = mobileUrl;
    qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mobileUrl)}&bgcolor=FFFFFF&color=0B0F17`;
    qrModalBackdrop.classList.add('open');
}

function closeQrModal(e) {
    if (!e || e.target === qrModalBackdrop || e.target.classList.contains('qr-close-btn')) {
        qrModalBackdrop.classList.remove('open');
    }
}

// Helper to format bytes into readable MB or GB
function formatBytes(bytes) {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
        return { val: (mb / 1024).toFixed(2), unit: 'GB', full: `${(mb / 1024).toFixed(2)} GB` };
    }
    return { val: mb.toFixed(2), unit: 'MB', full: `${mb.toFixed(2)} MB` };
}

// Detect Mobile Device
function detectDevice() {
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (deviceSubtitle) {
        deviceSubtitle.innerText = isMobile ? 'Mobile App Mode' : 'Desktop Pro Mode';
    }
}

// Haptic feedback
function triggerHaptic(type = 'light') {
    if (navigator.vibrate) {
        if (type === 'light') navigator.vibrate(15);
        if (type === 'medium') navigator.vibrate(35);
        if (type === 'turbo') navigator.vibrate([40, 40, 60, 40]);
        if (type === 'success') navigator.vibrate([20, 50, 20]);
    }
}

// --- Speed Scale mapping (Logarithmic for 0 to 1000+ Mbps) ---
const START_ANGLE = 0.75 * Math.PI;
const END_ANGLE = 2.25 * Math.PI;
const SPEED_TICKS = [0, 5, 10, 25, 50, 100, 250, 500, 1000];

function speedToAngle(speed) {
    if (speed <= 0) return START_ANGLE;
    if (speed >= 1000) return END_ANGLE;

    let idx = 0;
    while (idx < SPEED_TICKS.length - 1 && speed > SPEED_TICKS[idx + 1]) {
        idx++;
    }
    const segStartSpeed = SPEED_TICKS[idx];
    const segEndSpeed = SPEED_TICKS[idx + 1];
    const segFraction = (speed - segStartSpeed) / (segEndSpeed - segStartSpeed);

    const totalSegs = SPEED_TICKS.length - 1;
    const arcPerSeg = (END_ANGLE - START_ANGLE) / totalSegs;

    return START_ANGLE + (idx + segFraction) * arcPerSeg;
}

// --- Gauge Rendering Loop ---
function drawGauge() {
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height * 0.58;
    const radius = 135;

    ctx.clearRect(0, 0, width, height);

    gaugeSpeed += (targetSpeed - gaugeSpeed) * 0.15;
    if (Math.abs(targetSpeed - gaugeSpeed) < 0.05) gaugeSpeed = targetSpeed;

    liveSpeedNum.innerText = gaugeSpeed.toFixed(1);

    // 1. Background Arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, START_ANGLE, END_ANGLE, false);
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Active Colored Glow Arc
    const currentAngle = speedToAngle(gaugeSpeed);
    if (currentAngle > START_ANGLE) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, START_ANGLE, currentAngle, false);
        ctx.lineWidth = 14;

        if (isTurboRunning) {
            if (currentTurboType === 'upload') {
                // Turbo Upload: Neon Purple / Violet Gradient
                const gradient = ctx.createConicGradient(START_ANGLE, centerX, centerY);
                gradient.addColorStop(0, '#C77DFF');
                gradient.addColorStop(0.5, '#9D4EDD');
                gradient.addColorStop(1, '#FF007F');
                ctx.strokeStyle = gradient;
                ctx.shadowColor = '#9D4EDD';
            } else {
                // Turbo Download: Fiery Orange / Amber Gradient
                const gradient = ctx.createConicGradient(START_ANGLE, centerX, centerY);
                gradient.addColorStop(0, '#FF8E53');
                gradient.addColorStop(0.5, '#FF512F');
                gradient.addColorStop(1, '#FF0055');
                ctx.strokeStyle = gradient;
                ctx.shadowColor = '#FF512F';
            }
        } else {
            // Standard Cyberpunk Gradient
            const gradient = ctx.createConicGradient(START_ANGLE, centerX, centerY);
            gradient.addColorStop(0, '#00F2FE');
            gradient.addColorStop(0.5, '#4FACFE');
            gradient.addColorStop(0.8, '#9D4EDD');
            gradient.addColorStop(1, '#FF007F');
            ctx.strokeStyle = gradient;
            ctx.shadowColor = '#00F2FE';
        }

        ctx.shadowBlur = 18;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
    }

    // 3. Ticks
    SPEED_TICKS.forEach((tickVal) => {
        const angle = speedToAngle(tickVal);
        const tickInnerR = radius - 18;
        const tickOuterR = radius - 8;

        const x1 = centerX + Math.cos(angle) * tickInnerR;
        const y1 = centerY + Math.sin(angle) * tickInnerR;
        const x2 = centerX + Math.cos(angle) * tickOuterR;
        const y2 = centerY + Math.sin(angle) * tickOuterR;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = tickVal === 0 || tickVal === 100 || tickVal === 1000 ? 3 : 1.5;
        
        let tickColor = 'rgba(255, 255, 255, 0.25)';
        if (gaugeSpeed >= tickVal) {
            if (isTurboRunning) {
                tickColor = currentTurboType === 'upload' ? '#C77DFF' : '#FF6B00';
            } else {
                tickColor = '#00F2FE';
            }
        }
        ctx.strokeStyle = tickColor;
        ctx.stroke();

        const textR = radius - 32;
        const tx = centerX + Math.cos(angle) * textR;
        const ty = centerY + Math.sin(angle) * textR + 4;

        ctx.font = '600 11px Outfit, sans-serif';
        ctx.fillStyle = gaugeSpeed >= tickVal ? '#FFF' : 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'center';
        ctx.fillText(tickVal.toString(), tx, ty);
    });

    // 4. Needle
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(currentAngle);

    ctx.beginPath();
    ctx.moveTo(radius - 12, 0);
    ctx.lineTo(-15, -4);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-15, 4);
    ctx.closePath();

    const needleGrad = ctx.createLinearGradient(0, 0, radius, 0);
    if (isTurboRunning) {
        if (currentTurboType === 'upload') {
            needleGrad.addColorStop(0, '#FFFFFF');
            needleGrad.addColorStop(1, '#C77DFF');
            ctx.shadowColor = '#C77DFF';
        } else {
            needleGrad.addColorStop(0, '#FFFFFF');
            needleGrad.addColorStop(1, '#FF512F');
            ctx.shadowColor = '#FF512F';
        }
    } else {
        needleGrad.addColorStop(0, '#FFFFFF');
        needleGrad.addColorStop(1, '#00F2FE');
        ctx.shadowColor = '#00F2FE';
    }

    ctx.fillStyle = needleGrad;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.restore();

    // 5. Pivot Cap
    ctx.beginPath();
    ctx.arc(centerX, centerY, 12, 0, 2 * Math.PI);
    ctx.fillStyle = '#121826';
    let capStroke = '#00F2FE';
    if (isTurboRunning) {
        capStroke = currentTurboType === 'upload' ? '#C77DFF' : '#FF6B00';
    }
    ctx.strokeStyle = capStroke;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = capStroke;
    ctx.fill();
    ctx.stroke();

    requestAnimationFrame(drawGauge);
}

// --- Live Bandwidth Chart ---
function updateLiveChart(val) {
    chartPoints.push(val);
    if (chartPoints.length > 60) chartPoints.shift();

    if (val > peakSpeedRecorded) {
        peakSpeedRecorded = val;
        chartPeakSpeed.innerText = `Peak: ${peakSpeedRecorded.toFixed(2)} Mbps`;
    }

    const w = chartCanvas.width;
    const h = chartCanvas.height;
    chartCtx.clearRect(0, 0, w, h);

    if (chartPoints.length < 2) return;

    const maxVal = Math.max(10, Math.max(...chartPoints) * 1.2);
    const stepX = w / (chartPoints.length - 1);

    chartCtx.beginPath();
    chartCtx.moveTo(0, h - (chartPoints[0] / maxVal) * (h - 10));

    for (let i = 1; i < chartPoints.length; i++) {
        const x = i * stepX;
        const y = h - (chartPoints[i] / maxVal) * (h - 10);
        chartCtx.lineTo(x, y);
    }

    chartCtx.lineWidth = 2.5;
    let strokeColor = '#00F2FE';
    if (isTurboRunning) {
        strokeColor = currentTurboType === 'upload' ? '#C77DFF' : '#FF512F';
    }
    chartCtx.strokeStyle = strokeColor;
    chartCtx.shadowColor = strokeColor;
    chartCtx.shadowBlur = 8;
    chartCtx.stroke();

    chartCtx.lineTo((chartPoints.length - 1) * stepX, h);
    chartCtx.lineTo(0, h);
    chartCtx.closePath();

    const chartGrad = chartCtx.createLinearGradient(0, 0, 0, h);
    if (isTurboRunning) {
        if (currentTurboType === 'upload') {
            chartGrad.addColorStop(0, 'rgba(199, 125, 255, 0.35)');
            chartGrad.addColorStop(1, 'rgba(199, 125, 255, 0.0)');
        } else {
            chartGrad.addColorStop(0, 'rgba(255, 81, 47, 0.35)');
            chartGrad.addColorStop(1, 'rgba(255, 81, 47, 0.0)');
        }
    } else {
        chartGrad.addColorStop(0, 'rgba(0, 242, 254, 0.25)');
        chartGrad.addColorStop(1, 'rgba(0, 242, 254, 0.0)');
    }
    chartCtx.fillStyle = chartGrad;
    chartCtx.fill();
}

// --- Mode Switcher ---
function switchMode(mode) {
    if (isRunning || isTurboRunning) return;
    triggerHaptic('light');
    currentMode = mode;
    document.getElementById('modeInternetBtn').classList.toggle('active', mode === 'internet');
    document.getElementById('modeLocalBtn').classList.toggle('active', mode === 'local');
    document.getElementById('targetServerName').innerText = 
        mode === 'internet' ? 'Cloudflare CDN' : 'Local PC Hub (LAN)';
}

// --- Fetch Client & System Information ---
async function fetchClientInfo() {
    try {
        const res = await fetch('/api/system-info');
        if (res.ok) {
            const data = await res.json();
            infoOs.innerText = `${data.hostname} (${data.platform})`;
        }
    } catch (e) {
        infoOs.innerText = 'Mobile Device';
    }

    try {
        const res = await fetch('https://speed.cloudflare.com/meta', { cache: 'no-store' });
        if (res.ok) {
            const meta = await res.json();
            testResults.isp = meta.asnOrganization || meta.asOrganization || meta.isp || 'Broadband / Wi-Fi';
            testResults.ip = meta.clientIp || '--';
            testResults.location = `${meta.city || ''}, ${meta.country || ''}`;

            infoIsp.innerText = testResults.isp;
            infoIp.innerText = testResults.ip;
            infoLocation.innerText = testResults.location;
            return;
        }
    } catch (e) {
        // Fallback
    }

    infoIsp.innerText = 'Broadband / Wi-Fi';
    infoIp.innerText = '192.168.1.x';
    infoLocation.innerText = 'Local Network';
}

// ==========================================================
// 🔥 TURBO MODE CONTROLLER: DOWNLOAD & UPLOAD
// ==========================================================

function toggleTurboMode(type = 'download') {
    if (isRunning) return;

    if (isTurboRunning) {
        stopTurboMode();
    } else {
        startTurboMode(type);
    }
}

async function startTurboMode(type = 'download') {
    isTurboRunning = true;
    currentTurboType = type;
    turboAbortController = new AbortController();
    const signal = turboAbortController.signal;

    triggerHaptic('turbo');

    // Button states
    startBtn.disabled = true;
    startBtn.style.opacity = '0.5';

    if (type === 'download') {
        turboUpBtn.disabled = true;
        turboUpBtn.style.opacity = '0.5';
        turboDownBtn.classList.add('running');
        turboDownBtnLabel.innerText = 'STOP TURBO';
        
        testStateBadge.className = 'badge turbo-down';
        testStateBadge.innerText = '🚀 TURBO DOWN';
        testProgressText.innerText = 'Continuous high-speed download running...';
        speedStageLabel.innerText = 'TURBO DOWNLOAD SPEED';
        chartModeLabel.innerText = '🔥 TURBO DOWNLOAD STREAM';
        
        mainGaugeCard.classList.add('turbo-down-active');
        mainGaugeCard.classList.remove('turbo-up-active');
        ambientCyan.classList.add('turbo-fire');
        dataHeroCard.classList.remove('upload-theme');
        pulseDotType.className = 'pulse-fire-dot';
        dataHeroLabel.innerText = 'TOTAL NET DOWNLOADED (ડાઉનલોડ ડેટા)';
    } else {
        turboDownBtn.disabled = true;
        turboDownBtn.style.opacity = '0.5';
        turboUpBtn.classList.add('running');
        turboUpBtnLabel.innerText = 'STOP TURBO';
        
        testStateBadge.className = 'badge turbo-up';
        testStateBadge.innerText = '📤 TURBO UPLOAD';
        testProgressText.innerText = 'Continuous high-speed upload payload streaming...';
        speedStageLabel.innerText = 'TURBO UPLOAD SPEED';
        chartModeLabel.innerText = '⚡ TURBO UPLOAD STREAM';
        
        mainGaugeCard.classList.add('turbo-up-active');
        mainGaugeCard.classList.remove('turbo-down-active');
        ambientPurple.classList.add('turbo-purple');
        dataHeroCard.classList.add('upload-theme');
        pulseDotType.className = 'pulse-fire-dot pulse-purple-dot';
        dataHeroLabel.innerText = 'TOTAL NET UPLOADED (અપલોડ ડેટા)';
    }

    turboStatsBar.style.display = 'flex';
    chartPoints = [];
    peakSpeedRecorded = 0;
    turboPeakMbps = 0;
    chartPeakSpeed.innerText = 'Peak: 0.00 Mbps';
    targetSpeed = 0;
    gaugeSpeed = 0;
    turboTotalBytes = 0;
    turboStartTime = performance.now();

    const limitSetting = turboLimitSelect.value;
    const targetBytesLimit = limitSetting === 'unlimited' ? Infinity : (parseFloat(limitSetting) * 1024 * 1024);

    let lastBytesSample = 0;
    let lastSampleTime = performance.now();

    turboTimerInterval = setInterval(() => {
        const now = performance.now();
        const elapsedSec = Math.max(1, Math.floor((now - turboStartTime) / 1000));
        const mins = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
        const secs = (elapsedSec % 60).toString().padStart(2, '0');
        turboTimer.innerText = `${mins}:${secs}`;

        const formatted = formatBytes(turboTotalBytes);
        dataHeroVal.innerText = formatted.val;
        dataHeroUnit.innerText = formatted.unit;

        const deltaSec = (now - lastSampleTime) / 1000;
        if (deltaSec >= 0.5) {
            const bytesPerSec = (turboTotalBytes - lastBytesSample) / deltaSec;
            const mbPerSec = (bytesPerSec / (1024 * 1024)).toFixed(1);
            const verb = type === 'upload' ? 'Uploading at' : 'Downloading at';
            dataBurnRate.innerText = `${verb} ~${mbPerSec} MB/s (${(mbPerSec * 8).toFixed(0)} Mbps)`;
            lastBytesSample = turboTotalBytes;
            lastSampleTime = now;
        }

        const avgSpeedMbps = ((turboTotalBytes * 8) / (elapsedSec * 1024 * 1024)).toFixed(2);
        turboAvgSpeed.innerText = `${avgSpeedMbps} Mbps`;
        turboPeakSpeed.innerText = `${turboPeakMbps.toFixed(1)} Mbps`;

        if (type === 'upload') {
            valUpload.innerText = avgSpeedMbps;
        } else {
            valDownload.innerText = avgSpeedMbps;
        }

        if (turboTotalBytes >= targetBytesLimit && isTurboRunning) {
            stopTurboMode(`Target Limit of ${limitSetting >= 1024 ? (limitSetting/1024)+' GB' : limitSetting+' MB'} Reached!`);
        }
    }, 100);

    let windowBytes = 0;
    let windowStartTime = performance.now();

    const speedSampler = setInterval(() => {
        const now = performance.now();
        const deltaSec = (now - windowStartTime) / 1000;
        if (deltaSec >= 0.2) {
            const instantMbps = (windowBytes * 8) / (deltaSec * 1024 * 1024);
            targetSpeed = Math.min(instantMbps, 2500);
            if (targetSpeed > turboPeakMbps) turboPeakMbps = targetSpeed;
            updateLiveChart(targetSpeed);
            windowBytes = 0;
            windowStartTime = now;
        }
    }, 60);

    // ==========================================
    // RUN PARALLEL STREAM WORKERS (OOKLA TURBO ENGINE)
    // ==========================================

    if (type === 'download') {
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
        const streamsCount = currentMode === 'internet' ? (isMobile ? 3 : 5) : 4;

        async function runContinuousDownloadStream() {
            let chunkSize = 512 * 1024;
            while (!signal.aborted) {
                if (targetSpeed > 100) chunkSize = 8 * 1024 * 1024;
                else if (targetSpeed > 30) chunkSize = 4 * 1024 * 1024;
                else if (targetSpeed > 10) chunkSize = 1 * 1024 * 1024;
                else chunkSize = 512 * 1024;

                const url = currentMode === 'internet' 
                    ? `https://speed.cloudflare.com/__down?bytes=${chunkSize}&_t=${Date.now()}`
                    : `/api/download?size=${chunkSize}&_t=${Date.now()}`;

                try {
                    const response = await fetch(url, { cache: 'no-store', signal });
                    const reader = response.body.getReader();

                    while (!signal.aborted) {
                        const { done, value } = await reader.read();
                        if (done || signal.aborted) break;
                        turboTotalBytes += value.length;
                        windowBytes += value.length;
                    }
                } catch (e) {
                    if (signal.aborted) break;
                    await new Promise(r => setTimeout(r, 80));
                }
            }
        }

        const streamPromises = [];
        for (let i = 0; i < streamsCount; i++) {
            streamPromises.push(runContinuousDownloadStream());
        }

        try {
            await Promise.all(streamPromises);
        } catch (e) {} finally {
            clearInterval(speedSampler);
        }
    } else {
        // TURBO UPLOAD ENGINE (OOKLA ADAPTIVE MICRO-CHUNKS)
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
        const streamsCount = currentMode === 'internet' ? (isMobile ? 2 : 4) : 3;

        async function runContinuousUploadStream() {
            let payloadSize = 128 * 1024; // Start at 128KB for mobile
            let uploadBuffer = new Uint8Array(payloadSize);

            while (!signal.aborted) {
                if (targetSpeed > 40) payloadSize = 2 * 1024 * 1024;
                else if (targetSpeed > 15) payloadSize = 1 * 1024 * 1024;
                else if (targetSpeed > 5) payloadSize = 512 * 1024;
                else payloadSize = 128 * 1024;

                if (uploadBuffer.length !== payloadSize) {
                    uploadBuffer = new Uint8Array(payloadSize);
                }

                const url = currentMode === 'internet' 
                    ? 'https://speed.cloudflare.com/__up' 
                    : '/api/upload';

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        body: uploadBuffer,
                        cache: 'no-store',
                        signal
                    });
                    if (response.ok) {
                        turboTotalBytes += payloadSize;
                        windowBytes += payloadSize;
                    }
                } catch (e) {
                    if (signal.aborted) break;
                    await new Promise(r => setTimeout(r, 60));
                }
            }
        }

        const streamPromises = [];
        for (let i = 0; i < streamsCount; i++) {
            streamPromises.push(runContinuousUploadStream());
        }

        try {
            await Promise.all(streamPromises);
        } catch (e) {} finally {
            clearInterval(speedSampler);
        }
    }
}

function stopTurboMode(customMessage) {
    if (turboAbortController) {
        turboAbortController.abort();
    }

    clearInterval(turboTimerInterval);
    triggerHaptic('medium');

    isTurboRunning = false;
    startBtn.disabled = false;
    startBtn.style.opacity = '1';

    turboDownBtn.disabled = false;
    turboDownBtn.style.opacity = '1';
    turboDownBtn.classList.remove('running');
    turboDownBtnLabel.innerText = 'TURBO DOWN';

    turboUpBtn.disabled = false;
    turboUpBtn.style.opacity = '1';
    turboUpBtn.classList.remove('running');
    turboUpBtnLabel.innerText = 'TURBO UP';

    testStateBadge.className = 'badge complete';
    testStateBadge.innerText = 'TURBO STOPPED';
    
    const elapsedSec = Math.max(1, (performance.now() - turboStartTime) / 1000);
    const finalAvgMbps = parseFloat(((turboTotalBytes * 8) / (elapsedSec * 1024 * 1024)).toFixed(2));
    const formattedData = formatBytes(turboTotalBytes);

    const actionText = currentTurboType === 'upload' ? 'Uploaded' : 'Downloaded';
    testProgressText.innerText = customMessage || `Turbo Complete! ${actionText} ${formattedData.full} in ${Math.round(elapsedSec)}s @ avg ${finalAvgMbps} Mbps`;
    speedStageLabel.innerText = `${actionText.toUpperCase()} DATA: ${formattedData.full}`;

    mainGaugeCard.classList.remove('turbo-down-active', 'turbo-up-active');
    ambientCyan.classList.remove('turbo-fire');
    ambientPurple.classList.remove('turbo-purple');
    chartModeLabel.innerText = 'LIVE BANDWIDTH STREAM';
    targetSpeed = 0;

    const modeLabel = `${currentMode === 'local' ? 'LAN' : 'WAN'} (TURBO ${currentTurboType.toUpperCase()})`;

    saveTestRecord({
        mode: modeLabel,
        ping: '--',
        download: currentTurboType === 'download' ? finalAvgMbps : '--',
        upload: currentTurboType === 'upload' ? finalAvgMbps : '--',
        dataUsed: formattedData.full,
        isp: testResults.isp || 'Broadband / Wi-Fi',
        rating: finalAvgMbps >= 30 ? 'A+' : finalAvgMbps >= 15 ? 'A' : 'B'
    });
}

// ==========================================================
// STANDARD FULL SPEED TEST EXECUTION (OOKLA ENGINE)
// ==========================================================

const PING_ENDPOINTS = [
    'https://speed.cloudflare.com/__down?bytes=0',
    '/api/ping'
];

const DOWNLOAD_ENDPOINTS = [
    'https://speed.cloudflare.com/__down',
    '/api/download'
];

const UPLOAD_ENDPOINTS = [
    'https://speed.cloudflare.com/__up',
    '/api/upload'
];

// Helper: Ookla Trimmed Mean (10th - 90th percentile filtering)
function calculateTrimmedMean(samples) {
    if (!samples || samples.length === 0) return 0;
    if (samples.length < 4) {
        return samples.reduce((a, b) => a + b, 0) / samples.length;
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const trimCount = Math.floor(sorted.length * 0.10);
    const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
    if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)];
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

async function toggleTest() {
    if (isTurboRunning) return;
    triggerHaptic('medium');
    if (isRunning) {
        stopTest();
        return;
    }
    startFullSpeedTest();
}

function stopTest() {
    if (abortController) abortController.abort();
    isRunning = false;
    startBtn.classList.remove('running');
    btnLabel.innerText = 'FULL TEST';
    
    turboDownBtn.disabled = false;
    turboDownBtn.style.opacity = '1';
    turboUpBtn.disabled = false;
    turboUpBtn.style.opacity = '1';

    testStateBadge.className = 'badge idle';
    testStateBadge.innerText = 'ABORTED';
    testProgressText.innerText = 'Test was stopped.';
    targetSpeed = 0;
}

async function startFullSpeedTest() {
    isRunning = true;
    abortController = new AbortController();
    const signal = abortController.signal;

    turboDownBtn.disabled = true;
    turboDownBtn.style.opacity = '0.5';
    turboUpBtn.disabled = true;
    turboUpBtn.style.opacity = '0.5';
    turboStatsBar.style.display = 'none';

    chartPoints = [];
    peakSpeedRecorded = 0;
    chartPeakSpeed.innerText = 'Peak: 0.00 Mbps';
    targetSpeed = 0;
    gaugeSpeed = 0;

    valPing.innerText = '--';
    valJitter.innerText = '--';
    valDownload.innerText = '--';
    valUpload.innerText = '--';

    document.querySelectorAll('.metric-card').forEach(c => c.classList.remove('active-testing'));
    document.querySelectorAll('.rating-grade').forEach(g => { g.innerText = '--'; g.className = 'rating-grade'; });

    startBtn.classList.add('running');
    btnLabel.innerText = 'STOP';
    testStateBadge.className = 'badge testing';

    try {
        // 1. Ping & Jitter
        testStateBadge.innerText = 'TESTING PING';
        testProgressText.innerText = 'Measuring latency & jitter...';
        speedStageLabel.innerText = 'PING MEASUREMENT';
        document.getElementById('cardPing').classList.add('active-testing');

        const pingResults = await measurePingAndJitter(signal);
        testResults.ping = pingResults.ping;
        testResults.jitter = pingResults.jitter;
        valPing.innerText = testResults.ping;
        valJitter.innerText = testResults.jitter;
        document.getElementById('cardPing').classList.remove('active-testing');

        if (signal.aborted) return;

        // 2. Download Speed
        testStateBadge.innerText = 'TESTING DOWNLOAD';
        testProgressText.innerText = 'Streaming high-speed chunks...';
        speedStageLabel.innerText = 'DOWNLOAD SPEED';
        document.getElementById('cardDownload').classList.add('active-testing');

        const downloadData = await measureDownloadSpeed(signal);
        testResults.download = downloadData.mbps;
        valDownload.innerText = downloadData.mbps.toFixed(2);
        document.getElementById('cardDownload').classList.remove('active-testing');

        if (signal.aborted) return;

        // 3. Upload Speed
        targetSpeed = 0;
        testStateBadge.innerText = 'TESTING UPLOAD';
        testProgressText.innerText = 'Measuring upload throughput...';
        speedStageLabel.innerText = 'UPLOAD SPEED';
        document.getElementById('cardUpload').classList.add('active-testing');

        const uploadData = await measureUploadSpeed(signal);
        testResults.upload = uploadData.mbps;
        valUpload.innerText = uploadData.mbps.toFixed(2);
        document.getElementById('cardUpload').classList.remove('active-testing');

        const totalTestBytes = downloadData.bytes + uploadData.bytes;
        testResults.dataUsed = formatBytes(totalTestBytes).full;

        // 4. Ratings
        targetSpeed = 0;
        calculateRatings(testResults);
        testStateBadge.className = 'badge complete';
        testStateBadge.innerText = 'COMPLETED';
        testProgressText.innerText = `Done! Down: ${testResults.download.toFixed(1)} Mbps, Up: ${testResults.upload.toFixed(1)} Mbps, Ping: ${testResults.ping}ms`;
        speedStageLabel.innerText = 'TEST COMPLETE';
        triggerHaptic('success');

        saveTestRecord({
            mode: currentMode === 'local' ? 'LAN' : 'WAN',
            ping: testResults.ping,
            jitter: testResults.jitter,
            download: parseFloat(testResults.download.toFixed(2)),
            upload: parseFloat(testResults.upload.toFixed(2)),
            dataUsed: testResults.dataUsed,
            isp: testResults.isp || 'Broadband / Wi-Fi',
            rating: testResults.rating
        });

    } catch (err) {
        if (!signal.aborted) {
            console.error('Speed test error:', err);
            testStateBadge.className = 'badge idle';
            testStateBadge.innerText = 'ERROR';
            testProgressText.innerText = 'Network error during test.';
        }
    } finally {
        isRunning = false;
        startBtn.classList.remove('running');
        btnLabel.innerText = 'FULL TEST';
        turboDownBtn.disabled = false;
        turboDownBtn.style.opacity = '1';
        turboUpBtn.disabled = false;
        turboUpBtn.style.opacity = '1';
    }
}

// --- PING & JITTER (ULTRA-MOBILE PROBE) ---
async function measurePingAndJitter(signal) {
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
    const rounds = isMobile ? 5 : 8;
    const latencies = [];

    let activeEndpoint = PING_ENDPOINTS[0];
    if (currentMode === 'local') activeEndpoint = PING_ENDPOINTS[1];

    // Warm-up probe (0.2s)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        await fetch(`${activeEndpoint}&_t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
    } catch (e) {
        if (currentMode === 'internet') activeEndpoint = PING_ENDPOINTS[1];
    }

    for (let i = 0; i < rounds; i++) {
        if (signal.aborted) break;
        const t0 = performance.now();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const sep = activeEndpoint.includes('?') ? '&' : '?';
            await fetch(`${activeEndpoint}${sep}_r=${i}&_t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
            clearTimeout(timeoutId);
            const t1 = performance.now();
            latencies.push(t1 - t0);
        } catch (e) {
            if (signal.aborted) return { ping: 0, jitter: 0 };
        }
        await new Promise(r => setTimeout(r, isMobile ? 50 : 40));
    }

    if (!latencies.length) return { ping: 25, jitter: 3 };

    latencies.sort((a, b) => a - b);
    const validLatencies = latencies.length > 3 ? latencies.slice(1, -1) : latencies;
    const avgPing = Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length);

    let jitterSum = 0;
    for (let i = 1; i < latencies.length; i++) {
        jitterSum += Math.abs(latencies[i] - latencies[i - 1]);
    }
    const avgJitter = latencies.length > 1 ? Math.round(jitterSum / (latencies.length - 1)) : 1;

    return { ping: avgPing, jitter: avgJitter };
}

// --- ULTRA-MOBILE OPTIMIZED DOWNLOAD ENGINE ---
async function measureDownloadSpeed(signal) {
    const durationMs = 6500;
    const startTime = performance.now();
    let totalBytesReceived = 0;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
    const streamsCount = currentMode === 'internet' ? (isMobile ? 2 : 4) : (isMobile ? 2 : 3);

    let currentChunkSize = isMobile ? 128 * 1024 : 256 * 1024;
    const samples = [];

    let activeEndpoint = DOWNLOAD_ENDPOINTS[0];
    if (currentMode === 'local') activeEndpoint = DOWNLOAD_ENDPOINTS[1];

    let windowBytes = 0;
    let windowStartTime = performance.now();

    const intervalTimer = setInterval(() => {
        const now = performance.now();
        const deltaSec = (now - windowStartTime) / 1000;
        if (deltaSec >= 0.12) {
            const instantMbps = (windowBytes * 8) / (deltaSec * 1024 * 1024);
            if (instantMbps > 0) samples.push(instantMbps);
            
            if (instantMbps > 80) currentChunkSize = 8 * 1024 * 1024;
            else if (instantMbps > 25) currentChunkSize = 4 * 1024 * 1024;
            else if (instantMbps > 6) currentChunkSize = 1 * 1024 * 1024;
            else if (instantMbps > 1.5) currentChunkSize = 256 * 1024;
            else currentChunkSize = 128 * 1024;

            targetSpeed = Math.min(instantMbps, 2500);
            updateLiveChart(targetSpeed);

            windowBytes = 0;
            windowStartTime = now;
        }
    }, 40);

    async function runSingleDownloadStream() {
        while (performance.now() - startTime < durationMs && !signal.aborted) {
            const sep = activeEndpoint.includes('?') ? '&' : '?';
            const url = currentMode === 'internet' 
                ? `${activeEndpoint}?bytes=${currentChunkSize}&_t=${Date.now()}`
                : `${activeEndpoint}?size=${currentChunkSize}&_t=${Date.now()}`;

            try {
                const response = await fetch(url, { cache: 'no-store', signal });
                if (!response.ok && currentMode === 'internet') {
                    activeEndpoint = DOWNLOAD_ENDPOINTS[1];
                }
                const reader = response.body.getReader();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done || signal.aborted) break;
                    totalBytesReceived += value.length;
                    windowBytes += value.length;
                    if (performance.now() - startTime >= durationMs) {
                        reader.cancel();
                        break;
                    }
                }
            } catch (e) {
                if (signal.aborted) break;
                if (currentMode === 'internet' && activeEndpoint !== DOWNLOAD_ENDPOINTS[1]) {
                    activeEndpoint = DOWNLOAD_ENDPOINTS[1];
                }
                await new Promise(r => setTimeout(r, 60));
            }
        }
    }

    const streamPromises = [];
    for (let i = 0; i < streamsCount; i++) {
        streamPromises.push(runSingleDownloadStream());
    }

    await Promise.all(streamPromises);
    clearInterval(intervalTimer);

    const trimmedSpeed = calculateTrimmedMean(samples);
    const totalDurationSec = (performance.now() - startTime) / 1000;
    const rawMbps = (totalBytesReceived * 8) / (totalDurationSec * 1024 * 1024);
    const finalMbps = samples.length >= 3 ? trimmedSpeed : Math.max(0.1, rawMbps);

    return { mbps: Math.max(0.1, finalMbps), bytes: totalBytesReceived };
}

// --- ULTRA-MOBILE OPTIMIZED UPLOAD ENGINE (NO PREFLIGHT OVERHEAD) ---
async function measureUploadSpeed(signal) {
    const durationMs = 5500;
    const startTime = performance.now();
    let totalBytesUploaded = 0;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
    const streamsCount = currentMode === 'internet' ? (isMobile ? 2 : 3) : (isMobile ? 2 : 2);

    let activeEndpoint = UPLOAD_ENDPOINTS[0];
    if (currentMode === 'local') activeEndpoint = UPLOAD_ENDPOINTS[1];

    let currentPayloadSize = isMobile ? 32 * 1024 : 128 * 1024;
    let rawArray = new Uint8Array(currentPayloadSize);
    for (let i = 0; i < currentPayloadSize; i += 64) {
        rawArray[i] = Math.floor(Math.random() * 256);
    }
    let payloadBlob = new Blob([rawArray], { type: 'text/plain' });

    const samples = [];
    let windowBytes = 0;
    let windowStartTime = performance.now();

    const intervalTimer = setInterval(() => {
        const now = performance.now();
        const deltaSec = (now - windowStartTime) / 1000;
        if (deltaSec >= 0.12) {
            const instantMbps = (windowBytes * 8) / (deltaSec * 1024 * 1024);
            if (instantMbps > 0) samples.push(instantMbps);

            let newPayloadSize = currentPayloadSize;
            if (instantMbps > 30) newPayloadSize = 1 * 1024 * 1024;
            else if (instantMbps > 10) newPayloadSize = 512 * 1024;
            else if (instantMbps > 3) newPayloadSize = 128 * 1024;
            else if (instantMbps > 0.8) newPayloadSize = 64 * 1024;
            else newPayloadSize = 32 * 1024;

            if (newPayloadSize !== currentPayloadSize) {
                currentPayloadSize = newPayloadSize;
                rawArray = new Uint8Array(currentPayloadSize);
                payloadBlob = new Blob([rawArray], { type: 'text/plain' });
            }

            targetSpeed = Math.min(instantMbps, 2500);
            updateLiveChart(targetSpeed);

            windowBytes = 0;
            windowStartTime = now;
        }
    }, 40);

    async function runSingleUploadStream() {
        while (performance.now() - startTime < durationMs && !signal.aborted) {
            const url = currentMode === 'internet' 
                ? activeEndpoint 
                : `${activeEndpoint}?_t=${Date.now()}`;

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    body: payloadBlob,
                    cache: 'no-store',
                    signal
                });
                if (response.ok) {
                    totalBytesUploaded += currentPayloadSize;
                    windowBytes += currentPayloadSize;
                } else if (currentMode === 'internet') {
                    activeEndpoint = UPLOAD_ENDPOINTS[1];
                }
            } catch (e) {
                if (signal.aborted) break;
                if (currentMode === 'internet' && activeEndpoint !== UPLOAD_ENDPOINTS[1]) {
                    activeEndpoint = UPLOAD_ENDPOINTS[1];
                }
                await new Promise(r => setTimeout(r, 40));
            }
        }
    }

    const streamPromises = [];
    for (let i = 0; i < streamsCount; i++) {
        streamPromises.push(runSingleUploadStream());
    }

    await Promise.all(streamPromises);
    clearInterval(intervalTimer);

    const trimmedSpeed = calculateTrimmedMean(samples);
    const totalDurationSec = (performance.now() - startTime) / 1000;
    const rawMbps = (totalBytesUploaded * 8) / (totalDurationSec * 1024 * 1024);
    const finalMbps = samples.length >= 3 ? trimmedSpeed : Math.max(0.1, rawMbps);

    return { mbps: Math.max(0.1, finalMbps), bytes: totalBytesUploaded };
}

// --- Ratings ---
function calculateRatings(res) {
    let gGame = 'A+';
    if (res.ping <= 20 && res.jitter <= 5) gGame = 'A+';
    else if (res.ping <= 45 && res.jitter <= 15) gGame = 'A';
    else if (res.ping <= 80) gGame = 'B';
    else if (res.ping <= 130) gGame = 'C';
    else gGame = 'D';

    let gStream = 'A+';
    if (res.download >= 50) gStream = 'A+';
    else if (res.download >= 25) gStream = 'A';
    else if (res.download >= 15) gStream = 'B';
    else if (res.download >= 5) gStream = 'C';
    else gStream = 'D';

    let gCall = 'A+';
    if (res.upload >= 15 && res.ping <= 40) gCall = 'A+';
    else if (res.upload >= 5 && res.ping <= 70) gCall = 'A';
    else if (res.upload >= 2) gCall = 'B';
    else gCall = 'C';

    gradeGaming.innerText = gGame;
    gradeGaming.className = `rating-grade ${getGradeClass(gGame)}`;

    gradeStreaming.innerText = gStream;
    gradeStreaming.className = `rating-grade ${getGradeClass(gStream)}`;

    gradeVideoCall.innerText = gCall;
    gradeVideoCall.className = `rating-grade ${getGradeClass(gCall)}`;

    res.rating = gGame.startsWith('A') && gStream.startsWith('A') ? 'A+' : gStream;
}

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    detectDevice();
    drawGauge();
    fetchClientInfo();
});
window.addEventListener('resize', detectDevice);


