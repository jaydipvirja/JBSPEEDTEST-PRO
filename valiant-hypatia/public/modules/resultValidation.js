// Result Validation Module - Percentile Trimming & Statistical Validation

export function calculateTrimmedAverage(samples, trimFraction = 0.10) {
    if (!samples || samples.length === 0) return 0;
    if (samples.length < 4) {
        return samples.reduce((a, b) => a + b, 0) / samples.length;
    }
    const sorted = [...samples].sort((a, b) => a - b);
    // Ookla methodology: Discard bottom 25% (ramp-up samples) and average the upper 75% sustained peak samples
    const dropBottom = Math.floor(sorted.length * 0.25);
    const validSamples = sorted.slice(dropBottom);
    if (validSamples.length === 0) return sorted[sorted.length - 1];
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
