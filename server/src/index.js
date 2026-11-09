import dotenv from 'dotenv';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import { createApp } from './app.js';
import dns from 'node:dns'
dotenv.config({ path: '../.env' });
dotenv.config();

dns.setServers([
  '8.8.8.8',
  '[2001:4860:4860::8888]',
  '8.8.8.8:1053',
  '[2001:4860:4860::8888]:1053',
]);

const { MONGODB_URI, SESSION_SECRET, CLIENT_ORIGIN, NODE_ENV, PORT = 4000 } = process.env;
if (!MONGODB_URI || !SESSION_SECRET || SESSION_SECRET.length < 32 || !CLIENT_ORIGIN) throw new Error('Set MONGODB_URI, CLIENT_ORIGIN and a SESSION_SECRET of at least 32 characters');
if (NODE_ENV === 'production' && !CLIENT_ORIGIN.startsWith('https://')) throw new Error('CLIENT_ORIGIN must use HTTPS in production');
await mongoose.connect(MONGODB_URI);
// Wait for unique indexes before accepting requests, including on a fresh database.
await Promise.all(Object.values(mongoose.models).map(model => model.init()));
const store = MongoStore.create({ client: mongoose.connection.getClient(), dbName: mongoose.connection.name, collectionName: 'sessions', ttl: 7 * 24 * 60 * 60 });
const app = createApp({ store, secret: SESSION_SECRET, clientOrigin: CLIENT_ORIGIN, production: NODE_ENV === 'production' });
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
