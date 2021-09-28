// XML parser example
// use this as a template to create custom parsers

import Promise from 'bluebird'
import Redis from 'redis'
import Ginx from 'ginx'

let format =  '$remote_addr - $remote_user [$time_local] "$request" ' + 
    '$status $body_bytes_sent "$http_referer" ' +
    '"$http_user_agent" "$http_x_forwarded_for" ' +
    '$request_time $bytes_sent $request_length'

let ginx = new Ginx(format, {persistent: false, fieldsToObjects: false})

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
    // 61.188.138.121 - - [04/Jul/2017:14:29:37 +0800] "POST /romulan_print HTTP/1.1" 200 1793 "https://hft.opengascloud.com/sf_gm_print?addrid=00008610&transid=30608" "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36" "-" 0.020 1949 1515

    ginx.parseLine(message, (err, row) => {
        if (!err) {
            pubClient.publish("p_" + pubChannel, JSON.stringify(row))

            lastActivity.count++
            lastActivity.message = JSON.stringify(row)
            let now = new Date()
            lastActivity.ts = now.getTime()
        }
    })
})

// listen to collector
subClient.subscribe(subChannel)
