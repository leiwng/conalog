import Logger from '../lib/Logger'
import MongoProvider from '../lib/MongoProvider'

import {expect} from 'chai'

let logger = new Logger('Unit Test', 'Logger Testsuit')
let mongoProvider = new MongoProvider()

describe('Logger Testsuit', function() {
  this.timeout(5000)

  it('Log Test', function() {
    logger.debug(0, null, 'Test', 'Log Test')

    // wait for 1s
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        mongoProvider.delete('log', {eventId: 0})
          .then(ret => {
            // console.log('Log Test', ret)
            expect(ret.result.ok).to.equal(1)
            resolve(ret)
          })
          .catch(err => {
            reject(err)
          })
      }, 1000)
    })

  }) // it
}) // describe
