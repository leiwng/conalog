import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'



let states = { idle: 0, header: 1}
let state = states.idle

let buffer = ""
let result = {}
let reg = /([A-Za-z]{3}\s+){2}[0-9]{1,2}\s+(0|1|2)[0-9](:[0-5][0-9]){2}\s+\d{4}/

let parseTime = (time) => {
  let [d,mon,day,h_m_s,year] = time.split(' ')
  let [hour,min,sec] = h_m_s.split(':')
  var ms = ['Jan', 'Feb', 'Mar' , 'Apr', 'May','Jun','Jul','Aug','Sept','Oct','Nov','Dec']
  let month = ms.indexOf(mon) + 1
  let utc = new Date(year, month - 1, day, hour, min, sec).getTime()
  return utc
}

let resetState = () => {
  buffer = ""
  result = {}
}
let timer = null

let messageHandler = (parser, channel, message) => {
  switch (state) {

    case states.idle:
      try {

        if(reg.test(message)){
          result["ts"] = parseTime(message)
          state = states.header
        }

      }
      catch(e) {
        parser.sendError(message, 'state.idle', e)
        resetState()
      }
      break;

    case states.header:
      try {

        if(!reg.test(message)){
          buffer += message + " "
          if (!timer) {
            timer = setTimeout(() => {
              result["msg"] = buffer
              parser.sendResult(JSON.stringify(result))
              resetState()
              state = states.idle
              timer = null
            }, 3000)
          } else {
            clearTimeout(timer)
            timer = setTimeout(() => {
              result["msg"] = buffer
              parser.sendResult(JSON.stringify(result))
              resetState()
              state = states.idle
              timer = null
            }, 3000)
          }
        }else{
          if (timer) {
            clearTimeout(timer)
            timer = null
          }
            result["msg"] = buffer
            parser.sendResult(JSON.stringify(result))
            resetState()
            result["ts"] = parseTime(message)
        }

      }
      catch(e) {
        parser.sendError(message, 'state.header', e)
        resetState()
      }
      break;

    default:
      resetState()
      break;
  }
}

let oracleTraceParser = new Parser(messageHandler)
oracleTraceParser.start()


