// Download Module - Adaptive Concurrency & Progressive Throughput Engine

import { calculateTrimmedAverage } from './resultValidation.js';
import { createLoadedLatencyCollector } from './latency.js';

export async function runDownloadTest({
    server,
    isMobile = false,
    durationMs = 7000,
    testId = `test-${Date.now()}`,
    onProgress,
    signal
}) {
    const startTime = performance.now();
    let totalBytesReceived = 0;
    let warmUpBytesReceived = 0;
    const warmUpDurationMs = 1500;

    // Adaptive Concurrency: Start with 2 connections on mobile, 3 on desktop, scale up to 6
    let activeStreamsCount = isMobile ? 2 : 3;
    const maxStreamsCount = isMobile ? 4 : 6;

    let currentChunkSize = isMobile ? 128 * 1024 : 256 * 1024;
    const samples = [];

    const downloadEndpoint = server.downloadUrl.startsWith('http')
        ? server.downloadUrl
        : `${server.baseUrl}${server.downloadUrl}`;

    const pingEndpoint = server.pingUrl.startsWith('http')
        ? server.pingUrl
        : `${server.baseUrl}${server.pingUrl}`;

    // Loaded Latency Collector (Bufferbloat during download)
    const loadedLatencyCollector = createLoadedLatencyCollector(pingEndpoint, signal);

    let windowBytes = 0;
    let windowStartTime = performance.now();

    const intervalTimer = setInterval(() => {
        const now = performance.now();
        const elapsedSec = (now - startTime) / 1000;
        const deltaSec = (now - windowStartTime) / 1000;

        if (deltaSec >= 0.10) {
            const instantMbps = (windowBytes * 8) / (deltaSec * 1024 * 1024);

            // Record samples after warm-up phase (1.5 seconds)
            if (elapsedSec * 1000 > warmUpDurationMs && instantMbps > 0) {
                samples.push(instantMbps);
            }

            // Adaptive Concurrency Scaling based on speed
            if (instantMbps > 120) {
                currentChunkSize = 8 * 1024 * 1024;
                if (activeStreamsCount < maxStreamsCount) activeStreamsCount++;
            } else if (instantMbps > 40) {
                currentChunkSize = 4 * 1024 * 1024;
                if (activeStreamsCount < 4) activeStreamsCount++;
            } else if (instantMbps > 10) {
                currentChunkSize = 1 * 1024 * 1024;
            } else if (instantMbps > 2) {
                currentChunkSize = 512 * 1024;
            } else {
                currentChunkSize = 128 * 1024;
            }

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
            // Adaptive concurrency check
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

    return {
        mbps: finalMbps,
        bytes: totalBytesReceived,
        durationSec: totalDurationSec,
        samples: samples,
        loadedLatency: downloadLoadedLatency
    };
}
