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
let active_collector_id = ''
let active_collector_name = 'test-active-collector'

describe('Collector Testsuit', function() {
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
    .then(() => {
      return mongoProvider.delete(constants.COLLECTOR_COLL, {
        name: active_collector_name
      })
    })
  })

  it('Create Active Collector Test',  function() {
    let now = new Date()
    let url = '/collector/active'

    // create trigger object
    let trigger = new Date()
    trigger.setUTCHours(0)
    trigger.setUTCMinutes(0)
    trigger.setUTCSeconds(10)
    trigger.setUTCMilliseconds(0)

    let activeCollector = {
      ts: now.getTime,
      name: active_collector_name,
      category: 'active',
      type: 'Interval',
      trigger: trigger,
      cmd: 'ls',
      param: '-a',
      host: '127.0.0.1'
    }

    return httpAgent
      .post(url)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .send(activeCollector)
      .expect(res => {
        if (res.statusCode == 200) {
          // save collector ID
          active_collector_id = res.text
        }
      })
      .expect(200)
  }) // it

  it('Update Active Collector Test',  function() {
    let now = new Date()
    let url = '/collector/active'

    // create trigger object - update to 20s
    let trigger = new Date()
    trigger.setUTCHours(0)
    trigger.setUTCMinutes(0)
    trigger.setUTCSeconds(20)
    trigger.setUTCMilliseconds(0)

    let activeCollector = {
      ts: now.getTime,
      name: active_collector_name,
      category: 'active',
      type: 'Interval',
      trigger: trigger,
      cmd: 'ls',
      param: '-a',
      host: '127.0.0.1'
    }

    return httpAgent
      .put(url)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .send(activeCollector)
      .expect(200)
  }) // it

  it('Query Active Collector Test Stage 1',  function(done) {
    let now = new Date()
    let url = '/collector'

    httpAgent
      .get(url + '/' + active_collector_id)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .end((err, res) => {
        if (err)
          return done(err)

        if (res.statusCode == 200) {
          // check res.body.name
          if (res.body.name == active_collector_name)
            done()
          else
            return done({errMsg: 'Inconsistent query result.',
              'res.body.name': res.body.name,
              'expected': activeCollector.name})
        }
      })
  }) // it

  it('Query Active Collector Test Stage 2',  function(done) {
    let url = '/collector/id/' + active_collector_name

    httpAgent
      .get(url)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .end((err, res) => {
        if (err)
          return done(err)

        if (res.statusCode == 200) {
          // check res.body
          // console.log(res)
          if (res.text == active_collector_id)
            done()
          else
            return done({errMsg: 'Inconsistent query result.',
              'res.text': res.text,
              'expected': active_collector_id})
        }
        else {
          return done({errMsg: 'Query failed.',
            'res.statusCode': res.statusCode})
        }
      })
  }) // it

  it('List Active Collector Test',  function(done) {
    let now = new Date()
    let url = '/collector/list/active'

    httpAgent
      .get(url)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .expect(200, (err, res) => {
        if (err)
          return done(err)

        if (res.body.activeCollectorList.length > 0)
          done()
        else
          return done({errMsg: 'Unexpected result length.',
            'res.body.activeCollectorList.length': res.body.activeCollectorList.length})
      })
  }) // it

  it('Start Active Collector Test',  function() {
    let now = new Date()
    let url = '/collector/start'

    return httpAgent
      .get(url + '/' + active_collector_id)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .expect(200)
  }) // it

  it('Stop Active Collector Test',  function() {
    let now = new Date()
    let url = '/collector/stop'

    return httpAgent
      .get(url + '/' + active_collector_id)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .expect(200)
  }) // it

  it('Delete Active Collector Test',  function() {
    let now = new Date()
    let url = '/collector/active'

    let name = 'test_active_collector'
    let json = { 'list[]': [ active_collector_id ] }

    return httpAgent
      .delete(url)
      .set(constants.ACCESS_TOKEN_NAME, access_token)
      .send(json)
      .expect(200)
  }) // it

}) // describe
