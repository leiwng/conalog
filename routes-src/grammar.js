import constants from '../util/constants'

import MongoProvider from '../lib/MongoProvider'
var mongoProvider = new MongoProvider();

import Promise from 'bluebird';

var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  var name = req.params.name;
  var query = { name: name };

  mongoProvider.query(constants.GRAMMAR_COLL, query)
    .then(function(grammar) {
      if (grammar !== undefined && grammar !== null) {
        res.json(grammar);
      }
      else { // no grammar found
        logger.warning(2402,
          null,
          'Grammar Query Problem',
          'No grammar ' + name + ' found');
        res.sendStatus(404);
      }
    }) // query
    .catch(function(err) {
      logger.error(3401,
        null,
        'Grammar Query Problem',
        'Grammar ' + name + ' query failed: ' + err);
      res.sendStatus(500);
    });
});

router.post('/', function(req, res, next) {
  // create
  var grammar = {
    name: req.params.name,
    grammar: req.params.grammar,
    optimize: req.params.optimize,
    cache: req.params.cache
  };

  mongoProvier.insert(constants.GRAMMAR_COLL, grammar)
    .then(function(result) {
      if (result.result.n > 0) {
        res.sendStatus(200);
      }
      else {
        logger.warning(2404,
          null,
          'Grammar Insert Problem',
          'Grammar ' + JSON.stringify(grammar) + ' insert failed');
        res.sendStatus(500);
      }
    }) // mongoProvier.insert
    .catch(function(err) {
      logger.error(3403,
        null,
        'Grammar Insert Problem',
        'Grammar ' + JSON.stringify(grammar) + ' insert failed: ' + err);
      res.sendStatus(500);
    });
});

router.put('/', function(req, res, next) {
  // update
  var grammar = {
    name: req.params.name,
    src: req.params.src,
    optimize: req.params.optimize,
    cache: req.params.cache
  };

  mongoProvier.update(constants.GRAMMAR_COLL, grammar, { name: grammar.name })
    .then(function(result) {
      if (result.result.n > 0)
      {
        res.sendStatus(200);
      }
      else
      {
        logger.warning(2404,
          null,
          'Grammar Update Problem',
          'Grammar ' + JSON.stringify(grammar) + ' update failed');
        res.sendStatus(500);
      }
    }) // mongoProvier.update
    .catch(function(err) {
      logger.error(3403,
        null,
        'Grammar Update Problem',
        'Grammar ' + JSON.stringify(grammar) + ' update failed: ' + err);
      res.sendStatus(500);
    });
});

router.delete('/', function(req, res, next) {
  var name = req.params.name;
  var query = { name: name };

  mongoProvider.delete(constants.GRAMMAR_COLL, query)
    .then(function(result) {
      if (result.result.n > 0)
      {
        res.sendStatus(200);
      }
      else // no grammar found
      {
        logger.warning(2405,
          null,
          'Grammar Delete Problem',
          'No grammar ' + name + ' found');
        res.sendStatus(200);
      }
    }) // delete
    .catch(function(err) {
      logger.error(3406,
        null,
        'Grammar Delete Problem',
        'Grammar ' + name + ' query failed: ' + err);
      res.sendStatus(500);
    });
});

router.get('/list', function(req, res, next) {
  mongoProvier.list(constants.GRAMMAR_COLL, {})
    .then(function(list) {
      Promise.promisifyAll(list);
      list.toArrayAsync()
        .then(function(grammars) {
          res.json(grammars);
        }) // list.toArrayAsync
        .catch(function(err) {
          logger.error(3404,
            null,
            'Grammar List Problem',
            'Grammar list failed: ' + err);
          res.sendStatus(500);
        });
    }) // list
    .catch(function(err) {
      logger.error(3403,
        null,
        'Grammar List Problem',
        'Grammar list failed: ' + err);
      res.sendStatus(500);
    });
});

// get case list
router.get('/case', function(req, res, next) {
  var grammarName = req.params.grammar;
  var query = { grammar: grammarName };

  mongoProvier.list(constants.CASE_COLL, query)
    .then(function(list) {
      Promise.promisifyAll(list);
      list.toArrayAsync()
        .then(function(cases) {
          res.json(cases);
        }) // list.toArrayAsync
        .catch(function(err) {
          logger.error(3407,
            null,
            'Case List Problem',
            'Case list failed: ' + err);
          res.sendStatus(500);
        });
    }) // list
    .catch(function(err) {
      logger.error(3408,
        null,
        'Case List Problem',
        'Case list failed: ' + err);
      res.sendStatus(500);
    });
});

router.post('/case', function(req, res, next) {
  // create
  var now = new Date();

  var testcase = {
    ts: now.getTime(),
    grammar: req.params.grammar,
    case: req.params.case
  };

  mongoProvier.insert(constants.CASE_COLL, testcase)
    .then(function(result) {
      if (result.result.n > 0)
      {
        res.sendStatus(200);
      }
      else
      {
        logger.warning(2409,
          null,
          'Case Insert Problem',
          'Case ' + JSON.stringify(testcase.case) + ' insert failed');
        res.sendStatus(500);
      }
    }) // mongoProvier.insert
    .catch(function(err) {
      logger.error(3410,
        null,
        'Case Insert Problem',
        'Case ' + JSON.stringify(testcase.case) + ' insert failed: ' + err);
      res.sendStatus(500);
    });
});

/*
router.put('/case', function(req, res, next) {

});
*/

router.delete('/case', function(req, res, next) {
  var caseId = req.params.id;
  var query = { _id: ObjectId(caseId) };

  mongoProvider.delete(constants.CASE_COLL, query)
    .then(function(result) {
      if (result.result.n > 0)
      {
        res.sendStatus(200);
      }
      else // no grammar found
      {
        logger.warning(2411,
          null,
          'Case Delete Problem',
          'No case ' + name + ' found');
        res.sendStatus(200);
      }
    }) // delete
    .catch(function(err) {
      logger.error(3412,
        null,
        'Case Delete Problem',
        'Case ' + caseId + ' query failed: ' + err);
      res.sendStatus(500);
    });
});
