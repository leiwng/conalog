import constants from '../util/constants'

import authorize from '../lib/AuthProvider'

import MongoProvider from '../lib/MongoProvider'
var mongoProvider = new MongoProvider()

import Promise from 'bluebird'
import _ from 'lodash'

import Logger from '../lib/Logger'
let logger = new Logger('routes', 'history')

var express = require('express')
var router = express.Router()

let pageInfo = {
  sortField: null,
  sortDir: null,
  fromDate: null,
  toDate: null,
  pageSize: 10,
  page: 0
}

router.post('/pageinfo', authorize, (req, res, next) => {
  if (req.body.sortField !== undefined && req.body.sortField != null)
    pageInfo.sortField = req.body.sortField
  if (pageInfo.sortField == 'id')
    pageInfo.sortField = '_id'
  if (pageInfo.sortField == 'date')
    pageInfo.sortField = 'ts'

  if (req.body.sortDir !== undefined && req.body.sortDir != null)
    if (req.body.sortDir == 'asc')
      pageInfo.sortDir = 1
    else
      pageInfo.sortDir = -1

  if (req.body.from !== undefined && req.body.from != null)
    pageInfo.fromDate = req.body.from
  if (req.body.to !== undefined && req.body.to != null)
    pageInfo.toDate = req.body.to
  if (req.body.pageSize !== undefined && req.body.pageSize != null)
    pageInfo.pageSize = parseInt(req.body.pageSize)

  // refresh list
  // construct query json
  let skipCount = pageInfo.page * pageInfo.pageSize
  let filter = {}
  let toTs

  if (pageInfo.toDate !== undefined && pageInfo.toDate != null)
    toTs = Date.parse(pageInfo.toDate);

  if (pageInfo.fromDate !== undefined && pageInfo.fromDate != null)
  {
    let fromTs = Date.parse(pageInfo.fromDate);
    filter = { $and: [ { ts: { $gt: fromTs } },  { ts: { $lt: toTs } } ] };
  }

  if (req.params.level !== undefined && req.params.level != null)
    filter.level = req.params.level;
  if (req.params.module !== undefined && req.params.module != null)
    filter.module = req.params.module;
  if (req.params.source !== undefined && req.params.source != null)
    filter.source = req.params.source;
  if (req.params.machine !== undefined && req.params.machine != null)
    filter.machine = req.params.machine;
  if (req.params.user !== undefined && req.params.user != null)
    filter.user = req.params.user;
  if (req.params.eventid !== undefined && req.params.eventid != null)
    filter.eventId = req.params.eventid;
  if (req.params.type !== undefined && req.params.type != null)
    filter.type = req.params.type;

  console.log(pageInfo)
  if (pageInfo.sortField !== undefined && pageInfo.sortField != null)
  {
    let sortFilter = {}
    _.set(sortFilter, pageInfo.sortField, pageInfo.sortDir)
    console.log(sortFilter)
    mongoProvider.list(constants.LOG_COLL,
      filter,
      pageInfo.pageSize,
      sortFilter,
      skipCount)
      .then(function(list) {
        // console.log(list)
        res.json({pageContent: list})
      }) // mongoProvier.list
      .catch(function(err) {
        logger.error(3301,
          null,
          'Logger Query Problem',
          'Log list failed: ' + filter + err);
        res.sendStatus(500);
      })
    }
    else
      mongoProvider.list(constants.LOG_COLL,
        filter,
        pageInfo.pageSize,
        null,
        skipCount)
        .then(function(list) {
          // console.log(list)
          res.json({pageContent: list})
        }) // mongoProvier.list
        .catch(function(err) {
          logger.error(3302,
            null,
            'Logger Query Problem',
            'Log list failed: ' + filter + err);
          res.sendStatus(500);
        })
})

router.get('/pagecount', authorize, function(req, res, next) {
  var filter = {};

  if (pageInfo.toDate !== undefined && pageInfo.toDate != null)
    toTs = Date.parse(toDate);

  if (pageInfo.fromDate !== undefined && pageInfo.fromDate != null)
  {
    var fromTs = Date.parse(fromDate);
    filter = { $and: [ { ts: { $gt: pageInfo.fromTs } },  { ts: { $lt: pageInfo.toTs } } ] };
  }

  if (req.params.level !== undefined && req.params.level != null)
    filter.level = req.params.level;
  if (req.params.module !== undefined && req.params.module != null)
    filter.module = req.params.module;
  if (req.params.source !== undefined && req.params.source != null)
    filter.source = req.params.source;
  if (req.params.machine !== undefined && req.params.machine != null)
    filter.machine = req.params.machine;
  if (req.params.user !== undefined && req.params.user != null)
    filter.user = req.params.user;
  if (req.params.eventid !== undefined && req.params.eventid != null)
    filter.eventId = req.params.eventid;
  if (req.params.type !== undefined && req.params.type != null)
    filter.type = req.params.type;

  // console.log(filter)
  // let filter = {}
  // console.log(filter)
  mongoProvider.count(constants.LOG_COLL, filter)
    .then(function(list) {
      // console.log('list', list)
      let count = list.length
      let pageCount = 0
      if (count % pageInfo.pageSize != 0)
        pageCount = parseInt(count / pageInfo.pageSize) + 1
      else
        pageCount = count / pageInfo.pageSize

      res.json({pageCount: pageCount})
    }) // mongoProvier.list
    .catch(function(err) {
      // console.log('err', err)
      logger.error(3304,
        null,
        'Logger Counter Problem',
        'Log page count failed: ' + filter + err);
      res.sendStatus(500);
    })
});

