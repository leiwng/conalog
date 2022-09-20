import _ from 'lodash'
import constants from '../util/constants'
import authorize from '../lib/AuthProvider'

import { ObjectID } from 'mongodb'
import MongoProvider from '../lib/MongoProvider'
var mongoProvider = new MongoProvider()

import CollectorManager from '../lib/collector/CollectorManager'
var collectorManager = new CollectorManager()

import Logger from '../lib/Logger'
var logger = new Logger('conalog-router', 'collector')

var Promise = require('bluebird')

var express = require('express')
var router = express.Router()

router.use(authorize)

router.get('/', (req, res, next) => {
  let name = req.query.name
  let id = req.query.id
  let category = req.query.category

  let query = { }
  if (name !== undefined)
    query['name'] = name
  if (id !== undefined)
    query['_id'] = new ObjectID(id)
  if (category !== undefined)
    query['category'] = category
  
  mongoProvider.list(constants.COLLECTOR_COLL, query, constants.COLLECTOR_LIMIT, null, 0)
    .then(collectors => {
      res.json(collectors)
    })
    .catch(error => {
      logger.error(3509,
        null,
        'Collector Query Problem',
        'Collector query failed, url: ' +
        req.originalUrl +
        ', error: ' +
        JSON.stringify(error))
      res.sendStatus(500)
    })
})

router.get('/:id', (req, res, next) => {
  let query = { _id: new ObjectID(req.params.id) }

  mongoProvider.query(constants.COLLECTOR_COLL, query)
    .then(collector => {
      res.json(collector);
    }) // query
    .catch(error => {
      logger.error(3509,
        null,
        'Collector Query Problem',
        'Collector query failed, url: ' +
        req.originalUrl +
        ', error: ' +
        JSON.stringify(error))
      res.sendStatus(500)
    });
});

router.post('/', function(req, res, next) {
  // create collector
  let now = new Date()
  let collector = _.cloneDeep(req.body)
  collector.ts = now.getTime()

  mongoProvider.insert(constants.COLLECTOR_COLL, collector)
    .then(result => {
      if (result.result.n > 0)
      {
        collectorManager.startCollectorByName(collector.name)
        // send collector ID
        res.end(result.ops[0]._id.toString())
      }
      else
      {
        logger.error(3501,
          null,
          'Collector Insert Problem',
          'Collector insert failed, collector: ' +
          JSON.stringify(collector));
        res.sendStatus(500);
      }
    }) // mongoProvier.insert
    .catch(function(error) {
      logger.error(3501,
        null,
        'Collector Insert Problem',
        'Collector insert failed, collector: ' +
        JSON.stringify(collector) +
        ', error: ' +
        JSON.stringify(error));
      res.sendStatus(500);
    });
});

router.put('/', function(req, res, next) {
  // update collector
  let now = new Date();
  let collector =　_.cloneDeep(req.body)
  collector.ts = now.getTime()
  collector._id = new ObjectID(collector._id)

  let query = {
    name: collector.name
  };

  mongoProvider.update(constants.COLLECTOR_COLL, query, collector)
    .then(result => {
      if (result.result.ok > 0)
      {
        collectorManager.stopCollectorByName(collector.name)
        collectorManager.startCollectorByName(collector.name)
        res.sendStatus(200)
      }
      else
      {
        logger.error(3503,
          null,
          'Collector Update Problem',
          'Collector update failed, collector: ' +
          JSON.stringify(collector));
        res.status(500).json(new Error('Collector Update Failed'));
      }
    }) // mongoProvier.update
    .catch(function(error) {
      logger.error(3504,
          null,
          'Collector Update Problem',
          'Collector update failed, collector: ' +
          JSON.stringify(collector) +
          ', error: ' + 
          JSON.stringify(error));
      res.status(500).json(error.stack);
    });
});

router.delete('/:id', (req, res, next) => {
  let id = req.params.id
  if (id === undefined || id === null)
    res.sendStatus(412)

  let query = { _id: new ObjectID(id) }
  mongoProvider.delete(constants.COLLECTOR_COLL, query)
     .then(result => {
       if (result.result.ok > 0) {
         collectorManager.stopCollector(query._id)
         res.json({id: id})
       }
       else {
         logger.warning(2503,
            null,
            'Collector Delete Problem',
            'Collector delete failed, id: ' +
            id);
          res.sendStatus(200)
       }
     })
     .catch(err => {
        logger.error(3506,
          null,
          'Collector Delete Problem',
          'Collector delete failed, error: ' + 
          err.stack)
        res.status(500).json(err.stack)
      });
})

