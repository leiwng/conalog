
import Parser from '../lib/Parser'


let result = {}

let resetState = () => {
  result = {}
}

let messageHandler = (parser, channel, message) => {

  try {
    var msg = message.substr(4)
    var content = msg.split("> ").map(val => val.substr(1,val.length))
    result["ts"] = content[0]
    result["level"] = content[1]
    result["system"]  = content[2]
    result["computerName"] = content[3]
    result["serverName"] = content[4]
    result["threadID"] = content[5]
    result["userID"] = content[6]
    result["originalTime"] = content[9]
    result["msgID"] = content[10]
    result["message"] = content[11]
    parser.sendResult(JSON.stringify(result))
    resetState()
  }
  catch(e) {
    parser.sendError(message, 'state.idle', e)
    resetState()
  }
}

let weblogicLogParser = new Parser(messageHandler)
weblogicLogParser.start()

