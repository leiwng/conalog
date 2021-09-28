import RedisProvider from '../lib/RedisProvider'
import Promise from 'bluebird'
import Redis from 'redis'
import config from '../config/config'

import { expect } from 'chai'

// Promise.promisifyAll(Redis.RedisClient.prototype)
// Promise.promisifyAll(Redis.Multi.prototype)

let redisProvider = new RedisProvider()
let channel = 'conalogtest'

describe('RedisProvider Testsuit', function() {
  it('Publish Test', function() {
    let client = Redis.createClient(config.redisUrl)
    // let client = Redis.createClient()
    Promise.promisifyAll(client)
    client.subscribe(channel)

    let p = new Promise((resolve, reject) => {
      client.on('subscribe', (chan, count) => {
        client.on('message', (chan, message) => {
          // console.log(message)
          let json = JSON.parse(message)
          expect(json.test).to.equal('RedisProvider Testsuit')
          resolve(message)
        })
        redisProvider.publish(channel, JSON.stringify({'test': 'RedisProvider Testsuit'}))
      })
    })

    return p
  }) // it
}) // describe
