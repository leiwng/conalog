import app from '../app'
import request from 'supertest'
import MongoProvider from '../lib/MongoProvider'
import Config from '../config/config'
let config = Config.parseArgs()
import constants from '../util/constants'
import {expect} from 'chai'
import Crypto from 'crypto'
import _ from 'lodash'

let mongoProvider = new MongoProvider()
let access_token = ''

// be ware - we'll encrypt pass later
let now = new Date()
let cert = {
  host: '127.0.0.1',
  port: 22,
  user: 'test_user', // this is remote ssh username
  pass: 'test_pass',
  ts: now.getTime(),
  name: 'test' // this is conalog user name
}

// cert codec
let encodePass = (rawCert, conalogPass) => {
  // 1. create key
  let keySeed = rawCert.host + conalogPass + rawCert.ts
  let hash = Crypto.createHash('sha256')
  hash.update(keySeed)
  let key = hash.digest()

  // 2. encode pass
  let cipher = Crypto.createCipheriv('aes-256-cbc', key, '')
  cipher.setAutoPadding = true
  let encodedPass = cipher.update(rawCert.pass, 'ascii', 'hex')
  encodedPass += cipher.final('hex')

  return encodedPass
}

let decodePass = (encodedCert, conalogPass) => {
  // 1. create key
  let keySeed = encodedCert.host + conalogPass + encodedCert.ts
  let hash = Crypto.createHash('sha256')
  hash.update(keySeed)
  let key = hash.digest()

  // 2. decode pass
  let decipher = Crypto.createDecipheriv('aes-256-cbc', key, '')
  let decodedPass = decipher.update(encodedCert.pass, 'hex', 'ascii')
  decodedPass += decipher.final('ascii')

  return decodedPass
}

describe('Cert Testsuit', function() {
  this.timeout(5000) // set logger timeout for mongodb init
  let httpAgent = request.agent(app)

  before(function() {
    // write a dummy user for testing
    return mongoProvider.insert(constants.USER_COLL, {
      name: 'test',
      pass: 'password'
    })
    .then(() => {
      let hash  = Crypto.createHash('sha256')
      let now = new Date()
      let salt = now.getTime()
      hash.update('password' + salt.toString())

      let url = '/users/login' +
        '?user=test&pass=' + hash.digest('hex') +
        '&salt=' + salt.toString()

      return httpAgent
        .get(url)
        .expect(res => {
          if (res.statusCode == 200) {
            // save token
            access_token = res.text
          }
        })
        .expect(200)
    })
  })

  after(function() {
    // clean the dummy user
    return mongoProvider.delete(constants.USER_COLL, {
      name: 'test'
    })
  })

  it('Create Cert Test',  function() {
    let now = new Date()
    let url = '/cert'

    let encryptedPass = encodePass(cert, 'password') // we just inserted a test user whose pass is 'password'
    // BE WARE - now cert is encrypted
    cert.pass = encryptedPass

    return httpAgent
      .post(url)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .send(cert)
      .expect(200)
  }) // it

  it('Query Cert Test',  function(done) {
    let now = new Date()
    let url = '/cert'

    httpAgent
      .get(url + '/' + cert.host)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .end((err, res) => {
        if (err)
          return done(err)

        if (res.statusCode == 200) {
          // check res.body.pass
          let decodedPass = decodePass(cert, 'password')
          if (res.body.pass == decodedPass) {
            cert = _.assign({}, res.body)
            done()
          }
          else
            return done({errMsg: 'Inconsistent query result.',
              'res.body.pass': res.body.pass,
              'expected': decodedPass})
        }
      })
  }) // it

  it('Update Cert Test',  function() {
    // console.log('Update Test', cert)
    let now = new Date()
    let url = '/collector/active'

    cert.port = 23

    return httpAgent
      .put(url)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .send(cert)
      .expect(200)
  }) // it

  it('List Cert Test',  function(done) {
    let now = new Date()
    let url = '/cert'

    httpAgent
      .get(url)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .expect(200, (err, res) => {
        if (err)
          return done(err)

        if (res.body.length > 0)
          done()
        else
          return done({errMsg: 'Unexpected result length.',
            'res.body.length': res.body.length})
      })
  }) // it

  it('Delete Cert Test',  function() {
    let now = new Date()
    let url = '/cert'

    return httpAgent
      .delete(url + '/' + cert.host)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .expect(200)
  }) // it

}) // describe
