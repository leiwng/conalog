// Passive Collector Runtime

import Promise from 'bluebird'
import { Client } from 'ssh2'
import jschardet from 'jschardet'
import encoding from 'encoding'
import { ObjectID } from 'mongodb'

import MongoProvider from '../MongoProvider.js'
import RedisProvider from '../RedisProvider.js'
import NsqProvider from '../NsqProvider'

import Logger from '../Logger'
import Config from '../../config/config'
let config = Config.parseArgs()
import constants from '../../util/constants'

let mongoProvider = new MongoProvider()
let redisProvider = new RedisProvider()
let nsqProvider = new NsqProvider()
let logger = new Logger('collector', 'passive')

class PassiveCollector {
  constructor({collectorJson}) {
    let that = this

    this.runningFlag = false
    this.aliveFlag = false
    this.collector = collectorJson
    // this.nanomsgQueueProvider = nanomsgQueueProvider
    this.connection = new Client()
    // 2016.11.30 by Xie Di, Issue #47 - collect data before newline
    this.dataPool = null
    
    // setup connection
    Promise.promisifyAll(this.connection)

    if (this.collector.type == 'FileTail')
      this.collector.cmd = 'tail -F'

    if (this.collector.param.charAt(0) !== ' ')
      this.remoteCmd = this.collector.cmd + ' ' + this.collector.param
    else
      this.remoteCmd = this.collector.cmd + this.collector.param

    this.lastActivity = { execCounter: 0 }

    // member function
    this.start = this.start.bind(this)
    this.stop = this.stop.bind(this)
    this.watchdogProcessor = this.watchdogProcessor.bind(this)
    this.dataHandler = this.dataHandler.bind(this)
    this.errHandler = this.errHandler.bind(this)

    // connection setup
    this.connection.on('error', err => {
      logger.error(3704,
        null,
        'Passive Collector Exec Problem',
        'Passive collector ' +
        that.collector._id +
        ' ' + that.collector.name +
        ' exec failed, connection error: ' + JSON.stringify(err))

      that.connection.end()
      that.aliveFlag = false
    }) // connection on error
    .on('keyboard-interactive', (name, instr, lang, prompts, cb) => {
      if (~prompts[0].prompt.indexOf('Password:'))
        cb([that.cert.pass])
    })
    .on('ready', () => {
      that.connection.exec(that.remoteCmd, (err, stream) => {
        if (err) {
          let now = new Date()
          that.lastActivity.ts = now.getTime()
          that.lastActivity.status = 'Error'
          that.lastActivity.data = JSON.stringify(err)

          logger.error(3702,
            null,
            'Passive Collector Exec Problem',
            'Passive collector' +
            that.collector._id +
            ' ' + that.collector.name +
            ' exec failed, exec error: ' + JSON.stringify(err))

          that.connection.end()
          that.aliveFlag = false
        }
        else {
          stream.on('close', (code, signal) => {
            logger.warning(2703,
              that.collector.name,
              'SSH stream closed',
              'Code: ' + code + ', Signal: ' + signal)

            that.connection.end()
            that.aliveFlag = false
          }) // stream on close
          .on('data', this.dataHandler)
          .stderr.on('data', this.errHandler)

          that.aliveFlag = true
        }
      }) // connection exec
    }) // connection on ready

    return this
  }

  // user intercae
  start() {
    let that = this

    // get cert from mongo
    mongoProvider.query(constants.CERT_COLL, {_id: new ObjectID(this.collector.host)})
      .then(cert => {
        that.cert = cert

        // set running flag
        that.runningFlag = true

        // start watchdog, it will connect automatically
        this.watchdog = setInterval(this.watchdogProcessor, constants.PASSIVE_COLLECTOR_WATCHDOG_INTERVAL)
      })
      .catch(err => {
        logger.error(3705,
            null,
            'Passive Collector Exec Problem',
            'Cert host ' +
            that.cert.host +
            ' is not found. Collector name: ' +
            that.collector.name +
            + ' ,error: ' + JSON.stringify(err))
      })
  }

  stop() {
    // clear running flag and watchdog will disconnect automatically
    this.runningFlag = false
  }

  watchdogProcessor() {
    if (this.runningFlag == true) {
      if (this.aliveFlag == false) {
        // connect
        this.connection.connect({
          host: this.cert.host,
          port: this.cert.port,
          username: this.cert.user,
          password: this.cert.pass,
          keepaliveInterval: constants.SSH_KEEPALIVE_INTERVAL,
          keepaliveCountMax: constants.SSH_MAX_COUNT,
          tryKeyboard: true
        })
      }
    }
    else {
      if (this.aliveFlag == true) {
        // disconnect
        this.connection.end()
        this.aliveFlag = false
      }

      // stop watchdog
      clearInterval(this.watchdog)
    }
  }

