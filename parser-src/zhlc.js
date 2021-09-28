import Parser from '../lib/Parser'
import { parseString } from 'xml2js'
import lcpt_Map from './zhlc/Lcpt_map'

let lcptmap
let logId = ''

let getMsg = (message) => {
  let splitMessage = message.split(' ')
  let threadIdStr = splitMessage[0]
  let logIdStr = splitMessage[1]
  let FunctionIdStr = splitMessage[2]
  let threadId = threadIdStr.substring(threadIdStr.indexOf('[') + 1, threadIdStr.lastIndexOf(']'))
  logId = logIdStr.substring(logIdStr.indexOf('[') + 1, logIdStr.lastIndexOf(']'))
  let FunctionId = FunctionIdStr.substring(FunctionIdStr.indexOf('[') + 1, FunctionIdStr.lastIndexOf(']'))
  let time = ''
  let result = {}
  if (message.indexOf('请求时间') != -1) {
    time = message.substr(message.indexOf('请求时间') + 5, 23)
    result['startTime'] = new Date(time).getTime()
  } else if (message.indexOf('应答时间') != -1) {
    time = message.substr(message.indexOf('应答时间') + 5, 23)
    result['endTime'] = new Date(time).getTime()
  }
  result['threadId'] = threadId
  result['logId'] = logId
  result['FunctionId'] = FunctionId
  let msg = ''
  if (message.indexOf('请求信息') != -1) {
    msg = message.substr(message.indexOf('请求信息') + 5)
  } else if (message.indexOf('应答信息') != -1) {
    msg = message.substr(message.indexOf('应答信息') + 5)
  }
  let split = msg.split('|')
  for (let item of split) {
    if (item) {
      let key = item.split('=')[0]
      let value = item.split('=')[1]
      result[key] = value
    }
  }
  return result
}


let messageHandler = (parser, channel, message) => {
  if (message.indexOf('请求信息') != -1 && message.indexOf('请求时间') != -1) {
    let result = getMsg(message)
    lcptmap.add(logId, result)
  } else if (message.indexOf('应答时间') != -1 && message.indexOf('应答信息') != -1) {
    let result = getMsg(message)
    let exist = lcptmap.lookup(logId)
    if (exist) {
      let data = lcptmap.get(logId).data
      for (let key in data) {
        result[key] = data[key]
      }
      lcptmap.delete(logId)
      parser.sendResult(JSON.stringify(result))
    }
  }
}

let lcptParser = new Parser(messageHandler)
lcptmap = new lcpt_Map(lcptParser)
lcptParser.start()

