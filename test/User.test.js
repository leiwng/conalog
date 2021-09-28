import app from '../app'
import request from 'supertest'
import MongoProvider from '../lib/MongoProvider'
import Config from '../config/config'
let config = Config.parseArgs()
import constants from '../util/constants'
import {expect} from 'chai'
import Crypto from 'crypto'

let mongoProvider = new MongoProvider()
let access_token = ''

describe('User Testsuit', function() {
  let httpAgent = request.agent(app)

  before(function() {
    // write a dummy user for testing
    return mongoProvider.insert(constants.USER_COLL, {
      name: 'test',
      pass: 'password'
    })
  })

  after(function() {
    // clean the dummy user
    return mongoProvider.delete(constants.USER_COLL, {
      name: 'test'
    })
  })

  it('Login Test',  function() {
    let hash  = Crypto.createHash('sha256')
    let now = new Date()
    let salt = now.getTime()
    hash.update('password' + salt.toString())

    let url = '/users/login' +
      '?user=test&pass=' + hash.digest('hex') +
      '&salt=' + salt.toString()
    // console.log(url)

    return httpAgent
      .get(url)
      .expect(res => {
        if (res.statusCode == 200) {
          // save token
          access_token = res.text
        }
      })
      .expect(200)
  }) // it

  it('Management Test', function() {
    // this.timeout(5000)

    let hash  = Crypto.createHash('sha256')
    let now = new Date()
    let salt = now.getTime()
    hash.update('password' + salt.toString())

    let url = '/users/update'

    let json = {
      oldpass: hash.digest('hex'),
      newpass: 'newpassword',
      salt: salt.toString()
    }

    return httpAgent
      .post(url)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .send(json)
      .expect(200)
  }) // it

}) // describe
