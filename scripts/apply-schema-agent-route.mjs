import fs from 'node:fs/promises';

const file = 'apps/backend/src/routes/index.js';
let code = await fs.readFile(file, 'utf8');

if (!code.includes("handleSchemaAgentRoutes")) {
  code = code.replace(
    /(import .+;\n)/,
    `$1import { handleSchemaAgentRoutes } from './schema-agent.js';\n`
  );

  code = code.replace(
    /(async function setupRoutes[^{]+{)/,
    `$1\n  if (await handleSchemaAgentRoutes(request, response, pathname)) return;\n`
  );

  await fs.writeFile(file, code, 'utf8');
  console.log('Schema agent route inserted.');
} else {
  console.log('Schema agent route already exists.');
}
