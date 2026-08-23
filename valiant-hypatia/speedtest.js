// SpeedTest Pro - Master Controller Module

import { detectConnection, listenToNetworkChanges } from './modules/networkDetection.js';
import { selectBestServer } from './modules/serverSelection.js';
import { executeSpeedTestPipeline } from './modules/speedtestCore.js';
import { getTestHistory, clearTestHistory } from './modules/history.js';
import { generateShareText, generateShareCardCanvas } from './modules/sharing.js';

// Global Engine State
let currentMode = 'internet'; // 'internet' or 'local'
let isRunning = false;
let isTurboRunning = false;
let currentTurboType = 'download';
let activeAbortController = null;
let currentTestProfile = 'standard';
let activeResult = null;

let gaugeSpeed = 0;
let targetSpeed = 0;
let chartPoints = [];
let peakSpeedRecorded = 0;

let turboTimerInterval = null;
let turboStartTime = 0;
let turboTotalBytes = 0;
let turboPeakMbps = 0;

// DOM Elements
const canvas = document.getElementById('gaugeCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const chartCanvas = document.getElementById('liveChartCanvas');
const chartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;

const liveSpeedNum = document.getElementById('liveSpeedNumber');
const speedStageLabel = document.getElementById('speedStageLabel');
const startBtn = document.getElementById('startTestBtn');
const btnLabel = document.getElementById('btnLabel');

const connTypeName = document.getElementById('connTypeName');
const targetServerName = document.getElementById('targetServerName');
const pipelineProgressBox = document.getElementById('pipelineProgressBox');
const pipelineFill = document.getElementById('pipelineFill');
const pipelineStageNum = document.getElementById('pipelineStageNum');
const pipelineStageText = document.getElementById('pipelineStageText');

const valPing = document.getElementById('valPing');
const valJitter = document.getElementById('valJitter');
const valDownload = document.getElementById('valDownload');
const valUpload = document.getElementById('valUpload');

const lpIdle = document.getElementById('lpIdle');
const lpDown = document.getElementById('lpDown');
const lpUp = document.getElementById('lpUp');

const netScorePill = document.getElementById('netScorePill');
const recExcellentText = document.getElementById('recExcellentText');
const recGoodText = document.getElementById('recGoodText');
const valStability = document.getElementById('valStability');
const btnShareResult = document.getElementById('btnShareResult');

const turboDownBtn = document.getElementById('turboDownBtn');
const turboUpBtn = document.getElementById('turboUpBtn');
const turboStatsBar = document.getElementById('turboStatsBar');
const turboLimitSelect = document.getElementById('turboLimitSelect');

const mobileDataModalBackdrop = document.getElementById('mobileDataModalBackdrop');
const netChangeModalBackdrop = document.getElementById('netChangeModalBackdrop');
const shareModalBackdrop = document.getElementById('shareModalBackdrop');
const shareCardImg = document.getElementById('shareCardImg');

// Helper to format bytes into readable MB or GB
function formatBytes(bytes) {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
        return { val: (mb / 1024).toFixed(2), unit: 'GB', full: `${(mb / 1024).toFixed(2)} GB` };
    }
    return { val: mb.toFixed(2), unit: 'MB', full: `${mb.toFixed(2)} MB` };
}

// Haptic Feedback
function triggerHaptic(type = 'light') {
    if (navigator.vibrate) {
        if (type === 'light') navigator.vibrate(15);
        if (type === 'medium') navigator.vibrate(35);
        if (type === 'success') navigator.vibrate([20, 50, 20]);
    }
}

// Connection Initialization & Listener
function updateNetworkInfoDisplay(info) {
    if (connTypeName) {
        connTypeName.innerText = `Connection: ${info.connectionType}`;
    }

    const infoConn = document.getElementById('infoConnectionType');
    const infoEff = document.getElementById('infoEffectiveType');
    if (infoConn) infoConn.innerText = info.connectionType;
    if (infoEff) infoEff.innerText = info.effectiveType;
}

// Handle network change & background tab visibility during test
listenToNetworkChanges((info) => {
    updateNetworkInfoDisplay(info);

    if (isRunning || isTurboRunning) {
        if (activeAbortController) activeAbortController.abort();
        isRunning = false;
        isTurboRunning = false;
        
        if (netChangeModalBackdrop) netChangeModalBackdrop.classList.add('open');
        resetTestUI();
    }
}, (visibilityMsg) => {
    if (isRunning || isTurboRunning) {
        if (activeAbortController) activeAbortController.abort();
        isRunning = false;
        isTurboRunning = false;

        const testProgressText = document.getElementById('testProgressText');
        if (testProgressText) {
            testProgressText.innerText = visibilityMsg;
        }
        resetTestUI();
    }
});

