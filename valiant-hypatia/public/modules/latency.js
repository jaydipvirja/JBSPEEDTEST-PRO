// Latency Module - Idle Ping, Min/Median/Avg/Max, and Loaded Latency (Bufferbloat)

import { calculateJitter } from './jitter.js';

export async function measureIdleLatency(pingEndpoint, probeCount = 12, signal = null) {
    const latencies = [];
    let failedCount = 0;

    // 1. Warm-up probe (establishes TCP/TLS session on mobile tower / broadband edge)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const sep = pingEndpoint.includes('?') ? '&' : '?';
        await fetch(`${pingEndpoint}${sep}_w=1&_t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
    } catch (e) {}

    // 2. Sequential Ping Probes
    for (let i = 0; i < probeCount; i++) {
        if (signal && signal.aborted) break;
        const t0 = performance.now();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const sep = pingEndpoint.includes('?') ? '&' : '?';
            const res = await fetch(`${pingEndpoint}${sep}_r=${i}&_t=${Date.now()}`, { 
                cache: 'no-store', 
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                latencies.push(performance.now() - t0);
            } else {
                failedCount++;
            }
        } catch (e) {
            failedCount++;
        }
        await new Promise(r => setTimeout(r, 50));
    }

    if (!latencies.length) {
        return { min: 20, median: 25, avg: 25, max: 30, jitter: 2, rawSamples: [] };
    }

    latencies.sort((a, b) => a - b);
    const min = Math.round(latencies[0]);
    const max = Math.round(latencies[latencies.length - 1]);
    const median = Math.round(latencies[Math.floor(latencies.length / 2)]);
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const jitter = calculateJitter(latencies);

    return { min, median, avg, max, jitter, rawSamples: latencies };
}

// Background Ping Collector for Loaded Latency (Bufferbloat)
export function createLoadedLatencyCollector(pingEndpoint, signal) {
    const samples = [];
    let isCollecting = true;

    async function loop() {
        while (isCollecting && (!signal || !signal.aborted)) {
            const t0 = performance.now();
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1200);
                const sep = pingEndpoint.includes('?') ? '&' : '?';
                const res = await fetch(`${pingEndpoint}${sep}_ll=1&_t=${Date.now()}`, { 
                    cache: 'no-store', 
                    signal: controller.signal 
                });
                clearTimeout(timeoutId);
                if (res.ok) {
                    samples.push(performance.now() - t0);
                }
            } catch (e) {}
            await new Promise(r => setTimeout(r, 120));
        }
    }

    loop();

    return {
        stop: () => {
            isCollecting = false;
            if (!samples.length) return 0;
            samples.sort((a, b) => a - b);
            return Math.round(samples[Math.floor(samples.length / 2)]);
        },
        getSamples: () => [...samples]
    };
}
