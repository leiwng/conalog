'use strict';

var _nanomsg = require('nanomsg');

var _nanomsg2 = _interopRequireDefault(_nanomsg);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var protocol = 'tcp://';
var host = '127.0.0.1';
var requestPort = 19537;
var pullPort = 38484;

var topic = 'pc_tail2';

var pullSock = _nanomsg2.default.socket('pull');
var reqSock = _nanomsg2.default.socket('req');

reqSock.on('data', function (buf) {
  var portInfo = JSON.parse(buf.toString());
  console.log(portInfo);

  if (portInfo != -1) {
    // pullPort = portInfo.port
    // since I tested with docker, I have to manually use docker port to figure out the port mapping
    // you could use tools/docker-port-mapping tool
    pullSock.connect(protocol + host + ':' + pullPort);
    pullSock.on('data', function (buf) {
      console.log(buf.toString());
    });
  }
});

var reqUrl = protocol + host + ':' + requestPort;
console.log('reqUrl: ' + reqUrl);
reqSock.connect(reqUrl);
setTimeout(function () {
  console.log('reqSock.send: ' + topic);
  reqSock.send(topic);
}, 100);

