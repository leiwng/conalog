import MongoProvider from '../lib/MongoProvider'
var Crypto = require('crypto')
import Logger from '../lib/Logger'
import constants from '../util/constants'
import session from 'express-token-session'
import uuid from 'uuid'
import authorize from '../lib/AuthProvider'

var mongoProvider = new MongoProvider()
var logger = new Logger('routes', 'users')

var express = require('express')
var router = express.Router()

router.use(authorize)

// create user
/*
router.post('/', (req, res, next) => {

})

// remove user
router.delete('/', (req, res, next) => {

})
*/

// login
router.post('/login', function(req, res, next) {
  // console.log(req)
  var hash = Crypto.createHash('sha256')
  var userName = req.body.user;
  var userPass = req.body.pass;
  var userSalt = req.body.salt;
  // console.log('routers/login', userName, userPass, userSalt)

  mongoProvider.query(constants.USER_COLL, {name: userName})
    .then(function(result) {
      // console.log(result)
      if (result !== undefined && result != null) {
        // verify
        var rawPass = result.pass;
        hash.update(rawPass + userSalt);
        var saltedHash = hash.digest('hex');

        if (userPass == saltedHash) {
          logger.warning(1202,
            userName,
            'Auth Info',
            'User login'
          );

          // generate UUID to be used as session token
          let sessionId = uuid.v4().toString()
          session.generate(req, sessionId)

          if (req.session) {
            req.session.auth = true;
            req.session.user = result;
            // console.log('login() - session', req.sessionToken, JSON.stringify(req.session))
          }

          res.end(req.sessionToken)
        }
        else {
          // failed
          logger.warning(2203,
            null,
            'Auth Problem',
            'User login with incorrect password: ' + userPass
          );
          res.sendStatus(401);
        }
      }
      else {
        // check mongodb
        logger.error(3204,
          null,
          'Auth Problem',
          'No auth info found in database'
        );
        res.sendStatus(401);
      }
    })
    .catch(function(err) {
      logger.error(3205,
        null,
        'Auth Problem',
        'MongoDB query error: ' + err
      );
      res.sendStatus(500);
    });
});

// logout
router.get('/logout', function(req, res, next) {
  req.session.auth = false
  req.session.user = undefined
  req.session.destory()
  res.sendStatus(200)
});

// update user
router.put('/', function(req, res, next) {
  var hash = Crypto.createHash('sha256')
  var oldPass = req.body.oldpass;
  var newPass = req.body.newpass;
  var salt = req.body.salt;

  // console.log('router /update', JSON.stringify(req.body), JSON.stringify(req.session))

  // check auth
  if (req.session.auth === undefined || req.session.auth == null) {
    // no auth - return 401
    logger.warning(3212,
      null,
      'Auth Problem',
      'Updating password without current auth')

    res.sendStatus(401)
    return
  }

  // check old pass
  mongoProvider.query(constants.USER_COLL, {name: req.session.user})
    .then(user => {
      if (user !== undefined && user != null) {
        // verify old pass
        hash.update(user.pass + salt)
        let saltedPass = hash.digest('hex')
        // console.log('saltedPass', saltedPass)
        if (saltedPass == oldPass) {
          // update new pass
          mongoProvider.update(constants.USER_COLL, {name: req.session.user}, {
            name: req.session.user,
            pass: newPass
          })
          .then(result => {
            if (result.result.ok > 0) {
              logger.warning(3206,
                req.session.user,
                'Auth Info',
                'Password updated'
              );
              res.sendStatus(200);
            }
            else {
              logger.error(3208,
                null,
                'Auth Problem',
                'MongoDB update error: ' + err
              );
              res.sendStatus(500);
            }
          })
          .catch(err => {
            // old pass verification failed
            logger.warning(2209,
              null,
              'Auth Problem',
              'User password update with incorrect auth info: ' + oldPass + ' ' + uuid
            );
            res.sendStatus(401);
          })
        }
      }
      else {
        // result undefined or null
        // check mongodb
        logger.error(3210,
          null,
          'Auth Problem',
          'No auth info found in database'
        );
        res.sendStatus(500);
      }
    })
    .catch(err => {
      logger.error(3211,
        null,
        'Auth Problem',
        'MongoDB query error: ' + err
      );
      res.sendStatus(500);
    })
});

// user group operations
// create user group
/*
router.post('/group', (req, res, next) => {

})

// remove user group
router.delete('/group', (req, res, next) => {

})

// query user group
router.get('/group', (req, res, next) => {

})

// query user group list
router.get('/group/list', (req, res, next) => {

})

// update user group
router.put('/group', (req, res, next) => {

})

// securityBits operations
// create securityBits
router.post('/securitybits', (req, res, next) => {

})

// remove securityBits
router.delete('/securitybits', (req, res, next) => {

})

// query securityBits
router.get('/securitybits', (req, res, next) => {

})

// query securityBits list
router.get('/securitybits/list', (req, res, next) => {

})

// update securityBits
router.put('/securitybits', (req, res, next) => {

})
*/

module.exports = router;
