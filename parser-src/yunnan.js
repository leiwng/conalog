// XML parser example
// use this as a template to create custom parsers

import Promise from 'bluebird'
import Redis from 'redis'
import pickle from "pickle"

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
// let buffer = {}

subClient.on('message', (channel, message) => {
    /*
    0110.145058.257 tid:1234 abc.c.120,FORWARD TO [abx] send [
    a:123
    c010|S|1|1
    ][123]
    0110.145059.157 tid:1239 abc.c.120,FORWARD TO [abx] send [
    a:123
    c010|S|1|1
    ][123]
    0110.145158.257 tid:1234 abc.c.129,BACK TO [x] byte[
    a:123
    code|S|1|0
    ]
    0110.145358.257 tid:1230 abc.c.120,FORWARD TO [abx] send [
    a:123
    c010|S|1|1
    ][123]
    0110.145458.257 tid:1230 abc.c.129,BACK TO [x] byte[
    a:123
    code|S|1|0
    ]
    0110.145558.257 tid:1239 abc.c.129,BACK TO [x] byte[
    a:123
    code|S|1|0
    ]
    */

    let metaStr = message.split(" - ")[0]
    let levelStr = metaStr.substring(metaStr.lastIndexOf(" ") + 1)
    let dateTimeStr = metaStr.match(/\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/g)[0]

    let jsonStr = message.split(" - ")[1]
    pickle.load(jsonStr, (json) => {
        let result = { level: levelStr, datetime: dateTimeStr, message: JSON.stringify(json) }
        pubClient.publish(pubChannel, result)

        lastActivity.count++
        lastActivity.message = JSON.stringify(result)
        let now = new Date()
        lastActivity.ts = now.getTime()
    })
})

// listen to collector
subClient.subscribe(subChannel)
