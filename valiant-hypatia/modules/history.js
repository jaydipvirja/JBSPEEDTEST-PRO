// History Module - LocalStorage History Persistence & Filter Engine

const HISTORY_STORAGE_KEY = 'speedtest_pro_history_v2';

export function saveTestRecord(record) {
    const history = getTestHistory('all');
    const newRecord = {
        id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString('en-GB'),
        timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        download: record.download || 0,
        upload: record.upload || 0,
        ping: record.ping || 0,
        jitter: record.jitter || 0,
        packetLoss: record.packetLoss || '0%',
        loadedLatencyDown: record.loadedLatencyDown || 0,
        loadedLatencyUp: record.loadedLatencyUp || 0,
        connectionType: record.connectionType || 'Wi-Fi',
        effectiveType: record.effectiveType || '4G',
        server: record.server || 'Auto Server',
        isp: record.isp || 'Broadband / Wi-Fi',
        stability: record.stability || 'Stable',
        qualityScore: record.qualityScore || 90
    };

    history.unshift(newRecord);
    
    // Limit to latest 100 entries
    if (history.length > 100) history.pop();

    try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
        console.error('Failed to save test record to LocalStorage:', e);
    }

    return newRecord;
}

export function getTestHistory(timeRange = 'all') {
    let history = [];
    try {
        const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (stored) history = JSON.parse(stored);
    } catch (e) {
        console.error('Failed to read test history:', e);
    }

    if (timeRange === 'all') return history;

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (timeRange === 'today') {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        return history.filter(r => r.timestamp >= todayStart);
    }

    if (timeRange === '7days') {
        return history.filter(r => r.timestamp >= now - (7 * oneDay));
    }

    if (timeRange === '30days') {
        return history.filter(r => r.timestamp >= now - (30 * oneDay));
    }

    return history;
}

export function clearTestHistory() {
    try {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (e) {}
}
