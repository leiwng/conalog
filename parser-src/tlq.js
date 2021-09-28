import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import path from 'path'
import {parseString} from 'xml2js'


//let locqParserSrc = fs.readFileSync('./parser-src/tlq/locq.pegjs', 'UTF-8')
let locqParserSrc = fs.readFileSync(path.resolve(__dirname, './tlq/locq.pegjs'),'UTF-8')
let locqParser = peg.generate(locqParserSrc)

//let sndqParserSrc = fs.readFileSync('./parser-src/tlq/sndq.pegjs', 'UTF-8')
let sndqParserSrc = fs.readFileSync(path.resolve(__dirname, './tlq/sndq.pegjs'),'UTF-8')
let sndqParser = peg.generate(sndqParserSrc)

let states = { idle: 0, header: 1, sndq:2, locq:3}
let state = states.idle

let buffer = ""
let result = {"sndQ":[],"locQ":[]}

let resetState = () => {
  buffer = ""
  result = {"sndQ":[],"locQ":[]}
}
let timer = null

let messageHandler = (parser, channel, message) => {
  switch (state) {

    case states.idle:
      try {
        if(message.indexOf("Quename") != -1){
          state = states.sndq
        }
      }
      catch(e) {
        parser.sendError(message, 'state.idle', e)
        resetState()
      }
      break;



    case states.sndq:
      try {
        if(message != ""  && message.indexOf("LocQ Message Information") == -1){

          let sndq = sndqParser.parse(message)
          result["sndQ"].push(sndq)
        }else{
          if(message != "" ){
            state = states.header
          }

        }
      }
      catch(e) {
        parser.sendError(message, 'state.sndq', e)
        resetState()
      }
      break;


    case states.header:
      try {
        if(message.indexOf("Quename") != -1){
          state = states.locq
        }

      }
      catch(e) {
        parser.sendError(message, 'state.header', e)
        resetState()
      }
      break;

    case states.locq:
      try {
        if(message != ""  && message.indexOf("SndQ Message Information") == -1){
          let locq = locqParser.parse(message)
          result["locQ"].push(locq)
          // timeout
          if (!timer) {
            timer = setTimeout(() => {
              parser.sendResult(JSON.stringify(result))
              resetState()
              state = states.idle
              timer = null
            }, 3000)
          } else {
            clearTimeout(timer)
            timer = setTimeout(() => {
              parser.sendResult(JSON.stringify(result))
              resetState()
              state = states.idle
              timer = null
            }, 3000)
          }

        }else{
          if(message.indexOf("SndQ Message Information") != -1){
            parser.sendResult(JSON.stringify(result))
            resetState()
            state = states.sndq
          }  else {
            if (timer) {
              clearTimeout(timer)
              timer = null
            }
          }
        }
      }
      catch(e) {
        parser.sendError(message, 'state.locq', e)
        resetState()
      }
      break;

    default:
      resetState()
      break;
  }
}

let tlqParser = new Parser(messageHandler)
tlqParser.start()


