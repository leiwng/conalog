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
    // [2017-06-21 16:45:24,972] INFO - {'username': u'xuyan', 'form': ImmutableMultiDict([('columns[11][orderable]', u'false'), ('columns[9][orderable]', u'false'), ('columns[11][name]', u''), ('columns[8][data]', u'TQNUM'), ('columns[4][search][regex]', u'false'), ('columns[12][search][regex]', u'false'), ('columns[4][orderable]', u'false'), ('columns[5][orderable]', u'false'), ('columns[2][orderable]', u'false'), ('columns[6][searchable]', u'true'), ('columns[13][data]', u'CSTATUS'), ('columns[13][name]', u''), ('columns[14][data]', u'CRTDATE'), ('columns[4][name]', u''), ('columns[9][data]', u'ZHTYPE'), ('columns[0][search][regex]', u'false'), ('columns[11][search][value]', u''), ('start', u'0'), ('columns[10][data]', u'INITNUM'), ('columns[12][search][value]', u''), ('columns[14][name]', u''), ('columns[14][searchable]', u'true'), ('columns[5][search][value]', u''), ('columns[3][searchable]', u'true'), ('columns[8][orderable]', u'false'), ('columns[2][search][regex]', u'false'), ('columns[5][search][regex]', u'false'), ('columns[1][searchable]', u'true'), ('columns[4][data]', u'PHONE'), ('columns[1][orderable]', u'false'), ('columns[0][name]', u''), ('columns[3][data]', u'ADDRESS'), ('search[value]', u''), ('columns[13][search][regex]', u'false'), ('columns[12][searchable]', u'true'), ('columns[10][search][regex]', u'false'), ('columns[6][search][regex]', u'false'), ('search[regex]', u'false'), ('columns[14][search][regex]', u'false'), ('columns[3][orderable]', u'false'), ('columns[7][data]', u'DEVICECODE'), ('columns[8][search][regex]', u'false'), ('columns[13][orderable]', u'false'), ('columns[12][orderable]', u'false'), ('columns[0][data]', u''), ('columns[1][name]', u''), ('columns[9][search][regex]', u'false'), ('columns[5][searchable]', u'true'), ('columns[5][name]', u''), ('draw', u'6'), ('columns[8][searchable]', u'true'), ('columns[10][searchable]', u'true'), ('columns[12][name]', u''), ('columns[6][orderable]', u'false'), ('operation', u'query'), ('columns[1][search][regex]', u'false'), ('columns[7][search][value]', u''), ('columns[6][name]', u''), ('columns[14][orderable]', u'false'), ('custid_query', u'10920'), ('columns[2][searchable]', u'true'), ('columns[3][search][regex]', u'false'), ('columns[10][search][value]', u''), ('columns[7][searchable]', u'true'), ('columns[7][name]', u''), ('columns[5][data]', u'SELFNUM'), ('columns[0][search][value]', u''), ('columns[9][search][value]', u''), ('columns[11][search][regex]', u'false'), ('columns[4][searchable]', u'true'), ('columns[7][search][regex]', u'false'), ('columns[8][name]', u''), ('columns[0][searchable]', u'true'), ('columns[7][orderable]', u'false'), ('columns[11][data]', u'ASTATUS'), ('columns[2][search][value]', u''), ('columns[1][data]', u'CUSTID'), ('columns[10][orderable]', u'false'), ('columns[0][orderable]', u'false'), ('columns[13][searchable]', u'true'), ('columns[9][name]', u''), ('columns[14][search][value]', u''), ('columns[2][data]', u'NAME'), ('columns[9][searchable]', u'true'), ('columns[8][search][value]', u''), ('columns[3][name]', u''), ('columns[6][data]', u'PRICETYPE'), ('columns[13][search][value]', u''), ('columns[4][search][value]', u''), ('columns[6][search][value]', u''), ('columns[10][name]', u''), ('columns[1][search][value]', u''), ('columns[2][name]', u''), ('length', u'20'), ('columns[3][search][value]', u''), ('columns[12][data]', u'DSTATUS'), ('columns[11][searchable]', u'true')]), 'args': ImmutableMultiDict([]), 'userid': 1000007L, 'base_url': u'http://hft.opengascloud.com/gasinfo_data', 'tag': None, 'data': '', 'method': 'POST'}

    let metaStr = message.split(" - ")[0]
    let levelStr = metaStr.substring(metaStr.lastIndexOf(" ") + 1)
    let dateTimeStr = metaStr.match(/\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/g)[0]

    let jsonStr = message.split(" - ")[1]
    try {
        let json = JSON.parse(jsonStr)
        let result = { level: levelStr, datetime: dateTimeStr, message: json }
        pubClient.publish("p_" + pubChannel, JSON.stringify(result))

        lastActivity.count++
        lastActivity.message = JSON.stringify(result)
        let now = new Date()
        lastActivity.ts = now.getTime()
    }
    catch(err) {
        console.log(err.message, err.stack)
    }
})

// listen to collector
subClient.subscribe(subChannel)
