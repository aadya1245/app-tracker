import { app } from './app.js';
import { env } from './config/env.js';
import { initializeSchema, verifyDatabaseConnection } from './db.js';

async function bootstrap() {
  await verifyDatabaseConnection();
  await initializeSchema();

  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start API:', error);
  process.exit(1);
});
