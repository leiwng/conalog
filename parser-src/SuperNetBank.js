import Parser from '../lib/Parser'
import {parseString} from 'xml2js'
import SuperNetBank_Map from './super_netbank/super_netbank_map'

let super_netbank_map
let states = {
  idle:0,
  GatherXMLOfQryCoreRspPack:1, GatherXMLOfCoreBkReqPack:2, GatherRHWZRspHeader:3, GatherRHWZRspPackXML:4,
}

let XMLMsgBuffer = ''

let state = states.idle

let PackMsgInfo = {
  startTime: '',
  endTime: '',
  ThreadNo: '',
  PrvdSysSeqNo: '',
  PltfmSeqNo: '',
  PackType: '',
  CnsmSysSeqNo: '',
  SrcSysSeqNo: '',
}

let resetState = () => {

  XMLMsgBuffer = ''

  state = states.idle

  PackMsgInfo = {}

}

let ThreadNo4WZQryCoreRspPack
let PrvdSysSeqNo
let PltfmSeqNo
let CnsmSysSeqNo
let RenHangMsgID

let WZQryCoreReqPackID = 'doPayCreditBizReq'
let WZQryCoreRspPackID = 'response finish....'
let WZCoreBkReqPackID = '请求ESB的通讯接出报文为：'
let WZCoreBkRspPackID = '请求ESB的通讯响应报文为：'
let WZRHRspPackID = '收到报文:'
let RHPackHeaderID = '{H:'

let XML1stLineStartStr = '<?xml'
let XML1stLineEndStr = '?>'
let XMLEndStrOfSrv = '</service>'
let XMLEndStrOfDoc = '</Document>'
let ThreadNoStartStr = '[Thread-'

let ThreadNoSample = '[Thread-12821038]'
const ThreadNoStrLen = ThreadNoSample.length
const MaxStrLen = 9999

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

//从收到的一行报文消息中把线程号提取出来
const parseThreadNo = (thdString) => {

  let thdno_str = thdString.substr(thdString.indexOf(ThreadNoStartStr), ThreadNoStrLen)

  return thdno_str
}

//从收到的一行消息中提取首行XML
const parseXML1stLine = (msgStr) => {

  let xml1stln = ''

  let idxOfstart = msgStr.indexOf(XML1stLineStartStr)
  let idxOfend = msgStr.indexOf(XML1stLineEndStr)
  if ( (idxOfstart !== -1) && (idxOfend > idxOfstart)) {

    let msg_len = idxOfend - idxOfstart + XML1stLineEndStr.length

    //XML的第一行和报文开始的信息在同一行，析出XML的第一行，存入XML内容缓存
    xml1stln = msgStr.substr(idxOfstart, msg_len)
  }

  return xml1stln

}

//从收到的单行中，提取单行的全部XML消息内容
const parseXMLContentInOneLine = (msgStr) => {

  let xml1stln = ''

  let idxOfstart = msgStr.indexOf(XML1stLineStartStr)
  let idxOfend = msgStr.indexOf(XMLEndStrOfSrv)
  if ( (idxOfstart !== -1) && (idxOfend > idxOfstart)) {

    let msg_len = idxOfend - idxOfstart + XMLEndStrOfSrv.length

    //XML的第一行和报文开始的信息在同一行，析出XML的第一行，存入XML内容缓存
    xml1stln = msgStr.substr(idxOfstart, msg_len)
  }

  return xml1stln

}

