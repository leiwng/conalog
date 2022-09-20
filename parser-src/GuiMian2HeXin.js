import Parser from '../lib/Parser'
import GuiMian2HeXin_map from './guimian_2_hexin/guimian_2_hexin_map'

// 处理日志： teller_tuxedo_remote.log_20181016
let guimian_2_hexin_map

let states = {idle:0}

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

// tsDate: '2018-10-16'; tsTime: '07:46:36'; msec: '842';
const parseTs2 = (tsDate, tsTime, tsMsec) => {
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

  if (guimian_2_hexin_map.lookup(rec_id)) {

    guimian_2_hexin_map.delete(rec_id)

  }

}

const parseXmlMsg = (parser, xml_head_str, xml_tail_str) => {

  // 取XML缓冲区中的有效XML内容负载payload
  let stp = XmlRecBuf.indexOf(xml_head_str) + xml_head_str.length + 1
  let edp = XmlRecBuf.indexOf(xml_tail_str)
  let msg = XmlRecBuf.substring(stp, edp)
  msg = msg.substring(msg.indexOf('<'))

  try {

    let msg_pcs = msg.split('</>')

    for (let str in msg_pcs) {
      let key = str.substring(str.indexOf('<')+1, str.indexOf('>'))
      let val = str.substring(str.indexOf('>')+1)

      MsgInfo[key] = val
    }

    let existPack = guimian_2_hexin_map.lookup(MsgInfo.linkID)
    if (existPack){

      let tmp_storedmsginfo = guimian_2_hexin_map.get(MsgInfo.linkID).data

      let full_packmsginfo = Object.assign({}, tmp_storedmsginfo, MsgInfo)

      //Debug
      // console.log('parseXmlMsg:Find Process:Merge PackInfo')
      // console.dir(tmp_storedmsginfo)
      // console.dir(MsgInfo)
      // console.dir(full_packmsginfo)

      guimian_2_hexin_map.delete(MsgInfo.linkID)
      guimian_2_hexin_map.add(MsgInfo.linkID, full_packmsginfo)
    } else {
      guimian_2_hexin_map.add(MsgInfo.linkID, MsgInfo)

      //Debug
      // console.log('parseXmlMsg:New PackInfo')
      // console.dir(MsgInfo)

    }

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

      if (message.indexOf('通讯适配器向服务端发出的报文为') != -1) {

        let msg_split = message.split(' ')

        // 2018-10-16 07:46:36 842
        MsgInfo.startTime = parseTs(msg_split[0]+' '+msg_split[1]+'.'+msg_split[2])
        MsgInfo.linkID = msg_split[3]

        XmlRecBuf = message

        parseXmlMsg(parser, '通讯适配器向服务端发出的报文为[', '</>]')

        MsgInfo = {}

      } else if (message.indexOf('通讯适配器从服务端收到的报文为') != -1) {

        let msg_split = message.split(' ')

        MsgInfo.endTime = parseTs(msg_split[0]+' '+msg_split[1]+'.'+msg_split[2])
        let link_id = msg_split[3]

        XmlRecBuf = message

        parseXmlMsg(parser, '通讯适配器从服务端收到的报文为[', '</>]')

        let finalPackData = guimian_2_hexin_map.get(link_id).data

        if (finalPackData !== null) {
          finalPackData.duration = MsgInfo.endTime.getTime() - MsgInfo.startTime.getTime()

          parser.sendResult(JSON.stringify(finalPackData))

          clearMsgInfoMap(link_id)

          MsgInfo = {}
          XmlRecBuf = ''

        } else {
          //日志有问题，只有发给服务器报文，没有收到服务器报文
          MsgInfo = {}
          XmlRecBuf = ''
        }

      }

      break

    default:
      resetState()
      break
  }
}

let GuiMian2HeXinParser = new Parser(messageHandler)

guimian_2_hexin_map = new GuiMian2HeXin_map(GuiMian2HeXinParser)

GuiMian2HeXinParser.start()