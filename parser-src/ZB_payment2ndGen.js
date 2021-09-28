import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import path from 'path'
import {parseString} from 'xml2js'

// load and create peg parser
// let tsParserSrc = fs.readFileSync('./parser-src/payment2ndGen/ts.pegjs', 'UTF-8')
// let tsParser = peg.generate(tsParserSrc)

let headerParserSrc = fs.readFileSync(path.resolve(__dirname, './payment2ndGen/header.pegjs'),'UTF-8')
let headerParser = peg.generate(headerParserSrc)

// FSM - Finite State Machine
let states = {header: 1, xml: 2}
let state = states.header

let buffer = ""
let result = {}

let resetState = () => {
  buffer = ""
  result = {}
  state = states.header
}

let messageHandler = (parser, channel, message) => {
  switch (state) {
      case states.header:
        if (message.match('{H:') != null) {
          var index = message.indexOf('{H:')
          var time = message.substr(0,index).split(',')[0]
          var timestamp = Date.parse(new Date(time))/1000
          result['ts'] = timestamp

          var headermsg =message.substr(index)

          try {
						console.log('headermsg',headermsg)
            var  header = headerParser.parse(headermsg)
            result["header"] = header.header
						console.log('header',header)
            state = states.xml
          }
          catch(e) {
            parser.sendError(message, 'state.header', e)

            resetState()
          }
        }
      break;

    case states.xml:
      buffer += message

      if (message.indexOf("</Document>") != -1) {
        try {
          parseString(buffer, {ignoreAttrs: true}, (err, xmlJson) => {
            if (err == null) {
              result.xml = xmlJson
              parser.sendResult(JSON.stringify(result))
            }
            else {
              parser.sendError(buffer, 'state.xml', err)
            }
          })

          resetState()
        }
        catch(e) {
          parser.sendError(buffer, 'state.xml', e)

          resetState()
        }
      }
      break;

    default:
      resetState()
      break;
  }
}

let paymentParser = new Parser(messageHandler)
paymentParser.start()
