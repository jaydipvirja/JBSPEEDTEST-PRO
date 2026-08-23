// Network Detection Module - Connection Classifier & Change Listener

export function detectConnection() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (!conn) {
        return {
            connectionType: 'Detected automatically / unavailable',
            effectiveType: 'Unknown',
            rawType: 'unavailable',
            isMobile: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768,
            saveData: false,
            metaAvailable: false
        };
    }

    const type = (conn.type || '').toLowerCase();
    const effectiveType = (conn.effectiveType || '').toUpperCase();
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;

    let classifiedType = 'Unknown';

    if (type === 'wifi') {
        classifiedType = 'Wi-Fi';
    } else if (type === 'cellular' || type === 'cellular2g' || type === 'cellular3g' || type === 'cellular4g' || type === 'cellular5g') {
        classifiedType = 'Mobile Data';
    } else if (type === 'ethernet') {
        classifiedType = 'Ethernet';
    } else {
        if (isMobileDevice) {
            classifiedType = 'Mobile Data';
        } else {
            classifiedType = 'Wi-Fi';
        }
    }

    return {
        connectionType: classifiedType,
        effectiveType: effectiveType || (isMobileDevice ? '4G/LTE' : 'Broadband'),
        rawType: type || 'unknown',
        isMobile: isMobileDevice,
        saveData: !!conn.saveData,
        metaAvailable: true
    };
}

export function listenToNetworkChanges(onNetworkChangeCallback) {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const handleConnectionChange = () => {
        const info = detectConnection();
        onNetworkChangeCallback(info);
    };

    if (conn && conn.addEventListener) {
        conn.addEventListener('change', handleConnectionChange);
    }

    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);

    return () => {
        if (conn && conn.removeEventListener) {
            conn.removeEventListener('change', handleConnectionChange);
        }
        window.removeEventListener('online', handleConnectionChange);
        window.removeEventListener('offline', handleConnectionChange);
    };
}
