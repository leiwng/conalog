import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import Dlog_map from './dlog/Dlog_map'
import path from 'path'

//let ParserSrc = fs.readFileSync('./parser-src/dlog/dlog.pegjs', 'UTF-8')
let ParserSrc = fs.readFileSync(path.resolve(__dirname, './dlog/dlog.pegjs'),'UTF-8')
let dlogParserSrc = peg.generate(ParserSrc)
let dlog_map
let messageHandler = (parser, channel, message) => {

  try {
    //console.log(message)
    //console.log(typeof(message))
    //let msgJson = JSON.parse(message)
    //console.log('22222222222')
    //let msg = msgJson.message
    //console.log('33333333333')
    //console.log("1",msg)
    let msg = message.message
    let source = message.source
    let sourceArrs=source.split('/')
    let counterNumber=parseFloat(sourceArrs[sourceArrs.length-2])



    let output = dlogParserSrc.parse(msg)
    output['counterNumber']=counterNumber

    dlog_map.add(output)

    if(output.msg.indexOf('结束时间') != -1){
     let pid = output.key
      dlog_map.sendmsg(pid)
    }

  }
  catch(e) {
    parser.sendError(message, 'state.idle', e)
  }
}

let dlogParser = new Parser(messageHandler)
dlog_map = new Dlog_map(dlogParser)
dlogParser.start()
