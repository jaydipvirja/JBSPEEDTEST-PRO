// Network Detection Module - Mobile Profile & Change/Visibility Listener

export const NETWORK_PROFILES = {
    MOBILE: {
        type: 'Mobile Data',
        warmupMs: 1000,
        minDurationMs: 6000,
        maxDurationMs: 10000,
        initialConnections: 4,
        maxConnections: 8,
        stabilityThreshold: 35,
        maxTestDataMB: 100
    },
    WIFI: {
        type: 'Wi-Fi',
        warmupMs: 1000,
        minDurationMs: 5000,
        maxDurationMs: 8000,
        initialConnections: 6,
        maxConnections: 8,
        stabilityThreshold: 45,
        maxTestDataMB: 300
    },
    ETHERNET: {
        type: 'Ethernet',
        warmupMs: 1000,
        minDurationMs: 5000,
        maxDurationMs: 8000,
        initialConnections: 6,
        maxConnections: 8,
        stabilityThreshold: 50,
        maxTestDataMB: 500
    }
};

export function detectConnection() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (!conn) {
        return {
            connectionType: 'Detected automatically / unavailable',
            effectiveType: 'Unknown',
            rawType: 'unavailable',
            isMobile: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768,
            saveData: false,
            metaAvailable: false,
            profile: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? NETWORK_PROFILES.MOBILE : NETWORK_PROFILES.WIFI
        };
    }

    const type = (conn.type || '').toLowerCase();
    const effectiveType = (conn.effectiveType || '').toUpperCase();
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;

    let classifiedType = 'Unknown';
    let profile = NETWORK_PROFILES.WIFI;

    if (type === 'wifi') {
        classifiedType = 'Wi-Fi';
        profile = NETWORK_PROFILES.WIFI;
    } else if (type === 'cellular' || type === 'cellular2g' || type === 'cellular3g' || type === 'cellular4g' || type === 'cellular5g') {
        classifiedType = 'Mobile Data';
        profile = NETWORK_PROFILES.MOBILE;
    } else if (type === 'ethernet') {
        classifiedType = 'Ethernet';
        profile = NETWORK_PROFILES.ETHERNET;
    } else {
        if (isMobileDevice) {
            classifiedType = 'Mobile Data';
            profile = NETWORK_PROFILES.MOBILE;
        } else {
            classifiedType = 'Wi-Fi';
            profile = NETWORK_PROFILES.WIFI;
        }
    }

    console.log('[MobileDataDebug] Network Detection:', {
        classifiedType,
        effectiveType,
        saveData: !!conn.saveData,
        profile
    });

    return {
        connectionType: classifiedType,
        effectiveType: effectiveType || (isMobileDevice ? '4G/LTE' : 'Broadband'),
        rawType: type || 'unknown',
        isMobile: isMobileDevice,
        saveData: !!conn.saveData,
        metaAvailable: true,
        profile
    };
}

export function listenToNetworkChanges(onNetworkChangeCallback, onVisibilityChangeCallback) {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const handleConnectionChange = () => {
        const info = detectConnection();
        console.log('[MobileDataDebug] Network Change Event Fired:', info);
        onNetworkChangeCallback(info);
    };

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden' && onVisibilityChangeCallback) {
            console.log('[MobileDataDebug] Page Visibility Hidden during test.');
            onVisibilityChangeCallback('Keep this page open while testing.');
        }
    };

    if (conn && conn.addEventListener) {
        conn.addEventListener('change', handleConnectionChange);
    }

    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        if (conn && conn.removeEventListener) {
            conn.removeEventListener('change', handleConnectionChange);
        }
        window.removeEventListener('online', handleConnectionChange);
        window.removeEventListener('offline', handleConnectionChange);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
}
