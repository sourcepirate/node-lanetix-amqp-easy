'use strict';

var defaults = require('lodash.defaults'),
  BPromise = require('bluebird'),
  amqp = require('amqplib'),
  retry = require('amqplib-retry'),
  connections;

module.exports = function (amqpUrl) {
  function connect() {
    if (!connections[amqpUrl]) {
      connections[amqpUrl] = amqp.connect(amqpUrl);
    }
    return connections[amqpUrl];
  }

  function consume(queueConfig, handler) {
    var options = defaults({}, queueConfig || {}, {
      exchangeType: 'topic',
      exchangeOptions: {durable: true},
      queueOptions: {durable: true},
      prefetch: 1
    });

    // automatically enable retry unless it is specifically disabled
    if ((options.retry !== false && !options.retry) || options.retry === true) {
      options.retry = {};
    }

    // retry defaults
    if (options.retry) {
      options.retry = defaults({}, options.retry, {
        failQueue: options.queue + '.failure'
      });
    }

    return BPromise.resolve()
      .then(function () {
        return connect();
      })
      .then(function (conn) {
        return conn.createChannel();
      })
      .tap(function (ch) {
        ch.prefetch(options.prefetch);
        return BPromise.all([
          options.exchange ?
            ch.assertExchange(options.exchange,
                options.exchangeType,
                options.exchangeOptions)
            : BPromise.resolve(),
          ch.assertQueue(options.queue, options.queueOptions),
          options.retry && options.retry.failQueue ? ch.assertQueue(options.retry.failQueue, options.queueOptions) : true
        ]);
      })
      .tap(function (ch) {
        if (options.topics && options.topics.length) {
          return BPromise.map(options.topics, function (topic) {
            return ch.bindQueue(options.queue, options.exchange, topic);
          });
        }
      })
      .then(function (ch) {
        if (options.retry) {
          return ch.consume(options.queue, retry({
            channel: ch,
            consumerQueue: options.queue,
            failureQueue: options.retry.failQueue,
            handler: function (msg) {
              if (!msg) { return; }
              return BPromise.resolve()
                .then(function () {
                  try {
                    msg.json = JSON.parse(msg.content.toString());
                  } catch (err) {
                    console.error('Error converting AMQP message content to JSON.', err);
                  }
                  return handler(msg, ch);
                });
            }
          }));
        } else {
          return ch.consume(options.queue, function (msg) {
            if (!msg) { return; }
            return BPromise.resolve()
              .then(function () {
                try {
                  msg.json = JSON.parse(msg.content.toString());
                } catch (err) {
                  console.error('Error converting AMQP message content to JSON.', err);
                }
                return handler(msg, ch);
              })
              .then(function () {
                return ch.ack(msg);
              })
              .catch(function (err) {
                ch.nack(msg);
                throw err;
              });
          });
        }
      });
  }

  function publish(queueConfig, key, json, messageOptions) {
    return BPromise.resolve()
      .then(function () {
        return connect();
      })
      .then(function (conn) {
        return conn.createChannel();
      })
      .tap(function (ch) {
        if (queueConfig.exchange === null || queueConfig.exchange === undefined) {
          throw new Error('Client tries to publish to an exchange while exchange name is not undefined.');
        }
        return BPromise.all([
          ch.assertExchange(queueConfig.exchange,
                            queueConfig.exchangeType || 'topic',
                            queueConfig.exchangeOptions || {durable: true}),
          ch.assertQueue(queueConfig.queue,
                         queueConfig.queueOptions || {durable: true})
        ]);
      })
      .then(function (ch) {
        return ch.publish(queueConfig.exchange,
                          key,
                          new Buffer(JSON.stringify(json)),
                          messageOptions || queueConfig.messageOptions || {persistent: true});
      });
  }

  function sendToQueue(queueConfig, json, messageOptions) {
    return BPromise.resolve()
      .then(function () {
        return connect();
      })
      .then(function (conn) {
        // optional future =improvement - maybe we should keep the channel open?
        return conn.createChannel();
      })
      .tap(function (ch) {
        return ch.assertQueue(queueConfig.queue,
            queueConfig.queueOptions || {durable: true});
      })
      .then(function (ch) {
        return ch.sendToQueue(queueConfig.queue,
          new Buffer(JSON.stringify(json)),
            messageOptions || queueConfig.messageOptions || {persistent: true});
      });
  }

  return {
    connect: connect,
    consume: consume,
    publish: publish,
    sendToQueue: sendToQueue
  };
};
