import Promise from 'bluebird'
import Redis from 'redis'
import Config from '../config/config'
let config = Config.parseArgs()
import Logger from '../lib/Logger'

let logger = new Logger('conalog-lib', 'RedisProvider')

Promise.promisifyAll(Redis.RedisClient.prototype)
Promise.promisifyAll(Redis.Multi.prototype)

class RedisProvider {
  constructor() {
    if (this.client === undefined) {
      this.client = Redis.createClient(config.redisUrl)

      logger.warning(2701,
          null,
          'Redis new connection',
          'Redis connection created: ' + config.redisUrl)
    }
    else {
      logger.warning(2702,
          null,
          'Redis new connection',
          'Redis connection re-used')
    }
  }

  publish(channel, data) {
    // console.log('publish', channel, data)
    return this.client.publishAsync(channel, data)
  }

  rpush(list, data) {
    return this.client.rpushAsync(list, data)
  }

  lrem(list, count, value) {
    return this.client.lremAsync(list, count, value)
  }

  lrange(list, start, end) {
    return this.client.lrangeAsync(list, start, end)
  }

  exists(key) {
    return this.client.existsAsync(key)
  }

  set(key, value) {
    return this.client.setAsync(key, value)
  }

  get(key) {
    return this.client.getAsync(key)
  }
}

export default RedisProvider
