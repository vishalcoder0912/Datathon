/**
 * @fileoverview Main entry point for the InsightFlow Backend API Service.
 * Orchestrates server creation, environment configuration loading, request logging initialization,
 * and global process level error handling.
 * 
 * @module backend/index
 */

import { createHttpServer, startServer } from './core/server.js';
import { logStartup } from './middleware/request-logger.js';
import config from './config/environment.js';

/**
 * Initializes and starts the InsightFlow HTTP server instance.
 * Logs application startup information, binds to configured port,
 * and handles fatal startup exceptions.
 * 
 * @async
 * @function main
 * @returns {Promise<void>} Resolves when the server has successfully bound and started.
 * @throws {Error} Terminates process with exit code 1 if server fails to start.
 */
async function main() {
  try {
    // Log startup information
    logStartup();
    
    // Create and start the HTTP server
    const server = createHttpServer();
    await startServer(server, config.server.port);
    
    console.log('🎉 InsightFlow API started successfully!');
    
  } catch (error) {
    console.error('💥 Fatal error during startup:', error);
    process.exit(1);
  }
}

/**
 * Global handler for uncaught synchronous exceptions.
 * Logs error payload and forces process exit to prevent undefined state execution.
 */
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

/**
 * Global handler for unhandled asynchronous promise rejections.
 * Logs target promise and rejection reason before terminating process.
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main();

