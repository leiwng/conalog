import fs from 'fs'
import Parser from '../lib/Parser'


let result = {}
let resetState = () => {
  result = {}
}

let messageHandler = (parser, channel, message) => {

  try {
		result = JSON.parse(message.replace(/\\/g,''))
    parser.sendResult(JSON.stringify(result))
    resetState()
  }
  catch(e) {
    parser.sendError(message, 'state.idle', e)
    resetState()
  }
}

let oracledbParser = new Parser(messageHandler)
oracledbParser.start()



