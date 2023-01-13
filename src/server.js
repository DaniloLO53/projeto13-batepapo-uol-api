import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { messageSchema, participantSchema } from '../schemas/schemas.js'
import dayjs from 'dayjs';

dotenv.config();

// MONGO
const URL_MONGO = process.env.DATABASE_URL;
const mongoClient = new MongoClient(URL_MONGO);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db();
} catch (error) {
  console.log('Can\'t connect to mongo');
}

// SERVER
const PORT = 5000;
const server = express();

server.use(express.json());
server.use(cors());

server.post('/participants', async (request, response) => {
  const data = request.body;
  const { name } = data;

  try {
    const participant = await participantSchema.validateAsync(data);
    const alreadyExist = await db.collection('participants').findOne(participant);

    if (alreadyExist) return response.status(409).send('Already signed up');

    await db.collection('participants').insertOne({
      name,
      lastStatus: Date.now(),
    });

    response.sendStatus(201);
  } catch (error) {
    console.log('Erro');

    if (error.isJoi) return response.sendStatus(422);
    return response.sendStatus(500);
  }
});

server.get('/participants', async (request, response) => {
  try {
    const participants = await db.collection('participants').findMany().toArray();
    response.status(200).send(participants);
  } catch (error) {
    response.sendStatus(500);
  }
});

server.post('/messages', async (request, response) => {
  const data = request.body;
  const { user } = request.headers;
  const { to, text, type } = data;

  try {
    const message = messageSchema.validateAsync(data);
    const isParticipant = await db.collection('participants').findOne({ name: user });

    if (!isParticipant) return response.status(422);

    const finalMessageFormat = {
      ...message,
      from: user,
      time: dayjs(Date.now()).format('HH:mm:ss'),
    };

    await db.collection('participants').insertOne(finalMessageFormat);

    response.sendStatus(201);
  } catch (error) {
    console.log('Erro');

    if (error.isJoi) return response.sendStatus(422);
    return response.sendStatus(500);
  }
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