  dataHandler(data) {
    let that = this

    // console.log('STDOUT: ' + data);
    if (data == undefined || data == null) {
      // do nothing, just leave
      return
    }

    let dataBuffer = ""

    // Modified by Xie Di, 20161202 - Issue #47
    // check \n BEFORE chartset convertion so we won't miss it
    if (that.dataPool == null) {
      if (data[data.length - 1] == 10) {
        // console.log("\n dataPool = 0, GOT newline.")
        // Modified by Xie Di, 2016.11.24, Issue #46 - encode to utf-8 before pub to redis
        dataBuffer = encoding.convert(data, "utf-8", that.collector.encoding)
      }
      else {
        // console.log("\n dataPool = 0, WAIT newline.")
        // save to dataPool, wait for more data
        that.dataPool = new Buffer(data)
        return
      }
    }
    else {
      // append to dataPool, check for newline
      let dataTemp = new Buffer(that.dataPool.length + data.length)
      that.dataPool.copy(dataTemp)
      data.copy(dataTemp, that.dataPool.length)

      that.dataPool = new Buffer(dataTemp)
      dataTemp = null

      if (data[data.length - 1] == 10) {
        // console.log("\n dataPool = " + dataPool.length + ", GOT newline.")
        // Modified by Xie Di, 2016.11.24, Issue #46 - encode to utf-8 before pub to redis
        dataBuffer = encoding.convert(that.dataPool, "utf-8", that.collector.encoding)
        that.dataPool = null
      }
      else {
        // console.log("\n dataPool = " + dataPool.length + ", WAIT newline.")
        // wait for more data
        return
      }
    }

    let lines = dataBuffer.toString("utf-8").split("\n")
    lines.map(line => {
      if (line !== undefined && line != null && line !="") {
        // save last activity
        let now = new Date()
        that.lastActivity.execCounter += 1
        that.lastActivity.ts = now.getTime()
        that.lastActivity.status = 'Success'

        that.lastActivity.data = line

        // console.log(line)

        let dataLine = JSON.stringify({host: that.cert.host, startTs: now.getTime(), msg: line})

        switch (that.collector.channel) {
          case 'Redis PubSub':
          redisProvider.publish(
            constants.PASSIVE_COLLECTOR_PREFIX + that.collector.name,
              dataLine
            )
            .then(() => {
              // pub success, do nothing
            }) // redisProvider.publish
            .catch((err) => {
              // console.log('PassiveCollector::start', JSON.stringify(err))
              logger.error(3701,
                  null,
                  'Passive Collector Publish Problem',
                  'Msg ' + line + ' publish failed: ' + err)
            })
          break;

          /*
          case 'Nanomsg Queue':
          that.nanomsgQueueProvider.push({
            topic: constants.PASSIVE_COLLECTOR_PREFIX + that.collector.name,
            str: dataLine
          })
          break;
          */

          case 'Nsq Queue':
          nsqProvider.publish(constants.PASSIVE_COLLECTOR_PREFIX + that.collector.name,
            dataLine)
          .catch(err => {
            logger.error(3702,
              null,
              'Passive Collector Publish Problem',
              'Collector: ' + that.collector.name +
              ' Msg ' + data.toString() +
              ' publish failed: ' + err.stack)
          })
          break

          default: // fall back to redis
          redisProvider.publish(
            constants.PASSIVE_COLLECTOR_PREFIX + that.collector.name,
              dataLine
            )
            .then(() => {
              // pub success, do nothing
            }) // redisProvider.publish
            .catch((err) => {
              // console.log('PassiveCollector::start', JSON.stringify(err))
              logger.error(3701,
                  null,
                  'Passive Collector Publish Problem',
                  'Msg ' + line + ' publish failed: ' + err)
            })
          break;
        }
      }

      // Issue #41 - clear error tag
      that.lastActivity.stderr = null
    })
  }

  errHandler(data) {
    let that = this

    // save last activity
    let now = new Date()
    that.lastActivity.execCounter += 1
    that.lastActivity.ts = now.getTime()
    that.lastActivity.status = 'Success'
    that.lastActivity.stderr = data.toString()

    switch (that.collector.channel) {
      case 'Redis PubSub':
      redisProvider.publish(
        constants.PASSIVE_COLLECTOR_ERROR_PREFIX + that.collector.name,
        data.toString())
        .then(() => {
          // pub success, do nothing
        }) // redisProvider.publish
        .catch(err => {
          logger.error(3703,
            null,
            'Passive Collector Publish Problem',
            'Collector: ' + that.collector.name +
            ' Msg ' + data.toString() +
            ' publish failed: ' + err.stack)
        })
      break;

      /*
      case 'Nanomsg Queue':
      that.nanomsgQueueProvider.push({
        topic: constants.PASSIVE_COLLECTOR_ERROR_PREFIX + that.collector.name,
        str: data.toString()
      })
      break;
      */

      case 'Nsq Queue':
      nsqProvider.publish(constants.PASSIVE_COLLECTOR_ERROR_PREFIX + that.collector.name,
        data.toString())
      .catch(err => {
        logger.error(3702,
          null,
          'Passive Collector Publish Problem',
          'Collector: ' + that.collector.name +
          ' Msg ' + data.toString() +
          ' publish failed: ' + err.stack)
      })
      break

      default: // fall back to redis
      redisProvider.publish(
        constants.PASSIVE_COLLECTOR_ERROR_PREFIX + that.collector.name,
        data.toString())
        .then(() => {
          // pub success, do nothing
        }) // redisProvider.publish
        .catch(err => {
          logger.error(3703,
            null,
            'Passive Collector Publish Problem',
            'Collector: ' + that.collector.name +
            ' Msg ' + data.toString() +
            ' publish failed: ' + err.stack)
        })
      break;
    }
  }

  getLastActivity() {
    // console.log("getLastActivity", this.lastActivity)
    return this.lastActivity
  }

  getRunningFlag() {
    return this.runningFlag
  }

} // PassiveCollector

export default PassiveCollector
