import Nanomsg from 'nanomsg'

let protocol = 'tcp://'
let host = '127.0.0.1'
let requestPort = 19537
let pullPort = -1

let topic = 'ac_ls4'

let repSock = Nanomsg.socket('rep')

repSock.on('data', buf => {
  let topic = buf.toString()
  console.log(topic)
})

let repUrl = protocol + host + ':' + requestPort
console.log('reqUrl: ' + repUrl)
repSock.bind(repUrl)
