// Download Module - Mobile Profile Adaptive Concurrency & Warm-up Engine

import { calculateTrimmedAverage } from './resultValidation.js';
import { createLoadedLatencyCollector } from './latency.js';
import { NETWORK_PROFILES } from './networkDetection.js';

export async function runDownloadTest({
    server,
    isMobile = false,
    durationMs = 7000,
    testId = `test-${Date.now()}`,
    onProgress,
    signal
}) {
    const profile = isMobile ? NETWORK_PROFILES.MOBILE : NETWORK_PROFILES.WIFI;
    const startTime = performance.now();
    let totalBytesReceived = 0;
    let warmUpBytesReceived = 0;
    const warmUpDurationMs = profile.warmupMs;

    // Mobile Data & Wi-Fi start at high concurrency for instant Ookla-style saturation
    let activeStreamsCount = profile.initialConnections;
    const maxStreamsCount = profile.maxConnections;

    let currentChunkSize = 2 * 1024 * 1024; // Start at 2MB chunks to minimize HTTP overhead
    const samples = [];
    let previousSpeed = 0;

    const downloadEndpoint = server.downloadUrl.startsWith('http')
        ? server.downloadUrl
        : `${server.baseUrl}${server.downloadUrl}`;

    const pingEndpoint = server.pingUrl.startsWith('http')
        ? server.pingUrl
        : `${server.baseUrl}${server.pingUrl}`;

    const loadedLatencyCollector = createLoadedLatencyCollector(pingEndpoint, signal);

    let lastBytesCount = 0;
    let lastTickTime = performance.now();

    const intervalTimer = setInterval(() => {
        const now = performance.now();
        const elapsedSec = (now - startTime) / 1000;
        const deltaSec = (now - lastTickTime) / 1000;
        const bytesInDelta = totalBytesReceived - lastBytesCount;

        lastBytesCount = totalBytesReceived;
        lastTickTime = now;

        if (deltaSec >= 0.05) {
            const instantMbps = (bytesInDelta * 8) / (deltaSec * 1024 * 1024);

            // Record samples ONLY after the warm-up phase
            if (elapsedSec * 1000 > warmUpDurationMs && instantMbps > 0) {
                samples.push(instantMbps);
            }

            // Rapid Concurrency Scaling to saturate line speed
            if (activeStreamsCount < maxStreamsCount && instantMbps > 2.0) {
                activeStreamsCount = Math.min(maxStreamsCount, activeStreamsCount + 2);
            }
            previousSpeed = instantMbps;

            // Adaptive Chunk Sizing
            if (instantMbps > 60) currentChunkSize = 8 * 1024 * 1024;
            else if (instantMbps > 20) currentChunkSize = 4 * 1024 * 1024;
            else currentChunkSize = 2 * 1024 * 1024;

            const currentAverage = samples.length > 0
                ? calculateTrimmedAverage(samples)
                : instantMbps;

            if (onProgress) {
                onProgress({
                    instantMbps: parseFloat(instantMbps.toFixed(1)),
                    averageMbps: parseFloat(currentAverage.toFixed(1)),
                    totalBytes: totalBytesReceived,
                    elapsedSec: elapsedSec,
                    activeStreams: activeStreamsCount,
                    isWarmUp: elapsedSec * 1000 <= warmUpDurationMs
                });
            }
        }
    }, 80);

    async function runSingleDownloadWorker(workerId) {
        while (performance.now() - startTime < durationMs && (!signal || !signal.aborted)) {
            if (workerId >= activeStreamsCount) {
                await new Promise(r => setTimeout(r, 100));
                continue;
            }

            const sep = downloadEndpoint.includes('?') ? '&' : '?';
            const url = downloadEndpoint.startsWith('/api') 
                ? `${downloadEndpoint}?size=${currentChunkSize}&testId=${testId}&_t=${Date.now()}`
                : `${downloadEndpoint}${sep}bytes=${currentChunkSize}&testId=${testId}&_t=${Date.now()}`;

            try {
                const response = await fetch(url, { cache: 'no-store', signal });
                if (!response.ok) break;

                const reader = response.body.getReader();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done || (signal && signal.aborted)) break;
                    
                    totalBytesReceived += value.length;

                    if (performance.now() - startTime <= warmUpDurationMs) {
                        warmUpBytesReceived += value.length;
                    }

                    if (performance.now() - startTime >= durationMs) {
                        reader.cancel();
                        break;
                    }
                }
            } catch (e) {
                if (signal && signal.aborted) break;
                await new Promise(r => setTimeout(r, 80));
            }
        }
    }

    const workerPromises = [];
    for (let i = 0; i < maxStreamsCount; i++) {
        workerPromises.push(runSingleDownloadWorker(i));
    }

    await Promise.all(workerPromises);
    clearInterval(intervalTimer);
    const downloadLoadedLatency = loadedLatencyCollector.stop();

    const totalDurationSec = (performance.now() - startTime) / 1000;
    const measurementDurationSec = Math.max(0.5, totalDurationSec - (warmUpDurationMs / 1000));
    const measurementBytes = totalBytesReceived - warmUpBytesReceived;

    const trimmedMbps = samples.length >= 3
        ? calculateTrimmedAverage(samples)
        : (measurementBytes * 8) / (measurementDurationSec * 1024 * 1024);

    const finalMbps = Math.max(0.1, parseFloat(trimmedMbps.toFixed(1)));

    console.log('[MobileDataDebug] Download Test Completed:', {
        profile: profile.type,
        finalMbps,
        totalBytesReceived,
        warmUpBytesReceived,
        samplesCount: samples.length,
        loadedLatency: downloadLoadedLatency
    });

    return {
        mbps: finalMbps,
        bytes: totalBytesReceived,
        durationSec: totalDurationSec,
        samples: samples,
        loadedLatency: downloadLoadedLatency
    };
}
