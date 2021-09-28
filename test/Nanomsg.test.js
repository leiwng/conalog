import request from 'supertest'
import Chai from 'chai'
import ChaiAsPromised from 'chai-as-promised'
import Crypto from 'crypto'
import _ from 'lodash'
import Promise from 'bluebird'

// patch chai
Chai.use(ChaiAsPromised)
let expect = Chai.expect
let assert = Chai.assert
Chai.should()

import Nanomsg from 'nanomsg'
import NanomsgQueueProvider from '../lib/NanomsgQueueProvider'

let protocol = 'tcp://'
let host = '127.0.0.1'
let requestPort = 39525
let startPort = 39527
let endPort = 39537

let topic = 'nanomsg_test'
let port = -1

let pullSock = Nanomsg.socket('pull')
let reqSock = Nanomsg.socket('req')

let nanomsgQueueProvider = new NanomsgQueueProvider({protocol: protocol, host: host, requestPort: requestPort, startPort: startPort, endPort: endPort})

describe('Nanomsg Testsuit', function() {
  before(function(done) {
    reqSock.connect(protocol + host + ':' + requestPort)

    // wait >100ms for reqSock to connect
    setTimeout(() => {
      done()
    }, 150)
  })

  after(function() {
    // clean up
    pullSock.close()
    reqSock.close()
  })

  it('Register Topic Test', function() {
    return nanomsgQueueProvider.register(topic).should.eventually.not.equal(-1)
  })

  it('Request Port Test', function(done) {
    reqSock.on('data', buf => {
      let portInfo = JSON.parse(buf.toString())
      if (portInfo.port != -1) {
        port = portInfo.port
        done()
      }
      else
        done(new Error("Request Port Test Failed"))
    })

    reqSock.send(topic)
  })

  it('Push-Pull Test', function(done) {
    pullSock.connect(protocol + host + ':' + port)
    pullSock.on('data', buf => {
      if (buf.toString() == 'hello from nanomsg_test')
        done()
      else
        done({error: 'Push-Pull Failed, Recv: ' + buf.toString()})
    })

    // wait >= 100 ms for pullSock to connect
    setTimeout(() => {
      nanomsgQueueProvider.push({topic: topic, str: 'hello from nanomsg_test'})
    }, 150)
  })

  it ('Unregister Topic Test', function() {
    nanomsgQueueProvider.unregister(topic)
    expect(nanomsgQueueProvider.pushSockTable).to.be.empty
  })
})
