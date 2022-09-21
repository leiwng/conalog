'use strict';

var _nanomsg = require('nanomsg');

var _nanomsg2 = _interopRequireDefault(_nanomsg);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var protocol = 'tcp://';
var host = '127.0.0.1';
var requestPort = 19537;
var pullPort = -1;

var topic = 'ac_ls4';

var repSock = _nanomsg2.default.socket('rep');

repSock.on('data', buf => {
  var topic = buf.toString();
  console.log(topic);
});

var repUrl = protocol + host + ':' + requestPort;
console.log('reqUrl: ' + repUrl);
repSock.bind(repUrl);

