import _ from 'lodash'
import Promise from 'bluebird'
import Redis from 'redis'

import xmlreader from 'xmlreader'

let redisUrl = process.argv[2]
let subChannel = process.argv[3]
let pubChannel = process.argv[4]

Promise.promisifyAll(Redis.RedisClient.prototype)
Promise.promisifyAll(Redis.Multi.prototype)
let pubClient = Redis.createClient(redisUrl)
let subClient = Redis.createClient(redisUrl)

// last activity
let lastActivity = { count: 0, message: '' }

process.on('message', message => {
  if (message.GET === 'lastActivity')
    process.send(lastActivity)
})

let updateLastActivity = message => {
  // update last activity
  let now = new Date()
  lastActivity.ts = now.getTime()
  lastActivity.count++
  lastActivity.message = message
}

let outputCallback = message => {
  // pub to redis
  pubClient.publish(pubChannel, message)

  // log
  updateLastActivity(message)
}

// multi-source handlers
let handlers = {}

subClient.on('message', (channel, message) => {
  let json = JSON.parse(message)
  
  // create handler for new source
  if (handlers[message.source] === undefined || handlers[message.source] == null) {
    let esbParser = new EsbParser({outputCallback: outputCallback})
    handlers[message.source] = esbParser
  }

  // get parser for source
  let esbParser = handlers[message.source]
  esbParser.findXML(json.message)
})

class EsbParser {
  constructor({outputCallback}) {
    this.outputCallback = outputCallback

    this.xmlpush = 0
    this.xmlstr = ""
    this.pheader = {}
    this.esbout = {}
    this.pmtsTime= ""

    // for es6, we'd better bind member function to the instance we're creating
    // otherwise, member function may have different 'this' ref depending on context
    // bind() only works for the first time it's called on an object
    // so we don't have to worry about (unexpected) re-binding
    this.findXML = this.findXML.bind(this)
    this.trim = this.trim.bind(this)
    this.trimStr = this.trimStr.bind(this)
    this.readTag = this.readTag.bind(this)
    this.parseXML = this.parseXML.bind(this)
    this.parseTime = this.parseTime.bind(this)
  }

  // interface
  findXML(str) {
    this.parseTime(str)

    if (str.substring(0, 5) == '<?xml')
    {
      if (this.xmlpush == 1)
        this.xmlstr = ""

      this.xmlpush = 1
    }
    else if (this.xmlpush == 1)
      this.xmlstr += this.trim(str) + ' '

    if ((this.xmlpush == 1) && (str.substring(0, 6) == '</TLS>' || str.substr(str.length - 6, 6) == '</TLS>'))
    {
      this.xmlpush = 0
      this.parseXML(this.xmlstr, this.pheader)
      this.xmlstr = ""
      this.pheader = {}
    }
  }

  // tools
  trim(str) {
    return str.replace(/(^\s*)|(\s*$)/g, "")
  }

  trimStr(str) {
    let re = /\s*([^\s\0]*)\s*/
    re.exec(str)
    return RegExp.$1
  }

  readTag(ob) {
    for(let p in ob)
      if(!_.isFunction(ob[p])) {
        if (_.has(ob[p], 'text'))  
          this.esbout[p] = ob[p].text()

        if (_.has(ob[p], 'each'))
          this.readTag(ob[p])
      } // if
  }

  parseXML(str, header) {
    // console.log('esb.js - parseXML - str: ', str, ' header: ', header)
    let that = this
    let temp = (str)

    try {
      xmlreader.read(temp, function (err, res) {
        if (err) {
          // console.log('esb.js - parseXML - err: ', err.stack)
          return
        }

        that.readTag(res['TLS']);
        return
      })
    } catch (err) {
      // console.log('esb.js - parseXML - catch err: ', err.stack)
    }
  }

  parseTime(str)
  {
    if (str.length > 0)
    {
      this.pheader.beginFlag = str.substring(0, 7);
      if ((this.pheader.beginFlag != 'RECVXML') && (this.pheader.beginFlag != 'SENDXML'))
        return

      let strsz = str.split(',')

      if (this.pheader.beginFlag == 'RECVXML') {
        this.esbout.SEQ = this.trim(strsz[1]).substring(4, 26)
        this.esbout.RECVTIME = this.trim(strsz[3]).substring(5, 28)
      }

      if (this.pheader.beginFlag == 'SENDXML') {  
        if(this.esbout.SENDTIME != undefined) {
          // send and log
          this.outputCallback(JSON.stringify(this.esbout))
        }

        //clear old 
        this.esbout = {}
        this.esbout.SEQ = this.trim(strsz[1]).substring(4,26)
        this.esbout.SENDTIME = this.trim(strsz[3]).substring(5,28)
      }    
    }
  }

} // class

subClient.subscribe(subChannel)
