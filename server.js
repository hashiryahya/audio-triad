const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

let PORT = parseInt(process.env.PORT, 10) || 3000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.vtt': 'text/vtt; charset=utf-8',
    '.srt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
    // Add CORS headers for media streaming
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    filePath = decodeURIComponent(filePath);

    const extname = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        // Handle video/audio range requests for smooth seeking
        const range = req.headers.range;
        if (range && (extname === '.mp4' || extname === '.webm' || extname === '.mp3' || extname === '.wav')) {
            const fileSize = stats.size;
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': stats.size,
                'Content-Type': contentType
            });
            fs.createReadStream(filePath).pipe(res);
        }
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${PORT} in use, attempting port ${PORT + 1}...`);
        PORT += 1;
        server.listen(PORT);
    } else {
        console.error('Server error:', err);
    }
});

server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n==================================================`);
    console.log(`🚀 AudioTriad Multi-Device Audio Splitter Running!`);
    console.log(`📡 URL: ${url}`);
    console.log(`==================================================\n`);
    
    // Automatically launch browser in Windows unless --no-browser flag passed
    if (!process.argv.includes('--no-browser')) {
        const startCmd = process.platform === 'win32' ? `start ${url}` : `open ${url}`;
        exec(startCmd, (err) => {
            if (err) console.log(`Please open ${url} in your browser (Chrome/Edge recommended).`);
        });
    }
});