router.delete('/', function(req, res, next) {
  let list = req.body['list[]']

  let query
  if (typeof(list) == 'string') {
    query = { _id: new ObjectID(list) }
    mongoProvider.delete(constants.COLLECTOR_COLL, query)
      .then(function(result) {
        if (result.result.n > 0)
        {
          collectorManager.stopCollector(query._id)
          res.sendStatus(200);
        }
        else
        {
          logger.warning(2503,
            null,
            'Collector Delete Problem',
            'Collector delete failed, id: ' +
            list);
          res.sendStatus(200);
        }
      }) // delete
      .catch(function(err) {
        logger.error(3506,
          null,
          'Collector Delete Problem',
          'Collector delete failed, error: ' + 
          JSON.stringify(error));
        res.sendStatus(500);
      });
  }
  else {
    query = { _id: { $in: list.map(item => {
      return new ObjectID(item)
    }) } }
    mongoProvider.delete(constants.COLLECTOR_COLL, query)
      .then(result => {
        if (result.result.n == list.length)
        {
          list.map((collectorId) => {
            collectorManager.stopCollector(collectorId)
          })
          res.sendStatus(200);
        }
        else // some collector not found
        {
          logger.warning(2505,
            null,
            'Collector Delete Problem',
            'Some collector not found');
          res.sendStatus(200);
        }
      }) // delete
      .catch(function(error) {
        logger.error(3506,
          null,
          'Collector Delete Problem',
          'Collector delete failed, error: ' + 
          JSON.stringify(error));
        res.sendStatus(500);
      });
  }
});

router.post('/instances', (req, res, next) => {
  // start collector instance
  let id = req.body.id
  let query = { _id: new ObjectID(id) }

  mongoProvider.query(constants.COLLECTOR_COLL, query)
    .then(collector => {
      if (collector !== undefined || collector !== null) {
        collectorManager.startCollector(id)
        res.sendStatus(200)
      }
      else 
        res.sendStatus(404)
    })
    .catch(error => {
      logger.error(3509,
        null,
        'Collector Instance Start Problem',
        'Collector instance start failed, body: ' +
        JSON.stringify(req.body) +
        ', error: ' +
        JSON.stringify(error));
      res.sendStatus(500);
    })
})

// only running instances
router.get('/instances/:category', (req, res, next) => {
  // query collector instance
  let category = req.params.category

  let query = { }
  if (category !== undefined)
    query['category'] = category

  // 1. list from mongodb
  mongoProvider.list(constants.COLLECTOR_COLL, query, constants.COLLECTOR_LIMIT, null, 0)
    .then(list => {
      if (list !== undefined && list !== null) {
        // 2. get status of each item
        let statusList = list.map(collector => {
          let statusJson = _.clone(collector)
          statusJson['status'] = collectorManager.getStatus(collector._id)
          if (statusJson.status.runningFlag)
            return statusJson
          else
            return null
        })
        .reduce((prev, curr, index) => {
          if (curr !== null)
            return prev.push(curr)
          else
            return prev
        }, [])

        res.json(statusList)
      }
    })
    .catch(function(error) {
      logger.error(3507,
        null,
        'Collector Instance Query Problem',
        'Collector instance query failed, category: ' +
        category +
        ', error: ' +
        JSON.stringify(error));
      res.sendStatus(500);
    })
})

router.delete('/instances/:id', (req, res, next) => {
  // stop collector instance
  let id = req.params.id
  let query = { _id: new ObjectID(id) }

  mongoProvider.query(constants.COLLECTOR_COLL, query)
    .then(collector => {
      if (collector !== undefined || collector !== null) {
        collectorManager.stopCollector(id)
        res.sendStatus(200)
      }
      else
        res.sendStatus(200)
    })
    .catch(error => {
      logger.error(3509,
        null,
        'Collector Instance Stop Problem',
        'Collector instance start failed, id: ' +
        JSON.stringify(id) +
        ', error: ' +
        JSON.stringify(error));
      res.sendStatus(500);
    })
})

// status - collector status, including stopped collectors
router.get('/status/:category', function(req, res, next) {
  let category = req.params.category
  let query = { category: category }

  // 1. list from mongodb
  mongoProvider.list(constants.COLLECTOR_COLL, query, constants.COLLECTOR_LIMIT, null, 0)
    .then(list => {
      if (list !== undefined && list !== null) {
        // 2. get status of each item
        let statusList = list.map(collector => {
          let statusJson = _.clone(collector)
          statusJson['status'] = collectorManager.getStatus(collector._id)
          return statusJson
        })

        res.json(statusList)
      }
    })
    .catch(function(error) {
      logger.error(3507,
        null,
        'Collector Status Query Problem',
        'Collector status query failed, category: ' +
        category +
        ', error: ' +
        JSON.stringify(error));
      res.sendStatus(500);
    })
})

module.exports = router
