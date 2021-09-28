import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import path from 'path'

//let parser = fs.readFileSync('./parser-src/syslog/syslog.pegjs', 'UTF-8')
let parser = fs.readFileSync(path.resolve(__dirname, './syslog/syslog.pegjs'),'UTF-8')
let sysParser = peg.generate(parser)

let result = {}

let resetState = () => {
  result = {}
}

let messageHandler = (parser, channel, message) => {

  try {
    let output = sysParser.parse(message)
    result = output
    parser.sendResult(JSON.stringify(result))
    resetState()
  }
  catch(e) {
    parser.sendError(message, 'state.idle', e)
    resetState()
  }
}

let sys = new Parser(messageHandler)
sys.start()


