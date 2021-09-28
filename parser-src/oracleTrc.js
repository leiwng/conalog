import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'



let states = { idle: 0, header: 1}
let state = states.idle

let buffer = ""
let result = {}
let reg = /^\*{3}\s+\d{4}-[0-1][0-9]-[0-9]{1,2}\s+(0|1|2)[0-9]:[0-5][0-9]:[0-5][0-9]\.\d{3}$/g


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
          result["ts"] = message.substr(3)
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
          result["ts"] = message.substr(3)
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

let oracleTrcParser = new Parser(messageHandler)
oracleTrcParser.start()



