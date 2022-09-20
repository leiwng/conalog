// Collector runtime manager - top module of collector system
// ** collector storage should be handled by router directly

import { ObjectID } from 'mongodb'
import Config from '../../config/config'
let config = Config.parseArgs()
import constants from '../../util/constants'
import MongoProvider from '../MongoProvider'
import RedisProvider from '../RedisProvider'
import Logger from '../Logger'

import { Collector, CollectorTask } from './CollectorTask'

// import NanomsgQueueProvider from '../NanomsgQueueProvider'

let mongoProvider = new MongoProvider()
let redisProvider = new RedisProvider()
let logger = new Logger('conalog-lib', 'CollectorManager')

class CollectorManager {
  constructor() {
    // wanted states - collector name list
    this.state = {
      plannedTaskList: []
    }

    let that = this

    // init actual status - collector task list
    this.runningTaskList = []

    redisProvider.exists(constants.PLANNED_TASK_LIST)
      .then(ret => {
        if (ret == 1) {
          redisProvider.lrange(constants.PLANNED_TASK_LIST, 0, -1)
            .then(list => {
              if (list !== undefined && list !== null)
                that.state.plannedTaskList = list
                // console.log('CollectorManager::constructor()', constants.PLANNED_TASK_LIST, list)
            })
        }
      })

      /*
      this.nanomsgQueueProvider = new NanomsgQueueProvider({
        protocol: config.nanomsgProtocol,
        host: config.nanomsgHost,
        requestPort: config.nanomsgRequestPort,
        startPort: config.nanomsgStartPort,
        endPort: config.nanomsgEndPort
      })
      */

      // sync wanted state and actual status
      this.loop = setInterval(this.sync.bind(this), constants.COLLECTOR_SYNC_LOOP)

      // Log
      logger.info(6104,
        null,
        'Task Manager Start',
        'Task manager started')
  }

  // user interface
  startCollector(id) {
    // update state
    let existFlag = false
    this.state.plannedTaskList.map(taskId => {
      if (taskId == id)
        existFlag = true
    })

    if (!existFlag) {
      // this.state.plannedTaskList.push(id)

      // TODO: write state to etcd
      redisProvider.rpush(constants.PLANNED_TASK_LIST, id.toString())
    }
  }

  startCollectorByName(name) {
    // query by name
    let query = { name: name }
    mongoProvider.query(constants.COLLECTOR_COLL, query)
      .then(collector => {
        let id = collector._id

        // update state
        let existFlag = this.state.plannedTaskList.map(taskId => {
          if (taskId == id)
            return true
          else
            return false
        })
        .reduce((prev, curr, index) => {
          if (prev == true || curr == true)
            return true
          else
            return false
        }, false)

        if (!existFlag)
        // this.state.plannedTaskList.push(id)

        // TODO : write state to etcd
        redisProvider.rpush(constants.PLANNED_TASK_LIST, id.toString())
      })
      .catch(err => {
        // we don't wish this to happen
        logger.error(6304,
          null,
          'Task Start Problem',
          'Task ' + name + ' not found')
      })
  }

  // user interface
  stopCollector(id) {
    // update state
    let index = -1
    this.state.plannedTaskList.map((taskId, taskIndex) => {
      if (taskId == id)
        index = taskIndex
    })

    if (index > -1)
    {
      // this.state.plannedTaskList.splice(index)

      // TODO : write state to etcd
      redisProvider.lrem(constants.PLANNED_TASK_LIST, 0, id.toString())
    }
  }

  stopCollectorByName(name) {
    let query = { name: name }
    mongoProvider.query(constants.COLLECTOR_COLL, query)
      .then(collector => {
        let id = collector._id.toString()

        // update state
        let index = -1
        this.state.plannedTaskList.map((taskId, taskIndex) => {
          if (taskId == id)
            index = taskIndex
        })

        if (index > -1)
        {
          // this.state.plannedTaskList.splice(index)

          // TODO : write state to etcd
          redisProvider.lrem(constants.PLANNED_TASK_LIST, 0, id)
        }

      })
  }

  sync() {
    let that = this

    // TODO : read state from etcd - only need to read plannedTaskList
    redisProvider.lrange(constants.PLANNED_TASK_LIST, 0, -1)
      .then(list => {
        if (list !== undefined && list !== null)
          that.state.plannedTaskList = list
          // console.log('CollectorManager::sync()', constants.PLANNED_TASK_LIST, list)
      })
      .catch(err => {
        logger.error(6305,
          null,
          'Task State Problem',
          'Task state read failed')
      })
    
    /*
    console.log('*** sync ***')
    console.log('planned', this.state.plannedTaskList)
    console.log('running', this.runningTaskList.map(item => {return item._id.toString()}))
    */
    
    // setup waiting collector
    this.state.plannedTaskList.map((taskId) => {
      let runFlag = this.runningTaskList.map((collectorTask) => {
        if (collectorTask._id.toString() == taskId)
          return true
        else
          return false
      })
      .reduce((prev, curr, index) => {
        if (prev == true || curr == true)
          return true
        else
          return false
      }, false)

      if (!runFlag)
      {
        // query json from mongodb
        // console.log('CollectorManager::sync - taskId', taskId)
        mongoProvider.query(constants.COLLECTOR_COLL, { _id: new ObjectID(taskId) })
          .then((json) => {
            if (json !== undefined && json !== null) {
              let taskJson = new CollectorTask({
                collectorJson: json
              })

              // start to work
              taskJson.work()
              this.runningTaskList.push(taskJson)

              logger.info(6101,
                null,
                'Task Start',
                'Task ' + json.name +
                ' ' + taskId + ' started')
            }
          })
          .catch((err) => {
            // console.log('sync error', err.stack)
            logger.info(6302,
              null,
              'Task Start Problem',
              'Task ' + taskId + ' not found, error stack: ' +
              err.stack)
          })
      }
    })

    // kill useless collector
    this.runningTaskList.map((collectorTask, index) => {
      let regFlag = this.state.plannedTaskList.map(taskId => {
        // console.log('sync', collectorTask._id, taskId)
        if (collectorTask._id.toString() == taskId)
          return true
        else
          return false
      })
      .reduce((prev, curr, i) => {
        if (prev == true || curr == true)
          return true
        else
          return false
      }, false)

      // console.log('sync regFlag', regFlag)
      if (!regFlag)
      {
        // kill this task
        collectorTask.rest()
        this.runningTaskList.splice(index, 1)

        logger.info(6103,
          null,
          'Task Stop',
          'Task ' + collectorTask.name +
          ' ' + collectorTask._id + ' stopped')
      }
    })

  } // sync

  getStatus(id) {
    let running = (this.runningTaskList.filter(curr => {
      if (curr._id.toString() == id)
        return true
      else
        return false
    }).length == 0) ? false : true

    if (running) {
      // get lastActivity
      let lastActivity = this.runningTaskList.map(task => {
        if (task._id.toString() == id)
          return task.getActivityInfo()
        else 
          return null
      })
      .filter(curr => {
        if (curr !== null)
          return true
        else
          return false
      })

      return { runningFlag: true, lastActivity: lastActivity[0] }
    }
    else 
      return { runningFlag: false }
  }

} // class CollectorManager

export default CollectorManager
