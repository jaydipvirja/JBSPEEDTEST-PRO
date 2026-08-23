// Stability Module - Statistical Fluctuation & Connection Stability Engine

export function calculateStability(samples) {
    if (!samples || samples.length < 3) {
        return {
            status: 'Stable',
            variabilityPercent: 0,
            stdDev: 0,
            mean: 0,
            median: 0,
            min: 0,
            max: 0
        };
    }

    const n = samples.length;
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    
    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(n / 2)];
    const min = sorted[0];
    const max = sorted[n - 1];

    const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const variabilityPercent = mean > 0 ? Math.round((stdDev / mean) * 100) : 0;
    const isUnstable = variabilityPercent > 35 || (max / Math.max(1, min)) > 3.5;

    return {
        status: isUnstable ? 'Unstable' : 'Stable',
        variabilityPercent: variabilityPercent,
        stdDev: parseFloat(stdDev.toFixed(2)),
        mean: parseFloat(mean.toFixed(2)),
        median: parseFloat(median.toFixed(2)),
        min: parseFloat(min.toFixed(2)),
        max: parseFloat(max.toFixed(2))
    };
}
