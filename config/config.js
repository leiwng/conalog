var program = require('commander')

var config = {
  logLevel: 'info',
  logLifespan: 604800000, // 7 days, in ms
  userAuthSwitch: false,
  conalogHost: '192.168.0.77',
  conalogPort: 19527,
  conalogFrontHost: '192.168.0.77',
  conalogFrontPort: 9527,
  mongoUrl: 'mongodb://127.0.0.1:27017/conalog',
  redisUrl: 'redis://127.0.0.1:6379',
  filebeatChannel: 'conalog-filebeat',
  parserPathPrefix: './parser/',
  nsqdUrl: 'http://127.0.0.1:4151',
  nsqlookupdUrl: 'http://127.0.0.1:4161',
  parseArgs: function() {
    if (program.userAuthSwitch === undefined) {
      program
      .version('1.0.0')
      .option('--logLevel [logLevel]', 'Log Level [' + this.logLevel + ']', this.logLevel)
      .option('--logLifespan [logLifespan]', 'Log Lifespan[' + this.logLifespan + ']', this.logLifespan)
      .option('--userAuthSwitch', 'User Authorization Switch')
      .option('--redisUrl [redisUrl]', 'Redis URL [' + this.redisUrl + ']', this.redisUrl)
      .option('--mongoUrl [mongoUrl]', 'MongoDB URL [' + this.mongoUrl + ']', this.mongoUrl)
      .option('--conalogHost [conalogHost]', 'Conalog Backend Host [' + this.conalogHost + ']', this.conalogHost)
      .option('--conalogPort [conalogPort]', 'Conalog Backend Port [' + this.conalogPort + ']', this.conalogPort)
      .option('--conalogFrontHost [conalogFrontHost]', 'Conalog Frontend Host [' + this.conalogFrontHost + ']', this.conalogFrontHost)
      .option('--conalogFrontPort [conalogFrontPort]', 'Conalog Frontend Port [' + this.conalogFrontPort + ']', this.conalogFrontPort)
      .option('--filebeatChannel [filebeatChannel]', 'Filebeat Redis Publish Channel [' + this.filebeatChannel+ ']', this.filebeatChannel)
      .option('--parserPathPrefix [parserPathPrefix]', 'Parser Sub-path [' + this.parserPathPrefix + ']', this.parserPathPrefix)
      .option('--nsqdUrl [nsqdUrl]', 'nsqd URL [' + this.nsqdUrl + ']', this.nsqdUrl)
      .option('--nsqlookupdUrl [nsqlookupdUrl]', 'nsqlookupd URL [' + this.nsqlookupdUrl + ']', this.nsqlookupdUrl)
      .parse(process.argv)

      if (program.userAuthSwitch === undefined)
        program['userAuthSwitch'] = false
      else
        program['userAuthSwitch'] = true
    }

    return program
  }
}

module.exports = config;
