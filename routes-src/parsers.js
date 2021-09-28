import _ from 'lodash'
import constants from '../util/constants'
import authorize from '../lib/AuthProvider'
import Promise from 'bluebird'

import { ObjectID } from 'mongodb'
import MongoProvider from '../lib/MongoProvider'
let mongoProvider = new MongoProvider()

import Logger from '../lib/Logger'
let logger = new Logger('routes', 'parser')

import ParserManager from '../lib/ParserManager'
let parserManager = new ParserManager()

import express from 'express'
let router = express.Router()

router.post('/', (req, res, next) => {
  if (_.isEmpty(req.body)) {
    logger.warning(201,
        null,
        'Parser Creation Problem',
        'Create parser failed, client sent empty parser.')

    res.sendStatus(412)
  }

  let now = new Date()
  let parser = _.cloneDeep(req.body)
  parser.ts = now.getTime()
  let query = { name: parser.name }

  mongoProvider.query(constants.PARSER_COLL, query)
    .then(result => {
      if (result === undefined || result == null) {
        return mongoProvider.insert(constants.PARSER_COLL, parser)
          .then(json => {
              console.log(json)
            if (json.result.n == 0)
              res.json({})
            else
              res.json({id: json.ops[0]._id.toString()})
          })
      }
      else {
        res.status(412).json((new Error('Parser name: ' + parser.name + ' exists.')).stack)
      }
    })
    .catch(err => {
      console.log(err)
      logger.error(301,
        null,
        'Parser Creation Problem',
        'Create parser failed, parser: ' + JSON.stringify(parser) +
        ', error: ' + JSON.stringify(err))

      res.status(500).json(err.stack)
    })
})

router.get('/', (req, res, next) => {
  let query = {}

  let id = req.query.id
  if (id !== undefined && id != null)
    query['id'] = id

  let name = req.query.name
  if (name !== undefined && name != null)
    query['name'] = name

  mongoProvider.list(constants.PARSER_COLL, query, constants.COLLECTOR_LIMIT, null, 0)
    .then(parserList => {
      res.json(parserList.map(parser => {
        let idParser = _.cloneDeep(parser)
        idParser['id'] = parser._id.toString()
        idParser._id = undefined

        return idParser
      }))
    })
    .catch(err => {
      logger.error(302,
        null,
        'Parser List Problem',
        'List parser failed, query: ' + JSON.stringify(query) +
        ', error: ' + JSON.stringify(err))

      res.status(500).json(err.stack)
    })
})

/*
router.get('/:name', (req, res, next) => {
  let query = { name: req.params.name }
  
  mongoProvider.query(constants.PARSER_COLL, query)
    .then(parser => {
      if (parser !== undefined && parser != null) {
        let json = { id: parser._id.toString() }
        res.json(json)
      }
      else {
        res.json({})
      }
    })
    .catch(err => {
      logger.error(303,
        null,
        'Parser Query Problem',
        'Query parser failed, name: ' + query.name +
        ', error: ' + JSON.stringify(err))

      res.status(500).json(err.stack)
    })
})
*/

router.put('/', (req, res, next) => {
  if (_.isEmpty(req.body)) {
    logger.warning(201,
        null,
        'Parser Creation Problem',
        'Create parser failed, client sent empty parser.')

    res.sendStatus(412)
  }

  let now = new Date()
  let parser = _.cloneDeep(req.body)
  parser.ts = now.getTime()
  let query = { _id: new ObjectID(parser.id) }

  mongoProvider.update(constants.PARSER_COLL, query, parser)
    .then(result => {
      if (result.result.ok > 0) {
        // TODO : stop instance
        // TODO : start instance
        res.json({id: parser.id})
      }
    })
    .catch(err => {
      console.log(err)
      logger.error(301,
        null,
        'Parser Update Problem',
        'Update parser failed, parser: ' + JSON.stringify(parser) +
        ', error: ' + JSON.stringify(err))

      res.status(500).json(err.stack)
    })
})

router.delete('/:id', (req, res, next) => {
  let query = { _id: new ObjectID(req.params.id) }

  mongoProvider.delete(constants.PARSER_COLL, query)
    .then(result => {
      if (result.result.n > 0) {
        res.json({ id: query._id })
      }
      else {
        res.json({})
      }
    })
    .catch(err => {
      logger.error(304,
        null,
        'Parser Delete Problem',
        'Delete parser failed, id: ' + query._id.toString() +
        ', error: ' + JSON.stringify(err))

      res.status(500).json(err.stack)
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

  mongoProvider.delete(constants.PARSER_COLL, query)
    .then(result => {
      if (result.result.ok > 0) {
        res.json(ids)
      }
    })
    .catch(err => {
      logger.warning(21105,
        null,
        'Cert Delete Problem',
        'Cert host: ' + host + ' delete failed.')

      res.status(500).json(err.stack)
    })

})

router.post('/instances', (req, res, next) => {
  let parserId = req.body.id

  parserManager.startInstance({parserId: parserId})
    .then(idJson => {
      res.json(idJson)
    })
    .catch(err => {
      logger.error(305,
        null,
        'Parser Instance Start Problem',
        'Start parser instance failed, parserId: ' + parserId +
        ', error: ' + JSON.stringify(err))

      res.status(500).json(err.stack)
    })
})

router.get('/instances', (req, res, next) => {
  let query = {}

  let instanceId = req.query.id
  if (instanceId !== undefined && instanceId != null) {
    query['id'] = instanceId

    try {
      let instance = parserManager.queryInstanceById(query)
      res.json(instance)
    }
    catch(err) {
      logger.error(305,
        null,
        'Parser Instance Query Problem',
        'Query parser instance failed, error: ' + JSON.stringify(err))

      res.status(500).json(err.stack)
    }
  }
  else {
    try {
      let instanceList = parserManager.listInstance({})
      res.json(instanceList)
    }
    catch(err) {
      logger.error(305,
        null,
        'Parser Instance List Problem',
        'List parser instance failed, error: ' + JSON.stringify(err))

      res.status(500).json(err.stack)
    }
  }
})

router.get('/:id/instances', (req, res, next) => {
  let parserId = req.params.id

  try {
    let instanceList = parserManager.listInstance({parserId: parserId})
    res.json(instanceList)
  }
  catch(err) {
    logger.error(305,
      null,
      'Parser Instance List Problem',
      'List parser instance failed, parserId: ' + parserId  +
      'error: ' + JSON.stringify(err))

    res.status(500).json(err.stack)
  }
})

router.delete('/instances/:id', (req, res, next) => {
  let instanceId = req.params.id

  let result = parserManager.stopInstance({instanceId: instanceId})
  res.json(result)
})

router.get('/scripts', (req, res, next) => {
  parserManager.listScript()
    .then(scripts => {
      res.json(scripts)
    })
    .catch(ex => {
      res.status(500).json(err.stack)
    })
})

module.exports = router
