amqplib-easy
============
[![Build Status](https://travis-ci.org/lanetix/node-lanetix-amqp-easy.svg?branch=master)](https://travis-ci.org/lanetix/node-lanetix-amqp-easy)

[amqplib](https://github.com/squaremo/amqp.node) but easy! Let us manage your
channels, connections, assertions and bindings for you, so you can just send
messages.

Installation
------------
```javascript
npm install --save amqplib-easy
```

Usage
-----
```javascript
var amqp = require('amqplib-easy')('amqp://foo:bar@amqp.lol');

amqp.consume(
  {
    exchange: 'cat',
    queue: 'found_cats',
    topics: [ 'found.*' ]
  },
  function (cat) {
    console.log('Found a cat named', cat.json.name);
  }
);

amqp.publish({ exchange: 'cat' }, 'found.tawny', { name: 'Sally' });

amqp.sendToQueue({ queue: 'found_cats' }, { name: 'Fred' });
```
yields 
```
Found a cat named Sally
Found a cat named Fred
```

### [API](API.md)

### Logging
All methods return a promise, so you can attach logging to them via the
following.
```javascript
amqp.sendToQueue({ queue: 'found_cats' }, { name: 'Fred' })
  .then(function () { console.log('sent to queue'); })
  .catch(function (err) { console.error('sending failed', err); });
```

### Connection Cleanup

[diehard](https://www.npmjs.com/package/diehard) is used for cleaning up
connections before the process exits. To ensure connections are cleaned up,
```bash
npm install --save diehard
```
and in your application's entry point, add
```javascript
require('diehard').listen();
```

You can also explicitly close all connections by calling `require('amqplib-easy').close()`. You may pass a callback to this function which will be invoked once all connections have been closed.
