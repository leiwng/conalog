import MongoProvider from '../lib/MongoProvider'
import Logger from '../lib/Logger'
import Config from '../config/config'
let config = Config.parseArgs()
import constants from '../util/constants'
import program from 'commander'

let logger = new Logger('coanlog-lib', 'init-script')
let mongoProvider = new MongoProvider()

let init = () => {
  // insert default user at the first startup
  mongoProvider.query(constants.USER_COLL, {name: 'admin'})
    .then(user => {
      if (user === null || user === undefined) {
        mongoProvider.insert(constants.USER_COLL, {name: 'admin', pass: 'admininitpass'})
      }
    })

  let config = Config.parseArgs()

  // log start
  logger.warning(2901,
    null,
    'System start',
    'Conalog sytem started')

  // setup to clean logs
  let now = new Date()
  let limit = now.getTime() - config.logLifespan
  let limitDate = new Date(limit)

  let query = { ts: { $lt: limit } }
  mongoProvider.delete(constants.LOG_COLL, query)
    .then(() => {
      logger.warning(2902,
        null,
        'Log cleared',
        'Logs before ' + limitDate + ' are cleared')
    })
    .catch(err => {
      logger.warning(2901,
        null,
        'Log clear problem',
        'Logs before ' + limitDate + ' are failed to be cleared, err: ' + err)
    })

  setInterval(function() {
    let now = new Date()
    let limit = now.getTime() - config.logLifespan

    let limitDate = new Date(limit)
    let query = { ts: { $lt: limit } }
    mongoProvider.delete(constants.LOG_COLL, query)
      .then(() => {
        logger.warning(2902,
          null,
          'Log cleared',
          'Logs before ' + limitDate + ' are cleared')
      })
      .catch(err => {
        logger.warning(2901,
          null,
          'Log clear problem',
          'Logs before ' + limitDate + ' are failed to be cleared, err: ' + err)
      })
  }, 60 * 60 * 1000)
}

export default init
