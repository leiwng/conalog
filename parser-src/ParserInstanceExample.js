// XML parser example
// use this as a template to create custom parsers

import Promise from 'bluebird'
import Redis from 'redis'
import {parseString} from 'xml2js'

// node ParserInstanceExample.js redisUrl subChannel pubChannel customParameter

// get args
let redisUrl = process.argv[2]
let subChannel = process.argv[3]
let pubChannel = process.argv[4]
// process.argv[5] is custom parameter, you could pack multiple fields in it if needed
// we don't need argv[5] in this example

// prepare redis clients
// for now we only support redis channel, queue and es will be supported later
Promise.promisifyAll(Redis.RedisClient.prototype)
Promise.promisifyAll(Redis.Multi.prototype)
let pubClient = Redis.createClient(redisUrl)
let subClient = Redis.createClient(redisUrl)

// last activity
let lastActivity = { count: 0, message:'' }
process.on('message', message => {
  if (message.GET === 'lastActivity')
    process.send(lastActivity)
})

// global buffer
// we'll buffer for each source reported by filebeat
let buffer = {}

subClient.on('message', (channel, message) => {
  // filebeat message example: "{\"@timestamp\":\"2017-03-27T06:00:18.146Z\",\"beat\":{\"hostname\":\"voyager\",\"name\":\"voyager\",\"version\":\"5.2.2\"},\"input_type\":\"log\",\"message\":\"feaslkejfl;aksjefl;kababdasefaaaseafsef\",\"offset\":133,\"source\":\"/home/voyager/xd/filebeat-test/d_3.log\",\"type\":\"log\"}"

  let json = JSON.parse(message)
  if (buffer[json.source] === undefined || buffer[json.source] === null)
    buffer[json.source] = json
  else {
    buffer[json.source].message += json.message

    // update timestamp and offset to the latest one
    buffer[json.source]['@timestamp'] = json['@timestamp']
    buffer[json.source].offset = json.offset
  }

  let msg = buffer[json.source].message

  // search for closing tag
  if (msg.search('</msg>') > -1) {
    parseString(msg, (err, result) => {
      if (err === null) {
        buffer[json.source].message = result

        // update last activity
        let now = new Date()
        lastActivity.ts = now.getTime()
        lastActivity.count++
        lastActivity.message = JSON.stringify(buffer[json.source])

        // send
        pubClient.publish(pubChannel, lastActivity.message)
      }
      else {
        // error handler
        pubClient.publish(pubChannel + '_err', JSON.stringify(err.stack))
      }

      // clear buffer slot
      buffer[json.source].message = ''
    })
  }

})

// listen to collector
subClient.subscribe(subChannel)
