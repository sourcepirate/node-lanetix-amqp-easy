- [`Create(amqpUrl)`](#createamqpurl-socketoptions---amqp)
- [`AMQP.consume(config, handler)`](#amqpconsumeconfig-handler---cancellationpromise)
- [`AMQP.publish(config, key, message, [options])`](#amqppublishconfig-key-message-options---promise)
- [`AMQP.sendToQueue(config, message, [options])`](#amqpsendtoqueueconfig-message-options---promise)
- [`AMQP.connect()`](#amqpconnect---promise)
- [`Config`](#config)

### `Create(amqpUrl, [socketOptions])` -> `AMQP`
Create an `AMQP` which connects to `amqpUrl`. E.g.,
```javascript
var amqp = require('amqplib-easy')('amqp://guest:guest@localhost');
```

[`socketOptions`](http://www.squaremobius.net/amqp.node/channel_api.html#connect)
default to `maxChannels: 100`.

### `AMQP.consume(config, handler)` -> `CancellationPromise`
Asserts queue and exchange specified in [`config`](#config) and binds them
(exchange is optional). Then a consumer is created to consume messages in the
asserted queue.

A `CancellationPromise` is returned. This promise resolves to a function which,
when called, will cancel the consumer, preventing further messages from being
received.

### `AMQP.publish(config, key, message, [options])` -> `Promise`
Asserts exchange specified in [`config`](#config). Then publishes `message` to
that exchange with routing key, `key` and `options` (if they exist) as in
[amqplib](http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish).
If message is a `Buffer`, it is sent as is, otherwise, it is serialized to JSON
and sent.

### `AMQP.sendToQueue(config, message, [options])` -> `Promise`
Asserts queue specified in [`config`](#config). Then sends `message` to that
queue with `options` (if they exist) as in
[amqplib](http://www.squaremobius.net/amqp.node/channel_api.html#channel_sendToQueue).
If message is a `Buffer`, it is sent as is, otherwise, it is serialized to JSON
and sent.

### `AMQP.connect()` -> `Promise`
Returns [`amqplib` connection]
(http://www.squaremobius.net/amqp.node/channel_api.html#models)
for handling use cases not covered by this library, e.g., deleting queues.

### `AMQP.close()` --> `Promise`
Close the `AMQP` and delete its `connection` & `sendChannel` without affecting others. E.g.,
```javascript
var amqp = require('amqplib-easy');
var connection = amqplib('amqp://guest:guest@localhost:1337');

conneciton.close();
```
See above at [`closeConnection`](#closeconnectionamqpurl---promise).

### `Config`
Recognized properties follow
- `exchange`: (string) name of the exchange to be used
- `exchangeOptions`: (object) of options supported by
  [amqplib](http://www.squaremobius.net/amqp.node/channel_api.html#channel_assertExchange).
  Defaults to `{ durable: true }`
- `exchangeType`: (string)
  [type](https://www.rabbitmq.com/tutorials/amqp-concepts.html#exchanges) of
  the exchange. Defaults to `'topic'`
- `messageOptions`: (object) of options supported by
  [amqplib](http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish).
  Defaults to an empty object
- `parse`: (function) parse string content of message. Defaults to `JSON.parse`
- `prefetch`: (number) of messages to fetch when consuming. Defaults to `1`
- `arguments`: (object) containing any binding arguments for the queue. Defaults to `{}`
- `queue`: (string) name of the queue to use
- `queueOptions`: (object) of options supported by
  [amqplib](http://www.squaremobius.net/amqp.node/channel_api.html#channel_assertQueue).
  Defaults to `{ durable: true }`
- `topics`: (array of strings) topics to bind to the queue from the exchange.
  Only for `topic` exchanges.
- `retry`: (boolean or object) if false, disable retry via
  [amqplib-retry](https://www.npmjs.com/package/amqplib-retry). Defaults to true, but an object with properties that follow may be specified to customize the behavior of the retry.
  -  `failQueue` can also be specified to override the name of the queue used to hold failed messages.
  -  `delay` a function which accepts the number of attempts as an argument and returns a number of milliseconds to indicate how long to wait before retrying. If `-1` is returned, the message will be put into the failure queue.
