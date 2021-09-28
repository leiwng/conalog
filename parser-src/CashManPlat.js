import Parser from '../lib/Parser'
import {parseString} from 'xml2js'
import CashManPlat_map from './cash_man_plat/cash_man_plat_map'

// 处理日志： cmsfront_20180815.log
let cash_man_plat_map
// GGZY:银企直连（公共资源交易中心），YQZL：银企直连，QZ：前置
let states = {idle:0, inPack:1, inGGZY_ReqMsg:2,
  inYQZLorClient_ReqMsg:3, inESB_ReqMsg:4, inQZ_ReqMsg:5}

let XmlRecBuf = ''

let state = states.idle

let MsgInfo = {

  linkID: '',
  startTime: '',
  endTime: '',
  duration: 0

}

let resetState = () => {

  XmlRecBuf = ''

  state = states.idle

  MsgInfo = {}

}

let PackHeadStr = '开始分级日志'
let PackEndStr = '提交缓冲日志'

// 同 银企直连 或 客户端 通信
let YQZLorClient_ReqHeadStr = '请求报文[<ap>'
let YQZLorClient_RspHeadStr = '应答报文[<ap>'

// 同 银企直连（公共资源交易中心） 通信
let GGZY_ReqHeadStr = '请求报文[<root>'
let GGZY_RspHeadStr = '返回中心报文：[<root>'

// 同 前置 通信
let QZ_ReqHeadStr = '发送核心请求报文：['
let QZ_RspHeadStr = '接收核心应答报文：['

// 同 ESB 通信
let ESB_ReqHeadStr = '发送ESB请求报文'
let ESB_RspHeadStr = '转码后ESB应答报文'

// tsString format: '2018-09-10 23:22:33.456'
const parseTs = (tsString) => {
  let [dateStr, timeStr] = tsString.split(' ')
  let [year, month, day] = dateStr.split('-').map((str) => {
    return parseInt(str)
  })
  let [hour, min, secus] = timeStr.split(':')
  let [sec, msec] = secus.split('.')

  let ts = new Date(year, month - 1, day, hour, min, sec, msec)
  return ts
}

// tsDate: '20180904'; tsTime: '234566'
const parseTs2 = (tsDate, tsTime) => {
  let year = parseInt(tsDate.substr(0, 4))
  let month = parseInt(tsDate.substr(4, 2))
  let day = parseInt(tsDate.substr(6, 2))

  let hour = parseInt(tsTime.substr(0, 2))
  let min = parseInt(tsTime.substr(2, 2))
  let sec = parseInt(tsTime.substr(4, 2))
  let msec = 0

  let ts = new Date(year, month - 1, day, hour, min, sec, msec)
  return ts
}

const clearMsgInfoMap = (rec_id) => {

  if (cash_man_plat_map.lookup(rec_id)) {

    cash_man_plat_map.delete(rec_id)

  }

}

