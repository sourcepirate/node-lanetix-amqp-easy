'use strict';

var amqp = require('../index')('amqp://guest:guest@localhost:5672');

amqp.connect()
  .then(function (connection) {
    connection.on('close', function () {
      console.log('1337-closed-it');
    });
  });
