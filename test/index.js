/*globals it:false*/
'use strict';

var amqpUrl = 'amqp://guest:guest@localhost:5672',
  BPromise = require('bluebird'),
  amqplib = require('amqplib'),
  amqp = require('../index')(amqpUrl);

it('should publish, sendToQueue and receive', function (done) {
  amqplib.connect(amqpUrl)
    .then(function (connection) {
      //setup: teardown any existing data
      return connection.createChannel()
        .then(function (channel) {
          return BPromise.all([
            channel.deleteQueue('found_cats'),
            channel.deleteExchange('cat')
          ])
            .then(function () {
              return channel.close();
            });
        })
        .then(function () {
          return connection.close();
        });
    })
    .then(function () {
      var catCount = 0;
      return amqp.consume(
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
      )
        .then(function () {
          amqp.publish({ exchange: 'cat' }, 'found.tawny', { name: 'Sally' });

          amqp.sendToQueue({ queue: 'found_cats' }, { name: 'Fred' });
        });
    })
    .catch(done);
});
