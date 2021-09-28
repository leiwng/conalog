import Net from 'net'
import Promise from 'bluebird'
import Nanomsg from 'nanomsg'

let probePort = ({port = 9547, host = '127.0.0.1'}) => {
  let promise = new Promise((resolve, reject) => {
    let server = Net.createServer().listen(port, host)

    server.on('listening', () => {
      server.close()
      resolve(port)
    })

    server.on('error', err => {
      if (err.code !== 'EADDRINUSE') {
        reject(err)
      }
      else
        resolve(-1)
    })

  }) // new Promise

  return promise
}

// generator for unused port probe
function* GenGetUnusedPort({startPort, endPort, host}) {
  let port = startPort

  while (port <= endPort) {
    yield probePort({port, host})
    port++
  }
}

class NanomsgQueueProvider {
  constructor({protocol, host, requestPort, startPort, endPort}) {
    this.protocol = protocol
    this.host = host
    this.requestPort = requestPort
    this.startPort = startPort
    this.endPort = endPort

    this.pushSockTable = {}

    this.repSock = Nanomsg.socket('rep')
    let repUrl = protocol + host + ':' + requestPort
    // console.log('NanomsgQueueProvider::constructor - repUrl: ' + repUrl)
    this.repSock.bind(repUrl)
    this.repSock.on('data', buf => {
      // console.log('nanomsgQueueProvider::constructor - repSock recv data: ' + buf.toString())
      let topic = buf.toString()
      let sockInfo = this.pushSockTable[topic]
      if (sockInfo !== undefined || sockInfo != null)
        this.repSock.send(JSON.stringify({topic: topic, port: sockInfo.port}))
      else
        this.repSock.send(JSON.stringify({topic: topic, port: -1}))
    })

    // bind this to all member functions
    this.push = this.push.bind(this)
    this.register = this.register.bind(this)
    this.unregister = this.unregister.bind(this)
    this.getUnusedPort = this.getUnusedPort.bind(this)
  }

  push({topic, str}) {
    // console.log('NanomsgQueueProvider::push - topic: ' + topic + ' str: ' + str)
    let sockInfo = this.pushSockTable[topic]
    sockInfo.sock.send(str)
  }

  register(topic) {
    let that = this

    return this.getUnusedPort().then(port => {
      if (port != -1) {
        // console.log(topic, port)
        let sock = Nanomsg.socket('push')
        sock.bind(that.protocol + that.host + ':' + port)

        let info = {port: port, sock: sock}
        that.pushSockTable[topic] = info
      }
    })
  }

  unregister(topic) {
    let info = this.pushSockTable[topic]
    if (info)
      if (info.sock)
        info.sock.close()

    delete this.pushSockTable[topic]
  }

  getUnusedPort() {
    let that = this

    let promise = new Promise((resolve, reject) => {
      let gen = GenGetUnusedPort({
        startPort: that.startPort,
        endPort: that.endPort,
        host: that.host
      })

      let looper = () => {
        let genPromise = gen.next().value

        if (genPromise) {
          genPromise.then(port => {
            if (port == -1)
              looper()
            else
              resolve(port)
          })
          .catch(err => {
            looper()
          })
        }
        else
          reject(new Error("No Unused Port Found."))
      }

      looper()
    }) // new Promise

    return promise
  }

} // class NanomsgQueueProvider

export default NanomsgQueueProvider
