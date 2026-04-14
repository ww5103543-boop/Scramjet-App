const http = require("http");
const fs = require("fs");
const path = require("path");
const cluster = require("cluster");
const os = require("os");

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

if (cluster.isMaster) {
    const numCPUs = Math.min(os.cpus().length, 4); // Use up to 4 cores
    console.log(`Master ${process.pid} setting up ${numCPUs} workers`);
    
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    
    cluster.on("exit", (worker) => {
        console.log(`Worker ${worker.process.pid} died, restarting...`);
        cluster.fork();
    });
} else {
    const mimeTypes = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".wasm": "application/wasm",
        ".map": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
    };
    
    const server = http.createServer((req, res) => {
        let urlPath = req.url.split("?")[0];
        if (urlPath === "/") urlPath = "/index.html";
        if (urlPath === "/games") urlPath = "/games.html";
        
        const rootAttempt = path.join(__dirname, urlPath);
        const lithiumAttempt = path.join(__dirname, "lithium-js", urlPath);
        
        function serveFile(filePath) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || "application/octet-stream";
            const headers = { 
                "Content-Type": contentType,
                
                "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600"
            };
            if (ext === ".html") {
                headers["X-Frame-Options"] = "ALLOWALL";
                headers["Content-Security-Policy"] = "frame-ancestors *";
            }
            res.writeHead(200, headers);
            fs.createReadStream(filePath).pipe(res);
        }
        
        if (fs.existsSync(rootAttempt) && fs.statSync(rootAttempt).isFile()) {
            serveFile(rootAttempt);
        } else if (fs.existsSync(lithiumAttempt) && fs.statSync(lithiumAttempt).isFile()) {
            serveFile(lithiumAttempt);
        } else {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not found: " + urlPath);
        }
    });
    
    server.listen(PORT, HOST, () => {
        console.log(`Worker ${process.pid} running on http://${HOST}:${PORT}`);
    });
}
