- [`Create(amqpUrl)`](#createamqpurl---amqp)
- [`AMQP.consume(config, handler)`](#amqp-consumeconfig-handler---cancellationpromise)
- [`AMQP.publish(config, message)`](#amqp-publishconfig-handler---promise)
- [`AMQP.sendToQueue(config, message)`](#amqp-sendtoqueueconfig-message---promise)
- [`AMQP.connect()`](#amqp-connect---promise)
- [`Config`](#config)

### `Create(amqpUrl)` -> `AMQP`
Create an `AMQP` which connects to `amqpUrl`. E.g.,
```javascript
var amqp = require('amqplib-easy')('amqp://guest:guest@localhost');
```

### `AMQP.consume(config, handler)` -> `CancellationPromise`
Asserts queue and exchange specified in [`config`](#config) and binds them
(exchange is optional). Then a consumer is created to consume messages in the
asserted queue.

A `CancellationPromise` is returned. This promise resolves to a function which,
when called, will cancel the consumer, preventing further messages from being
received.

### `AMQP.publish(config, message)` -> `Promise`
Asserts exchange specified in [`config`](#config). Then publishes `message` to
that exchange.

### `AMQP.sendToQueue(config, message)` -> `Promise`
Asserts queue specified in [`config`](#config). Then sends `message` to that
queue.

### `AMQP.connect()` -> `Promise`
Returns [`amqplib` connection]
(http://www.squaremobius.net/amqp.node/doc/channel_api.html#toc_11)
for handling use cases not covered by this library, e.g., deleting queues.

### `Config`
Recognized properties follow
- `exchange`: (string) name of the exchange to be used
- `exchangeOptions`: (object) of options supported by
  [amqplib](http://www.squaremobius.net/amqp.node/doc/channel_api.html#toc_45).
  Defaults to `{ durable: true }`
- `exchangeType`: (string)
  [type](https://www.rabbitmq.com/tutorials/amqp-concepts.html#exchanges) of
  the exchange
- `prefetch`: (number) of messages to fetch when consuming
- `queue`: (string) name of the queue to use
- `queueOptions`: (object) of options supported by
  [amqplib](http://www.squaremobius.net/amqp.node/doc/channel_api.html#toc_27).
  Defaults to `{ durable: true }`
- `retry`: (boolean or object) if false, disable retry via
  [amqplib-retry](https://www.npmjs.com/package/amqplib-retry). An object with
  `failQueue` can also be specified to override the fail queue. Defaults to
  true.
