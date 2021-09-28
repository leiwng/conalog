import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import path from 'path'
  
let parser = fs.readFileSync(path.resolve(__dirname, './accesslog/accesslog.pegjs'),'UTF-8')
//let parser = fs.readFileSync('./parser-src/accesslog/accesslog.pegjs', 'UTF-8')
let accessParser = peg.generate(parser)

let result = {}

let resetState = () => {
  result = {}
}

let messageHandler = (parser, channel, message) => {

  try {
    let output = accessParser.parse(message)
    result = output
    parser.sendResult(JSON.stringify(result))
    resetState()
  }
  catch(e) {
    parser.sendError(message, 'state.idle', e)
    resetState()
  }
}

let access = new Parser(messageHandler)
access.start()



