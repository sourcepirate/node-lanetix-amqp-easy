/* globals it:false */
'use strict'

var amqpUrl = 'amqp://guest:guest@localhost:5672'
var childProcess = require('child_process')
var BPromise = require('bluebird')
var amqp = require('../index')(amqpUrl)

describe('amqplib-easy', function () {
  afterEach(function () {
    return amqp.connect()
      .then(function (connection) {
        return connection.createChannel()
          .then(function (channel) {
            return BPromise.all(
              [
                channel.checkQueue('found_cats')
                  .then(function () {
                    return channel.deleteQueue('found_cats')
                  }),
                channel.checkQueue('found_cats.failure')
                  .then(function () {
                    return channel.deleteQueue('found_cats.failure')
                  })
              ])
              .catch(function () {
                // the queue doesn't exist, so w/e
                return
              })
          })
      })
  })

  describe('consumer', function () {
    var cancel

    afterEach(function () {
      if (cancel) {
        return cancel()
      }
    })

    it('should accept alternate parser', function (done) {
      amqp.consume(
        {
          exchange: 'cat',
          parse: function () {
            return {name: 'Fred'}
          },
          queue: 'found_cats',
          topics: ['found.*']
        },
        function (cat) {
          var name = cat.json.name
          var payload = cat.payload
          try {
            cat.should.have.properties(['content', 'fields', 'properties'])
            name.should.equal('Fred')
            payload.should.be.deepEqual(cat.json)
            done()
          } catch (err) {
            done(err)
          }
        }
      )
        .then(function (c) {
          cancel = c
          return BPromise.all([
            amqp.sendToQueue({queue: 'found_cats'}, new Buffer('dsadasd'))
          ])
        })
        .catch(done)
    })

    it('should handle buffers reasonably', function (done) {
      var catCount = 0
      amqp.consume(
        {
          exchange: 'cat',
          queue: 'found_cats',
          topics: ['found.*']
        },
        function (cat) {
          var name = cat.json.name
          try {
            (name === 'Sally' || name === 'Fred').should.be.ok()
            if (++catCount === 2) {
              done()
            }
          } catch (err) {
            done(err)
          }
        }
      )
        .then(function (c) {
          cancel = c
          return BPromise.all([
            amqp.publish({exchange: 'cat'}, 'found.tawny', new Buffer('{ "name": "Sally" }')),
            amqp.sendToQueue({queue: 'found_cats'}, new Buffer('{ "name": "Fred" }'))
          ])
        })
        .catch(done)
    })

    it('should publish, sendToQueue and receive', function (done) {
      var catCount = 0
      amqp.consume(
        {
          exchange: 'cat',
          queue: 'found_cats',
          topics: ['found.*']
        },
        function (cat) {
          var name = cat.json.name
          try {
            (name === 'Sally' || name === 'Fred').should.be.ok()
            if (++catCount === 2) {
              done()
            }
          } catch (err) {
            done(err)
          }
        }
      )
        .then(function (c) {
          cancel = c
          return BPromise.all([
            amqp.publish({exchange: 'cat'}, 'found.tawny', {name: 'Sally'}),
            amqp.sendToQueue({queue: 'found_cats'}, {name: 'Fred'})
          ])
        })
        .catch(done)
    })

    it('should publish even if something causes the channel to die', function (done) {
      amqp.consume(
        {
          exchange: 'cat',
          queue: 'found_cats',
          topics: ['found.*']
        },
        function () {
          done()
        }
      )
        .then(function (c) {
          cancel = c
          return amqp.publish({exchange: 'cat', exchangeType: 'direct'}, 'found.tawny', {name: 'Sally'})
            .catch(function () {
              return amqp.publish({exchange: 'cat', exchangeType: 'topic'}, 'found.tawny', {name: 'Sally'})
            })
        })
        .catch(done)
    })

    describe('fanout exchange', function () {
      function deleteCat () {
        return amqp.connect()
          .then(function (connection) {
            return connection.createChannel()
              .then(function (channel) {
                return channel.checkExchange('cat')
                  .then(
                    function () {
                      return channel.deleteExchange('cat')
                    },
                    function () { /* NBD it doesn't exist */
                    }
                )
              })
          })
      }

      beforeEach(deleteCat)
      afterEach(deleteCat)

      it('should publish via fanout', function (done) {
        amqp.consume(
          {
            exchange: 'cat',
            exchangeType: 'fanout',
            queue: 'found_cats'
          },
          function (cat) {
            var name = cat.json.name
            try {
              name.should.equal('Sally')
              done()
            } catch (err) {
              done(err)
            }
          }
        )
          .then(function (c) {
            cancel = c
            return amqp.publish(
              {exchange: 'cat', exchangeType: 'fanout'},
              'found.tawny',
              {name: 'Sally'}
            )
          })
          .catch(done)
      })
    })

    describe('headers exchange', function () {
      function deleteCat () {
        return amqp.connect()
          .then(function (connection) {
            return connection.createChannel()
              .then(function (channel) {
                return channel.checkExchange('cat')
                  .then(
                    function () {
                      return channel.deleteExchange('cat')
                    },
                    function () { /* NBD it doesn't exist */
                    }
                )
              })
          })
      }

      afterEach(deleteCat)

      it('should publish via headers', function (done) {
        amqp.consume(
          {
            exchange: 'cat',
            exchangeType: 'headers',
            arguments: {
              'color': 'blue'
            },
            queue: 'found_cats'
          },
          function (cat) {
            var name = cat.json.name
            try {
              name.should.equal('Sally')
              done()
            } catch (err) {
              done(err)
            }
          }
        )
          .then(function (c) {
            cancel = c
            return amqp.publish(
              {exchange: 'cat', exchangeType: 'headers'},
              'found.tawny',
              {name: 'Sally'},
              {headers: {color: 'blue'}}
            )
          })
          .catch(done)
      })
    })
  })

  it('should cancel consumer', function (done) {
    amqp.consume(
      {
        exchange: 'cat',
        queue: 'found_cats',
        topics: ['found.*']
      },
      function () {
        done('Got a cat')
      }
    )
      .then(function (cancel) {
        return cancel()
      })
      .then(function () {
        // add some delay so that the cancel takes affect
        return BPromise.delay(200)
      })
      .then(function () {
        return amqp.sendToQueue({queue: 'found_cats'}, {name: 'Carl'})
      })
      .then(function () {
        // add some delay so that we get the sent message if it were sent
        return BPromise.delay(200)
      })
      .nodeify(done)
  })
})

