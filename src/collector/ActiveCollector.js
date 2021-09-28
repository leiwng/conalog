// ActiveCollector Runtime

import Promise from 'bluebird'
import { Client } from 'ssh2'
import jschardet from 'jschardet'
import encoding from 'encoding'
import { ObjectID } from 'mongodb'

import MongoProvider from '../MongoProvider'
import RedisProvider from '../RedisProvider'
import NsqProvider from '../NsqProvider'

import Logger from '../Logger'
import Config from '../../config/config'
let config = Config.parseArgs()
import constants from '../../util/constants'

let mongoProvider = new MongoProvider()
let redisProvider = new RedisProvider()
let nsqProvider = new NsqProvider()
let logger = new Logger('collector', 'active')

import getTimeString from '../../lib/DateUtil'

class ActiveCollector { 
  constructor({collectorJson}) {
    this.runningFlag = false
    this.collector = collectorJson
    // this.nanomsgQueueProvider = nanomsgQueueProvider
    this.connection = new Client()
    Promise.promisifyAll(this.connection)

    this.lastActivity = { execCounter: 0 }

    if (this.collector.param.charAt(0) !== ' ')
      this.remoteCmd = this.collector.cmd + ' ' + this.collector.param
    else
      this.remoteCmd = this.collector.cmd + this.collector.param

    return this
  }

  // user interface
  start() {
    // console.log('*** ActiveCollector#start() ***', this.collector._id)
    let that = this
    this.runningFlag = true

    // get cert from mongo
    mongoProvider.query(constants.CERT_COLL, {_id: new ObjectID(this.collector.host)})
      .then(cert => {
        that.cert = cert
        // connect ssh
        that.connection.on('error', err => {
          logger.error(3604,
              null,
              'Active Collector Exec Problem',
              'Active collector' +
              that.collector._id +
              ' ' + that.collector.name +
              ' connection failed: ' + JSON.stringify(err))
        })
        .on('ready', () => {
          // start setInterval
          if (that.collector.type == 'Time') {
            that.task = setInterval(that.exec.bind(that), constants.ACTIVE_TIME_COLLECTOR_INTERVAL)
          }
          if (that.collector.type == 'OneShot') {
            let exec = that.exec.bind(that)
            exec()
          }
          else { // Interval
            // convert trigger to ms - only consider hour, min and sec parts
            let trigger = new Date(parseInt(that.collector.trigger))
            // Issue #1
            // wherever the user is, we offset trigger at client side
            // so here, only consider UTC should be OK
            // eg. user timezone is +08:00:00, his/her timepicker will return 08:00:10(UTC) if user picks 00:00:10
            // so we do 08:00:10(UTC) - +08:00:00 = 00:00:10(UTC), and that is what we wanted
            let hour = trigger.getUTCHours()
            let min = trigger.getUTCMinutes()
            let sec = trigger.getUTCSeconds()
            let triggerMs = ((hour * 60 + min) * 60 + sec) * 1000

            that.task = setInterval(that.exec.bind(that), triggerMs)
          }
        }) // on ready
        .on('end', () => {
          if (that.runningFlag) {
            // we are running, so reconnect
            setTimeout(function() {
              that.connection.connect({
                host: cert.host,
                port: cert.port,
                username: cert.user,
                password: cert.pass,
                tryKeyboard: true
              })
            }, constants.SSH_RECONNECT_DELAY)
          }
        }) // on end
        .on('keyboard-interactive', (name, instr, lang, prompts, cb) => {
          if (~prompts[0].prompt.indexOf('Password:'))
            cb([cert.pass])
        })
        .connect({
          host: cert.host,
          port: cert.port,
          username: cert.user,
          password: cert.pass,
          tryKeyboard: true
        })
      })
      .catch(err => {
        logger.error(3605,
            null,
            'Active Collector Exec Problem',
            'Cert host ' +
            that.cert.host +
            'is not found. Collector name ' +
            ' ' + that.collector.name +
            + ' ' + JSON.stringify(err))
      })
  }

  stop() {
    this.runningFlag = false

    // stop setInterval
    if (this.collector.type == 'Time' || this.collector.type == 'Interval')
      clearInterval(this.task)

    // disconnect ssh
    this.connection.endAsync()
  }

  getLastActivity() {
    return this.lastActivity
  }

  getRunningFlag() {
    return this.runningFlag
  }

  // helper
  exec() {
    if (this.collector.type == 'Time') {
      // get nowTs - HH:mm:ss string
      let nowTs = getTimeString(new Date())
      // get HH:mm:ss part of trigger - trigger is UTC format
      let triggerTs = getTimeString(new Date(parseInt(this.collector.trigger)))
      if (nowTs == triggerTs) {
        return this.remoteCall()
      }
    }
    else { // Interval & OneShot      
      return this.remoteCall()
    }
  }

