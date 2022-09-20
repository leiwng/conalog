import constants from '../util/constants';

import MongoProvider from '../lib/MongoProvider';
var mongoProvider = new MongoProvider();
import GatewayProvider from '../lib/GatewayProvider';
var gatewayProvider = new GatewayProvider();

import Promise from 'bluebird';

var express = require('express');
var router = express.Router();

router.post('/scan', function(req, res, next) {
  var rawFlows = req.body;
  var flows = [];
  var now = new Date();

  // 1. find out all flows
  rawFlows.map(function(rawFlow) {
    if (rawFlow.type === 'tab') // got new flow
      flows.push({flowId: rawFlow.id, name: rawFlow.label, date: now.getTime(), status:'stopped', nodes:[rawFlow]});
  });

  // 2. create all flows
  rawFlows.map(function(rawFlow) {
    if (rawFlow.type !== 'tab') // got node
    {
      flows.map(function(flow) {
        if (flow.flowId === rawFlow.z) // got a member
          flow.nodes.push(rawFlow);
      });
    }
  });

  // 3. read status
  flows.map(function(flow) {
    var query = {flowId: flow.flowId};
    mongoProvider.query(constants.FLOW_COLL, query)
      .then(function(result) {
        if (result !== undefined && result !== null) {
          // already saved, update
          flow.status = result.status;
        }
      })
      .catch(function(err) {
        console.log('hi1')
        logger.error(3401,
          null,
          'Flow Query Problem',
          'Flow ' + flow.flowId + ' ' + flow.name + ' query failed: ' + err);
        res.sendStatus(500);
      });
console.log('hi2')
  // 4. delete all flows
  mongoProvider.delete(constants.FLOW_COLL, {})
    .then(function() {
      logger.info(3101,
        null,
        'Flow Deleted',
        'Flows deleted');

        // save
        flows.map(function(flow) {
          mongoProvier.insert(constants.FLOW_COLL, flow)
            .then(function() {
              logger.info(3101,
                null,
                'Flow Insert',
                'Flow ' + flow.flowId + ' ' + flow.name + ' inserted');
            }) // insert
            .catch(function(err) {
              console.log('hi2')
              logger.error(3401,
                null,
                'Flow Insert Problem',
                'Flow ' + flow.flowId + ' ' + flow.name + ' insert failed: ' + err);
              res.sendStatus(500);
            }); // insert
          }); // flows.map
      }) // delete
      .catch(function(err) {
        console.log('hi3')
        logger.error(3401,
          null,
          'Flow Delete Problem',
          'Flow delete failed: ' + err);
        res.sendStatus(500);
      }); // delete

  // 5. restart running flows
  // stop
  gatewayProvider.stopApi()
    .then(function() {
      logger.info(3101,
        null,
        'Flow Stopped',
        'All flow stopped');

        // delete
        gatewayProvider.deletePlan()
          .then(function() {
            logger.info(3101,
              null,
              'Flow Deleted',
              'All flow deleted');

              // deploy
              flows.map(function(flow) {
                gatewayProvider.deployPlan(flow.nodes)
                  .then(function() {
                    logger.info(3101,
                      null,
                      'Flow Deployed',
                      'Flow ' + flow.flowId + ' ' + flow.name + ' deployed');

                    if (flow.status === 'running')
                    {
                      // start
                      gatewayProvider.startApi(flow.flowId)
                        .then(function() {
                          logger.info(3101,
                            null,
                            'Flow Started',
                            'Flow ' + flow.flowId + ' ' + flow.name + ' started');
                        })
                        .catch(function(err) {
                          logger.error(3401,
                            null,
                            'Flow Delete Problem',
                            'All flow delete failed: ' + err);
                          res.sendStatus(500);
                        });
                    }
                  })
                  .catch(function(err) {
                    logger.error(3401,
                      null,
                      'Flow Deploy Problem',
                      'Flow ' + flow.flowId + ' ' + flow.name + ' deploy failed: ' + err);
                    res.sendStatus(500);
                  });
              });
          })
          .catch(function(err) {
            logger.error(3401,
              null,
              'Flow Delete Problem',
              'All flow delete failed: ' + err);
            res.sendStatus(500);
          });
    })
    .catch(function(err) {
      logger.error(3401,
        null,
        'Flow Stop Problem',
        'All flow stop failed: ' + err);
      res.sendStatus(500);
    });
  });
})

router.get('/list', function(req, res, next) {
  mongoProvier.list(constants.FLOW_COLL, {})
    .then(function(list) {
      if (list !== undefined && list !== null && list.length !== 0)
        res.json(list);
      else
        res.sendStatus(404);
    })
    .catch(function(err) {
      logger.error(3401,
        null,
        'Flow List Problem',
        'All flow list failed: ' + err);
      res.sendStatus(500);
    });
});

router.put('/', function(req, res, next) {
  // update flow - status
  var status = req.params.status;
  var flowId = req.params.flowId;
  // query
  mongoProvier.query(constants.FLOW_COLL, {flowId: flowId})
    .then(function(value) {
      if (value !== undefined && value !== null) {
        // ok - now let's operate api
        if (status === 'running')
          gatewayProvider.startApi(flowId)
            .then(function() {
              // update mongodb
              value.status = status;
              mongoProvider.update(constants.FLOW_COLL, value, {flowId: flowId})
                .then(function() {
                  // done
                  res.sendStatus(200);
                })
                .catch(function(err) {
                  logger.error(3401,
                    null,
                    'Flow Update Problem',
                    'Flow ' + flowId + ' update failed: ' + err);
                  res.sendStatus(500);
                });
            })
            .catch(function(err) {
              logger.error(3401,
                null,
                'Flow Start Problem',
                'Flow ' + flowId + ' start failed: ' + err);
              res.sendStatus(500);
            });
        else
        gatewayProvider.stopApi(flowId)
          .then(function() {
            // update mongodb
            value.status = status;
            mongoProvider.update(constants.FLOW_COLL, value, {flowId: flowId})
              .then(function() {
                // done
                res.sendStatus(200);
              })
              .catch(function(err) {
                logger.error(3401,
                  null,
                  'Flow Update Problem',
                  'Flow ' + flowId + ' update failed: ' + err);
                res.sendStatus(500);
              });
          })
          .catch(function(err) {
            logger.error(3401,
              null,
              'Flow Stop Problem',
              'Flow ' + flowId + ' stop failed: ' + err);
            res.sendStatus(500);
          });
      }
      else {
        res.sendStatus(404);
      }
    })
    .catch(function(err) {
      logger.error(3401,
        null,
        'Flow Query Problem',
        'Flow ' + flowId + ' query failed: ' + err);
      res.sendStatus(500);
    });
});

router.delete('/', function(req, res, next) {
  // del flow
});

module.exports = router;
