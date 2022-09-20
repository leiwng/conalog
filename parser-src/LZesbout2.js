import Parser from '../lib/Parser'
import { parseString } from 'xml2js'
import fs from 'fs'
import peg from 'pegjs'
import path from 'path'

let EsboutMap = require(path.resolve(__dirname, './LZesb/EsboutMap2.js')).default

let parser = fs.readFileSync(path.resolve(__dirname, './LZesb/esbOut.pegjs'), 'UTF-8')
let esboutParser = peg.generate(parser)

let parsers = fs.readFileSync(path.resolve(__dirname, './LZesb/esb.pegjs'), 'UTF-8')
let notXmlParser = peg.generate(parsers)

let esb_map

function parseJson(obj, final) {
    for (var key in obj) {
        if (typeof (obj[key]) == 'object') {
            parseJson(obj[key], final)
        } else {
            final[key] = obj[key]
        }
    }
}
const parseTs = (tsString) => {
    let date = tsString.replace(/,/, '.')
    let ts = new Date(date).getTime()
    return ts
  }

const parsexmls = (parser, buffer, time) => {
    try {
        if (buffer.indexOf("<?xml") != -1) {
            let msg = buffer.substring(buffer.indexOf('<'), buffer.lastIndexOf('>') + 1);
            parseString(msg, { explicitArray: false }, (err, xmlJson) => {
                if (err === null) {
                    let result = xmlJson
                    result['startTime'] = parseTs(time)
                    let finalResult = {}
                    parseJson(result, finalResult)
                    parser.sendResult(JSON.stringify(finalResult))
                    //fs.appendFile('/home/voyager/jiang/test/conalog/parser-src/a.txt', JSON.stringify(result) + '\n')
                }
                else {
                    parser.sendError(buffer, 'state.xmls', err)
                }
            })
        } else {
            let result = {}
            let start = buffer.substr(buffer.indexOf('<'))
            let msg = start.substr(0, start.lastIndexOf('>') + 1)
            let output = notXmlParser.parse(msg).content
            for (let key in output) {
                let item = output[key]
                let key = item.key
                let value = item.value
                result[key] = value
            }
            result['startTime'] = parseTs(time)
            let finalResult = {};
            parseJson(result, finalResult);
            //fs.appendFile('/home/voyager/jiang/test/conalog/parser-src/a.txt', JSON.stringify(result) + '\n')
            parser.sendResult(JSON.stringify(finalResult))
        }
    }
    catch (e) {
        parser.sendError(buffer, 'parse xmls', e)
    }
}


let messageHandler = (parser, channel, message) => {
   let source = message.source
    message = message.message	
  //  let source = JSON.parse(message).msg.source
//    message = JSON.parse(message).msg.message
    if (message.indexOf("Write bytes is") != -1 || message.indexOf("Received bytes is") != -1) {
        let splitmsg = message.split(' ')
        let startTs = splitmsg[0] + ' ' + splitmsg[1]
        if (esb_map.lookup(source)) {
            let buffer = esb_map.get(source).data.msg
            let time = esb_map.get(source).data.startTs
            //let buffer = esb_map.get(source).data
            //解析XML
            parsexmls(parser, buffer, time)
            esb_map.delete(source)
            let obj = {
                startTs,
                msg: '',
            }
            esb_map.add(source, obj)
        } else {
            let obj = {
                startTs,
                msg: '',
            }
            esb_map.add(source, obj)
        }
    } else {
        try {
            if (message.length > 0) {
                if (esboutParser.parse(message) || esboutParser.parse(message) == "") {
                    let output = esboutParser.parse(message)
                    esb_map.add(source, output)
                }
            }
        }
        catch (err) {
            parser.sendError(message, 'not xml', err)
        }
    }
}

let esb = new Parser(messageHandler)
esb_map = new EsboutMap(esb)
esb.start()



