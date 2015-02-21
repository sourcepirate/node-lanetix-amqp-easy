'use strict';

var amqp = require('../../index')('amqp://guest:guest@localhost:5672'),
  diehard = require('diehard');

amqp.connect()
  .then(function (connection) {
    connection.on('close', function () {
      process.send('ok');
    });
  })
  .then(function () {
    process.send('ready');
  });

diehard.listen({timeout: 8000});
