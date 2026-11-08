// dotenv must load first, because db.js reads DATABASE_URL as soon as it is imported.
import 'dotenv/config';
import { app } from './app.js';

const port = process.env.PORT ?? 3000;
app.listen(port, () => console.log(`Server on http://localhost:${port}`));
