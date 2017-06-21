'use strict'

var defaults = require('lodash.defaults')
var Promise = require('bluebird')
var amqp = require('amqplib')
var retry = require('amqplib-retry')
var diehard = require('diehard')
var connections = {}
var sendChannels = {}

function cleanup (done) {
  return Promise.map(
    Object.keys(connections),
    function (connectionUrl) {
      return connections[connectionUrl]
        .then(function (connection) {
          return connection.close()
        }).catch(function () {})
    })
    .then(function () {
      connections = {}
      sendChannels = {}
    })
    .nodeify(done)
}

function toBuffer (obj) {
  if (obj instanceof Buffer) {
    return obj
  }
  return new Buffer(JSON.stringify(obj))
}

diehard.register(cleanup)

module.exports = function (amqpUrl, socketOptions) {
  function connect () {
    if (!connections[amqpUrl]) {
      socketOptions = defaults({}, socketOptions || {}, {
        channelMax: 100
      })
      connections[amqpUrl] = Promise.resolve(amqp.connect(amqpUrl, socketOptions))
    }
    return connections[amqpUrl]
  }

  function sendChannel () {
    if (!sendChannels[amqpUrl]) {
      sendChannels[amqpUrl] = connect()
        .then(function (connection) {
          return connection.createConfirmChannel()
            .then(function (channel) {
              channel.on('error', function () {
                sendChannels[amqpUrl] = null
                // clear out the channel since it's in a bad state
              })
              return channel
            })
        })
    }
    return sendChannels[amqpUrl]
  }

  function createChannel () {
    return connect().then(function (connection) {
      return Promise.resolve(connection.createChannel())
    })
  }

  function consume (queueConfig, handler) {
    var options = defaults({}, queueConfig || {}, {
      exchangeType: 'topic',
      exchangeOptions: {durable: true},
      parse: JSON.parse,
      queueOptions: {durable: true},
      prefetch: 1,
      arguments: {}
    })

    // automatically enable retry unless it is specifically disabled
    if ((options.retry !== false && !options.retry) || options.retry === true) {
      options.retry = {}
    }

    // retry defaults
    if (options.retry) {
      options.retry = defaults({}, options.retry, {
        failQueue: options.queue + '.failure'
      })
    }

    return createChannel()
      .then(function (ch) {
        ch.prefetch(options.prefetch)
        return Promise.resolve()
          .then(function () {
            return Promise.all([
              options.exchange ? ch.assertExchange(options.exchange, options.exchangeType, options.exchangeOptions) : Promise.resolve(),
              ch.assertQueue(options.queue, options.queueOptions),
              options.retry && options.retry.failQueue ? ch.assertQueue(options.retry.failQueue, options.queueOptions) : Promise.resolve()
            ])
          })
          .then(function () {
            if (!options.topics || !options.topics.length) {
              options.topics = ['']
            }

            return Promise.map(options.topics, function (topic) {
              return ch.bindQueue(options.queue, options.exchange, topic, options.arguments || {})
            })
          })
          .then(function () {
            function parse (msg) {
              return function () {
                try {
                  msg.json = options.parse(msg.content.toString())
                  return handler(msg, ch)
                } catch (err) {
                  console.error('Error deserializing AMQP message content.', err)
                }
              }
            }

            if (options.retry) {
              return ch.consume(options.queue, retry({
                channel: ch,
                consumerQueue: options.queue,
                failureQueue: options.retry.failQueue,
                delay: options.retry.delay,
                handler: function (msg) {
                  if (!msg) {
                    return
                  }
                  return Promise.resolve()
                    .then(parse(msg))
                }
              }))
            } else {
              return ch.consume(options.queue, function (msg) {
                if (!msg) {
                  return
                }
                return Promise.resolve()
                  .then(parse(msg))
                  .then(function () {
                    return ch.ack(msg)
                  })
                  .catch(function (err) {
                    ch.nack(msg)
                    throw err
                  })
              })
            }
          })
          .then(function (consumerInfo) {
            return function () {
              return Promise.resolve(ch.cancel(consumerInfo.consumerTag))
            }
          })
      })
  }

  function publish (queueConfig, key, json, messageOptions) {
    return sendChannel()
      .then(
        function (ch) {
          if (queueConfig.exchange === null || queueConfig.exchange === undefined) {
            throw new Error('Client tries to publish to an exchange while exchange name is not undefined.')
          }
          return Promise
            .all([
              ch.assertExchange(queueConfig.exchange, queueConfig.exchangeType || 'topic', queueConfig.exchangeOptions || {durable: true}),
              queueConfig.queue ? ch.assertQueue(queueConfig.queue, queueConfig.queueOptions || {durable: true}) : Promise.resolve()
            ])
            .then(function () {
              return new Promise(function (resolve, reject) {
                ch.publish(queueConfig.exchange,
                  key,
                  toBuffer(json),
                  messageOptions || queueConfig.messageOptions || {persistent: true},
                  function (err) {
                    if (err) {
                      reject(err)
                    } else {
                      resolve()
                    }
                  }
                )
              })
            })
        }
      )
  }

  function sendToQueue (queueConfig, json, messageOptions) {
    return sendChannel()
      .then(
        function (ch) {
          return ch.assertQueue(queueConfig.queue, queueConfig.queueOptions || {durable: true})
            .then(function () {
              return new Promise(function (resolve, reject) {
                ch.sendToQueue(
                  queueConfig.queue,
                  toBuffer(json),
                  messageOptions || queueConfig.messageOptions || {persistent: true},
                  function (err) {
                    if (err) {
                      reject(err)
                    } else {
                      resolve()
                    }
                  }
                )
              })
            })
        }
      )
  }

  return {
    connect: connect,
    consume: consume,
    publish: publish,
    sendToQueue: sendToQueue
  }
}

module.exports.close = cleanup
