import fs from 'fs'
import Parser from '../lib/Parser'
import {parseString} from 'xml2js'

let states = { idle: 0, content: 1}
let state = states.idle

let buffer = ""
let result = {}
let resetState = () => {
  result = {}
  buffer = ""
  let state = states.idle
}

let messageHandler = (parser, channel, message) => {
  switch (state) {

    case states.idle:
      try {
        if(message.indexOf("<msg") != -1){
          buffer += message
          state = states.content
        }
      }
      catch(e) {
        parser.sendError(message, 'state.idle', e)
        resetState()
      }
      break;

    case states.content:
      buffer += message
      if(message.indexOf("</msg>") != -1){
        try {
          parseString(buffer,{explicitArray : false}, (err, xmlJson) => {
            if (err == null) {
             // result.xml = xmlJson
							let msg = xmlJson.msg.$
							let txt = xmlJson.msg.txt
							msg["txt"] = txt
              result = msg
						  parser.sendResult(JSON.stringify(result))
            }
            else {
              parser.sendError(buffer, 'state.content', err)
            }
          })

          resetState()
        }
        catch(e) {
          parser.sendError(buffer, 'state.content', e)

          resetState()
        }
      }

      break;

    default:
      resetState()
      break;
  }

}

let oracleXMLParser = new Parser(messageHandler)
oracleXMLParser.start()

