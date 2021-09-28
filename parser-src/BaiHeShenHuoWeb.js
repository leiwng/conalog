/*
---功能：百合生活网 日志文件解析 
---范围：default.log.yyyy-mm-dd 日志文件
---修改记录
   日期    | 作者  |   修改说明
2019-02-13 | Lei.W | 第一版：完成基本数据的解析
*/

import Parser from '../lib/Parser'

let states = {idel:0, gotHead:1}

let state = states.idel

let HeadMsgInfo = {}
let BodyMsgInfo = {}
let PackMsgInfo = {}

let messageHandler = (parser, channel, message) => {

  // message = message.message

  switch (state) {
    case states.idle:

      if (message.indexOf('Head:[') == 0) {

        //日志消息原文样例: 'Head:[moduleRequestMethodId=GET_JIFENUNION_URL, servcId=B2C_INDEX_PAGE_FACEDE]'
        let msgChunk = message.substring(message.indexOf('[')+1, message.indexOf(']'))

        let msgSplit = msgChunk.split(', ')
        msgSplit.array.forEach(element => {
          let [key, val] = element.split('=')
          HeadMsgInfo[key] = val
        });

        state = states.gotHead
      }
      break

    case states.gotHead:

      if (message.indexOf('body:[app_param={') == 0) {

        //日志消息原文样例: 'body:[app_param={"requestNo":"BER123","reqData":{"phone":"1234456677"},"Tocken":"MkkPBGT"}]'
        let msgJSON = message.substring(message.indexOf('{'), message.lastIndexOf('}')+1)
        BodyMsgInfo = JSON.parse(msgJSON)
        PackMsgInfo = Object.assign({}, HeadMsgInfo, BodyMsgInfo)

        parser.sendResult(JSON.stringify(PackMsgInfo))

        HeadMsgInfo = {}
        BodyMsgInfo = {}
        state = states.idel
      }

      break

    default:

      break
  }
}

let BaiHeShenHuoWebParser = new Parser(messageHandler)

BaiHeShenHuoWebParser.start()