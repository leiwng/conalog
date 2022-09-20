import Parser from '../lib/Parser'
import {parseString} from 'xml2js'
import NetsUnionPreSystem_Map from './netsunion_presystem/netsunion_presystem_map'

let nu_presys_map
let states = {idle:0,
    NewPackHeader:1, NewPackContent:2, NewPackContentReceiving:3,
    RspPackHeader:4, RspPackContent:5, RspPackContentReceiving:6
}

let XMLMsgRecBuffer = ''

let state = states.idle

let PackMsgInfo = {

  processID: '',
  startTime: '',
  endTime: '',

}

let resetState = () => {

  XMLMsgRecBuffer = ''

  state = states.idle

  PackMsgInfo = {}

}

let NewPackHeaderStr = '接收网联报文开始'
let RspPackHeaderStr = '返回网联报文开始'

let InputStreamStr = 'Inputstream------->'
const InputStreamStrLen = InputStreamStr.length

let OutputStreamStr = 'Outputstream------->'
const OutputStreamStrLen = OutputStreamStr.length

let XMLStartStr = '<?xml'
let XMLEndingStr = '</root>'

let ProcessIDSampleStr = '2018070509090482048231'
const ProcessIDLen = ProcessIDSampleStr.length

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

const parseXmlMsg = (parser) => {
  let msg = XMLMsgRecBuffer.substr(XMLMsgRecBuffer.indexOf(XMLStartStr))
  try {
    // 将XML格式字串转换为JSON对象，返回值在xmlJson中，错误信息在err中
    parseString(msg, { explicitArray: false }, (err, xmlJson) => {
      if (err === null) {
        //将JSON格式的KV，转换成JavaScript的Map中的KV，存入PackMsgInfo
        parse(xmlJson, PackMsgInfo)
        let existPack = nu_presys_map.lookup(PackMsgInfo.processID)
        if (existPack){

          let full_packmsginfo = {}
          let tmp_storedmsginfo = nu_presys_map.get(PackMsgInfo.processID).data

          parse(tmp_storedmsginfo, full_packmsginfo)
          parse(PackMsgInfo, full_packmsginfo)

          nu_presys_map.delete(PackMsgInfo.processID)
          nu_presys_map.add(PackMsgInfo.processID, full_packmsginfo)
        } else {
          nu_presys_map.add(PackMsgInfo.processID, PackMsgInfo)
        }
        // resetState()
      }
      else {
        parser.sendError(PackMsgInfo, 'fail to deal XML format Pack Msg', err)
        resetState()
      }
    })
  } catch (err) {
    parser.sendError(PackMsgInfo, 'state.xml', err)
    resetState()
  }
}

//将JSON格式的KV，转换成JavaScript的Map中的KV，存入PackMsgInfo
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
    case states.idle:

      if (message.indexOf(NewPackHeaderStr) != -1) {

        // switch to NewPackHeader state
        state = states.NewPackHeader

      } else if (message.indexOf(RspPackHeaderStr) != -1) {

        // switch to RspPackHeader state
        state = states.RspPackHeader

      }

      break

    case states.NewPackHeader:

      if (message.indexOf(InputStreamStr) != -1) {

        // 1. parse Inputstream line
        let msgHeader = message.split('|')

        // 2. get transition start time
        PackMsgInfo['startTime'] = parseTs(msgHeader[0])

        // 3. store ID and start time to pack storage
        PackMsgInfo['processID'] = msgHeader[1].substr(InputStreamStrLen, ProcessIDLen)

        // 4. switch to NewPackContent statue
        state = states.NewPackContent

        // 5. Init New Pack XML Msg buffer
        XMLMsgRecBuffer = ''

      }

      break

    case states.NewPackContent:

      if (message.indexOf(XMLStartStr) != -1) {

        // 不断将XML片段到写入到XML缓存中
        XMLMsgRecBuffer += message

        // 1. switch to NewPackContentReceiving statue
        state = states.NewPackContentReceiving

      }

      break

    case states.NewPackContentReceiving:

      // 不断将XML片段到写入到XML缓存中
      XMLMsgRecBuffer += message

      if (message.indexOf(XMLEndingStr) != -1) {

        // XML内容接收完成
        // 1. 处理XML格式报文，
        // 2. 将XML解析后的内容存入 pack storage 中
        parseXmlMsg(parse)
        // 3. switch to Idle state
        resetState()

      }

      break

    case states.RspPackHeader:

      if (message.indexOf(OutputStreamStr) != -1) {

        // 1. parse Inputstream line
        let msgHeader = message.split('|')

        // 2. get transition end time
        PackMsgInfo['endTime'] = parseTs(msgHeader[0])

        // 3. use ID to search the pack which already stored
        let tmp_process = msgHeader[1].substr(OutputStreamStrLen, ProcessIDLen)

        // 3.1 Found -> 记下这个pack storage, switch to RspPackContent state
        // 3.2 Not Found -> 丢弃数据, switch to Idle state
        if (tmp_process.length !== 0) {

          //存储processID，后续状态会用
          PackMsgInfo['processID'] = tmp_process

          let existProcess = nu_presys_map.lookup(tmp_process)
          if (existProcess){

            state = states.RspPackContent
            XMLMsgRecBuffer = ''

          } else {

            resetState()

          }
        } else {

          resetState()

        }

      }

      break

    case states.RspPackContent:

      if (message.indexOf(XMLStartStr) != -1) {

        // 不断将XML片段到写入到XML缓存中
        XMLMsgRecBuffer += message

        // 1. switch to RspPackContentReceiving statue
        state = states.RspPackContentReceiving

      }

      break

    case states.RspPackContentReceiving:

      // 不断将XML片段到写入到XML缓存中
      XMLMsgRecBuffer += message

      if (message.indexOf(XMLEndingStr) != -1) {

        // XML内容接收完成
        // 1. 处理XML格式报文，
        // 2. output to output channel
        // 3. back to idle state and init data
        parseXmlMsg(parse)
        let finalPackData = nu_presys_map.get(PackMsgInfo.processID).data
        if (finalPackData !== null) {
          finalPackData['duration'] = finalPackData.endTime - finalPackData.startTime
          parser.sendResult(JSON.stringify(finalPackData))
          nu_presys_map.delete(PackMsgInfo.processID)
        }
        resetState()
      }

      break

    default:
      resetState()
      break
  }
}

let NetsUnionPreSystemParser = new Parser(messageHandler)

nu_presys_map = new NetsUnionPreSystem_Map(NetsUnionPreSystemParser)

NetsUnionPreSystemParser.start()