// tploader-style spliter parser

import Promise from 'bluebird'
import Redis from 'redis'

// get args
let redisUrl = process.argv[2]
let subChannel = process.argv[3]
let pubChannel = process.argv[4]
let spliter = process.argv[5]

// prepare redis clients
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

subClient.on('message', (channel, message) => {
  // filebeat message example: "{\"@timestamp\":\"2017-03-27T06:00:18.146Z\",\"beat\":{\"hostname\":\"voyager\",\"name\":\"voyager\",\"version\":\"5.2.2\"},\"input_type\":\"log\",\"message\":\"feaslkejfl;aksjefl;kababdasefaaaseafsef\",\"offset\":133,\"source\":\"/home/voyager/xd/filebeat-test/d_3.log\",\"type\":\"log\"}"

  let json = JSON.parse(message)
  let msg = json.message

  let arr = msg.split(spliter)
  if (arr.length < 5)
    return
  else {
    let result = {
      ts: arr[0],
      process: arr[1],
      line: arr[2],
      module: arr[3],
      msg: arr[4]
    }
    json.message = result

    pubClient.publish(pubChannel, JSON.stringify(json))

    // update last activity
    let now = new Date()
    lastActivity.ts = now.getTime()
    lastActivity.count++
    lastActivity.message = JSON.stringify(json)
  }

})

// listen to collector
subClient.subscribe(subChannel)