  remoteCall() {
    let that = this

    return this.connection.execAsync(this.remoteCmd)
      .then(stream => {
        stream.on('close', (code, signal) => {
          // this is ok - do nothing
        }) // on close
        .on('data', data => {
          // STDOUT
          // Issue #45 - split active collector results into lines
          // Modified by Xie Di, 2016.11.24, Issue #46 - encode to utf-8 before pub to redis
          let dataBuf = encoding.convert(data, 'utf-8', that.collector.encoding)
          let lines = dataBuf.toString('utf-8').split("\n")
          lines.map(line => {
            if (line == "") {
              // do nothing, just leave
              return
            }

            // save last activity
            let now = new Date()
            that.lastActivity.execCounter += 1
            that.lastActivity.ts = now.getTime()
            that.lastActivity.status = 'Success'            
            
            let dataLine = JSON.stringify({host: that.cert.host, startTs: now.getTime(), msg: line})
            that.lastActivity.stdout = dataLine

            switch (that.collector.channel) {
              case 'Redis PubSub':
              redisProvider.publish(
                constants.ACTIVE_COLLECTOR_PREFIX + that.collector.name,
                dataLine)
                .then(() => {
                  // pub success, do nothing
                }) // redisProvider.publish
                .catch(err => {
                  logger.error(3602,
                    null,
                    'Active Collector Publish Problem',
                    'Collector: ' + that.collector.name +
                    ' Msg ' + data.toString() +
                    ' publish failed: ' + err.stack)
                })
              break;

              /*
              case 'Nanomsg Queue':
              that.nanomsgQueueProvider.push({
                topic: constants.ACTIVE_COLLECTOR_PREFIX + that.collector.name,
                str: dataLine
              })
              break;
              */

              case 'Nsq Queue':
              nsqProvider.publish(constants.ACTIVE_COLLECTOR_PREFIX + that.collector.name,
                dataLine)
              .catch(err => {
                logger.error(3602,
                  null,
                  'Active Collector Publish Problem',
                  'Collector: ' + that.collector.name +
                  ' Msg ' + data.toString() +
                  ' publish failed: ' + err.stack)
              })
              break

              default: // fall back to redis
              redisProvider.publish(
                constants.ACTIVE_COLLECTOR_PREFIX + that.collector.name,
                dataLine)
                .then(() => {
                  // pub success, do nothing
                }) // redisProvider.publish
                .catch(err => {
                  logger.error(3602,
                    null,
                    'Active Collector Publish Problem',
                    'Collector: ' + that.collector.name +
                    ' Msg ' + data.toString() +
                    ' publish failed: ' + err.stack)
                })
              break;
            }

            // Issue #41 - clear error tag
            that.lastActivity.stderr = null
          })
        }) // on data
        .stderr.on('data', data => {
          // STDERR
          // save last activity
          let now = new Date()
          that.lastActivity.execCounter += 1
          that.lastActivity.ts = now.getTime()
          that.lastActivity.status = 'Success'
          that.lastActivity.stderr = data.toString()

          switch (that.collector.channel) {
            case 'Redis PubSub':
            redisProvider.publish(
              constants.ACTIVE_COLLECTOR_ERROR_PREFIX + that.collector.name,
              data.toString())
              .then(() => {
                // pub success, do nothing
              }) // redisProvider.publish
              .catch(err => {
                logger.error(3603,
                  null,
                  'Active Collector Publish Problem',
                  'Collector: ' + that.collector.name +
                  ' Msg ' + data.toString() +
                  ' publish failed: ' + err.stack)
              })
            break;

            /*
            case 'Nanomsg Queue':
            that.nanomsgQueueProvider.push({
              topic: constants.ACTIVE_COLLECTOR_ERROR_PREFIX + that.collector.name,
              str: data.toString()
            })
            break;
            */

            case 'Nsq Queue':
            nsqProvider.publish(constants.ACTIVE_COLLECTOR_ERROR_PREFIX + that.collector.name,
              data.toString())
            .catch(err => {
              logger.error(3602,
                null,
                'Active Collector Publish Problem',
                'Collector: ' + that.collector.name +
                ' Msg ' + data.toString() +
                ' publish failed: ' + err.stack)
            })
            break

            default: // fall back to redis
            redisProvider.publish(
              constants.ACTIVE_COLLECTOR_ERROR_PREFIX + that.collector.name,
              data.toString())
              .then(() => {
                // pub success, do nothing
              }) // redisProvider.publish
              .catch(err => {
                logger.error(3603,
                  null,
                  'Active Collector Publish Problem',
                  'Collector: ' + that.collector.name +
                  ' Msg ' + data.toString() +
                  ' publish failed: ' + err.stack)
              })
            break;
          }
        }) // stderr on data
      })
      .catch(err => {
        // save last activity
        let now = new Date()
        that.lastActivity.ts = now.getTime()
        that.lastActivity.status = 'Error'
        that.lastActivity.stderr = err.stack

        logger.error(3601,
          null,
          'Active Collector Exec Problem',
          'Active collector ' + that.collector.name + ' exec failed: ' + err.stack)
      })
  }

} // class ActiveCollector

export default ActiveCollector
