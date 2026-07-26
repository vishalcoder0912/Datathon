// Health check endpoints
import { sendHealth, sendSuccess } from '../utils/response-utils.js';
import { HTTP_STATUS } from '../config/constants.js';

export async function handleHealthRoutes(request, response, pathname) {
  const { method } = request;

  // GET /api/health - Main health check
  if (pathname === '/api/health' && method === 'GET') {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };

    sendHealth(response, 'healthy', healthData);
    return true;
  }

  // GET /api/health/detailed - Detailed health check
  if (pathname === '/api/health/detailed' && method === 'GET') {
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      
      // System information
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      },
      
      // Memory usage
      memory: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
        external: process.memoryUsage().external,
        arrayBuffers: process.memoryUsage().arrayBuffers
      },
      
      // CPU usage
      cpu: {
        user: process.cpuUsage().user,
        system: process.cpuUsage().system
      },
      
      // Event loop lag
      eventLoop: {
        lag: getEventLoopLag()
      },
      
      // Process info
      process: {
        title: process.title,
        execPath: process.execPath,
        execArgv: process.execArgv,
        argv: process.argv
      }
    };

    sendHealth(response, 'healthy', detailedHealth);
    return true;
  }

  // GET /api/health/ping - Simple ping
  if (pathname === '/api/health/ping' && method === 'GET') {
    sendSuccess(response, { 
      pong: true, 
      timestamp: new Date().toISOString() 
    }, 'Pong');
    return true;
  }

  // GET /api/health/ready - Readiness probe
  if (pathname === '/api/health/ready' && method === 'GET') {
    // Check if all critical services are ready
    const isReady = await checkReadiness();
    
    if (isReady.ready) {
      sendHealth(response, 'healthy', isReady);
    } else {
      sendHealth(response, 'unhealthy', isReady);
    }
    return true;
  }

  // GET /api/health/live - Liveness probe
  if (pathname === '/api/health/live' && method === 'GET') {
    // Basic liveness check - process is responsive
    sendHealth(response, 'healthy', {
      live: true,
      timestamp: new Date().toISOString()
    });
    return true;
  }

  return false;
}

/**
 * Get event loop lag in milliseconds
 */
function getEventLoopLag() {
  const start = process.hrtime.bigint();
  return setImmediate(() => {
    const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
    return lag;
  });
}

/**
 * Check if the application is ready to serve traffic
 */
async function checkReadiness() {
  const checks = {
    database: false,
    aiProviders: false,
    fileSystem: false,
    memory: false
  };

  // Check file system access
  try {
    const fs = require('fs');
    fs.accessSync('./data', fs.constants.R_OK | fs.constants.W_OK);
    checks.fileSystem = true;
  } catch (error) {
    console.warn('File system check failed:', error.message);
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  checks.memory = memoryUsagePercent < 90; // Less than 90% memory usage

  // Check database (placeholder - would implement actual DB check)
  checks.database = true; // Placeholder

  // Check AI providers (placeholder - would check actual providers)
  checks.aiProviders = true; // Placeholder

  const allChecksPass = Object.values(checks).every(check => check === true);

  return {
    ready: allChecksPass,
    checks,
    timestamp: new Date().toISOString()
  };
}

export default {
  handleHealthRoutes
};
