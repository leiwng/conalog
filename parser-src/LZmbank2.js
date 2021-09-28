import Parser from '../lib/Parser'
import { parseString } from 'xml2js'
import Mbank_map from './mbank/Mbank_map'


let mbank_map

let test = (obj, final) => {
  for (var key in obj) {
    if (typeof (obj[key]) == 'object') {
      test(obj[key], final)
    } else {
      final[key] = obj[key]
    }
  }
}


let messageHandler = (parser, channel, message) => {
  try {
    if (message.indexOf("解析后XML数据为") != -1) {
      let key = message.split(' ')[2]
      let msg = message.substr(message.indexOf('解析后XML数据为') + 10)
      let xml = msg.substr(0, msg.length - 1)
      var SrcSysSeqNo
      if (xml.indexOf('<?xml') != -1) {
        parseString(xml, { explicitArray: false }, (err, xmlJson) => {
          if (err == null) {
            SrcSysSeqNo = xmlJson.service.SYS_HEAD.SrcSysSeqNo
           // console.log("1", SrcSysSeqNo)
          }
          else {
            parser.sendError(buffer, 'state.idle', err)
          }
        })
      }
      let out = { key: key, message: SrcSysSeqNo }
      //console.log('out', out)
      mbank_map.add(out)
    }
    if (message.indexOf("返回报文为：") != -1) {

      let result = {}
      let ts = message.substring(message.indexOf('[') + 1, message.indexOf(','))
      let msg = JSON.parse(message.substr(message.indexOf('返回报文为：') + 6))
      let b = message.split(' ')
      let PID = b[2]
      let CustomerID = b[3]
      let TranCode = b[4]
      let TranContent = b[5]
      let SourceMsg = b[8]
      result['ts'] = new Date(ts).getTime()
      result['PID'] = PID
      result['CustomerID'] = CustomerID
      result['TranCode'] = TranCode
      result['TranContent'] = TranContent
      result['SourceMsg'] = SourceMsg
			//console.log('mmmm',result)
      test(msg, result)

      // var key = message.split(' ')[2]
      // let msg = message.substr(message.indexOf('返回报文为：') + 6)

      //console.log("2", PID, msg)
      var exist = mbank_map.get(PID)
      //mbank_map.all()
      //console.log("22exit   =>  ", exist)
      if (exist) {
        //console.log("3", exist)
        // let result = JSON.parse(msg)
        result['SrcSysSeqNo'] = exist
        //console.log("JSONmsg", result)
        parser.sendResult(JSON.stringify(result))
        mbank_map.delete(PID)
      } else {
        //console.log("4", result)
        parser.sendResult(JSON.stringify(result))
      }
    }
  }
  catch (e) {
    parser.sendError(message, 'state.idle', e)
  }
}

let mbankParser = new Parser(messageHandler)
mbank_map = new Mbank_map(mbankParser)
mbankParser.start()

