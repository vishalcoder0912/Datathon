// New entry point with organized structure
import { createHttpServer, startServer } from './core/server.js';
import { logStartup } from './middleware/request-logger.js';
import config from './config/environment.js';

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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main();
