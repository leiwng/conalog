import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import path from 'path'
import {parseString} from 'xml2js'

// load and create peg parser
//let qmgrParserSrc = fs.readFileSync('./parser-src/mq/qmgr.pegjs', 'UTF-8')
let qmgrParserSrc = fs.readFileSync(path.resolve(__dirname, './mq/qmgr.pegjs'),'UTF-8')
let qmgrParser = peg.generate(qmgrParserSrc)


// FSM - Finite State Machine
let states = {idle: 0, content:1}
let state = states.idle

let buffer = ""
let result = {}

let resetState = () => {
  buffer = ""
  result = {}

  state = states.idle
}

let messageHandler = (parser, channel, message) => {
  switch (state) {

    case states.idle:
      try {
        if(message.indexOf('Display Queue Manager details') != -1){
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
	if(message.indexOf("One MQSC command read.") != -1){
	  let output = qmgrParser.parse(buffer)
          for(let item of output){
           let key = item.key
           let value = item.value
           result[key]=value
        }
          parser.sendResult(JSON.stringify(result))
          resetState()
	}else{
	  buffer += message + ""
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

let qmgr = new Parser(messageHandler)
qmgr.start()

