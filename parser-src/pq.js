import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import path from 'path'

//let ParserSrc = fs.readFileSync('./parser-src/demoServer/pq.pegjs', 'UTF-8')
let ParserSrc = fs.readFileSync(path.resolve(__dirname, './demoServer/pq.pegjs'),'UTF-8')
let pqParserSrc = peg.generate(ParserSrc)

let result = {}

let resetState = () => {
  result = {}
}

let messageHandler = (parser, channel, message) => {

  try {
    let output = pqParserSrc.parse(message)
    result = output
		result.ts = new Date().getTime()
		result.source = channel.substr(channel.indexOf("_")+1)
    parser.sendResult(JSON.stringify(result))
    resetState()
  }
  catch(e) {
    parser.sendError(message, 'state.idle', e)
    resetState()
  }
}

let pqParser = new Parser(messageHandler)
pqParser.start()
