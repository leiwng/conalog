import Nanomsg from 'nanomsg'

let protocol = 'tcp://'
let host = '127.0.0.1'
let requestPort = 19537

// since I tested with docker, I have to manually use docker port to figure out the port mapping
// you could use tools/docker-port-mapping tool to do that
let pullPort = 38484

let topic = 'pc_tail2'

let pullSock = Nanomsg.socket('pull')
let reqSock = Nanomsg.socket('req')

reqSock.on('data', buf => {
  let portInfo = JSON.parse(buf.toString())
  console.log(portInfo)

  if (portInfo != -1) {
    // you could directly use responsed port if you are NOT using docker
    // pullPort = portInfo.port

    pullSock.connect(protocol + host + ':' + pullPort)
    pullSock.on('data', buf => {
      console.log(buf.toString())
    })
  }
})

let reqUrl = protocol + host + ':' + requestPort
console.log('reqUrl: ' + reqUrl)
reqSock.connect(reqUrl)
setTimeout(() => {
  console.log('reqSock.send: ' + topic)
  reqSock.send(topic)
}, 100)
