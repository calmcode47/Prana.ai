const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaultEnhanceMiddleware = config.server.enhanceMiddleware;

/**
 * Expo tunnels expose Metro's port only. Proxying this dedicated path through
 * Metro makes the real backend reachable over that same tunnel without a
 * second public tunnel or an invented localhost URL on the phone.
 */
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const metroMiddleware = defaultEnhanceMiddleware
    ? defaultEnhanceMiddleware(middleware, metroServer)
    : middleware;

  return (request, response, next) => {
    const requestUrl = request.url || '/';
    if (requestUrl !== '/prana-api' && !requestUrl.startsWith('/prana-api/')) {
      return metroMiddleware(request, response, next);
    }

    const backendPath = requestUrl.slice('/prana-api'.length) || '/';
    const headers = {
      ...request.headers,
      host: request.headers.host || '127.0.0.1:8000',
      'x-forwarded-prefix': '/prana-api',
      'x-forwarded-proto': request.headers['x-forwarded-proto'] || 'https',
    };
    const proxyRequest = http.request({
      hostname: '127.0.0.1',
      port: 8000,
      method: request.method,
      path: backendPath,
      headers,
    }, (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
      proxyResponse.pipe(response);
    });

    proxyRequest.on('error', () => {
      if (!response.headersSent) {
        response.writeHead(502, { 'content-type': 'application/json' });
      }
      response.end(JSON.stringify({ detail: 'PRANA backend is unavailable' }));
    });
    request.pipe(proxyRequest);
  };
};

module.exports = config;