describe('Connection managment', function () {
  it('should close and delete connection – no reuse', function (done) {
    amqp.connect()
      .then(function (connection1) {
        return amqp.close().then(function () {
          amqp.connect()
            .then(function (connection2) {
              connection1.should.not.equal(connection2)
              done()
            })
        })
      })
      .catch(done)
  })

  it('should close/delete connection and reconnect on consume', function (done) {
    amqp.connect()
      .then(function (connection1) {
        return amqp.close().then(function () {
          amqp.consume({
            exchange: 'cat',
            queue: 'found_cats',
            topics: ['found.*']
          },
          function () {
            done('Got a cat')
          }).catch(done)
          .then(function () {
            amqp.connect().then(function () {
              done()
            })
          })
        })
      })
      .catch(done)
  })

  it('should reuse the existing connection', function (done) {
    amqp.connect()
      .then(function (connection1) {
        amqp.connect()
          .then(function (connection2) {
            connection1.should.equal(connection2)
            done()
          })
      })
      .catch(done)
  })

  it('should close the connection upon death', function (done) {
    this.timeout(3000)
    // Spin up a process to kill
    var testProcess = childProcess.fork('./test/resources/death.js', {silent: false})

    testProcess.on('message', function (message) {
      switch (message) {
        case 'ok':
          return done()
        case 'ready':
          return testProcess.kill('SIGTERM')
        default:
          return done(new Error('Unknown message ' + message))
      }
    })
  })
})

describe('x-delayed-message', function () {
  var plugin = false

  after(function () {
    if (!plugin) return

    return amqp.connect()
      .then(function (connection) {
        return BPromise.resolve(connection.createChannel())
          .then(function (channel) {
            return BPromise.all(
              [
                channel.checkExchange('cat')
                  .then(function () {
                    channel.deleteExchange('cat')
                  }),
                channel.checkQueue('found_cats')
                  .then(function () {
                    channel.deleteQueue('found_cats')
                  }),
                channel.checkQueue('found_cats.failure')
                  .then(function () {
                    channel.deleteQueue('found_cats.failure')
                  })
              ])
              .catch(function () {
                // the queue doesn't exist, so w/e
                return
              })
          })
      })
  })

  it('should installed rabbitmq delayed message plugin', function (done) {
    amqp.connect()
      .then(function (connection) {
        connection.on('error', function () {})
        return BPromise.resolve(connection.createChannel())
          .then(function (channel) {
            return channel.assertExchange('cat', 'x-delayed-message', {arguments: {'x-delayed-type': 'fanout'}})
          })
          .then(function () {
            return BPromise.resolve(connection.createChannel())
              .then(function (channel) {
                plugin = true
                return channel.deleteExchange('cat')
              })
          })
      })
      .catch(function () {})
      .finally(function () {
        done()
      })
  })

  it('should publish delayed message of 3 sec via fanout', function (done) {
    if (!plugin) {
      this.skip()
    }

    this.timeout(6000)
    amqp
    .consume({
      exchange: 'cat',
      exchangeType: 'x-delayed-message',
      exchangeOptions: {arguments: {'x-delayed-type': 'fanout'}},
      queue: 'found_cats'
    }, function (cat) {
      var name = cat.json.name
      // There may be some delay, use 2.9 sec to test
      var time = cat.json.time + 2900

      try {
        name.should.equal('Sally')
        time.should.be.below(new Date().getTime())
        done()
      } catch (err) {
        done(err)
      }
    })
    .then(function () {
      return amqp.publish(
        {exchange: 'cat', exchangeType: 'x-delayed-message'},
        'found.tawny',
        {name: 'Sally', time: new Date().getTime()},
        {headers: {'x-delay': 3000}}
      )
    })
  })
})
