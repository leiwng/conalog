import os from 'os'
import MongoProvider from './MongoProvider.js'
// import Promise from 'bluebird'
import Config from '../config/config'
let config = Config.parseArgs()
// import constants from '../util/constants.js'

let LOG_LEVEL = {
  'debug': 0,
  'info': 1,
  'warning': 2,
  'error': 3,
}

class Logger {
  constructor(module, source) {
    this.persistentProvider = new MongoProvider()

    this.module = module
    this.source = source
    this.level = LOG_LEVEL[config.logLevel]
    // console.log('Logger::constructor level:', this.level)
    this.machine = os.hostname()
  }

  log(level, eventId, user, type, desc) {
    // check log level
    if (this.level > level)
      return

    let now = new Date()
    let logJson = {
      ts: now.getTime(),
      level: level,
      module: this.module,
      source: this.source,
      eventId: eventId,
      user: user,
      machine: this.machine,
      type: type,
      desc: desc
    }

    // console.log('log info:', logJson)

    // send log to mongodb
    this.persistentProvider.insert('log', logJson)
  }

  debug(eventId, user, type, desc) {
    this.log('debug', eventId, user, type, desc)
  }

  info(eventId, user, type, desc) {
    this.log('info', eventId, user, type, desc)
  }

  warning(eventId, user, type, desc) {
    this.log('warning', eventId, user, type, desc)
  }

  error(eventId, user, type, desc) {
    this.log('error', eventId, user, type, desc)
  }
}

export default Logger
