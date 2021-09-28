// ActiveCollector Runtime

import Promise from 'bluebird'
import { Client } from 'ssh2'
import jschardet from 'jschardet'
import encoding from 'encoding'
import Redis from 'redis'
import Match from 'minimatch'
import Yaml from 'js-yaml'

import MongoProvider from '../MongoProvider'
import RedisProvider from '../RedisProvider'
import NsqProvider from '../NsqProvider'

import Logger from '../Logger'
import Config from '../../config/config'
let config = Config.parseArgs()
import constants from '../../util/constants'

Promise.promisifyAll(Redis.RedisClient.prototype)
Promise.promisifyAll(Redis.Multi.prototype)

let mongoProvider = new MongoProvider()
let redisProvider = new RedisProvider()
let nsqProvider = new NsqProvider()
let logger = new Logger('collector', 'agent')

class FilebeatSpliter {
  constructor(redisUrl, filebeatChannel) {
    // this.pubClient = Redis.createClient(redisUrl)
    let that = this
    
    this.subClient = Redis.createClient(redisUrl)
    // console.log(redisUrl, filebeatChannel)

    this.subClient.on('message', (channel, message) => {
      let json = JSON.parse(message)

      let info = this.pathList.filter(curr => {
        try {
          if (Match(json.source, curr.path)) {
            return true
          }
          else
            return false
        }
        catch(err) {
          return false
        }
      })

      if (info.length != 0) {
        let now = new Date()
        message = JSON.stringify({host: json.hostname, startTs: now.getTime(), msg: json})

        // record last activity
        let callback = info[0].callback
        callback(message)
      }
    })

    this.subClient.subscribe(filebeatChannel)

    this.pathList = []
  }

  addPath({path, channel, callback}) {
    let existFlag = this.pathList.reduce((prev, curr) => {
      if (prev == true)
        return true
      else if (curr.path == path)
        return true
      else
        return false
    }, false)

    if (!existFlag) {
      this.pathList.push({path: path, channel: channel, callback: callback})
      
    }
  }

  removePath(path) {
    // filter the one we want to remove
    this.pathList = this.pathList.filter(curr => {
      if (curr.path != path)
        return true
      else
        return false
    })
  }

}

const filebeatSpliter = new FilebeatSpliter(config.redisUrl, config.filebeatChannel)

class AgentCollector {
  constructor({collector}) {
    this.collector = collector

    this.runningFlag = false
    this.lastActivity = { execCounter: 0 }

    this.messageCallback = this.messageCallback.bind(this)
    this.setLastActivity = this.setLastActivity.bind(this)

    return this
  }

  // interface
  start() {
    this.runningFlag = true
    this.insertSpliter(this.collector.param)
  }

  stop() {
    this.runningFlag = false
    this.deleteSpliter(this.collector.param)
  }

  setLastActivity(message) {
    let now = new Date()
    this.lastActivity.execCounter++
    this.lastActivity.ts = now.getTime()
    this.lastActivity.status = 'Success'

    this.lastActivity.stdout = message
  }

  getLastActivity() {
    return this.lastActivity
  }

  getRunningFlag() {
    return this.runningFlag
  }

  // helper
  messageCallback(message) {
    let that = this

    this.setLastActivity(message)
    switch (this.collector.channel) {
      case 'Redis PubSub':
      redisProvider.publish(
        constants.AGENT_COLLECTOR_PREFIX + this.collector.name,
          message)
        .then(() => {
          // pub success, do nothing
        }) // redisProvider.publish
        .catch(err => {
          logger.error(3802,
            null,
            'Agent Collector Publish Problem',
            'Collector: ' + that.collector.name +
            ' Msg ' + message +
            ' publish failed: ' + err.stack)
        })
      break

      case 'Nsq Queue':
      nsqProvider.publish(constants.AGENT_COLLECTOR_PREFIX + that.collector.name,
        message)
      .catch(err => {
        logger.error(3803,
          null,
          'Agent Collector Publish Problem',
          'Collector: ' + that.collector.name +
          ' Msg ' + message +
          ' publish failed: ' + err.stack)
        })
      break

      default:
      redisProvider.publish(
        constants.AGENT_COLLECTOR_PREFIX + this.collector.name,
          message)
        .then(() => {
          // pub success, do nothing
        }) // redisProvider.publish
        .catch(err => {
          logger.error(3802,
            null,
            'Agent Collector Publish Problem',
            'Collector: ' + that.collector.name +
            ' Msg ' + message +
            ' publish failed: ' + err.stack)
        })
      break
    }
  }

  insertSpliter(targetPath) {
    filebeatSpliter.addPath({path: targetPath,
      callback: this.messageCallback
    })
  }

  deleteSpliter(targetPath) {
    filebeatSpliter.removePath(targetPath)
  }
}

export default AgentCollector
