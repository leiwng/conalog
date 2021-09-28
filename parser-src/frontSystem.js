// 开始： 接收通讯报文完成（里面包含数据）  中间：收到通讯报文:（包含数据）     结束：交易处理完成      唯一标示号：24499814
import Parser from '../lib/Parser'
import { parseString } from 'xml2js'
import fs from 'fs'
import peg from 'pegjs'
import path from 'path'

let FrontMap = require(path.resolve(__dirname, './frontSystem/FrontMap.js')).default
let front_map

let parsers = fs.readFileSync(path.resolve(__dirname, './frontSystem/frontSystem.pegjs'), 'UTF-8')
let notXmlParser = peg.generate(parsers)

let buffer = ""
let process = ''
let payload = ''
let ts = ''
let states = { idle: 0, res1: 1, res2: 2 }
let state = states.idle
let resetState = () => {
  buffer = ""
  state = states.idle
}

/*const parseTs = (tsString) => {
  let year = new Date().getFullYear()
  let [month, day, timeStr] = tsString.split('-')
  let date = year + '-' + month + '-' + day + ' ' + timeStr
  let ts = new Date(date).getTime()
  return ts
}*/
const parseTs = (tsString) => {
  let year = new Date().getFullYear()
  let [month, day, timeStr] = tsString.split('-')
  let [hour, min, secus] = timeStr.split(':')
  let [sec, us] = secus.split('.')

  let ts = new Date(year, month - 1, day, hour, min, sec, us)
  return ts.getTime() - 8 * 60 * 60 * 1000;
}


const parseMsg = (msg) => {
  let result = {}
  let output = notXmlParser.parse(msg).content
  for (let key in output) {
    let item = output[key]
    let key = item.key
    let value = item.value
    result[key] = value
  }
  return result
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
  switch (state) {
    case states.idle:
      if (message.indexOf("接收通讯报文完成") != -1) {
        let [time, a, b, pid, log, action, msg] = message.split('|')
        process = pid
        payload = message.substr(message.indexOf('msg['))
        ts = time.split(' ')[0]
        if (message.indexOf('>') == -1) { // xml 多行
          buffer += payload
          state = states.res1
        } else if (message.indexOf('</>') !== -1) { // </>单行

          try {
            let msg2 = payload.substring(payload.indexOf('<'), payload.lastIndexOf('</>') + 3)
            //					console.log('接受通讯报文完成单行', process,msg2)
            let result = parseMsg(msg2)
            if (!front_map.lookup(process)) {
              let startmsg = {
                startTime: ts,
                msg: result,
              }
              front_map.add(process, startmsg)
            } else {
              front_map.add(process, result)
            }
          } catch (err) {
            parser.sendError(message, '接收通讯报文完成', err)
          }

        } else if (message.indexOf('<?xml') !== -1) {

          try {
            let msgxml = message.substring(message.indexOf('<'), message.lastIndexOf('>') + 1)
            parseString(msgxml, { explicitArray: false }, (err, xmlJson) => {
              if (err == null) {
                let result = xmlJson
                if (result == null) {
                  result = {}
                }
                if (!front_map.lookup(process)) {
                  let startmsg = {
                    startTime: ts,
                    msg: result,
                  }
                  front_map.add(process, startmsg)
                } else {
                  front_map.add(process, result)
                }
              }
              else {
                parser.sendError(message, '接收通讯报文完成', err)
              }
            })
          } catch (err) {
            parser.sendError(message, '接收通讯报文完成', err)
          }

        } else {
          if (!front_map.lookup(process)) {
            let startmsg = {
              startTime: ts,
              msg: {},
            }
            //	console.log('空白行接受通讯报文完成',process,startmsg)
            front_map.add(process, startmsg)
          }
        }
      } else if (message.indexOf("收到通讯报文:") != -1) {
        let [time, a, b, pid, log, action, msg] = message.split('|')
        process = pid
        payload = message.substr(message.indexOf('msg['))
        if (message.indexOf('<?xml') !== -1) { //多行xml
          buffer += payload
          state = states.res2
        } else if (message.indexOf('</>') !== -1) { //单行</>
          //      console.log('受到通讯报文',process, payload)
          let msg3 = payload.substring(payload.indexOf('<'), payload.lastIndexOf('</>') + 3)
          try {
            let resultrec = parseMsg(msg3)
            if (front_map.lookup(process)) {
              front_map.add(process, resultrec)
            }
          } catch (err) {
            parser.sendError(msg3, 'messageHandler()', { message: 'Failed to parse 收到通讯报文', err })
          }
        }
      } else if (message.indexOf("交易处理完成") != -1) {
        let [time, a, b, pid, log, action, msg] = message.split('|')
        process = pid
        ts = time.split(' ')[0]
        try {
          let all = front_map.get(process).data
          let startTime = parseTs(all.startTime)
          let endTime = parseTs(ts)
      		//let startTime = parseTs(all.startTime).getTime() + parseTs(all.startTime).getTimezoneOffset() * 60 * 1000
					//let endTime = parseTs(ts).getTime() + parseTs(ts).getTimezoneOffset() * 60 * 1000 
			 	  let result = all.msg
         // result['startTime'] = startTime
         // result['endTime'] = endTime
         // result['duration'] = endTime - startTime
          result['process'] = process
//					console.log('result', result, startTime, endTime)
          let final = {}
          parse(result, final)
  				final['startTime'] = startTime
					final['endTime'] = endTime
					final['duration'] = endTime - startTime
					if (final.TranDate) {
						let date = final.TranDate
						if (date.indexOf(':') != -1) {
							var b = date.substring(0,10)
							var c = date.substring(10)
							date = b + 'T' + c
							final.TranDate = date
						}
					}
          parser.sendResult(JSON.stringify(final))
          front_map.delete(process)
          resetState()
        } catch (err) {
          parser.sendError(message, 'messageHandler()', { message: 'Failed to send ', err })
        }
      }
      break

    case states.res1:
      if (buffer.indexOf(']') != -1) {
        let msg2 = buffer.substring(buffer.indexOf('<'), buffer.lastIndexOf('>') + 1)
        parseString(msg2, { explicitArray: false }, (err, xmlJson) => {
          if (err == null) {
            let result = xmlJson
            if (result == null) {
              result = {}
            }
            if (!front_map.lookup(process)) {
              let startmsg = {
                startTime: ts,
                msg: result,
              }
              front_map.add(process, startmsg)
            } else {
              front_map.add(process, result)
            }
          }
          else {
            parser.sendError(msg2, '接收通讯报文完成', err)
          }
        })
        resetState()
      } else {
        buffer += message.trim()
      }
      break

    case states.res2:
      if (buffer.indexOf(']') != -1) {
        console.log('接受报文多行', process, buffer)
        let msg4 = buffer.substring(buffer.indexOf('<'), buffer.lastIndexOf('>') + 1)
        parseString(msg4, { explicitArray: false }, (err, xmlJson) => {
          if (err == null) {
            let result = xmlJson
            if (result == null) {
              result = {}
            }
            if (front_map.lookup(process)) {
              front_map.add(process, result)
            }
          }
          else {
            parser.sendError(msg4, '接收通讯报文：', err)
          }
        })
        resetState()
      } else {
        buffer += message.trim()
      }
      break

    default:
      resetState()
      break;
  }
}

let front = new Parser(messageHandler)
front_map = new FrontMap(front)
front.start()



