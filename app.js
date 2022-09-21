var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-token-session');
var TokenRedisStore = require('token-session-redis')(session);
var RedisUrl = require('redis-url');

var routes = require('./routes/index');
var users = require('./routes/users');
var history = require('./routes/history');
var collectors = require('./routes/collectors');
var certificates = require('./routes/certificates');
var parsers = require('./routes/parsers');

var Config = require('./config/config');
var config = Config.parseArgs()
var constants = require('./util/constants')

var app = express();

// to show dev info
app.set('env', 'development')

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// app.use(logger('dev')); // this outputs RESTFUL messages

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// token session
var redisJson = RedisUrl.parse(config.redisUrl)
var tokenSession = session({
  store: new TokenRedisStore({
    host: redisJson.hostname,
    port: redisJson.port
  }),
  secret: 'conalog',
  key: constants.ACCESS_TOKEN_NAME
})
app.use(tokenSession);

app.use(express.static(path.join(__dirname, 'public')));

// disable 304 cache for debug
app.disable('etag');

// CROS headers
var originUrl = 'http://' + config.conalogFrontHost + ':' + config.conalogFrontPort;
// console.log("Access-Control-Allow-Origin", originUrl);
app.use((req, res, next) => {
  // don't use wildcard to prevent session cookies from failing
  res.header("Access-Control-Allow-Origin", originUrl);
  // allow session cookies
  res.header("Access-Control-Allow-Credentials", true);

  res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization, access_token");
  next();
});

app.use('/', routes);
app.use('/users', users);
app.use('/history', history);
app.use('/collectors', collectors);
app.use('/certificates', certificates);
app.use('/parsers', parsers);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  var err = new Error('Not Found');
  err.status = 404;
  next(err, req, res, next);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use((err, req, res, next) => {
    console.log(req.originalUrl, err.stack)
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}
/*
// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});
*/

module.exports = app;
