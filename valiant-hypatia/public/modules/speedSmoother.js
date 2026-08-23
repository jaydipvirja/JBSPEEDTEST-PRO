// Speed Smoother Module - Rolling Sample Buffer, Outlier Protection & 60 FPS Adaptive Interpolation Engine

export const WIFI_SMOOTHING_CONFIG = {
    rollingWindowSize: 10,
    baseFactor: 0.12,
    fastFactor: 0.24,
    outlierThreshold: 2.2
};

export const MOBILE_SMOOTHING_CONFIG = {
    rollingWindowSize: 14,
    baseFactor: 0.07,
    fastFactor: 0.18,
    outlierThreshold: 1.8
};

export class SpeedSmoother {
    constructor(isMobile = false) {
        this.config = isMobile ? MOBILE_SMOOTHING_CONFIG : WIFI_SMOOTHING_CONFIG;
        this.rawSamples = [];
        this.targetSpeed = 0;
        this.displaySpeed = 0;
        this.lastSampleTime = performance.now();
        this.sustainedCount = 0;
        this.lastRawSpeed = 0;
    }

    setMobileMode(isMobile) {
        this.config = isMobile ? MOBILE_SMOOTHING_CONFIG : WIFI_SMOOTHING_CONFIG;
    }

    reset() {
        this.rawSamples = [];
        this.targetSpeed = 0;
        this.displaySpeed = 0;
        this.lastSampleTime = performance.now();
        this.sustainedCount = 0;
        this.lastRawSpeed = 0;
    }

    // Process raw network measurement sample
    pushRawSample(rawSpeed) {
        if (typeof rawSpeed !== 'number' || isNaN(rawSpeed) || rawSpeed < 0) return;

        this.rawSamples.push(rawSpeed);
        if (this.rawSamples.length > this.config.rollingWindowSize) {
            this.rawSamples.shift();
        }

        // Detect sustained trend vs transient spike
        if (Math.abs(rawSpeed - this.lastRawSpeed) > 10) {
            this.sustainedCount++;
        } else {
            this.sustainedCount = Math.max(0, this.sustainedCount - 1);
        }
        this.lastRawSpeed = rawSpeed;

        // Outlier Protection & Rolling Target Calculation
        const sorted = [...this.rawSamples].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];

        // Filter out extreme spikes if not sustained
        const filtered = this.rawSamples.filter(s => {
            if (this.sustainedCount >= 3) return true; // Sustained trend accepted
            const ratio = s / Math.max(1, median);
            return ratio <= this.config.outlierThreshold && ratio >= (1 / this.config.outlierThreshold);
        });

        const activeSet = filtered.length > 0 ? filtered : sorted;
        
        // Weighted Moving Average (newer samples weighted higher)
        let totalWeight = 0;
        let weightedSum = 0;
        activeSet.forEach((val, idx) => {
            const weight = idx + 1;
            weightedSum += val * weight;
            totalWeight += weight;
        });

        this.targetSpeed = Math.max(0, weightedSum / Math.max(1, totalWeight));
    }

    // 60 FPS Animation Frame Step
    step(dtMs = 16.6) {
        const delta = this.targetSpeed - this.displaySpeed;
        const absDelta = Math.abs(delta);

        // Adaptive smoothing factor based on velocity
        let factor = this.config.baseFactor;
        if (absDelta > 40) {
            factor = this.config.fastFactor; // Accelerate on large real changes
        } else if (absDelta > 15) {
            factor = (this.config.baseFactor + this.config.fastFactor) / 2;
        }

        // Apply Frame Time Compensation
        const frameAdjustedFactor = 1 - Math.pow(1 - factor, dtMs / 16.6);
        this.displaySpeed += delta * frameAdjustedFactor;

        if (Math.abs(this.targetSpeed - this.displaySpeed) < 0.02) {
            this.displaySpeed = this.targetSpeed;
        }

        return this.displaySpeed;
    }

    // Force smooth transition to final result on test completion
    animateToFinal(finalMbps, durationMs = 400, onFrame, onComplete) {
        const startVal = this.displaySpeed;
        const startTime = performance.now();

        function animateFrame(now) {
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / durationMs);

            // Ease-Out Cubic Curve
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentVal = startVal + (finalMbps - startVal) * easeOut;

            if (onFrame) onFrame(currentVal);

            if (progress < 1) {
                requestAnimationFrame(animateFrame);
            } else {
                if (onFrame) onFrame(finalMbps);
                if (onComplete) onComplete();
            }
        }

        requestAnimationFrame(animateFrame);
    }
}
