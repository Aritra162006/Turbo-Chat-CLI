// dotenv must load first, because db.js reads DATABASE_URL as soon as it is imported.
import 'dotenv/config';
import { createServer } from 'node:http';
import { app } from './app.js';
import { attachSocket } from './socket.js';

const port = process.env.PORT ?? 3000;
const httpServer = createServer(app);
attachSocket(httpServer);
httpServer.listen(port, () => console.log(`Server on http://localhost:${port}`));
