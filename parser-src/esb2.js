import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import path from 'path'
import {parseString} from 'xml2js'


//let esbParserSrc = fs.readFileSync('./parser-src/esb/esb.pegjs', 'UTF-8')
let esbParserSrc = fs.readFileSync(path.resolve(__dirname, './esb/esb.pegjs'),'UTF-8')
let esbParser = peg.generate(esbParserSrc)

let states = { header: 0, idle: 1, xml: 2}
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
      if (message.match('RECVXML') !== null || message.match('SENDXML') !== null) {
        try {
	  if(message.match('RECVXML')){
            let header = esbParser.parse(message)
            result.qheader = "RECVXML"
	    result["RECVTIME"] = header.header.time
            result['SEQ'] = header.header.seq
          }else if( message.match('SENDXML')){
            let header = esbParser.parse(message)
            result.qheader = "SENDXML"
	    result["SENDTIME"] = header.header.time
            result['SEQ'] = header.header.seq
          }
          state = states.idle
        }
        catch(e) {
          parser.sendError(message, 'state.header', e)

          resetState()
        }
      }
      break;
    
    case states.idle:
      if (message.match('P') !== null  ) {
        try {
          state = states.xml
        }
        catch(e) {
          parser.sendError(message, 'state.idle', e)

          resetState()
        }
      }
      break;

    case states.xml:
       buffer += message
	if (message.indexOf("</soapenv:Envelope>") != -1) {
        try {
          parseString(buffer, (err, xmlJson) => {
            if (err === null) {
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

let esbParser2 = new Parser(messageHandler) //???
esbParser2.start()





// whitespace   [ \t\r\n]*
// number  [0-9]+ { return parseInt(text(), 10) }
