import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { participantSchema } from '../schemas/schemas.js'

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
    const participant = participantSchema.validateAsync(data);
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

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
