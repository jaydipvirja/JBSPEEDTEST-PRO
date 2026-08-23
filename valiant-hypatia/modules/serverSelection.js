// Server Selection Module - 2-Stage Geographic & Latency Probe Scoring Engine

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function fetchServerList() {
    try {
        const res = await fetch('/api/servers');
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn('Backend server registry unavailable, using fallback edge list:', e);
    }

    return [
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
        }
    ];
}

export async function selectBestServer(userLat = 23.0225, userLon = 72.5714, signal = null) {
    const servers = await fetchServerList();

    // Stage 1: Candidate selection based on geographic distance
    const candidateServers = servers.map(srv => ({
        ...srv,
        distanceKm: Math.round(haversineDistance(userLat, userLon, srv.lat, srv.lon))
    })).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 4);

    // Stage 2: Latency & Jitter Probes
    const scoredServers = await Promise.all(candidateServers.map(async (server) => {
        const pingEndpoint = server.pingUrl.startsWith('http') 
            ? server.pingUrl 
            : `${server.baseUrl}${server.pingUrl}`;

        const probes = 4;
        const latencies = [];
        let failedCount = 0;

        for (let i = 0; i < probes; i++) {
            if (signal && signal.aborted) break;
            const t0 = performance.now();
            try {
                const sep = pingEndpoint.includes('?') ? '&' : '?';
                const res = await fetch(`${pingEndpoint}${sep}_r=${i}&_t=${Date.now()}`, { 
                    cache: 'no-store', 
                    signal 
                });
                if (res.ok) {
                    latencies.push(performance.now() - t0);
                } else {
                    failedCount++;
                }
            } catch (e) {
                failedCount++;
            }
            await new Promise(r => setTimeout(r, 40));
        }

        if (latencies.length === 0) {
            return { server, medianPing: 999, jitter: 99, score: 9999 };
        }

        latencies.sort((a, b) => a - b);
        const medianPing = latencies[Math.floor(latencies.length / 2)];

        let jitterSum = 0;
        for (let i = 1; i < latencies.length; i++) {
            jitterSum += Math.abs(latencies[i] - latencies[i - 1]);
        }
        const jitter = latencies.length > 1 ? jitterSum / (latencies.length - 1) : 0;

        // Score formula: Lower is better
        const score = (medianPing * 0.5) + (jitter * 0.3) + (failedCount * 150) + (server.distanceKm * 0.05);

        return { server, medianPing: Math.round(medianPing), jitter: Math.round(jitter), score };
    }));

    scoredServers.sort((a, b) => a.score - b.score);
    return scoredServers[0] ? scoredServers[0].server : servers[0];
}
