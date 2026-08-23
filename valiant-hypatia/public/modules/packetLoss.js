// Packet Loss Module - Lightweight Probe Loss Estimator with "Unavailable" Browser Fallback

export async function measurePacketLoss(endpointUrl, probesCount = 12, signal = null) {
    let sent = 0;
    let received = 0;

    for (let i = 0; i < probesCount; i++) {
        if (signal && signal.aborted) break;
        sent++;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            const sep = endpointUrl.includes('?') ? '&' : '?';
            const res = await fetch(`${endpointUrl}${sep}_pl=${i}&_t=${Date.now()}`, { 
                cache: 'no-store', 
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                received++;
            }
        } catch (e) {
            // Failed probe
        }
        await new Promise(r => setTimeout(r, 40));
    }

    if (sent === 0 || received === 0) {
        return {
            lossPercent: null,
            displayText: 'Unavailable',
            sent: sent,
            received: received
        };
    }

    const lost = sent - received;
    const lossPercent = Math.round((lost / sent) * 100);

    return {
        lossPercent: lossPercent,
        displayText: lossPercent > 0 ? `${lossPercent}%` : '0%',
        sent: sent,
        received: received
    };
}
