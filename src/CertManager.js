import Promise from 'bluebird'
import Logger from './Logger'
import Config from '../config/config'
let config = Config.parseArgs()
import constants from '../util/constants'

import { ObjectID } from 'mongodb'
import MongoProvider from './MongoProvider'

import Crypto from 'crypto'

let logger = new Logger('conalog-lib', 'CertManager')
let mongoProvider = new MongoProvider()

class CertManager {
  constructor() {

  }

  // user interface
  addCert(host, port, user, pass, ts) {
    return new Promise.Promise((resolve, reject) => {
			mongoProvider.insert(constants.CERT_COLL, {
				host: host,
				port: port,
				user: user,
				pass: pass,
				ts: ts
			})
				.then(ret => {
					if (ret.result.ok == 1)
						resolve(ret)
					else {
						logger.error(31001,
							null,
						'Cert Insertion Problem',
						JSON.stringify(ret))

						reject({
							msg: 'Cert insertion failed.',
							info: ret
						})
					}
				}) // mongoProvider.insert
				.catch(err => {
					logger.error(31002,
						null,
					'Cert Insertion Problem',
					JSON.stringify(err))

					reject({
						msg: 'Cert insertion error.',
						info: err
					})
				})
	}) // new Promise()
}

removeCert(query) {
	return new Promise((resolve, reject) => {
		mongoProvider.delete(constants.CERT_COLL, query)
			.then(ret => {
				if (ret.result.ok > 0)
					resolve(ret)
				else {
					logger.error(31004,
						null,
						'Cert Remvoe Problem',
						JSON.stringify(ret))

					reject({
						msg: 'Cert remove failed',
						info: ret
					})
				}
			}) // mongoProvider.delete
			.catch(err => {
				logger.error(31005,
					null,
					'Cert Remvoe Problem',
					JSON.stringify(err))

				reject({
					msg: 'Cert remove failed',
					info: err
				})
			})
    })
  }

  updateCert(id, host, port, user, pass, ts) {
    console.log('CertManager.js:118', id, host, port, user, pass, ts)
    return new Promise((resolve, rejct) => {
      mongoProvider.update(constants.CERT_COLL,
        {_id: new ObjectID(id)},
        {
          _id: new ObjectID(id),
          host: host,
          port: port,
          user: user,
          pass: pass,
          ts: ts
        })
        .then(ret => {
          if (ret.result.ok > 0)
            resolve(ret)
          else {
            logger.error(31008,
              null,
              'Cert Update Problem',
              JSON.stringify(ret))

            reject({
              msg: 'Cert update failed',
              info: ret
            })
          }
        })
        .catch(err => {
          logger.error(31009,
            null,
            'Cert Update Problem',
            JSON.stringify(err))

          reject({
            msg: 'Cert update failed',
            info: err
          })
        })
    })
  }

  listCerts() {
    return new Promise((resolve, reject) => {
      mongoProvider.list(constants.CERT_COLL, {}, constants.CERT_LIMIT, null, 0)
        .then(ret => {
          if (ret !== undefined && ret !== null)
            resolve(ret)
          else {
            logger.error(31006,
              null,
              'Cert List Problem',
              JSON.stringify(ret))

            reject({
              msg: 'Cert list failed',
              info: ret
            })
          }
        }) // mongoProvider.query
        .catch(err => {
          logger.error(31007,
            null,
            'Cert List Problem',
            JSON.stringify(err))

          reject({
            msg: 'Cert list failed',
            info: err
          })
        })
    })
  }

  getCert(host) {
    return new Promise((resolve, reject) => {
      mongoProvider.query(constants.CERT_COLL, {host: host})
        .then(ret => {
          if (ret !== undefined && ret !== null)
            resolve(ret)
          else {
            logger.error(31006,
              null,
              'Cert Query Problem',
              JSON.stringify(ret))

            reject({
              msg: 'Cert query failed',
              info: ret
            })
          }
        }) // mongoProvider.query
        .catch(err => {
          logger.error(31007,
            null,
            'Cert Query Problem',
            JSON.stringify(err))

          reject({
            msg: 'Cert query failed',
            info: err
          })
        })
    })
  }
}

export default CertManager
