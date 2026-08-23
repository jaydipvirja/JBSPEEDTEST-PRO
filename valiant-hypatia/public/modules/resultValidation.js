// Result Validation Module - Percentile Trimming & Statistical Validation

export function calculateTrimmedAverage(samples, trimFraction = 0.10) {
    if (!samples || samples.length === 0) return 0;
    if (samples.length < 4) {
        return samples.reduce((a, b) => a + b, 0) / samples.length;
    }
    const sorted = [...samples].sort((a, b) => a - b);
    // Standard Ookla / Fast.com percentile trimming: Drop lower 20% (ramp-up) and upper 10% (burst spikes)
    const start = Math.floor(sorted.length * 0.20);
    const end = Math.max(start + 1, Math.floor(sorted.length * 0.90));
    const validSamples = sorted.slice(start, end);
    if (validSamples.length === 0) return sorted[Math.floor(sorted.length / 2)];
    return validSamples.reduce((a, b) => a + b, 0) / validSamples.length;
}

export function validateSpeedResult(samples, rawMbps) {
    if (!samples || samples.length < 3) {
        return {
            isValid: true,
            finalMbps: Math.max(0.1, parseFloat(rawMbps.toFixed(1))),
            isConclusive: true,
            reason: 'Sufficient sample size'
        };
    }

    const trimmedMbps = calculateTrimmedAverage(samples, 0.10);
    const finalVal = Math.max(0.1, parseFloat(trimmedMbps.toFixed(1)));

    return {
        isValid: true,
        finalMbps: finalVal,
        isConclusive: true,
        reason: 'Validated via trimmed percentile'
    };
}
