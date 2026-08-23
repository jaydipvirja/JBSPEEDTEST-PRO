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

    // Mobile Data starts at 2 connections. Wi-Fi starts at 4.
    let activeStreamsCount = profile.initialConnections;
    const maxStreamsCount = profile.maxConnections;

    let currentChunkSize = isMobile ? 128 * 1024 : 512 * 1024;
    const samples = [];
    let previousSpeed = 0;

    const downloadEndpoint = server.downloadUrl.startsWith('http')
        ? server.downloadUrl
        : `${server.baseUrl}${server.downloadUrl}`;

    const pingEndpoint = server.pingUrl.startsWith('http')
        ? server.pingUrl
        : `${server.baseUrl}${server.pingUrl}`;

    const loadedLatencyCollector = createLoadedLatencyCollector(pingEndpoint, signal);

    let windowBytes = 0;
    let windowStartTime = performance.now();

    const intervalTimer = setInterval(() => {
        const now = performance.now();
        const elapsedSec = (now - startTime) / 1000;
        const deltaSec = (now - windowStartTime) / 1000;

        if (deltaSec >= 0.10) {
            const instantMbps = (windowBytes * 8) / (deltaSec * 1024 * 1024);

            // Record samples ONLY after the warm-up phase
            if (elapsedSec * 1000 > warmUpDurationMs && instantMbps > 0) {
                samples.push(instantMbps);
            }

            // Adaptive Concurrency: Only increase connections if speed improves meaningfully (>8%)
            if (activeStreamsCount < maxStreamsCount) {
                if (instantMbps > previousSpeed * 1.08 && instantMbps > 5.0) {
                    activeStreamsCount++;
                    console.log(`[MobileDataDebug] Download Concurrency Scaled UP to ${activeStreamsCount} connections (Instant: ${instantMbps.toFixed(1)} Mbps)`);
                }
            }
            previousSpeed = instantMbps;

            // Adaptive Chunk Sizing
            if (instantMbps > 100) currentChunkSize = 8 * 1024 * 1024;
            else if (instantMbps > 30) currentChunkSize = 2 * 1024 * 1024;
            else if (instantMbps > 8) currentChunkSize = 512 * 1024;
            else currentChunkSize = 128 * 1024;

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

            windowBytes = 0;
            windowStartTime = now;
        }
    }, 40);

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
                    windowBytes += value.length;

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
