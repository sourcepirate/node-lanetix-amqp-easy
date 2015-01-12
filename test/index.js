/*globals it:false*/
'use strict';

var childProcess = require('child_process'),
  path = require('path'),
  BPromise = require('bluebird'),
  amqp = require('../index')('amqp://guest:guest@localhost:5672');

it('should publish, sendToQueue and receive', function (done) {
  amqp.connect()
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

it('should reuse the existing connection', function (done) {
  amqp.connect()
    .then(function (connection1) {
      amqp.connect()
        .then(function (connection2) {
          connection1.should.equal(connection2);
          done();
        });
    })
    .catch(done);
});

it('should close the connection upon death', function (done) {
  // Spin up a process to kill
  var testProcess = childProcess.exec('node ' + path.join(__dirname, 'death.js')),
      testStdOutput = testProcess.stdout;

  // record stdout
  testStdOutput.on('data', function (chunk) {
    if (chunk === '1337-closed-it\n') {
      done();
    }
  });

  // need a delay to be sure the process is running
  setTimeout(function () {
    // kill the spun up process
    process.kill(testProcess.pid, 'SIGTERM');
  }, 200);
});
