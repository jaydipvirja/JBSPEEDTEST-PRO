// Jitter Module - Consecutive Latency Variation & Quality Classification

export function calculateJitter(latencies) {
    if (!latencies || latencies.length < 2) return 0;
    
    let sumDiff = 0;
    for (let i = 1; i < latencies.length; i++) {
        sumDiff += Math.abs(latencies[i] - latencies[i - 1]);
    }
    
    return Math.round(sumDiff / (latencies.length - 1));
}

export function getJitterClassification(jitterMs) {
    if (jitterMs <= 5) {
        return { label: 'Excellent', grade: 'A+', color: '#00F2FE' };
    }
    if (jitterMs <= 15) {
        return { label: 'Good', grade: 'A', color: '#38EF7D' };
    }
    if (jitterMs <= 30) {
        return { label: 'Fair', grade: 'B', color: '#FFB300' };
    }
    return { label: 'Poor', grade: 'C', color: '#FF416C' };
}