// 将完整的XML报文解析成KV对
const parseXmlMsg = (parser) => {

  let msg = parseXMLContentInOneLine(XMLMsgBuffer)

  try {

    // 将XML格式字串转换为JSON对象，返回值在xmlJson中，错误信息在err中
    parseString(msg, { explicitArray: false }, (err, xmlJson) => {

      if (err === null) {

        //将JSON格式的KV，存入PackMsgInfo
        parse(xmlJson, PackMsgInfo)

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

//处理收到的单行报文消息
let messageHandler = (parser, channel, message) => {

  message = message.message

  switch (state) {
    case states.idle:

      if (message.indexOf(WZQryCoreReqPackID) != -1) {
        //处理往账第一条向核心系统查询请求报文，收集报文内容存入PackInfo

        //本条报文就一行，将XML格式的报文行传入XML消息缓存
        XMLMsgBuffer = parseXMLContentInOneLine(message)

        // 处理XMLMsgBuffer中的XML格式的报文信息，存储到PackMsgInfo对象中
        parseXmlMsg(parse)

        //记录交易类型
        PackMsgInfo['PackType'] = '往账'

        //记录交易处理线程号
        PackMsgInfo['ThreadNo'] = parseThreadNo(message)

        //记录交易开始时间
        let year_str = PackMsgInfo.CnsmSysSeqNo.substr(6, 4)
        let mon_str = PackMsgInfo.CnsmSysSeqNo.substr(10, 2)
        let day_str = PackMsgInfo.CnsmSysSeqNo.substr(12, 2)

        let msg_array = message.split(' ')

        //拼装成： 2018-07-05 09:09:03.906 格式
        let date_time_str = year_str + '-' + mon_str + '-' + day_str + ' ' + msg_array[0]
        PackMsgInfo['startTime'] = parseTs(date_time_str)

        //以ThreadNo为Key存入Map结构
        super_netbank_map.add(PackMsgInfo.ThreadNo, PackMsgInfo)

        // clear XML temp, clear Pack info temp, switch to idle state
        resetState()

      } else if (message.indexOf(WZQryCoreRspPackID) != -1) {
        //处理往账查询核心的返回报文

        //解析出当前消息的Thread No
        let thd_no = parseThreadNo(message)

        //暂时存储交易现场号，供紧接着的查询核心返回消息用
        ThreadNo4WZQryCoreRspPack = thd_no

        //看能否找到之前的核心查询请求消息的数据
        let existPack = super_netbank_map.lookup(thd_no)
        if (existPack) {

          //XML的第一行和报文开始的信息在同一行，析出XML的第一行，存入XML内容缓存
          XMLMsgBuffer = parseXML1stLine(message)

          if (XMLMsgBuffer !== '') {

            //换到下一状态，开始按行囤积XML格式的报文内容
            state = states.GatherXMLOfQryCoreRspPack

          } else {
            //没找到第一行XML：<?xml version="1.0" encoding="UTF-8"?>
            parser.sendError(message, 'No 1st of XML in QryCoreRspPack', err)

            //生活还要继续，药不能停：清数据、清状态，重新开始
            resetState()
          }

        } else {
          //找不到之前发给核心的查询请求消息的内容，可能是刚开始，可能是日志记录有问题了，报错
          parser.sendError(PackMsgInfo, '找不到之前发给核心的查询请求消息的内容:线程号', err)

          //生活还要继续，药不能停：清数据、清状态，重新开始
          resetState()
        }

      } else if (message.indexOf(WZCoreBkReqPackID) != -1) {
        // 解向核心发起记账的报文

        //囤积XML格式报文的第一行
        XMLMsgBuffer = parseXML1stLine(message)
        if (XMLMsgBuffer !== '') {

          //换到下一状态，开始按行囤积XML格式的报文内容
          state = states.GatherXMLOfCoreBkReqPack

        } else {

          //没找到第一行XML：<?xml version="1.0" encoding="UTF-8"?>
          parser.sendError(message, 'No 1st of XML in QryCoreRspPack', err)

          //生活还要继续，药不能停：清数据、清状态，重新开始
          resetState()

        }

      } else if (message.indexOf(WZCoreBkRspPackID) != -1) {
        // 解核心返回的记账报文

        // 本条报文就一行，将XML格式的报文行传入XML消息缓存
        XMLMsgBuffer = parseXMLContentInOneLine(message)

        if (XMLMsgBuffer !== '') {

          // 处理XMLMsgBuffer中的XML格式的报文信息，存储到PackMsgInfo对象中
          parseXmlMsg(parse)

          //提取出报文中的CnsmSysSeqNo域
          CnsmSysSeqNo = PackMsgInfo.CnsmSysSeqNo

          //查找之前的已存储的报文信息
          if (super_netbank_map.lookup(CnsmSysSeqNo)) {
            //找到之前的报文信息

            //把新解析出的报文信息和之前解的merge到一起，存储到Map中
            let packinfoFromMap = super_netbank_map.get(CnsmSysSeqNo).data
            let packTmp4merge = {}
            parse(packinfoFromMap, packTmp4merge)
            parse(PackMsgInfo, packTmp4merge)

            // 通过PltfmSeqNo域，查数据库，得到发给人行的报文号，然后将报文号存入最后汇总的数据集中

            // ??? 2018-07-20, 下午1点25分
            // super_netbank_map.delete(CnsmSysSeqNo)
            // super_netbank_map.add(RenHangMsgID, packTmp4merge)

            //报文处理完毕，清理工作
            resetState()

          } else {
            // 找不到之前的报文信息，可能是刚开始，可能是日志记录有问题，报错
            parser.sendError(PackMsgInfo, '处理核心记账返回报文时，通过CnsmSysSeqNo找不到之前的报文信息', err)

            //药不能停，请暂存数据，清状态，重头再来
            resetState()
          }
        } else {
          //核心记账返回报文中，XML格式可能不完整，未能析出整条单行XML内容
          parser.sendError(message, '核心记账返回报文中，XML格式可能不完整，未能析出整条单行XML内容', err)

          resetState()
        }

      } else {}

      break

    case states.GatherXMLOfQryCoreRspPack:
      //囤积并处理查询核心返回报文中的XML格式的报文内容

      XMLMsgBuffer += message

      if (XMLMsgBuffer.length > MaxStrLen) {

        //囤积了太多的XML报文内容，还没囤积完，一定是日志出啥问题了
        parser.sendError(PackMsgInfo, 'XML Msg Buffer to long over Max Length', err)

        //清了，从头再来
        resetState()

        break
      }

      if (message.indexOf(XMLEndStrOfSrv) != -1) {
        //查询核心返回的XML消息囤积完毕

        //处理XMLMsgBuffer中的XML格式报文信息，存储到PackMsgInfo中
        parseXmlMsg(parse)

        //取得PrvdSysSeqNo号
        PrvdSysSeqNo = PackMsgInfo.PrvdSysSeqNo

        //把新解析出的报文信息和之前解的merge到一起，存储到Map中
        let packinfoFromMap = super_netbank_map.get(ThreadNo4WZQryCoreRspPack).data
        let packTmp4merge = {}
        parse(packinfoFromMap, packTmp4merge)
        parse(PackMsgInfo, packTmp4merge)

        super_netbank_map.delete(ThreadNo4WZQryCoreRspPack)
        super_netbank_map.add(PrvdSysSeqNo, packTmp4merge)

        //报文处理完毕，清理工作
        resetState()

      }

      break

    case states.GatherXMLOfCoreBkReqPack:
      //囤积并处理向核心发起记账请求报文中XML格式的报文内容

      XMLMsgBuffer += message

      if (XMLMsgBuffer.length > MaxStrLen) {

        //囤积了太多的XML报文内容，还没囤积完，一定是日志出啥问题了
        parser.sendError(PackMsgInfo, 'XML Msg Buffer to long over Max Length', err)

        //清了，从头再来
        resetState()

        break
      }

      if (message.indexOf(XMLEndStrOfSrv) != -1) {
        //查询核心返回的XML消息囤积完毕

        //处理XMLMsgBuffer中的XML格式报文信息，存储到PackMsgInfo中
        parseXmlMsg(parse)

        //取得PltfmSeqNo号和之前取得的PrvdSysSeqNo号做比对
        PltfmSeqNo = PackMsgInfo.PltfmSeqNo

        if (super_netbank_map.lookup(PltfmSeqNo)) {
          //找到之前的报文处理信息

          //把新解析出的报文信息和之前解的merge到一起，存储到Map中
          let packinfoFromMap = super_netbank_map.get(PltfmSeqNo).data
          let packTmp4merge = {}
          parse(packinfoFromMap, packTmp4merge)
          parse(PackMsgInfo, packTmp4merge)

          super_netbank_map.delete(PltfmSeqNo)

          //取得CnsmSysSeqNo号，作为辨认下一条交易标识的依据
          CnsmSysSeqNo = PackMsgInfo.CnsmSysSeqNo

          // 存入Map
          super_netbank_map.add(CnsmSysSeqNo, packTmp4merge)

          //报文处理完毕，清理工作
          resetState()

        } else {
          //找不到之前的报文信息，可能是解析刚开始，也可能是日志记录有问题了
          parser.sendError(PackMsgInfo, '找不到之前发给核心的查询请求消息的内容:PrvdSysSeqNo', err)

          //生活还要继续，药不能停：清数据、清状态，重新开始
          resetState()
        }
      }

      break

    case states.NewPackContentReceiving:

      // 不断将XML片段到写入到XML缓存中
      XMLMsgBuffer += message

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

          let existProcess = super_netbank_map.lookup(tmp_process)
          if (existProcess){

            state = states.RspPackContent
            XMLMsgBuffer = ''

          } else {

            resetState()

          }
        } else {

          resetState()

        }

      }

      break

    case states.RspPackContent:

      if (message.indexOf(XML1stLineStartStr) != -1) {

        // 不断将XML片段到写入到XML缓存中
        XMLMsgBuffer += message

        // 1. switch to RspPackContentReceiving statue
        state = states.RspPackContentReceiving

      }

      break

    case states.RspPackContentReceiving:

      // 不断将XML片段到写入到XML缓存中
      XMLMsgBuffer += message

      if (message.indexOf(XMLEndingStr) != -1) {

        // XML内容接收完成
        // 1. 处理XML格式报文，
        // 2. output to output channel
        // 3. back to idle state and init data
        parseXmlMsg(parse)
        let finalPackData = super_netbank_map.get(PackMsgInfo.processID).data
        if (finalPackData !== null) {
          finalPackData['duration'] = finalPackData.endTime - finalPackData.startTime
          parser.sendResult(JSON.stringify(finalPackData))
          super_netbank_map.delete(PackMsgInfo.processID)
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

super_netbank_map = new SuperNetBank_Map(NetsUnionPreSystemParser)

NetsUnionPreSystemParser.start()