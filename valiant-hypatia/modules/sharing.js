// Sharing Module - Clean Share Result Image Generator & Formatted Text Exporter

export function generateShareText(result) {
    const dateStr = new Date().toLocaleDateString('en-GB');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `🚀 SpeedTest Pro Results (${dateStr} ${timeStr})

📥 Download: ${result.download} Mbps
📤 Upload: ${result.upload} Mbps
⚡ Latency: ${result.ping} ms
📈 Jitter: ${result.jitter} ms
📉 Packet Loss: ${result.packetLoss}

📶 Connection: ${result.connectionType} (${result.effectiveType})
📍 Server: ${result.server}
🏆 Quality Score: ${result.qualityScore}/100 (${result.stability})
Test your speed: ${window.location.origin}`;
}

export function generateShareCardCanvas(result) {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 600, 360);
    bgGrad.addColorStop(0, '#0B0F17');
    bgGrad.addColorStop(1, '#1A2236');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 600, 360);

    // Accent Border Glow
    ctx.strokeStyle = '#00F2FE';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 580, 340);

    // Title Header
    ctx.font = 'bold 22px Outfit, sans-serif';
    ctx.fillStyle = '#00F2FE';
    ctx.fillText('SPEEDTEST PRO - RESULT CARD', 30, 45);

    ctx.font = '13px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(`${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 420, 45);

    // Divider Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 65);
    ctx.lineTo(570, 65);
    ctx.stroke();

    // Metrics Columns
    // 1. Download
    ctx.font = '12px Outfit, sans-serif';
    ctx.fillStyle = '#A0AEC0';
    ctx.fillText('DOWNLOAD', 30, 100);

    ctx.font = 'bold 36px Outfit, sans-serif';
    ctx.fillStyle = '#00F2FE';
    ctx.fillText(`${result.download}`, 30, 140);
    ctx.font = '14px Outfit, sans-serif';
    ctx.fillText('Mbps', 180, 140);

    // 2. Upload
    ctx.font = '12px Outfit, sans-serif';
    ctx.fillStyle = '#A0AEC0';
    ctx.fillText('UPLOAD', 300, 100);

    ctx.font = 'bold 36px Outfit, sans-serif';
    ctx.fillStyle = '#9D4EDD';
    ctx.fillText(`${result.upload}`, 300, 140);
    ctx.font = '14px Outfit, sans-serif';
    ctx.fillText('Mbps', 450, 140);

    // 3. Ping & Jitter Row
    ctx.font = '12px Outfit, sans-serif';
    ctx.fillStyle = '#A0AEC0';
    ctx.fillText('LATENCY', 30, 190);
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${result.ping} ms`, 30, 220);

    ctx.font = '12px Outfit, sans-serif';
    ctx.fillStyle = '#A0AEC0';
    ctx.fillText('JITTER', 160, 190);
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${result.jitter} ms`, 160, 220);

    ctx.font = '12px Outfit, sans-serif';
    ctx.fillStyle = '#A0AEC0';
    ctx.fillText('PACKET LOSS', 300, 190);
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${result.packetLoss}`, 300, 220);

    ctx.font = '12px Outfit, sans-serif';
    ctx.fillStyle = '#A0AEC0';
    ctx.fillText('SCORE', 450, 190);
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.fillStyle = '#38EF7D';
    ctx.fillText(`${result.qualityScore}/100`, 450, 220);

    // Footer Metadata Box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(30, 260, 540, 70);

    ctx.font = '13px Outfit, sans-serif';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(`Connection: ${result.connectionType} (${result.effectiveType})`, 45, 288);
    ctx.fillText(`Server: ${result.server}`, 45, 312);

    ctx.fillText(`ISP: ${result.isp}`, 320, 288);
    ctx.fillText(`Stability: ${result.stability}`, 320, 312);

    return canvas.toDataURL('image/png');
}
