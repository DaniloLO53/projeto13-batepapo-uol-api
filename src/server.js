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
    const participants = await db.collection('participants').find().toArray();
    return response.status(200).send(participants);

  } catch (error) {
    return response.status(500).send('ERRO');
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

    return response.sendStatus(201);
  } catch (error) {
    console.log('Erro');

    if (error.isJoi) return response.sendStatus(422);
    return response.sendStatus(500);
  }
});

server.get('/messages', async (request, response) => {
  const { limit } = request.query;
  const { user } = request.headers;

  try {
    const messages = await db.collection('messages').find({
      $or: [
        {
          type: 'public'
        },
        {
          type: 'status'
        },
        {
          to: user,
          type: 'private'
        },
        {
          type: 'private',
          from: user
        }
      ]
    }).toArray();

    if (limit) {
      if (Number(limit) < 1 || isNaN(Number(limit))) return response.sendStatus(422);

      return response.send([...messages].slice(-Number(limit)).reverse());
    }

    return response.send([...messages].reverse());

  } catch (err) {
    console.log(err)

    return response.sendStatus(500)
  }
});

server.post('/status', async (request, response) => {
  const { user } = request.headers;

  const participantSignedUp = await db.collection('participants').findOne({ name: user });
  if (!participantSignedUp) return response.sendStatus(404);

  await db.collection('participants').updateOne({ name: user }, { $set: { lastStatus: Date.now() } });

  return response.sendStatus(200);
});

function removeInactives() {
  const TIME_LIMIT = 10000 // * in milliseconds

  setInterval(async () => {
    const deltaTime = Date.now() - TIME_LIMIT

    try {
      const participants = await db.collection('participants').find().toArray()

      participants.forEach(async ({ lastStatus, name, _id }) => {

        if (lastStatus < deltaTime) {
          await db.collection('participants').deleteOne({ _id: ObjectId(_id) })

          await db.collection('messages').insertOne({
            from: name,
            to: 'Todos',
            text: 'sai da sala...',
            type: 'status',
            time: dayjs(Date.now()).format('HH:mm:ss')
          })
        }
      })

    } catch (err) {
      console.log('Erro')
    }

  }, TIME_LIMIT)
}
removeInactives();

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
