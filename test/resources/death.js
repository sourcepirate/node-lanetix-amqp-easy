'use strict';

console.log('bam');
var amqp = require('../../index')('amqp://guest:guest@localhost:5672'),
  diehard = require('diehard');

amqp.connect()
  .then(function (connection) {
    console.log('boom');
    connection.on('close', function () {
      console.log('1337-closed-it');
    });
  });

diehard.listen();
