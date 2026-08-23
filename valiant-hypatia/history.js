// History Management & Analytics

let testHistory = [];

async function loadHistoryRecords() {
    try {
        const res = await fetch('/api/history');
        if (res.ok) {
            testHistory = await res.json();
        } else {
            throw new Error('API failed');
        }
    } catch (e) {
        const local = localStorage.getItem('speedtest_history');
        testHistory = local ? JSON.parse(local) : [];
    }
    renderHistoryTable();
    updateHistoryStats();
}

async function saveTestRecord(record) {
    testHistory.unshift(record);
    if (testHistory.length > 100) testHistory.pop();
    
    try {
        await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });
    } catch (e) {
        console.warn('Could not sync to server history, saving to localStorage');
    }

    localStorage.setItem('speedtest_history', JSON.stringify(testHistory));
    
    renderHistoryTable();
    updateHistoryStats();
}

function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    const badge = document.getElementById('historyCountBadge');
    if (!tbody) return;

    badge.innerText = `${testHistory.length} Test${testHistory.length === 1 ? '' : 's'}`;

    if (!testHistory.length) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="8">No test records yet. Run your first speed test above!</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = testHistory.map(item => {
        const dateStr = new Date(item.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const isTurbo = item.mode && item.mode.includes('TURBO');
        const modeBadgeClass = isTurbo ? 'turbo' : (item.mode === 'local' ? 'idle' : 'complete');
        const dataUsedDisplay = item.dataUsed || (isTurbo ? (item.isp.match(/\((.*?)\)/)?.[1] || '~100 MB') : '~35 MB');

        return `
            <tr>
                <td class="font-mono">${dateStr}</td>
                <td><span class="badge ${modeBadgeClass}">${item.mode || 'WAN'}</span></td>
                <td class="font-mono">${item.ping !== undefined ? item.ping + ' ms' : '--'}</td>
                <td class="font-mono highlight-cyan"><strong>${item.download !== undefined ? item.download + ' Mbps' : '--'}</strong></td>
                <td class="font-mono highlight-purple"><strong>${item.upload !== undefined ? item.upload + ' Mbps' : '--'}</strong></td>
                <td class="font-mono highlight-orange"><strong>${dataUsedDisplay}</strong></td>
                <td>${item.isp ? item.isp.replace(/\(.*?\)/, '').trim() : 'Local / Wi-Fi'}</td>
                <td><span class="rating-grade ${getGradeClass(item.rating)}">${item.rating || 'A'}</span></td>
            </tr>
        `;
    }).join('');
}

function updateHistoryStats() {
    if (!testHistory.length) {
        document.getElementById('histAvgDown').innerText = '-- Mbps';
        document.getElementById('histMaxDown').innerText = '-- Mbps';
        document.getElementById('histAvgUp').innerText = '-- Mbps';
        document.getElementById('histAvgPing').innerText = '-- ms';
        return;
    }

    const downVals = testHistory.map(h => parseFloat(h.download) || 0).filter(v => v > 0);
    const upVals = testHistory.map(h => parseFloat(h.upload) || 0).filter(v => v > 0);
    const pingVals = testHistory.map(h => parseFloat(h.ping) || 0).filter(v => v > 0);

    const avgDown = downVals.length ? (downVals.reduce((a, b) => a + b, 0) / downVals.length).toFixed(1) : '--';
    const maxDown = downVals.length ? Math.max(...downVals).toFixed(1) : '--';
    const avgUp = upVals.length ? (upVals.reduce((a, b) => a + b, 0) / upVals.length).toFixed(1) : '--';
    const avgPing = pingVals.length ? Math.round(pingVals.reduce((a, b) => a + b, 0) / pingVals.length) : '--';

    document.getElementById('histAvgDown').innerText = `${avgDown} Mbps`;
    document.getElementById('histMaxDown').innerText = `${maxDown} Mbps`;
    document.getElementById('histAvgUp').innerText = `${avgUp} Mbps`;
    document.getElementById('histAvgPing').innerText = `${avgPing} ms`;
}

function getGradeClass(grade) {
    if (!grade) return 'grade-good';
    if (grade.startsWith('A')) return 'grade-excellent';
    if (grade.startsWith('B')) return 'grade-good';
    if (grade.startsWith('C')) return 'grade-fair';
    return 'grade-poor';
}

function exportHistoryCSV() {
    if (!testHistory.length) {
        alert('No history to export.');
        return;
    }

    const headers = ['Timestamp', 'Mode', 'Ping (ms)', 'Download (Mbps)', 'Upload (Mbps)', 'Data Used (MB/GB)', 'ISP', 'Rating'];
    const rows = testHistory.map(h => [
        `"${h.timestamp || ''}"`,
        `"${h.mode || 'WAN'}"`,
        h.ping || 0,
        h.download || 0,
        h.upload || 0,
        `"${h.dataUsed || '~35 MB'}"`,
        `"${(h.isp || '').replace(/"/g, '""')}"`,
        `"${h.rating || 'A'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `speedtest_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function clearHistoryRecords() {
    if (confirm('Are you sure you want to clear all speed test history?')) {
        testHistory = [];
        localStorage.removeItem('speedtest_history');
        fetch('/api/history', { method: 'POST', body: '[]', headers: { 'Content-Type': 'application/json' } }).catch(() => {});
        renderHistoryTable();
        updateHistoryStats();
    }
}

document.addEventListener('DOMContentLoaded', loadHistoryRecords);
