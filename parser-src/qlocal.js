import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import path from 'path'
import {parseString} from 'xml2js'

// load and create peg parser
//let qlocalParserSrc = fs.readFileSync('./parser-src/mq/qlocal.pegjs', 'UTF-8')
let qlocalParserSrc = fs.readFileSync(path.resolve(__dirname, './mq/qlocal.pegjs'),'UTF-8')
let qlocalParser = peg.generate(qlocalParserSrc)


// FSM - Finite State Machine
let states = {idle: 0, content:1}
let state = states.idle

let buffer = ""
let result = {}

let resetState = () => {
  buffer = ""
  result = {}
}

let messageHandler = (parser, channel, message) => {
  switch (state) {

    case states.idle:
      try {
        if(message.indexOf('Display Queue details') != -1){
          state = states.content
        }

      }
      catch(e) {
        parser.sendError(message, 'state.idle', e)
        resetState()
      }
      break;

    case states.content:
      try {
        if(message.indexOf("Display Queue details") == -1 && message.indexOf("One MQSC command read") == -1 && message.indexOf("AMQ") == -1){
          buffer += message + ""
        }else if(message.indexOf("One MQSC command read") != -1){
          result = qlocalParser.parse(buffer)
          parser.sendResult(JSON.stringify(result))
          resetState()
          state = states.idle
        }else {
          if(message.indexOf("Display Queue details") != -1){
            result = qlocalParser.parse(buffer)
            parser.sendResult(JSON.stringify(result))
            resetState()
          }
        }

      }
      catch(e) {
        parser.sendError(message, 'state.content', e)
        resetState()
      }
      break;


    default:
      resetState()
      break;
  }
}

let qlocalParsers = new Parser(messageHandler)
qlocalParsers.start()
