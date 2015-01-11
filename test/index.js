/*globals it:false*/
'use strict';

var amqpUrl = 'amqp://guest:guest@localhost:5672',
  amqp = require('../index')(amqpUrl);

it('should publish, sendToQueue and receive', function (done) {
  var catCount = 0;
  amqp.consume(
    {
      exchange: 'cat',
      queue: 'found_cats',
      topics: [ 'found.*' ]
    },
    function (cat) {
      var name = cat.json.name;
      /*eslint-disable no-unused-expressions*/
      (name === 'Sally' || name === 'Fred').should.be.ok;
      /*eslint-enable no-unused-expressions*/
      if (++catCount === 2) {
        done();
      }
    }
  );

  amqp.publish({ exchange: 'cat' }, 'found.tawny', { name: 'Sally' });

  amqp.sendToQueue({ queue: 'found_cats' }, { name: 'Fred' });
});
