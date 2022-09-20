import _ from 'lodash'
import Crypto from 'crypto'
import constants from '../util/constants'
import authorize from '../lib/AuthProvider'
import Promise from 'bluebird'
import { Client } from 'ssh2'

import { ObjectID } from 'mongodb'
import MongoProvider from '../lib/MongoProvider'
let mongoProvider = new MongoProvider()

import CertManager from '../lib/CertManager'
let certManager = new CertManager()

import Logger from '../lib/Logger'
let logger = new Logger('routes', 'cert')

import express from 'express'
let router = express.Router()

router.use(authorize)

let decryptPass = (name, host, pass, ts) => {
  // console.log('certificates.js:24', name, host, pass, ts)

  let query = { name: name }

  return mongoProvider.query(constants.USER_COLL, query)
    .then(user => {
      if (user !== undefined && user !== null) {
        // got conalog user, now create key
        let keySeed = host + user.pass + ts
        let hash = Crypto.createHash('sha256')
        hash.update(keySeed)
        let key = hash.digest()

        // got key, now decode pass
        let iv = ''
        let decipher = Crypto.createDecipheriv('aes-256-cbc', key, iv)
        decipher.setAutoPadding = true
        let decodedPass = decipher.update(pass, 'hex', 'ascii')
        decodedPass += decipher.final('ascii')

        return decodedPass
      }
      else
        throw new Error('Cannot find user. name: ' + name)
    })
}

let encryptPass = (name, host, pass, ts) => {
  let query = { name: name }

  return mongoProvider.query(constants.USER_COLL, query)
    .then(user => {
      if (user !== undefined && user !== null) {
        // got conalog user, now create key
        let keySeed = host + user.pass + ts
        let hash = Crypto.createHash('sha256')
        hash.update(keySeed)
        let key = hash.digest()

        // got key, now encode pass
        let iv = ''
        let cipher = Crypto.createCipheriv('aes-256-cbc', key, iv)
        cipher.setAutoPadding = true
        // TODO : check the following ascii hex thing...
        let encodedPass = cipher.update(pass, 'ascii', 'hex')
        encodedPass += cipher.final('hex')

        return encodedPass
      }
      else
        throw new Error('Cannot find user. name: ' + name)
    })
}

// restful api - standard CRUD

// create
router.post('/', (req, res, next) => {
  let host = req.body.host
  let port = req.body.port
  let user = req.body.user // remote system ssh cert user
  let pass = req.body.pass
  let ts = req.body.ts
  let name = req.body.name // conalog user name

  certManager.addCert(host, port, user, pass, ts)
    .then(idJson => {
      res.json(idJson)
    })
    .catch(err => {
      logger.error(21104,
      null,
      'Certificate Creation Problem',
      'Add certificate failed, name: ' + name +
      ', error: ' + JSON.stringify(err))

      res.status(500).json(err)
    })
})

// query by host
router.get('/:host', (req, res, next) => {
  let host = req.params.host
  let name = req.query.name

  certManager.getCert(host)
    .then(cert => {
      /*
      encryptPass(name, host, cert.pass, cert.ts)
        .then(encodedPass => {
          if (encodedPass != null) {
            cert.pass = encodedPass
            res.json(cert)
          }
          else {

          }
        })
      */
      res.json(cert)
    })
    .catch(err => {
      logger.warning(21105,
        null,
        'Cert Query Problem',
        'Cert host: ' + host + ' query failed.')

      res.status(500).json(err)
    })
})

// list
router.get('/', (req, res, next) => {
  let query = {}

  let id = req.query.id
  if (id !== undefined && id !== null) 
    query['_id'] = new ObjectID(id)
  
  let host = req.query.host
  if (host !== undefined && host !== null)
    query['host'] = host

  certManager.listCerts(query)
    .then(list => {
      res.json(list)
    })
    .catch(err => {
      logger.warning(21106,
        null,
        'Cert Query Problem',
        'Cert list failed.')

      res.status(500).json(err)
    })
})

