#!/usr/bin/env node

/**
 * Kill process using port 3001
 * Run: node kill-port.js
 */

import { exec } from "child_process";
import { platform } from "os";

const port = 3001;

console.log(`🔍 Attempting to kill process on port ${port}...\n`);

if (platform() === "win32") {
  exec(
    `netstat -ano | findstr :${port}`,
    (err, stdout) => {
      if (err || !stdout) {
        console.log(`✅ No process found on port ${port}`);
        return;
      }

      const lines = stdout.trim().split('\n');
      if (lines.length > 0) {
        const firstLine = lines[0].trim().split(/\s+/);
        const pid = firstLine[4];
        if (pid && pid !== '0') {
          console.log(`Found PID: ${pid}`);
          exec(`taskkill /PID ${pid} /F`, (err, stdout) => {
            if (err) {
              console.error(`❌ Failed to kill process: ${err.message}`);
            } else {
              console.log(`✅ Process killed successfully`);
              console.log(`💡 You can now start the server: npm run dev\n`);
            }
          });
        }
      }
    }
  );
} else {
  exec(
    `lsof -i :${port} | grep LISTEN | awk '{print $2}'`,
    (err, stdout) => {
      if (err || !stdout) {
        console.log(`✅ No process found on port ${port}`);
        return;
      }

      const pid = stdout.trim();
      if (pid) {
        console.log(`Found PID: ${pid}`);
        exec(`kill -9 ${pid}`, (err) => {
          if (err) {
            console.error(`❌ Failed to kill process: ${err.message}`);
          } else {
            console.log(`✅ Process killed successfully`);
            console.log(`💡 You can now start the server: npm run dev\n`);
          }
        });
      }
    }
  );
}
