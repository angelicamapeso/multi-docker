const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
// Middleware
// Cross origin resource sharing - allows us to make request
// from one domain to completely different domain
app.use(cors());
// Body parser - will parse incoming requests and turn body
// into a JSON value
app.use(bodyParser.json());

// Postgres Client Setup
// To get express application to communicate with Postgres
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgPassword,
  port: keys.pgPort,
});

pgClient.on('error', () => console.log('Lost PG connection!'));
pgClient.on('connect', (client) => {
  client
    .query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch((err) => console.error(err));
});

// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});
// We are making these duplicate connections
// because if we ever have a client that is listening
// or publishing info, we have to make a duplicate
// connection (when connection turned into something to listen
// subscribe or publish, it can't be used to do anything else)
const redisPublisher = redisClient.duplicate();

// Express Route handlers
app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * from values');
  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;
  // need to cap the index since the worker
  // could take  areally long time with larger
  // indeces
  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high!');
  }

  redisClient.hset('values', index, 'Nothing yet!');
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES ($1)', [index]);

  res.send({ working: true });
});

app.listen(5000, (err) => {
  console.log('Listening!');
});
