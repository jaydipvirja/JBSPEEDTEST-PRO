// SpeedTest Core Module - 8-Stage Pipeline Orchestrator & Activity Recommendation Engine

import { detectConnection } from './networkDetection.js';
import { selectBestServer } from './serverSelection.js';
import { measureIdleLatency } from './latency.js';
import { measurePacketLoss } from './packetLoss.js';
import { runDownloadTest } from './download.js';
import { runUploadTest } from './upload.js';
import { calculateStability } from './stability.js';
import { saveTestRecord } from './history.js';

export function calculateQualityScore({ download, upload, ping, jitter, stabilityStatus }) {
    let score = 100;

    // Download Weighting (35%)
    if (download < 5) score -= 30;
    else if (download < 15) score -= 20;
    else if (download < 30) score -= 10;
    else if (download < 50) score -= 5;

    // Upload Weighting (25%)
    if (upload < 2) score -= 20;
    else if (upload < 5) score -= 15;
    else if (upload < 15) score -= 8;
    else if (upload < 25) score -= 4;

    // Ping Weighting (20%)
    if (ping > 150) score -= 20;
    else if (ping > 80) score -= 15;
    else if (ping > 45) score -= 8;
    else if (ping > 25) score -= 4;

    // Jitter Weighting (10%)
    if (jitter > 30) score -= 10;
    else if (jitter > 15) score -= 6;
    else if (jitter > 5) score -= 3;

    // Stability Penalty (10%)
    if (stabilityStatus === 'Unstable') score -= 10;

    return Math.max(10, Math.min(100, Math.round(score)));
}

export function getPracticalRecommendations({ download, upload, ping, jitter }) {
    const excellentFor = [];
    const goodFor = [];
    const poorFor = [];

    // 4K Streaming
    if (download >= 35) excellentFor.push('4K Ultra HD Streaming');
    else if (download >= 15) goodFor.push('HD 1080p Streaming');
    else poorFor.push('4K Streaming');

    // Video Calls
    if (upload >= 8 && ping <= 40 && jitter <= 10) excellentFor.push('4K / Multi-Party Video Calls');
    else if (upload >= 2 && ping <= 80) goodFor.push('Standard Video Calls (Zoom/Teams)');
    else poorFor.push('High-Quality Video Calls');

    // Gaming
    if (ping <= 30 && jitter <= 8 && download >= 15) excellentFor.push('Competitive Online Gaming');
    else if (ping <= 60 && jitter <= 18) goodFor.push('Casual Multiplayer Gaming');
    else poorFor.push('Competitive Gaming (High Latency)');

    // Cloud Backup & Large Uploads
    if (upload >= 25) excellentFor.push('Large File & Cloud Backups');
    else if (upload >= 8) goodFor.push('Regular Cloud File Uploads');
    else poorFor.push('Large File Uploads');

    return { excellentFor, goodFor, poorFor };
}

export async function executeSpeedTestPipeline({
    userOptions = { mode: 'extended' },
    onStageChange,
    onProgressUpdate,
    signal
}) {
    // Stage 1: Detect Connection
    if (onStageChange) onStageChange(1, 'Detecting Connection...');
    const connInfo = detectConnection();
    await new Promise(r => setTimeout(r, 200));

    if (signal && signal.aborted) throw new Error('Test aborted');

    // Stage 2: Finding Best Server
    if (onStageChange) onStageChange(2, 'Finding Best Server...');
    const selectedServer = await selectBestServer(23.0225, 72.5714, signal);

    if (signal && signal.aborted) throw new Error('Test aborted');

    // Stage 3: Latency & Jitter Probe
    if (onStageChange) onStageChange(3, `Testing Latency on ${selectedServer.name}...`);
    const pingEndpoint = selectedServer.pingUrl.startsWith('http')
        ? selectedServer.pingUrl
        : `${selectedServer.baseUrl}${selectedServer.pingUrl}`;

    const idleLatencyResult = await measureIdleLatency(pingEndpoint, connInfo.isMobile ? 8 : 12, signal);
    const packetLossResult = await measurePacketLoss(pingEndpoint, 12, signal);

    if (signal && signal.aborted) throw new Error('Test aborted');

    // Stage 4: Preparing Connection & Warm-up
    if (onStageChange) onStageChange(4, 'Preparing Connection & Warm-up...');
    await new Promise(r => setTimeout(r, 300));

    if (signal && signal.aborted) throw new Error('Test aborted');

    // Stage 5: Testing Download
    if (onStageChange) onStageChange(5, 'Testing Download Throughput...');
    const downloadTestResult = await runDownloadTest({
        server: selectedServer,
        isMobile: connInfo.isMobile,
        durationMs: userOptions.mode === 'standard' ? 5000 : 7500,
        onProgress: (p) => {
            if (onProgressUpdate) onProgressUpdate('download', p);
        },
        signal
    });

    if (signal && signal.aborted) throw new Error('Test aborted');

    // Stage 6: Testing Upload
    if (onStageChange) onStageChange(6, 'Testing Upload Throughput...');
    const uploadTestResult = await runUploadTest({
        server: selectedServer,
        isMobile: connInfo.isMobile,
        durationMs: userOptions.mode === 'standard' ? 4500 : 6500,
        onProgress: (p) => {
            if (onProgressUpdate) onProgressUpdate('upload', p);
        },
        signal
    });

    if (signal && signal.aborted) throw new Error('Test aborted');

    // Stage 7: Measuring Stability & Bufferbloat
    if (onStageChange) onStageChange(7, 'Analyzing Connection Stability & Loaded Latency...');
    const combinedSamples = [...downloadTestResult.samples, ...uploadTestResult.samples];
    const stabilityAnalysis = calculateStability(combinedSamples);

    const qualityScore = calculateQualityScore({
        download: downloadTestResult.mbps,
        upload: uploadTestResult.mbps,
        ping: idleLatencyResult.median,
        jitter: idleLatencyResult.jitter,
        stabilityStatus: stabilityAnalysis.status
    });

    const recommendations = getPracticalRecommendations({
        download: downloadTestResult.mbps,
        upload: uploadTestResult.mbps,
        ping: idleLatencyResult.median,
        jitter: idleLatencyResult.jitter
    });

    // Stage 8: Finalizing Results
    if (onStageChange) onStageChange(8, 'Finalizing Results...');

    const finalRecord = {
        download: downloadTestResult.mbps,
        upload: uploadTestResult.mbps,
        ping: idleLatencyResult.median,
        minPing: idleLatencyResult.min,
        maxPing: idleLatencyResult.max,
        jitter: idleLatencyResult.jitter,
        packetLoss: packetLossResult.displayText,
        loadedLatencyDown: downloadTestResult.loadedLatency,
        loadedLatencyUp: uploadTestResult.loadedLatency,
        connectionType: connInfo.connectionType,
        effectiveType: connInfo.effectiveType,
        server: selectedServer.name,
        isp: 'Broadband / Wi-Fi',
        stability: stabilityAnalysis.status,
        variabilityPercent: stabilityAnalysis.variabilityPercent,
        qualityScore: qualityScore,
        recommendations: recommendations,
        totalBytes: downloadTestResult.bytes + uploadTestResult.bytes
    };

    saveTestRecord(finalRecord);

    return finalRecord;
}
