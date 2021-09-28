import { MongoClient } from 'mongodb'
import Promise from 'bluebird'
import Config from '../config/config'
let config = Config.parseArgs()
import constants from '../util/constants'

Promise.promisifyAll(MongoClient)

class MongoProvider {
  constructor() {
    this.init = MongoClient.connectAsync(config.mongoUrl)
      .then(db => {
        Promise.promisifyAll(db)
        return db
      })
  }

  query(collName, query) {
    return Promise.resolve(this.init)
      .then(db => {
        return db.collectionAsync(collName)
      })
      .then(coll => {
        Promise.promisifyAll(coll)
        return coll.findOneAsync(query)
      })
  }

  count(collName, query) {
    return Promise.resolve(this.init)
      .then(db => {
        return db.collectionAsync(collName)
      })
      .then(coll => {
        Promise.promisifyAll(coll)
        return coll.countAsync(query)
      })
  }

  list(collName, query, limit, sort, skip) {
    return Promise.resolve(this.init)
      .then(db => {
        return db.collectionAsync(collName)
      })
      .then(coll => {
        Promise.promisifyAll(coll)
        return Promise.promisifyAll(coll.findAsync(query))
      })
      .then(cursor => {
        Promise.promisifyAll(cursor)
        if (sort !== undefined && sort != null)
          return cursor.sort(sort)
        else
          return cursor
      })
      .then(cursor => {
        return cursor.skip(skip)
          .limit(limit)
          .toArrayAsync()
      })
  }

  insert(collName, value) {
    return Promise.resolve(this.init)
      .then(db => {
        return db.collectionAsync(collName)
      })
      .then(coll => {
        Promise.promisifyAll(coll)
        return coll.insertAsync(value)
      })
  }

  update(collName, query, value) {
    return Promise.resolve(this.init)
      .then(db => {
        return db.collectionAsync(collName)
      })
      .then(coll => {
        Promise.promisifyAll(coll)
        return coll.updateAsync(query, value)
      })
  }

  delete(collName, query) {
    return Promise.resolve(this.init)
      .then(db => {
        return db.collectionAsync(collName)
      })
      .then(coll => {
        Promise.promisifyAll(coll)
        return coll.removeAsync(query)
      })
  }

}

export default MongoProvider
