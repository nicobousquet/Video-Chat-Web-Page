const HTTPS_PORT = 8443;

const fs = require('fs');           //https://nodejs.org/api/fs.html
const https = require('https');     //https://nodejs.org/api/https.html
const WebSocket = require('ws');    //https://github.com/websockets/ws
const WebSocketServer = WebSocket.Server;


const serverConfig = {
    // TODO: Add options for TLS support
    key: fs.readFileSync('server/tls/key.pem'),
    cert: fs.readFileSync('server/tls/cert.pem')
};

// ----------------------------------------------------------------------------------------

// Create a web server for serving the client html page
const httpsServer = https.createServer(serverConfig, (request, response) => {
    console.log('request received: ' + request.url);

    if (request.url === '/') {
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.end(fs.readFileSync('client/index.html'));
    } else if (request.url === '/webrtc.js') {
        response.writeHead(200, {'Content-Type': 'application/javascript'});
        response.end(fs.readFileSync('client/webrtc.js'));
    }
}).listen(HTTPS_PORT);

// ----------------------------------------------------------------------------------------

// Create a Websocket server for signaling
const wss = new WebSocketServer({server: httpsServer});

wss.on('connection', function (ws) {
    ws.on('message', function (message) {
        console.log('received: %s', message);

        //TODO: Broadcast received messages to all clients
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});


console.log('Server running. \nUse HTTPS not HTTP! Accept TLS certificates\n');
