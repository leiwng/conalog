/*
---功能：百合生活网 日志文件解析 
---范围：default.log.yyyy-mm-dd 日志文件
---修改记录
   日期    | 作者  |   修改说明
2019-02-13 | Lei.W | 第一版：完成基本数据的解析
*/

import Parser from '../lib/Parser'
import {parseString} from 'xml2js'

let states = {idle:0, gotStart:1, gatherXML:2}

let MsgRecBuf = ''

let state = states.idle

let MsgInfo = {}

let resetState = () => {
  MsgRecBuf = ''
  state = states.idle
  MsgInfo = {}
}

// 判断标识字串
// 交易开始标识字串
let transStartFlagStr = '.start :'
// 交易结束标识字串
let transEndFlagStr = '.end :'
// responseContext XML消息开始标识字串(包含该字串)
let rspContextXMLStartFlagStr = '<responseContext'
// 一般XML消息报文开始标识字串(包含该字串)
let commonXMLStartFlagStr = '<?xml version="1.0" encoding="UTF-8"?>'
// XML消息报文结尾标识字串（XML报文不包含该字串）
let XMLEndFlagStr = '>]'
let XMLEndFlagStr2 = ']'

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

//把多层对象嵌套熨平成一层，多层对象的key值用‘.’区隔开。
function ironObj2OneLayer(obj_input, obj_output){

  //es6新语法   Object.prototype.toString方法精准判断参数值 属于哪种类型
  if(Object.prototype.toString.call(obj_input) === '[object Object]'){

    (function getKeysFn(o, char) {

      for(let key in o){

        //取最末端属性
        let newChar = key;

        if (Object.prototype.toString.call(o[key]) === '[object Object]') {

          // 如果属性对应的属性值仍为可分解的对象，使用递归函数继续分解，直到最里层
          getKeysFn(o[key],newChar);

        }else{
          obj_output[newChar] = o[key]
        }
      }

    })(obj_input, '')

  }else{
    console.log('function ironObj2OneLayer：传入的不是一个真正的对象');
  }
}

const parseXmlMsg = (parser) => {

  try {
    // 将XML格式字串转换为JSON对象，返回值在xmlJson中，错误信息在err中
    parseString(MsgRecBuf, { explicitArray: false }, (err, xmlJson) => {
      if (err == null) {

        //Debug
        // console.log('parseXmlMsg:Before parseString:xmlJson->MsgInfo')
        // console.dir(xmlJson)
        // console.dir(MsgInfo)

        let tmpMsgInfo = {}
        ironObj2OneLayer(xmlJson, tmpMsgInfo)

        //Debug
        // console.log('parseXmlMsg:After parse(xmlJson, MsgInfo)')
        // console.dir(MsgInfo)

        let tmpMergeInfo = Object.assign({}, tmpMsgInfo, MsgInfo)
        MsgInfo = tmpMergeInfo
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

let messageHandler = (parser, channel, message) => {

  // message = message.message

  switch (state) {
    case states.idle:

      if (message.indexOf(transStartFlagStr) != -1) {

        // get trans start time
        // sample: '[INFO]-[2019-02-13 00:00:01.977] [ACTIVE]'
        let timeStr = message.substring(8, 31)
        MsgInfo['StartTime'] = parseTs(timeStr)

        state = states.gotStart
      }
      break

    case states.gotStart:

      let idxOfXMLStart = message.indexOf(commonXMLStartFlagStr)
      if (idxOfXMLStart != -1) {
        MsgRecBuf = message.substring(idxOfXMLStart)
        let idxOfEnd = MsgRecBuf.indexOf(XMLEndFlagStr)
        if (idxOfEnd != -1) {
          //XML消息在一行中全部输出完成
          MsgRecBuf = MsgRecBuf.substring(0, idxOfEnd+1)

          //解析完整的XML报文消息
          parseXmlMsg(parser)
          MsgRecBuf = ''
        } else {
          // XML消息在多行中输出，需要逐行囤积
          // 此处不用对MsgRecBuf进行赋值，上面已经做了
          state = states.gatherXML
        }
        break
      }

      //检查另一种类型的XML消息，这个XML消息和上面一个是互斥的，一行报文的消息中不可能同时出现两种类型的XML报文
      idxOfXMLStart = message.indexOf(rspContextXMLStartFlagStr)
      if (idxOfXMLStart == 0) {
        //必须以标识字串开始，因为原报文中有'"<responseContext'以冒号打头的这种不靠谱情况，需要把这种情况排除掉，所以是 == 0 不是 != -1
        MsgRecBuf = message
        let idxOfEnd = MsgRecBuf.indexOf(XMLEndFlagStr)
        if (idxOfEnd != -1) {
          //XML消息在一行中全部输出完成
          MsgRecBuf = MsgRecBuf.substring(0, idxOfEnd+1)

          //解析完整的XML报文消息
          parseXmlMsg(parser)
          MsgRecBuf = ''
        } else {
          // XML消息在多行中输出，需要逐行囤积
          // 此处不用对MsgRecBuf进行赋值，上面已经做了
          state = states.gatherXML
        }
        break
      }

      //检查是否到了报文结束
      let idxOfTransMsgEnd = message.indexOf(transEndFlagStr)
      if (idxOfTransMsgEnd != -1) {
        //一个交易报文完整接收和解析完毕需要将消息送入输出通道
        // get trans END time
        // sample: '[INFO]-[2019-02-13 00:00:01.977] [ACTIVE]'
        let timeStr = message.substring(8, 31)
        MsgInfo['EndTime'] = parseTs(timeStr)
        MsgInfo['Duration'] = MsgInfo['EndTime'].getTime() - MsgInfo['StartTime'].getTime()

        parser.sendResult(JSON.stringify(MsgInfo))

        resetState()
      }

      break

    case states.gatherXML:

      let idxOfXMLEnd = message.indexOf(XMLEndFlagStr2)
      if (idxOfXMLEnd != -1) {
        MsgRecBuf += message.substring(0, idxOfXMLEnd)

        parseXmlMsg(parser)

        MsgRecBuf = ''
        state = states.gotStart
      } else {
        MsgRecBuf += message
      }

      break

    default:
      resetState()
      break
  }
}

let The3rdServiceParser = new Parser(messageHandler)

The3rdServiceParser.start()