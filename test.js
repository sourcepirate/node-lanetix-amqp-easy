'use strict';

var test = require('tape'),
  amqp = require('./index')('amqp://guest:guest@localhost:5672');

test('should publish, sendToQueue and receive', function (t) {
  t.plan(2);
  amqp.consume(
    {
      exchange: 'cat',
      queue: 'found_cats',
      topics: [ 'found.*' ]
    },
    function (cat) {
      var name = cat.json.name;
      t.ok(name === 'Sally' || name === 'Fred', 'Cat named Sally or Fred.');
    }
  );

  amqp.publish({ exchange: 'cat' }, 'found.tawny', { name: 'Sally' });

  amqp.sendToQueue({ queue: 'found_cats' }, { name: 'Fred' });
});
