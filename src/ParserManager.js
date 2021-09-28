import _ from 'lodash'
import ChildProcess from 'child_process'
import fs from 'fs'
import Promise from 'bluebird'

import Logger from '../lib/Logger'
let logger = new Logger('coanlog-lib', 'ParserManager')

import Config from '../config/config'
let config = Config.parseArgs()
import constants from '../util/constants'

import { ObjectID } from 'mongodb'
import MongoProvider from '../lib/MongoProvider'
import RedisProvider from '../lib/RedisProvider'

let mongoProvider = new MongoProvider()
let redisProvider = new RedisProvider()

class ParserManager {
  constructor() {
    let that = this
    this.instanceTable = []

    // read instance table from redis
    redisProvider.get(constants.PLANNED_PARSER_LIST)
      .then(instanceList => {
        instanceList = JSON.parse(instanceList)
        // console.log('ParserManager::constructor', instanceList)

        if (instanceList != null && instanceList !== undefined && instanceList.length != 0)
          instanceList.map(instance => {
            that.startInstance({parserId: instance})
          })
      })
  }

  startInstance({parserId: parserId}) {
    let that = this
    let query = {_id: new ObjectID(parserId)}

    return mongoProvider.query(constants.PARSER_COLL, query)
      .then(parser => {
        if (_.isEmpty(parser))
          throw new Error('No such parser found. parserId: ' + parserId)
        else {
          let path = parser.path
          let inChannel = parser.input.channel
          let inType = parser.input.type
          let outChannel = parser.output.channel
          let outType = parser.output.type
          let parameter = parser.parameter

          let child = ChildProcess.fork(config.parserPathPrefix + path, 
            [config.redisUrl, config.nsqdUrl, config.nsqlookupdUrl, inChannel, inType, outChannel, outType, parameter])

          /*
          child.on('newListener', (event, listener) => {
            console.log("ParserManager::startInstance", "newListener", event)
          })
          */

          let exitHandler = (code, signal) => {
            // log exit event
            logger.warning(2707,
              null,
              'Parser Instance Exit',
              JSON.stringify({instanceId: that.instanceId, parserName: parser.name, code: code, signal: signal}))
              
            // remove this child info from instanceTable
            that.instanceTable.filter(curr => {
              let pid = curr.process.pid
              if (pid == that.pid) {
                clearInterval(curr.interval)
                return false
              }
              else
                return true
            })

            // sync instance table to redis
            let instanceList = that.instanceTable.map(instance => {
              return instance.parserId
            })
            redisProvider.set(constants.PLANNED_PARSER_LIST, JSON.stringify(instanceList))
          }
          exitHandler = exitHandler.bind(child)

          child.on('exit', exitHandler)
          // child.on('disconnect', exitHandler)

          child.on('message', lastActivity => {
            // save lastActivity to instanceTable
            that.instanceTable = that.instanceTable.map(curr => {
              if (curr.instanceId == this.instanceId)
                curr.lastActivity = lastActivity
              return curr
            })
          })
          
          let instanceId = new Date().getTime().toString()
          child.instanceId = instanceId
          let childInfo = {id: instanceId, parserId: parser._id.toString(), process: child}
          that["pid"] = childInfo.process.pid

          childInfo.interval = setInterval(() => {
            try {
              child.send({GET: 'lastActivity'})
            }
            catch(err) {
              logger.error(3705,
                null,
                'Parser Process Info Query Problem',
                'error: ' + JSON.stringify(err))
            }
          }, constants.PARSER_LAST_ACTIVITY_INTERVAL)

          that.instanceTable.push(childInfo)

          // sync instance table to redis
          let instanceList = that.instanceTable.map(instance => {
            return instance.parserId
          })
          redisProvider.set(constants.PLANNED_PARSER_LIST, JSON.stringify(instanceList))

          let idJson = {id: instanceId}
          return idJson
        }
      })
  }

  stopInstance({instanceId: instanceId}) {
    let that = this
    that.pid = undefined
    let childInfo = this.instanceTable.reduce((prev, curr) => {
      if (prev != null)
        return prev
      else if (curr.id == instanceId)
        return curr
    }, null)

    // console.log('stopInstance', instanceId, childInfo)

    if (childInfo !== undefined && childInfo != null) {
      try {
        clearInterval(childInfo.interval)
        childInfo.process.disconnect()
        // send SIGKILL since we are using node for parser - and node exits unconditionally when received SIGKILL
        childInfo.process.kill('SIGKILL')
      }
      catch(err) {
        logger.error(3706,
          null,
          'Parser Process Stopping Problem',
          'error: ' + JSON.stringify(err))
      }
      finally {
        this.instanceTable = this.instanceTable.filter(curr => {
          if (curr.id == instanceId)
            return false
          else
            return true
        })
  
        // sync instance table to redis
        let instanceList = that.instanceTable.map(instance => {
          return instance.parserId
        })
        // console.log('ParserManager::stopInstance', instanceList)
        redisProvider.set(constants.PLANNED_PARSER_LIST, JSON.stringify(instanceList))
  
        return {id: childInfo.instanceId}
      }
    }
    else
      return {}
  }

  queryInstanceById({id: id}) {
    let childInfo = this.instanceTable.reduce((prev, curr) => {
      if (prev != null)
        return prev
      else if (curr.id == id)
        return curr
    }, null)

    if (childInfo !== undefined && childInfo != null) {
      let instanceInfo = {
        id: id,
        parserId: childInfo.parserId,
        lastActivity: childInfo.lastActivity
      }

      return instanceInfo
    }

    return null
  }

  listInstance({parserId: parserId}) {
    // console.log('ParserManager::listInstance this.instanceTable', this.instanceTable)

    let instanceList = []

    if (parserId !== undefined && parserId != null) {
      let parserInstances = this.instanceTable.filter(instance => {
        if (instance.parserId == parserId)
          return true
        else
          return false
        })

        let instanceCount = parserInstances.length

        if (instanceCount != 0) {
          instanceList = parserInstances.map(curr => {
            let instanceInfo = {
              id: curr.id,
              parserId: curr.parserId,
              lastActivity: curr.lastActivity
            }

            return instanceInfo
          })
        }
    }
    else {
      // no parser specified, return all instance
      instanceList = this.instanceTable.map(curr => {
        let instanceInfo = {
          id: curr.id,
          parserId: curr.parserId,
          lastActivity: curr.lastActivity
        }

        return instanceInfo
      })
    }

    return instanceList
  }

  listScript() {
    let promise = new Promise((resolve, reject) => {
      fs.readdir(config.parserPathPrefix, (err, files) => {
        if (err)
          reject(err)
        else
          resolve(files)
      })
    })

    return promise
  }

}

export default ParserManager
