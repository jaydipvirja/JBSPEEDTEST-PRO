// Upload Module - Mobile Profile Adaptive Payload & Concurrency Engine

import { calculateTrimmedAverage } from './resultValidation.js';
import { createLoadedLatencyCollector } from './latency.js';
import { NETWORK_PROFILES } from './networkDetection.js';

export async function runUploadTest({
    server,
    isMobile = false,
    durationMs = 6000,
    testId = `test-${Date.now()}`,
    onProgress,
    signal
}) {
    const profile = isMobile ? NETWORK_PROFILES.MOBILE : NETWORK_PROFILES.WIFI;
    const startTime = performance.now();
    let totalBytesUploaded = 0;
    let warmUpBytesUploaded = 0;
    const warmUpDurationMs = profile.warmupMs;

    let activeStreamsCount = profile.initialConnections;
    const maxStreamsCount = profile.maxConnections;

    let currentPayloadSize = 512 * 1024; // Start at 512KB payload
    let rawArray = new Uint8Array(currentPayloadSize);
    for (let i = 0; i < currentPayloadSize; i += 64) {
        rawArray[i] = Math.floor(Math.random() * 256);
    }
    let payloadBlob = new Blob([rawArray], { type: 'text/plain' });

    const samples = [];
    let previousSpeed = 0;

    const uploadEndpoint = server.uploadUrl.startsWith('http')
        ? server.uploadUrl
        : `${server.baseUrl}${server.uploadUrl}`;

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

            if (elapsedSec * 1000 > warmUpDurationMs && instantMbps > 0) {
                samples.push(instantMbps);
            }

            // Rapid Concurrency Scaling
            if (activeStreamsCount < maxStreamsCount && instantMbps > 1.0) {
                activeStreamsCount = Math.min(maxStreamsCount, activeStreamsCount + 2);
                console.log(`[MobileDataDebug] Upload Concurrency Scaled UP to ${activeStreamsCount} connections (Instant: ${instantMbps.toFixed(1)} Mbps)`);
            }
            previousSpeed = instantMbps;

            let newPayloadSize = currentPayloadSize;
            if (instantMbps > 30) newPayloadSize = 2 * 1024 * 1024;
            else if (instantMbps > 10) newPayloadSize = 1 * 1024 * 1024;
            else newPayloadSize = 512 * 1024;

            if (newPayloadSize !== currentPayloadSize) {
                currentPayloadSize = newPayloadSize;
                rawArray = new Uint8Array(currentPayloadSize);
                payloadBlob = new Blob([rawArray], { type: 'text/plain' });
            }

            const currentAverage = samples.length > 0
                ? calculateTrimmedAverage(samples)
                : instantMbps;

            if (onProgress) {
                onProgress({
                    instantMbps: parseFloat(instantMbps.toFixed(1)),
                    averageMbps: parseFloat(currentAverage.toFixed(1)),
                    totalBytes: totalBytesUploaded,
                    elapsedSec: elapsedSec,
                    activeStreams: activeStreamsCount,
                    isWarmUp: elapsedSec * 1000 <= warmUpDurationMs
                });
            }

            windowBytes = 0;
            windowStartTime = now;
        }
    }, 40);

    async function runSingleUploadWorker(workerId) {
        while (performance.now() - startTime < durationMs && (!signal || !signal.aborted)) {
            if (workerId >= activeStreamsCount) {
                await new Promise(r => setTimeout(r, 100));
                continue;
            }

            const sep = uploadEndpoint.includes('?') ? '&' : '?';
            const url = uploadEndpoint.startsWith('/api')
                ? `${uploadEndpoint}?testId=${testId}&_t=${Date.now()}`
                : `${uploadEndpoint}${sep}testId=${testId}&_t=${Date.now()}`;

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

                    if (performance.now() - startTime <= warmUpDurationMs) {
                        warmUpBytesUploaded += currentPayloadSize;
                    }
                }
            } catch (e) {
                if (signal && signal.aborted) break;
                await new Promise(r => setTimeout(r, 60));
            }
        }
    }

    const workerPromises = [];
    for (let i = 0; i < maxStreamsCount; i++) {
        workerPromises.push(runSingleUploadWorker(i));
    }

    await Promise.all(workerPromises);
    clearInterval(intervalTimer);
    const uploadLoadedLatency = loadedLatencyCollector.stop();

    const totalDurationSec = (performance.now() - startTime) / 1000;
    const measurementDurationSec = Math.max(0.5, totalDurationSec - (warmUpDurationMs / 1000));
    const measurementBytes = totalBytesUploaded - warmUpBytesUploaded;

    const trimmedMbps = samples.length >= 3
        ? calculateTrimmedAverage(samples)
        : (measurementBytes * 8) / (measurementDurationSec * 1024 * 1024);

    const finalMbps = Math.max(0.1, parseFloat(trimmedMbps.toFixed(1)));

    console.log('[MobileDataDebug] Upload Test Completed:', {
        profile: profile.type,
        finalMbps,
        totalBytesUploaded,
        warmUpBytesUploaded,
        samplesCount: samples.length,
        loadedLatency: uploadLoadedLatency
    });

    return {
        mbps: finalMbps,
        bytes: totalBytesUploaded,
        durationSec: totalDurationSec,
        samples: samples,
        loadedLatency: uploadLoadedLatency
    };
}
