const keys = require('./keys');
const redis = require('redis');

const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  // Tell Redis client to attempt to auto reconnect
  // once every 1000ms
  retry_strategy: () => 1000,
});
// Making a duplicate of Redis client
// Used to listen to events
const sub = redisClient.duplicate();

// Classic solution to fibonacci sequence
// Using reccursive solution because very slow
// So gives us a better solution to have a
// second process to calculate fibonacci values
function fib(index) {
  if (index < 2) return 1;
  return fib(index - 1) + fib(index - 2);
}

sub.on('message', (channel, message) => {
  // The 'message' value is the index
  // hset - insert fib value into a hash called 'values'
  // where the key is the 'message' value or index
  redisClient.hset('values', message, fib(parseInt(message)));
});
// Subscribe to the 'insert' event (whenever someone inserts a value into redis)
sub.subscribe('insert');
