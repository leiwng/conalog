import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import path from 'path'
import {parseString} from 'xml2js'

// load and create peg parser
//let tsParserSrc = fs.readFileSync('./parser-src/payment2ndGen/ts.pegjs', 'UTF-8')
let tsParserSrc = fs.readFileSync(path.resolve(__dirname, './payment2ndGen/ts.pegjs'),'UTF-8')
let tsParser = peg.generate(tsParserSrc)

//let headerParserSrc = fs.readFileSync('./parser-src/payment2ndGen/header.pegjs', 'UTF-8')
let headerParserSrc = fs.readFileSync(path.resolve(__dirname, './payment2ndGen/header.pegjs'),'UTF-8')
let headerParser = peg.generate(headerParserSrc)

// FSM - Finite State Machine
let states = {idle: 0, header: 1, xml: 2}
let state = states.idle

let buffer = ""
let result = {}

let resetState = () => {
    buffer = ""
    result = {}

    state = states.idle
}

let messageHandler = (parser, channel, message) => {
    switch (state) {
        case states.idle:
        // parse ts
        try {
            let ts = tsParser.parse(message)
            result["ts"] = ts.ts

            state = states.header
        }
        catch(e) {
            parser.sendError(message, 'state.idle', e)

            resetState()
        }
        break;

        case states.header:
        if (message.match('{H:') !== null) {
            // parse header
            try {
                let header = headerParser.parse(message)
                result["header"] = header.header

                state = states.xml
            }
            catch(e) {
                parser.sendError(message, 'state.header', e)

                resetState()
            }         
        }
        break;

        case states.xml:
        buffer += message

        if (message.indexOf("</Document>") != -1) {
            try {
                parseString(buffer, (err, xmlJson) => {
                    if (err === null) {
                        result.xml = xmlJson
                        parser.sendResult(JSON.stringify(result))
                    }
                    else {
                        parser.sendError(buffer, 'state.xml', err)
                    }
                })

                resetState()
            }
            catch(e) {
                parser.sendError(buffer, 'state.xml', e)

                resetState()
            }
        }
        break;

        default:
        resetState()
        break;
    }
}

let paymentParser = new Parser(messageHandler)
paymentParser.start()

/*
[2014-12-20 20:35:25.566012][29063] Level 0 PMTSMSGHDL: 
前一节点发送时间[]
本地队列管理器:[100],本地队列:[MSGMBFE_1]
首选发送队列名:[MSGTO8211I_2],备注:[]
U头信息:[无]
报文内容:
{H:01313821001016IBPS0000        IBPS20141220083234XMLccms.990.001.01     IBPB548F276B83095395IBPB548F276B830953953U         }
<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:cnaps:std:ibps:2010:tech:xsd:ccms.990.001.01" xmlns:xs="http://www.w3.org/2001/XMLSchema">
<ComuCnfm>
	<OrigSndr>0000</OrigSndr>
	<OrigSndDt>20141220</OrigSndDt>
	<MsgTp>saps.601.001.01</MsgTp>
	<MsgId>IBPB548F276B83095395</MsgId>
	<MsgRefId>IBPB548F276B83095395</MsgRefId>
	<MsgProCd>0000</MsgProCd>
</ComuCnfm>
</Document>
*/

/*
header peg source:
header
	= "{H:" data1: [^\t ]+ [ \t]+ data2: [^\t ]+ [ \t]+ data3: [^\t ]+ [ \t]+ "}" { return {header: [data1.join(""), data2.join(""), data3.join("")]} }

input:
{H:01313821001016IBPS0000        IBPS20141220083234XMLccms.990.001.01     IBPB548F276B83095395IBPB548F276B830953953U         }

output:
{
   "header": [
      "01313821001016IBPS0000",
      "IBPS20141220083234XMLccms.990.001.01",
      "IBPB548F276B83095395IBPB548F276B830953953U"
   ]
}
*/

/*
ts peg source:
starter
	= "[" ts: ts "]" .+ { return {ts: ts} }
    
ts
	= year: number+ "-" month: number+ "-" day: number+ space hour: number+ ":" minute: number+ ":" second: number+ "." us: number+ { return year.join("") + "-" + month.join("") + "-" + day.join("") + " " + hour.join("") + ":" + minute.join("") + ":" + second.join("") + "." + us.join("") }
    
number
	= [0-9]
    
space
	= [ \t]

input:
[2014-12-20 20:35:25.566012][29063] Level 0 PMTSMSGHDL: 

output:
{
   "ts": "2014-12-20 20:35:25.566012"
}
*/