router.get('/count', authorize, function(req, res, next) {
  let filters = []
  // get filters - not so general, remember to update this once you change filters in page
  let keys = Object.keys(req.query)
  for (let i = 0, l = keys.length; i < l; i++) {
    let key = keys[i]
    let value = req.query[key]
    let filter = {}
    if (Array.isArray(value)) {
      // this is a filter
      switch(key) {
        case 'ts':
        // TODO : query in range
        break

        case 'eventId':
        filter[key] = { $in: value.map(parseInt) }
        filters.push(filter)
        break

        default:
        filter[key] = { $in: value }
        filters.push(filter)
        break
      }
    }
  }
  if (filters.length > 0)
    filters = { $and: filters }
  else
    filters = {}

  // console.log('/history/count', 'filters:', JSON.stringify(filters))

  // query from mongoProvier
  mongoProvider.count(constants.LOG_COLL, filters)
    .then(count => {
      res.json({count: count})
    })
    .catch(function(err) {
      // console.log('err', err)
      logger.error(3305,
        null,
        'Logger Counter Problem',
        'Log count failed: ' + JSON.stringify(filters) + ' ' + JSON.stringify(err));
      res.sendStatus(500);
    })
})

router.get('/page', authorize, function(req, res, next) {
  let pageInfo = {
    filters: []
  }

  // for user, page starts from 1
  pageInfo.page = parseInt(req.query.pageNo) - 1
  pageInfo.pageSize = parseInt(req.query.pageSize)
  if (req.query.sortField !== undefined && req.query.sortField != null) {
    pageInfo.sortField = req.query.sortField
    if (req.query.sortOrder == 'descend')
      pageInfo.sortOrder = -1 // descend
    else
      pageInfo.sortOrder = 1 // ascend
  }
  pageInfo.sort = {}
  pageInfo.sort[pageInfo.sortField] = pageInfo.sortOrder

  // get filters - not so general, remember to update this once you change filters in page
  let keys = Object.keys(req.query)
  for (let i = 0, l = keys.length; i < l; i++) {
    let key = keys[i]
    let value = req.query[key]
    let filter = {}
    if (Array.isArray(value)) {
      // this is a filter
      switch(key) {
        case 'ts':
        // TODO : query in range
        break

        case 'eventId':
        filter[key] = { $in: value.map(parseInt) }
        pageInfo.filters.push(filter)
        break

        default:
        filter[key] = { $in: value }
        pageInfo.filters.push(filter)
        break
      }
    }
  }
  if (pageInfo.filters.length > 0)
    pageInfo.filters = { $and: pageInfo.filters }
  else
    pageInfo.filters = {}

  // construct query json
  let skipCount = pageInfo.page * pageInfo.pageSize

  /*
  if (pageInfo.toDate !== undefined && pageInfo.toDate != null)
    toTs = Date.parse(pageInfo.toDate);

  if (pageInfo.fromDate !== undefined && pageInfo.fromDate != null)
  {
    let fromTs = Date.parse(pageInfo.fromDate);
    filter = { $and: [ { ts: { $gt: fromTs } },  { ts: { $lt: toTs } } ] };
  }
  */
  // console.log(JSON.stringify(pageInfo))
  if (pageInfo.sortField !== undefined && pageInfo.sortField != null)
    mongoProvider.list(constants.LOG_COLL,
      pageInfo.filters,
      pageInfo.pageSize,
      pageInfo.sort,
      skipCount)
      .then(function(list) {
        // console.log(list)
        res.json({pageContent: list})
      }) // mongoProvier.list
      .catch(function(err) {
        logger.error(3301,
          null,
          'Logger Query Problem',
          'Log list failed: ' + filter + err);
        res.sendStatus(500);
      })
    else
      mongoProvider.list(constants.LOG_COLL,
        pageInfo.filters,
        pageInfo.pageSize,
        null,
        skipCount)
        .then(function(list) {
          // console.log(list)
          res.json({pageContent: list})
        }) // mongoProvier.list
        .catch(function(err) {
          logger.error(3302,
            null,
            'Logger Query Problem',
            'Log list failed: ' + filter + err);
          res.sendStatus(500);
        })
});

/*
router.post('/', function(req, res, next) {
  // create

});
*/

/* not allow to update logs
router.put('/', function(req, res, next) {
  // update
});
*/

/*
router.delete('/', function(req, res, next) {
  // delete
});
*/

module.exports = router
