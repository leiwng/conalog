import Parser from '../lib/Parser'
import {parseString} from 'xml2js'
import MobileBank_map from './mobile_bank/mobile_bank_map'

let mobile_bank_map
let states = {idle:0, recReqInfo:1, recRspInfo:2}

let MsgRecBuf = ''

let state = states.idle

let MsgInfo = {

  processID: '',
  startTime: '',
  endTime: '',
  duration: 0,
  bizDesc:''

}

let resetState = () => {

  MsgRecBuf = ''

  state = states.idle

  MsgInfo = {}

}

// 请求 报文 开始行标识
let ReqHeader = 'cn.com.yitong.ares.net.esb.EsbSocketClient:137'

// 响应 报文 开始行标识
let RspHeader = 'cn.com.yitong.ares.net.esb.EsbSocketClient:163'

const parseTs = (tsString) => {
  let [dateStr, timeStr] = tsString.split(' ')
  let [year, month, day] = dateStr.split('-').map((str) => {
    return parseInt(str)
  })
  let [hour, min, secus] = timeStr.split(':')
  let [sec, us] = secus.split(',')

  let ts = new Date(year, month - 1, day, hour, min, sec, us)
  return ts
}

const clearMsgInfoMap = (rec_id) => {

  if (mobile_bank_map.lookup(rec_id)) {

    mobile_bank_map.delete(rec_id)

  }

}

const parseXmlMsg = (parser) => {

  let msg = MsgRecBuf

  try {
    // 将XML格式字串转换为JSON对象，返回值在xmlJson中，错误信息在err中
    parseString(msg, { explicitArray: false }, (err, xmlJson) => {
      if (err === null) {
        //将JSON格式的KV，转换成JavaScript的Map中的KV，存入PackMsgInfo

        //Debug
        // console.log('parseXmlMsg:Before parseString:xmlJson->MsgInfo')
        // console.dir(xmlJson)
        // console.dir(MsgInfo)

        parse(xmlJson, MsgInfo)

        //Debug
        // console.log('parseXmlMsg:After parse(xmlJson, MsgInfo)')
        // console.dir(MsgInfo)

        let existPack = mobile_bank_map.lookup(MsgInfo.processID)
        if (existPack){

          let tmp_storedmsginfo = mobile_bank_map.get(MsgInfo.processID).data

          let full_packmsginfo = Object.assign({}, tmp_storedmsginfo, MsgInfo)
          
          //Debug
          // console.log('parseXmlMsg:Find Process:Merge PackInfo')
          // console.dir(tmp_storedmsginfo)
          // console.dir(MsgInfo)
          // console.dir(full_packmsginfo)

          mobile_bank_map.delete(MsgInfo.processID)
          mobile_bank_map.add(MsgInfo.processID, full_packmsginfo)
        } else {
          mobile_bank_map.add(MsgInfo.processID, MsgInfo)

          //Debug
          // console.log('parseXmlMsg:New PackInfo')
          // console.dir(MsgInfo)

        }
        // resetState()
      }
      else {

        // console.log('fail to deal XML format Pack Msg')
        resetState()
      }
    })
  } catch (e) {
    parser.sendError(MsgInfo, 'state.xml', e)
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

  // message = message.message

  switch (state) {
    case states.idle:

      if (message.indexOf(ReqHeader) != -1) {

        let stp = message.indexOf('[') + 1
        let edp = message.indexOf(']')
        MsgInfo.startTime = parseTs(message.substring(stp, edp))

        let msg_split = message.split(' ')

        MsgInfo.processID = msg_split[2] + '_' + msg_split[3] + '_' + msg_split[4]

        MsgInfo.bizDesc = msg_split[5]

        MsgRecBuf = '<?xml version="1.0" encoding="UTF-8"?>'

        state = states.recReqInfo

      } else if (message.indexOf(RspHeader) != -1) {

        let stp = message.indexOf('[') + 1
        let edp = message.indexOf(']')
        MsgInfo.endTime = parseTs(message.substring(stp, edp))

        let msg_split = message.split(' ')

        MsgInfo.processID = msg_split[2] + '_' + msg_split[3] + '_' + msg_split[4]

        MsgRecBuf = '<?xml version="1.0" encoding="UTF-8"?>'

        state = states.recRspInfo
      }

      break

    case states.recReqInfo:

      // [2018-10-22 09:54:40,223]
      if ((message.indexOf('[') == 0) && (message.indexOf(']')) == 24){
        resetState()
      }

      MsgRecBuf += message

      if (message.indexOf('</service>') != -1) {

        parseXmlMsg(parser)

        //restart
        resetState()
      }

      break

    case states.recRspInfo:

      // [2018-10-22 09:54:40,223]
      if ((message.indexOf('[') == 0) && (message.indexOf(']')) == 24){
        resetState()
      }

      MsgRecBuf += message

      if (message.indexOf('</service>') != -1) {

        parseXmlMsg(parser)

        let finalPackData = mobile_bank_map.get(MsgInfo.processID).data

        if (finalPackData !== null) {
          finalPackData.duration = MsgInfo.endTime.getTime() - MsgInfo.startTime.getTime()

          parser.sendResult(JSON.stringify(finalPackData))

          clearMsgInfoMap(MsgInfo.processID)
        }

        //restart
        resetState()
      }

      break

    default:
      resetState()
      break
  }
}

let MobileBankParser = new Parser(messageHandler)

mobile_bank_map = new MobileBank_map(MobileBankParser)

MobileBankParser.start()