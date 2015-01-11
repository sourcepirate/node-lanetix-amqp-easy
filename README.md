amqplib-easy
============

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

###Logging
All methods return a promise, so you can attach logging to them via the
following.
```javascript
amqp.sendToQueue({ queue: 'found_cats' }, { name: 'Fred' })
  .then(function () { console.log('sent to queue'); })
  .catch(function (err) { console.error('sending failed', err); });
```