// Speedometer Gauge Arc Mappings
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

function drawGauge() {
    if (!canvas || !ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height * 0.58;
    const radius = 135;

    ctx.clearRect(0, 0, width, height);

    gaugeSpeed += (targetSpeed - gaugeSpeed) * 0.15;
    if (Math.abs(targetSpeed - gaugeSpeed) < 0.05) gaugeSpeed = targetSpeed;

    if (liveSpeedNum) liveSpeedNum.innerText = gaugeSpeed.toFixed(1);

    // Background Arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, START_ANGLE, END_ANGLE, false);
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Active Glow Arc
    const currentAngle = speedToAngle(gaugeSpeed);
    if (currentAngle > START_ANGLE) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, START_ANGLE, currentAngle, false);
        ctx.lineWidth = 14;

        const gradient = ctx.createConicGradient(START_ANGLE, centerX, centerY);
        gradient.addColorStop(0, '#00F2FE');
        gradient.addColorStop(0.5, '#4FACFE');
        gradient.addColorStop(0.8, '#9D4EDD');
        gradient.addColorStop(1, '#FF007F');
        ctx.strokeStyle = gradient;
        ctx.shadowColor = '#00F2FE';
        ctx.shadowBlur = 18;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
    }

    // Ticks
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
        ctx.strokeStyle = gaugeSpeed >= tickVal ? '#00F2FE' : 'rgba(255, 255, 255, 0.25)';
        ctx.stroke();

        const textR = radius - 32;
        const tx = centerX + Math.cos(angle) * textR;
        const ty = centerY + Math.sin(angle) * textR + 4;

        ctx.font = '600 11px Outfit, sans-serif';
        ctx.fillStyle = gaugeSpeed >= tickVal ? '#FFF' : 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'center';
        ctx.fillText(tickVal.toString(), tx, ty);
    });

    // Needle
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
    needleGrad.addColorStop(0, '#FFFFFF');
    needleGrad.addColorStop(1, '#00F2FE');
    ctx.shadowColor = '#00F2FE';

    ctx.fillStyle = needleGrad;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.restore();

    // Pivot Cap
    ctx.beginPath();
    ctx.arc(centerX, centerY, 12, 0, 2 * Math.PI);
    ctx.fillStyle = '#121826';
    ctx.strokeStyle = '#00F2FE';
    ctx.lineWidth = 3;
    ctx.stroke();

    requestAnimationFrame(drawGauge);
}

