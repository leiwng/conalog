import Parser from '../lib/Parser'
import { parseString } from 'xml2js'
import fs from 'fs'
import peg from 'pegjs'
import path from 'path'

let parser = fs.readFileSync(path.resolve(__dirname, './LZesb/esb.pegjs'), 'UTF-8')
let esbParser = peg.generate(parser)

let states = { idle: 0, xmls: 1, xmls2: 2 }
let state = states.idle

let buffer = ""
let result = {}
let startTs = ''
let endTs = ''

let resetState = () => {
  buffer = ""
  result = {}
  state = states.idle
  startTs = ''
  endTs = ''
}
const parseTs = (tsString) => {
  let date = tsString.replace(/,/, '.')
  let ts = new Date(date).getTime()
  return ts
}
function parseJson(obj, final) {
  for (var key in obj) {
    if (typeof (obj[key]) == 'object') {
      parseJson(obj[key], final)
    } else {
      final[key] = obj[key]
    }
  }
}

let messageHandler = (parser, channel, message) => {
  message = message.message; //agc 采集
  switch (state) {
    case states.idle:
      if (message.indexOf('SecTCP mode is ‘short’') != -1) {
        let splitmsg = message.split(' ')
        startTs = splitmsg[0] + ' ' + splitmsg[1]
      } else if (message.indexOf('TCPServer has received request message:') != -1) {
        let splitmsg = message.split(' ')
        endTs = splitmsg[0] + ' ' + splitmsg[1]
      } else if (message.indexOf('解密后的报文是') != -1) {
        let splitmsg = message.split(' ')
        endTs = splitmsg[0] + ' ' + splitmsg[1]
        startTs = endTs
        state = states.xmls2
      }
      try {
        if (message.indexOf("(String) [") != -1) {
          if (message.indexOf(']') != -1) {
            //处理单行XML
            let start = message.substr(message.indexOf('<'))
            let end = start.indexOf(']')
            let msg = start.substr(0, end)

            if (msg.indexOf('<?xml') != -1) {
              parseString(msg, { explicitArray: false }, (err, xmlJson) => {
                if (err === null) {
                  result = xmlJson
                  result['startTime'] = startTs
                  result['endTime'] = endTs
                  result['useTime'] = parseTs(endTs) - parseTs(startTs)
                  let finalResult = {}
                  parseJson(result, finalResult)
                  parser.sendResult(JSON.stringify(finalResult))
                  resetState()
                }
                else {
                  parser.sendError(buffer, 'state.idle', err)
                  resetState()
                }
              })
            } else {
              let outputpeg = esbParser.parse(msg)
              let output = outputpeg.content
              for (let key in output) {
                let item = output[key]
                let key = item.key
                let value = item.value
                result[key] = value
              }
              result['startTime'] = startTs
              result['endTime'] = endTs
              result['useTime'] = parseTs(endTs) - parseTs(startTs)
              let finalResult = {}
              parseJson(result, finalResult)
              parser.sendResult(JSON.stringify(finalResult))
              resetState()
              // parser.sendResult(JSON.stringify(result))
            }
            // resetState()
          } else {
            //处理多行 XML
            state = states.xmls
          }
        }
        // else if (message.indexOf("解密后的报文是") != -1) {
        //   state = states.xmls2
        // }
      }
      catch (e) {
        parser.sendError(message, 'state.idle', e)
        resetState()
      }
      break;

    case states.xmls:
      if (message.indexOf(']') == -1) {
        buffer += message
      } else {
        try {
          //处理多行xml
          parseString(buffer, { explicitArray: false }, (err, xmlJson) => {
            if (err === null) {
              result = xmlJson
              result['startTime'] = startTs
              result['endTime'] = endTs
              result['useTime'] = parseTs(endTs) - parseTs(startTs)
              let finalResult = {}
              parseJson(result, finalResult)
              parser.sendResult(JSON.stringify(finalResult))
              resetState()
            }
            else {
              parser.sendError(buffer, 'state.xmls', err)
              resetState()
            }
          })
        }
        catch (e) {
          parser.sendError(message, 'state.xmls', e)
          resetState()
        }
      }
      break;

    case states.xmls2:
      if (message.indexOf('}') == -1) {
        buffer += message
      } else {
        try {
          parseString(buffer, { explicitArray: false }, (err, xmlJson) => {
            if (err === null) {
              result = xmlJson
              result['startTime'] = startTs
              result['endTime'] = endTs
              result['useTime'] = parseTs(endTs) - parseTs(startTs)
              // let finalResult = {}
              // parseJson(result, finalResult)
              parser.sendResult(JSON.stringify(result))
              resetState()
            }
            else {
              parser.sendError(buffer, 'state.xmls2', err)
              resetState()
            }
          })
        }
        catch (e) {
          parser.sendError(message, 'state.xmls2', e)
          resetState()
        }
      }
      break;
  }
}

let esb = new Parser(messageHandler)
esb.start()




