import { createApp } from './app.js';

const port = Number(process.env.PORT) || 4000;
const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim());

createApp({ corsOrigin }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
