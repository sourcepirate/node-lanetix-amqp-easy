/*globals it:false*/
'use strict';

var amqpUrl = 'amqp://guest:guest@localhost:5672',
  BPromise = require('bluebird'),
  amqp = require('../index')(amqpUrl);

describe('amqplib-easy', function () {
  afterEach(function () {
    return amqp.connect()
      .then(function (connection) {
        return connection.createChannel()
          .then(function (channel) {
            return BPromise.all([
              channel.checkQueue('found_cats')
                .then(function () {
                  return channel.deleteQueue('found_cats');
                }),
              channel.checkQueue('found_cats.failure')
                .then(function () {
                  return channel.deleteQueue('found_cats.failure');
                })
            ])
              .catch(function (err) {
                console.log('boom', err);
                //the queue doesn't exist, so w/e
                return;
              });
          });
      });
  });

  describe('should publish, sendToQueue and receive', function () {
    var cancel;

    afterEach(function () {
      if (cancel) {
        return cancel();
      }
    });

    it('', function (done) {
      var catCount = 0;
      amqp.consume(
        {
          exchange: 'cat',
          queue: 'found_cats',
          topics: [ 'found.*' ]
        },
        function (cat) {
          var name = cat.json.name;
          try {
            /*eslint-disable no-unused-expressions*/
            (name === 'Sally' || name === 'Fred').should.be.ok;
            /*eslint-enable no-unused-expressions*/
            if (++catCount === 2) {
              done();
            }
          } catch (err) { done(err); }
        }
      )
        .then(function (c) {
          cancel = c;
          return BPromise.all([
            amqp.publish({ exchange: 'cat' }, 'found.tawny', { name: 'Sally' }),
            amqp.sendToQueue({ queue: 'found_cats' }, { name: 'Fred' })
          ]);
        })
        .catch(done);

    });
  });

  it('should cancel consumer', function (done) {

    amqp.consume(
      {
        exchange: 'cat',
        queue: 'found_cats',
        topics: [ 'found.*' ]
      },
      function () {
        done('Got a cat');
      }
    )
      .then(function (cancel) {
        return cancel();
      })
      .then(function () {
        //add some delay so that the cancel takes affect
        return BPromise.delay(200);
      })
      .then(function () {
        return amqp.sendToQueue({ queue: 'found_cats' }, { name: 'Carl' });
      })
      .then(function () {
        //add some delay so that we get the sent message if it were sent
        return BPromise.delay(200);
      })
      .nodeify(done);

  });
});