const parseXmlMsg = (parser, xml_head_str, xml_tail_str) => {

  // 取XML缓冲区中的有效XML内容负载payload
  let stp = XmlRecBuf.indexOf(xml_head_str)
  let edp = XmlRecBuf.indexOf(xml_tail_str)
  let msg = XmlRecBuf.substring(stp, edp)
  try {
    // 将XML格式字串转换为JSON对象，返回值在xmlJson中，错误信息在err中
    parseString(msg, { explicitArray: false }, (err, xmlJson) => {
      if (err == null) {
        //将JSON格式的KV，转换成JavaScript的Map中的KV，存入PackMsgInfo

        //Debug
        // console.log('parseXmlMsg:Before parseString:xmlJson->MsgInfo')
        // console.dir(xmlJson)
        // console.dir(MsgInfo)

        parse(xmlJson, MsgInfo)

        //Debug
        // console.log('parseXmlMsg:After parse(xmlJson, MsgInfo)')
        // console.dir(MsgInfo)

        let existPack = cash_man_plat_map.lookup(MsgInfo.linkID)
        if (existPack){

          let tmp_storedmsginfo = cash_man_plat_map.get(MsgInfo.linkID).data

          let full_packmsginfo = Object.assign({}, tmp_storedmsginfo, MsgInfo)
          
          //Debug
          // console.log('parseXmlMsg:Find Process:Merge PackInfo')
          // console.dir(tmp_storedmsginfo)
          // console.dir(MsgInfo)
          // console.dir(full_packmsginfo)

          cash_man_plat_map.delete(MsgInfo.linkID)
          cash_man_plat_map.add(MsgInfo.linkID, full_packmsginfo)
        } else {
          cash_man_plat_map.add(MsgInfo.linkID, MsgInfo)

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

  // 走Agent Collector进来的message需要这条
  // message = message.message

  switch (state) {
    case states.idle:

      if (message.indexOf(PackHeadStr) != -1) {

        let st = message.indexOf('PID:') + 'PID:'.length
        let len = '18481160'.length
        MsgInfo['PID'] = message.substr(st, len)
        MsgInfo.linkID = MsgInfo['PID']

        st = message.indexOf('DATE:') + 'DATE:'.length
        len = '20180904'.length
        let dt = message.substr(st, len)

        st = message.indexOf('TIME:') + 'TIME:'.length
        len = '000000'.length
        let tm = message.substr(st, len)
        MsgInfo['startTime'] = parseTs2(dt, tm)

        state = states.inPack

      }

      break

    // 收到报文开始标志，进入报文处理
    case states.inPack:

      // -== 开始处理请求消息 ==-
      // 银企直连（公共资源交易中心）: '请求报文[<root>'
      if (message.indexOf(GGZY_ReqHeadStr) != -1) {

        // 开始囤积XML的内容
        let st = message.indexOf('请求报文[') + '请求报文['.length
        XmlRecBuf = message.substr(st)

        state = states.inGGZY_ReqMsg

      } else if (message.indexOf(YQZLorClient_ReqHeadStr) != -1) {
        // 银企直连 或 客户端: '请求报文[<ap>'

        // 开始囤积XML的内容
        let st = message.indexOf('请求报文[') + '请求报文['.length
        XmlRecBuf = message.substr(st)

        state = states.inYQZLorClient_ReqMsg

      } else if (message.indexOf(QZ_ReqHeadStr) != -1) {
        // 前置 : '发送核心请求报文：['

        // 开始囤积XML的内容
        let st = message.indexOf(QZ_ReqHeadStr) + QZ_ReqHeadStr.length
        XmlRecBuf = message.substr(st)

        state = states.inQZ_ReqMsg

      } else if (message.indexOf(ESB_ReqHeadStr) != -1) {
        // ESB : '发送ESB请求报文'

        // 开始囤积XML的内容
        if (message.indexOf('<?xml') != -1) {


          let st = message.indexOf('<?xml')
          XmlRecBuf = message.substr(st)

          state = states.inESB_ReqMsg

        }

        // -== 开始处理响应消息 ==-
      } else if (message.indexOf(GGZY_RspHeadStr) != -1) {
        //银企直连（公共资源交易中心）响应消息：
        XmlRecBuf = message

        parseXmlMsg(parser, '<root>',']')

      } else if (message.indexOf(YQZLorClient_RspHeadStr) != -1) {
        // 银企直连 或 客户端 响应消息
        XmlRecBuf = message

        parseXmlMsg(parser, '<ap>', ']')

      } else if (message.indexOf(QZ_RspHeadStr) != -1) {
        // 前置 响应消息
        XmlRecBuf = message

        parseXmlMsg(parser, '<?xml', ']')

      } else if (message.indexOf(ESB_RspHeadStr) != -1) {
        // ESB 响应消息
        XmlRecBuf = message

        parseXmlMsg(parser, '<?xml', ']')

      } else if (message.indexOf('成功交易处理总时间: ') != -1) {
        // 成功交易处理总时间:
        let stp = message.indexOf('[成功交易处理总时间: [') + '[成功交易处理总时间: ['.length
        let edp = message.indexOf(']ms')
        MsgInfo.duration = parseInt(message.substring(stp, edp))

        // -== 收到报文结束标志，完成报文处理 ==-
      } else if (message.indexOf(PackEndStr) != -1) {
        // 收到报文结束标志 : '提交缓冲日志'

        // 取出之前保存的报文数据
        let finalPackData = cash_man_plat_map.get(MsgInfo.linkID).data

        if (finalPackData != null) {
          // get duration
          finalPackData['duration'] = MsgInfo.duration

          // get endTime
          let st = message.indexOf('DATE:') + 'DATE:'.length
          let len = '20180904'.length
          let dt = message.substr(st, len)

          st = message.indexOf('TIME:') + 'TIME:'.length
          len = '000230'.length
          let tm = message.substr(st, len)
          MsgInfo['endTime'] = parseTs2(dt, tm)

          // 因为日志中的endTime只到秒，如果startTime == endTime就用startTime加上duration算出endTime
          if (MsgInfo.startTime.getTime() == MsgInfo.endTime.getTime()) {
            MsgInfo.endTime = new Date(MsgInfo.startTime.getTime() + MsgInfo.duration)
          }

          finalPackData['endTime'] = MsgInfo.endTime

          // 核对PID
          st = message.indexOf('PID:') + 'PID:'.length
          len = '18481160'.length
          let pid = message.substr(st, len)

          // PID 不符
          if (pid != finalPackData.linkID) {
            // 日志报文有错，报文之间有交错的现象
            // 清理之前已经处理的数据
            clearMsgInfoMap(MsgInfo.linkID)

            // 初始化状态
            resetState()

            break
          }

          // 解析的日志内容送出去
          parser.sendResult(JSON.stringify(finalPackData))

          // 清除存储的数据
          clearMsgInfoMap(MsgInfo.linkID)

          // 初始化状态
          resetState()

          break

        } else {
          // no stored data restarted again
          // 初始化状态
          resetState()

          break
        }

      }

      break

    // 囤积 银企直连（公共资源交易中心）请求 XML doc
    case states.inGGZY_ReqMsg:

      // 不断将XML片段到写入到XML缓存中
      XmlRecBuf += message

      if (message.indexOf('</root>') != -1) {

        // XML内容接收完成
        // 1. 处理XML格式报文，
        // 2. 将XML解析后的内容存入 pack storage 中
        parseXmlMsg(parser, '<root>', ']')

        // 3. switch state
        state = states.inPack

      } else if (message.indexOf(PackEndStr) != -1) {
        // 收到报文结束标志 : '提交缓冲日志'
        // 日志有错: 在囤积银企直连（公共资源交易中心）XML doc过程中收到整个报文结束标志

        // 处理报文不完整，清理之前已经处理的数据
        if (MsgInfo.linkID != '') {
          clearMsgInfoMap(MsgInfo.linkID)
        }
        // 初始化状态
        resetState()
      }

      break

    // 囤积 银企直连 或 客户端 请求 XML doc
    case states.inYQZLorClient_ReqMsg:

      // 不断将XML片段到写入到XML缓存中
      XmlRecBuf += message

      if (message.indexOf('</ap>') != -1) {

        // XML内容接收完成
        // 1. 处理XML格式报文，
        // 2. 将XML解析后的内容存入 pack storage 中
        parseXmlMsg(parser, '<ap>', ']')

        // 3. switch state
        state = states.inPack

      } else if (message.indexOf(PackEndStr) != -1) {
        // 收到报文结束标志 : '提交缓冲日志'
        // 日志有错: 在囤积银企直连（公共资源交易中心）XML doc过程中收到整个报文结束标志

        // 处理报文不完整，清理之前已经处理的数据
        if (MsgInfo.linkID != '') {
          clearMsgInfoMap(MsgInfo.linkID)
        }
        // 初始化状态
        resetState()
      }

      break

    // 囤积 前置请求 XML doc
    case states.inQZ_ReqMsg:

      // 不断将XML片段到写入到XML缓存中
      XmlRecBuf += message

      if (message.indexOf('</EBANK>') != -1) {

        // XML内容接收完成
        // 1. 处理XML格式报文，
        // 2. 将XML解析后的内容存入 pack storage 中
        parseXmlMsg(parser, '<?xml', ']')

        // 3. switch state
        state = states.inPack

      } else if (message.indexOf(PackEndStr) != -1) {
        // 收到报文结束标志 : '提交缓冲日志'
        // 日志有错: 在囤积银企直连（公共资源交易中心）XML doc过程中收到整个报文结束标志

        // 处理报文不完整，清理之前已经处理的数据
        if (MsgInfo.linkID != '') {
          clearMsgInfoMap(MsgInfo.linkID)
        }
        // 初始化状态
        resetState()
      }

      break

    // 囤积 ESB请求 XML doc
    case states.inESB_ReqMsg:

      // 不断将XML片段到写入到XML缓存中
      XmlRecBuf += message

      if (message.indexOf('</service>') != -1) {

        // XML内容接收完成
        // 1. 处理XML格式报文，
        // 2. 将XML解析后的内容存入 pack storage 中
        parseXmlMsg(parser, '<?xml', ']')

        // 3. switch state
        state = states.inPack

      } else if (message.indexOf(PackEndStr) != -1) {
        // 收到报文结束标志 : '提交缓冲日志'
        // 日志有错: 在囤积银企直连（公共资源交易中心）XML doc过程中收到整个报文结束标志

        // 处理报文不完整，清理之前已经处理的数据
        if (MsgInfo.linkID != '') {
          clearMsgInfoMap(MsgInfo.linkID)
        }
        // 初始化状态
        resetState()
      }

      break

    default:
      resetState()
      break
  }
}

let CashManPlatParser = new Parser(messageHandler)

cash_man_plat_map = new CashManPlat_map(CashManPlatParser)

CashManPlatParser.start()