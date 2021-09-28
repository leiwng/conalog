import MongoProvider from '../lib/MongoProvider'

import { expect } from 'chai'

let mongoProvider = new MongoProvider()

describe('MongoProvider Testsuit', function() {
  it('Insert Test', function() {
    return mongoProvider.insert('conalog_test', {'test': 'MongoProvider Testsuit'})
      .then((ret) => {
        expect(ret.result.n).to.equal(1)
      })
  })

  it('Query Test', function() {
    return mongoProvider.query('conalog_test', {'test': 'MongoProvider Testsuit'})
      .then((ret) => {
        expect(ret.test).to.equal('MongoProvider Testsuit')
      })
  })

  it('Update Test', function() {
    return mongoProvider.update('conalog_test', {'test': 'MongoProvider Testsuit'}, {$set: {'update': 'done'}})
      .then((ret) => {
        expect(ret.result.n).to.equal(1)
      })
  })

  it('List Test 1st stage', function() {
    return mongoProvider.insert('conalog_test', {'test': 'MongoProvider Testsuit'})
      .then(insertRet => {
        return mongoProvider.list('conalog_test', {'test': 'MongoProvider Testsuit'}, 2, null, 0)
          .then(ret => {
            expect(ret).to.have.length(2)
          })
      })
  })

  it('List Test 2nd stage', function() {
    return mongoProvider.insert('conalog_test', {'test': 'MongoProvider Testsuit'})
      .then(insertRet => {
        return mongoProvider.list('conalog_test', {}, 1024, null, 0)
          .then(ret => {
            expect(ret).to.have.length(3)
          })
      })
  })

  it('Delete Test', function() {
    return mongoProvider.delete('conalog_test', {'test': 'MongoProvider Testsuit'})
      .then((ret) => {
        expect(ret.result.n).to.equal(3)
      })
  })
})
