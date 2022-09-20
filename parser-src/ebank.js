//分为 esb 和 ebank 两种情况(处理两部分数据： 接收和返回) 接收数据是多行，esb: <service> 结尾  ebank: </EBANK> 或者 <Document>结尾，<Document>结尾的情况也会包含</EBANK>字段  返回数据为dataMap:{}
import Parser from '../lib/Parser'
import { parseString } from 'xml2js'
import Ebank_Map from './ebank/Ebank_map'

let ebank_map
let states = { header: 0, req: 1, }
let buffer = ''
let state = states.header
let req = {
  startTime: '',
  process: '',
}
let resetState = () => {
  buffer = ""
  state = states.header
  req = {
    startTime: '',
    process: '',
  }
}

const parseTs = (tsString) => {
  let [dateStr, timeStr] = tsString.split(' ')
  let [year, month, day] = dateStr.split('-').map((str) => {
    return parseInt(str)
  })
  let [hour, min, secus] = timeStr.split(':')
  let [sec, us] = secus.split('.')

  let ts = new Date(year, month - 1, day, hour, min, sec, us)
  return ts
}

const parseXml = (parser) => {
  let msg = buffer.substr(buffer.indexOf('<?xml'))
  try {
    parseString(msg, { explicitArray: false }, (err, xmlJson) => {
      if (err === null) {
        parse(xmlJson, req)
        ebank_map.add(req.process, req)
        resetState()
      }
      else {
        parser.sendError(buffer, 'fail to deal req', err)
        resetState()
      }
    })
  } catch (err) {
    parser.sendError(buffer, 'state.xml', err)
    resetState()
  }
}

function parse(obj, final) {
  for (var key in obj) {
    if (typeof (obj[key]) == 'object') {
      parse(obj[key], final)
    } else {
      final[key] = obj[key]
    }
  }
}

let messageHandler = (parser, channel, message) => {
  message = message.message
  switch (state) {
    case states.header:
      if (message.indexOf('com.csii.ibs.i2brouter.lzccb.esb.StreamFormatter') != -1 || message.indexOf('com.csii.ibs.i2brouter.lzccb.StreamFormatter') != -1) {

        try {
          let reqHeader = message.split(' ')
          req.startTime = parseTs(reqHeader[0] + ' ' + reqHeader[1])
          req.process = reqHeader[6]
          state = states.req
        } catch (err) {
          parser.sendError(message, 'start to receive req', err)
          resetState()
        }

      } else if ((message.indexOf('com.csii.ibs.i2brouter.lzccb.esb.AfterParser') != -1 || message.indexOf('com.csii.ibs.i2brouter.lzccb.AfterParser') != -1 ) && message.indexOf('dataMap') != -1) {
        try {
          let resHeader = message.substr(0, message.indexOf('dataMap:'))
          // let resMsg = message.substr(message.indexOf('dataMap:{') + 9, message.lastIndexOf('}'))
          let split = resHeader.split(' ')
          let endTime = parseTs(split[0] + ' ' + split[1])
          let process = split[6]
          // let responseJson = JSON.parse(resMsg.replace(/=/g, ':'))
          let resMsg = message.substring(message.indexOf('dataMap:{') + 9, message.lastIndexOf('}'))
          if (resMsg === '') {
            let existReq = ebank_map.lookup(process)
            if (existReq) {
              let result = ebank_map.get(process).data
              result['endTime'] = endTime
              result['duration'] = endTime - result.startTime
              parser.sendResult(JSON.stringify(result))
              ebank_map.delete(process)
            }
          } else {
            let msgSplit = resMsg.split(', ')
            let responseJson = {}
            for (let item of msgSplit) {
              let split = item.split('=')
              responseJson[split[0]] = split[1].trim()
            }
            let existReq = ebank_map.lookup(process)
            if (existReq) {
              let result = ebank_map.get(process).data
              result['endTime'] = endTime
              for (let key in responseJson) {
                result[key] = responseJson[key]
              }
              result['duration'] = endTime - result.startTime
              parser.sendResult(JSON.stringify(result))
              ebank_map.delete(process)
            }
          }
        } catch (err) {
          parser.sendError(message, 'fail to deal response', err)
          resetState()
        }
      }
      break

    case states.req:
      buffer += message
      if (message.indexOf('</service>') !== -1) {
        // 解析请求XML
        parseXml(parse)
      } else if (buffer.indexOf('<Document>') !== -1 && buffer.indexOf('</Document>') !== -1) {
        parseXml(parse)
      } else if (buffer.indexOf('<Document>') == -1 && buffer.indexOf('</EBANK>') !== -1) {
        parseXml(parse)
      }
      break

    default:
      resetState()
      break
  }
}

let ebankParser = new Parser(messageHandler)
ebank_map = new Ebank_Map(ebankParser)
ebankParser.start()