// validate
router.get('/:id/validation/', (req, res, next) => {
  let query = {}
  let id = req.params.id
  if (id !== undefined && id !== null)
    query['_id'] = new ObjectID(id)
  else {
    res.sendStatus(412)
    return
  }

  mongoProvider.query(constants.CERT_COLL, query)
    .then(cert => {
      let data = ''

      // got pass, now check cert
      let connection = new Client()
      Promise.promisifyAll(connection)
      connection.on('ready', () => {
        connection.exec('echo conalog', (err, stream) => {
          if (err) {
            logger.warning(21101,
              null,
              'Cert Creation Problem',
              'Remote command failed.')

            // error
            res.sendStatus(500)
          }
          else {
            stream.on('close', (code, signal) => {
              // check data
              if (data == 'conalog') {
                // ok, save cert
                certManager.updateCert(host, port, user, decodedPass, ts)
                  .then(() => {
                    res.sendStatus(200)
                  }) // certManager.addCert
              }
              else {
                logger.warning(21102,
                  null,
                  'Cert Creation Problem',
                  'Remote reply not received.')

                res.sendStatus(500)
              }
            }) // stream.onClose
            .on('data', str => {
              data += str
            }) // stream.onData
          }
        }) // connection.exec
      }) // connection.onReady
      .connect({
        host: host,
        port: port,
        username: user,
        password: decodedPass
      })
    })
    .catch(err => {
      logger.warning(21102,
        null,
        'Cert Validation Problem',
        'Cert id: ' + id + ' not found.')

      res.status(500).json(err)
    })
})

// update
router.put('/', (req, res, next) => {
  let id = req.body._id
  let host = req.body.host
  let port = req.body.port
  let user = req.body.user // remote system ssh cert user
  let pass = req.body.pass
  let ts = req.body.ts
  let name = req.body.name // conalog user name

  // 1. query user pass
  mongoProvider.query(constants.USER_COLL, {name: name})
    .then(result => {
      if (result !== undefined && result !== null) {
        /*
        // got user, now create key
        let keySeed = host + result.pass + ts
        let hash = Crypto.createHash('sha256')
        hash.update(keySeed)
        let key = hash.digest()

        // got key, now decode pass
        let iv = ''
        let decipher = Crypto.createDecipheriv('aes-256-ecb', key, iv)
        decipher.setAutoPadding = true
        let decodedPass = decipher.update(pass, 'hex', 'ascii')
        decodedPass += decipher.final('ascii')
        */

        certManager.updateCert(id, host, port, user, pass, ts)
          .then(ret => {
            res.json(ret)
          })

        /*
        decryptPass(result.name, host, pass, ts)
          .then(decodedPass => {
            console.log('certificates.js:260', 'decodedPass', decodedPass)

            certManager.updateCert(id, host, port, user, decodedPass, ts)
              .then(idJson => {
                res.json(idJson)
              })
          })
        */
      }
      else {
        logger.warning(21103,
          null,
          'Cert Update Problem',
          'No user named: ' + name + ' found.')

        res.status(404)
      }
    }) // mongoProvider.query
    .catch(err => {
      logger.warning(21104,
        null,
        'Cert Update Problem',
        'User ' + name + ' query failed.')

      // console.log('certificates.js:299', err.stack)
      res.status(500).json(err)
    })
})

// remove
router.delete('/:id', (req, res, next) => {
  let id = req.params.id
  let query = { _id: new ObjectID(id) }
  
  certManager.removeCert(query)
    .then(ret => {
      res.json(ret)
    })
    .catch(err => {
      logger.warning(21105,
        null,
        'Cert Delete Problem',
        'Cert id: ' + id + ' delete failed.')

      res.sendStatus(500)
    })
})

router.delete('/', (req, res, next) => {
  let query = {}
  
  let ids = req.query['idList[]']
  if (typeof(ids) == 'string')
    query = { _id: new ObjectID(ids) }
  else
    query = { _id: { $in: ids.map(id => {
      return new ObjectID(id)
    })} }
  
  certManager.removeCert(query)
    .then(idList => {
      res.json(idList)
    })
    .catch(err => {
      logger.warning(21105,
        null,
        'Cert Delete Problem',
        'Cert host: ' + host + ' delete failed.')

      res.status(500).json(err.stack)
    })
})

module.exports = router
