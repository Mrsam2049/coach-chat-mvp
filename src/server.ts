import { createApp } from './app.js';
import { ENV } from './config/env.js';

const app = createApp();
app.listen(ENV.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${ENV.PORT}`);
});
