import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import {parseString} from 'xml2js'
import param from './fep_log/Param'
import packet from './fep_log/Packet'
import path from 'path'


// load and create peg parser
//let fepParserSrc = fs.readFileSync('./parser-src/fep_log/fep.pegjs', 'UTF-8')
let fepParserSrc = fs.readFileSync(path.resolve(__dirname, './fep_log/fep.pegjs'),'UTF-8')
let headerParser = peg.generate(fepParserSrc)


// FSM - Finite State Machine
let states = { header:1, detect:2, xml2:3 }
let state = states.header

let buffer = ""
let result = {header:{ts:"",level:"",source:{},operation:{}}}

let resetState = () => {
  buffer = ""
  result = {header:{ts:"",level:"",source:{},operation:{}}}
  state = states.header
}

let messageHandler = (parser, channel, message) => {
  switch (state) {
    case states.header:
      // parse header
      try {
        let header = headerParser.parse(message)
        result.header['ts'] = header.ts
        result.header['level'] = header.level
        result.header.source['filename'] = header.filename
        result.header.source['lines'] = header.lines
        result.header.operation['action'] = header.action
        result.header.operation['subject'] = header.subject
        state = states.detect
      }
      catch(e) {
        parser.sendError(message, 'state.header', e)
        resetState()
      }
      break;

    case states.detect:
      buffer += message
      if ( message.indexOf("<xml>") != -1 && message.indexOf("</xml>") != -1 ) {
        try {
					/*single-line xml*/
          parseString(message, (err, xmlJson) => {
            if (err == null) {
              result.message = xmlJson
              parser.sendResult(JSON.stringify(result))
            } else {
              parser.sendError(err, 'state.xml', err)
            }
          })

          resetState()
        }
        catch(e) {
          parser.sendError(message, 'state.xml', e)
          resetState()
        }

      }
      else if( message.indexOf("<xml>") != -1 && message.indexOf("</xml>") == -1){
				/*multi-line xml*/
        state = states.xml2
      }
      else if(message.split('&').length > 1 && message.split('&').every(v => v.split('=').length > 1)){
        try{
					/*param*/
          let xmlJson = param.start(message)
          result.message = xmlJson
          parser.sendResult(JSON.stringify(result))

          resetState()
        }
        catch(e){
          parser.sendError(message, 'state.param', e)
          resetState()
        }
      }
      else if(packet.xml(message)){
        try{
					/*datagram to xml*/
          let xml = packet.xml(message)
          parseString(xml, (err, xmlJson) => {
            if (err == null) {
              result.message = xmlJson
              parser.sendResult(JSON.stringify(result))
            } else {
              parser.sendError(err, 'state.packet_xml', err)
            }
          })

          resetState()
        }
        catch(e){
          parser.sendError(message, 'state.packet_xml', e)
          resetState()
        }
      }
      else if(packet.param(message)){
        try{
					/*datagram to param*/
          let params = packet.param(message)
          let xmlJson = param.start(params)
          result.message = xmlJson
          parser.sendResult(JSON.stringify(result))

          resetState()
        }
        catch(e){
          parser.sendError(message, 'state.packet_param', e)
          resetState()
        }
      }
      else{
        try{
					/*json*/
          var xmlJson = JSON.parse(message)
          result.message = xmlJson
          parser.sendResult(JSON.stringify(result))
					resetState()
        }
        catch(e){
          parser.sendError(message, 'state.json', e)
        }
        try{
					/*datagram to json*/
          let json = packet.json(message)
          var xmlJson = JSON.parse(json)
          result.message = xmlJson
          parser.sendResult(JSON.stringify(result))
					resetState()
        }
        catch(e){
          parser.sendError(message, 'state.packet_json', e)
        }
			 resetState()

      }
      break;

    case states.xml2:
      buffer += message
      if (buffer.indexOf("<xml>") != -1 && buffer.indexOf("</xml>") != -1 ) {
        try {
          buffer = buffer.replace(/\]+>/g, '').replace(/<!\[CDATA\[/g, '')
          parseString(buffer, (err, xmlJson) => {
            if (err == null) {
              result.message = xmlJson
              parser.sendResult(JSON.stringify(result))
            } else {
              parser.sendError(buffer, 'state.xml2', err)
            }
          })

          resetState()
        }
        catch(e) {
          parser.sendError(e, 'state.xml2', e)
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