// Live Chart Renderer
function updateLiveChart(val) {
    if (!chartCanvas || !chartCtx) return;
    chartPoints.push(val);
    if (chartPoints.length > 60) chartPoints.shift();

    if (val > peakSpeedRecorded) {
        peakSpeedRecorded = val;
        const peakEl = document.getElementById('chartPeakSpeed');
        if (peakEl) peakEl.innerText = `Peak: ${peakSpeedRecorded.toFixed(2)} Mbps`;
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
    chartCtx.strokeStyle = '#00F2FE';
    chartCtx.shadowColor = '#00F2FE';
    chartCtx.shadowBlur = 8;
    chartCtx.stroke();

    chartCtx.lineTo((chartPoints.length - 1) * stepX, h);
    chartCtx.lineTo(0, h);
    chartCtx.closePath();

    const chartGrad = chartCtx.createLinearGradient(0, 0, 0, h);
    chartGrad.addColorStop(0, 'rgba(0, 242, 254, 0.25)');
    chartGrad.addColorStop(1, 'rgba(0, 242, 254, 0.0)');
    chartCtx.fillStyle = chartGrad;
    chartCtx.fill();
}

// Reset UI
function resetTestUI() {
    targetSpeed = 0;
    gaugeSpeed = 0;
    if (startBtn) {
        startBtn.classList.remove('running');
        startBtn.disabled = false;
        startBtn.style.opacity = '1';
    }
    if (btnLabel) btnLabel.innerText = 'START SPEED TEST';
    if (pipelineProgressBox) pipelineProgressBox.style.display = 'none';
    const testStateBadge = document.getElementById('testStateBadge');
    if (testStateBadge) {
        testStateBadge.className = 'badge idle';
        testStateBadge.innerText = 'READY';
    }
}

// Standard Speed Test Trigger
window.toggleTest = function() {
    if (isTurboRunning) return;
    triggerHaptic('medium');

    if (isRunning) {
        if (activeAbortController) activeAbortController.abort();
        isRunning = false;
        resetTestUI();
        return;
    }

    const connInfo = detectConnection();
    if (connInfo.connectionType === 'Mobile Data') {
        if (mobileDataModalBackdrop) mobileDataModalBackdrop.classList.add('open');
    } else {
        startFullSpeedTest();
    }
};

window.selectTestProfile = function(profile) {
    currentTestProfile = profile;
    document.querySelectorAll('.profile-card-btn').forEach(b => b.classList.remove('active'));
    const targetBtn = document.getElementById(profile === 'standard' ? 'btnProfileStandard' : 'btnProfileExtended');
    if (targetBtn) targetBtn.classList.add('active');
};

window.closeMobileDataModal = function() {
    if (mobileDataModalBackdrop) mobileDataModalBackdrop.classList.remove('open');
};

window.startTestWithProfile = function() {
    closeMobileDataModal();
    startFullSpeedTest();
};

window.closeNetChangeModal = function() {
    if (netChangeModalBackdrop) netChangeModalBackdrop.classList.remove('open');
};

// Main 8-Stage Speed Test Runner
async function startFullSpeedTest() {
    isRunning = true;
    activeAbortController = new AbortController();
    const signal = activeAbortController.signal;

    if (startBtn) {
        startBtn.classList.add('running');
        if (btnLabel) btnLabel.innerText = 'STOP TEST';
    }

    if (pipelineProgressBox) pipelineProgressBox.style.display = 'block';

    const testStateBadge = document.getElementById('testStateBadge');
    const testProgressText = document.getElementById('testProgressText');

    try {
        const result = await executeSpeedTestPipeline({
            userOptions: { mode: currentTestProfile },
            onStageChange: (stageNum, stageName) => {
                if (pipelineFill) pipelineFill.style.width = `${(stageNum / 8) * 100}%`;
                if (pipelineStageNum) pipelineStageNum.innerText = `Stage ${stageNum}/8`;
                if (pipelineStageText) pipelineStageText.innerText = stageName;
                if (testStateBadge) testStateBadge.innerText = `STAGE ${stageNum}`;
                if (testProgressText) testProgressText.innerText = stageName;
            },
            onProgressUpdate: (phase, data) => {
                targetSpeed = data.instantMbps;
                updateLiveChart(targetSpeed);
                if (phase === 'download' && valDownload) {
                    valDownload.innerText = data.averageMbps.toFixed(1);
                }
                if (phase === 'upload' && valUpload) {
                    valUpload.innerText = data.averageMbps.toFixed(1);
                }
            },
            signal
        });

        activeResult = result;

        // Render Final Results
        if (valPing) valPing.innerText = result.ping;
        if (valJitter) valJitter.innerText = result.jitter;
        if (valDownload) valDownload.innerText = result.download.toFixed(1);
        if (valUpload) valUpload.innerText = result.upload.toFixed(1);

        if (lpIdle) lpIdle.innerText = `${result.ping} ms`;
        if (lpDown) lpDown.innerText = `${result.loadedLatencyDown || result.ping} ms`;
        if (lpUp) lpUp.innerText = `${result.loadedLatencyUp || result.ping} ms`;

        if (netScorePill) netScorePill.innerText = `Score: ${result.qualityScore}/100`;
        if (valStability) {
            valStability.innerText = result.stability;
            valStability.className = result.stability === 'Stable' ? 'stab-val badge-stable' : 'stab-val badge-unstable';
        }

        if (recExcellentText && result.recommendations) {
            recExcellentText.innerText = result.recommendations.excellentFor.join(', ') || 'Standard Browsing';
        }
        if (recGoodText && result.recommendations) {
            recGoodText.innerText = result.recommendations.goodFor.join(', ') || 'General Internet Use';
        }

        if (btnShareResult) btnShareResult.style.display = 'inline-flex';
        if (testStateBadge) {
            testStateBadge.className = 'badge complete';
            testStateBadge.innerText = 'COMPLETED';
        }
        if (testProgressText) testProgressText.innerText = `Test Complete! Score: ${result.qualityScore}/100`;

        triggerHaptic('success');
        refreshHistoryUI();

    } catch (err) {
        if (!signal.aborted) {
            console.error('Speed test execution error:', err);
            if (testStateBadge) {
                testStateBadge.className = 'badge idle';
                testStateBadge.innerText = 'ERROR';
            }
            if (testProgressText) testProgressText.innerText = 'Network error during test execution.';
        }
    } finally {
        isRunning = false;
        if (startBtn) {
            startBtn.classList.remove('running');
            if (btnLabel) btnLabel.innerText = 'START SPEED TEST';
        }
    }
}

// Share Modal Controls
window.openShareModal = function() {
    if (!activeResult) return;
    if (shareModalBackdrop) shareModalBackdrop.classList.add('open');
    if (shareCardImg) {
        shareCardImg.src = generateShareCardCanvas(activeResult);
    }
};

window.closeShareModal = function(e) {
    if (!e || e.target === shareModalBackdrop || e.target.classList?.contains('qr-close-btn')) {
        if (shareModalBackdrop) shareModalBackdrop.classList.remove('open');
    }
};

window.copyShareText = function() {
    if (!activeResult) return;
    const text = generateShareText(activeResult);
    navigator.clipboard.writeText(text);
    alert('📋 Result copied to clipboard!');
};

window.downloadShareCard = function() {
    if (!activeResult || !shareCardImg) return;
    const link = document.createElement('a');
    link.download = `SpeedTest-Result-${Date.now()}.png`;
    link.href = shareCardImg.src;
    link.click();
};

// Mode Switcher
window.switchMode = function(mode) {
    if (isRunning) return;
    currentMode = mode;
    const btnNet = document.getElementById('modeInternetBtn');
    const btnLoc = document.getElementById('modeLocalBtn');
    if (btnNet) btnNet.classList.toggle('active', mode === 'internet');
    if (btnLoc) btnLoc.classList.toggle('active', mode === 'local');
    if (targetServerName) {
        targetServerName.innerText = mode === 'internet' ? 'Cloudflare CDN' : 'Local PC Hub (LAN)';
    }
};

// History UI Refresh
function refreshHistoryUI(filter = 'all') {
    const history = getTestHistory(filter);
    const tbody = document.getElementById('historyTableBody');
    const countBadge = document.getElementById('historyCountBadge');
    
    if (countBadge) countBadge.innerText = `${history.length} Tests`;

    if (!tbody) return;

    if (history.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No test records found for this filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = history.map(r => `
        <tr>
            <td>${r.dateStr} ${r.timeStr}</td>
            <td>${r.connectionType}</td>
            <td class="font-mono">${r.ping} ms</td>
            <td class="font-mono highlight-cyan">${r.download} Mbps</td>
            <td class="font-mono highlight-purple">${r.upload} Mbps</td>
            <td>${r.server}</td>
            <td class="font-mono" style="color: #38EF7D;">${r.qualityScore}/100</td>
        </tr>
    `).join('');
}

window.filterHistoryTab = function(timeRange, btn) {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    refreshHistoryUI(timeRange);
};

window.clearHistoryRecords = function() {
    if (confirm('Are you sure you want to clear all speed test history?')) {
        clearTestHistory();
        refreshHistoryUI();
    }
};

// Client Information Detection
async function fetchClientInfo() {
    try {
        const res = await fetch('https://speed.cloudflare.com/meta', { cache: 'no-store' });
        if (res.ok) {
            const meta = await res.json();
            const ispEl = document.getElementById('infoIsp');
            const ipEl = document.getElementById('infoIp');
            const locEl = document.getElementById('infoLocation');

            if (ispEl) ispEl.innerText = meta.asnOrganization || meta.asOrganization || meta.isp || 'Broadband / Wi-Fi';
            if (ipEl) ipEl.innerText = meta.clientIp || '--';
            if (locEl) locEl.innerText = `${meta.city || ''}, ${meta.country || ''}`;
        }
    } catch (e) {}

    const connInfo = detectConnection();
    updateNetworkInfoDisplay(connInfo);
}

// DOM Ready Init
window.addEventListener('DOMContentLoaded', () => {
    drawGauge();
    fetchClientInfo();
    refreshHistoryUI();
});
