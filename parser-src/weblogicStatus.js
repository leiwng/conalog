import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import path from 'path'

//let weblogicStatus = fs.readFileSync('./parser-src/weblogic/weblogicStatus.pegjs', 'UTF-8')
let weblogicStatus = fs.readFileSync(path.resolve(__dirname, './weblogic/weblogicStatus.pegjs'),'UTF-8')
let weblogicStatusSrc = peg.generate(weblogicStatus)


let result = {}
let resetState = () => {
  result = {}
}



let messageHandler = (parser, channel, message) => {

  try {
    let output = weblogicStatusSrc.parse(message)
    result = output
    let arrs = output.msg.substr(output.msg.indexOf("!")+1).split(" ")
    let msg = {}
    let msgcontent =""

    for(let i in arrs){
      msgcontent += arrs[i]
      if(msgcontent.indexOf("=") != -1){
        let key = msgcontent.split("=")[0].trim()
        let value = msgcontent.split("=")[1].trim()
        if(value.split('.').every((v, k) => ~~v == v && k < 2)){
          value = parseFloat(value)
        }
        msg[key] = value
        msgcontent = ""
      }
    }
    result["msg"] = msg

    parser.sendResult(JSON.stringify(result))
    resetState()
  }
  catch(e) {
    parser.sendError(message, 'state', e)
    resetState()
  }
}

let weblogicStatusParser = new Parser(messageHandler)
weblogicStatusParser.start()
