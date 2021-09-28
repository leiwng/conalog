import fs from 'fs'
import peg from 'pegjs'
import Parser from '../lib/Parser'
import FsmLut from '../lib/FsmLut'

const START_TOKEN = 'into tploader'
const END_TOKEN = '公共组包结束'
const SCAN_INTERVAL = 1000
const SCAN_TIMEOUT = 30000

/*
const parserSrc = fs.readFileSync('./parser-src/tploader/tploader.pegjs', 'UTF-8')
const tploaderPegParser = peg.generate(parserSrc)
*/

const scanCallback = (item, fsmLut) => {
    const now = new Date()
    if (now.getTime() - item.value.history[item.value.history.length - 1].localTs.getTime() > SCAN_TIMEOUT) {
        console.log('tploader.js::scanCallback - Process timeout', now, item.value.history[item.value.history.length - 1].localTs, fsmLut.pop(item.key))
    }
}

const lut = new FsmLut(SCAN_INTERVAL, scanCallback)

const state = {
    // idle: 0,
    pairing: 1,
    reading: 2
}

const parseTs = (tsString) => {
    let [dateStr, timeStr] = tsString.split(' ')
    let [month, day] = dateStr.split('-').map((str) => {
        return parseInt(str)
    })
    let [hour, min, sec, us] = timeStr.split(':').map((str) => {
        return parseInt(str)
    })

    let now = new Date()
    let ts = new Date(now.getFullYear(), month - 1, day, hour, min, sec, us / 1000)
    return ts
}

const parseKv = (kvString) => {
    const startPos = kvString.indexOf('<')
    let header = kvString.substr(0, startPos - 1).trim()
    let kv = kvString.substr(startPos).trim()

    let tranCode = header.substr(header.lastIndexOf(' ') + 1)

    let results = kv.split('</>').map((item) => {
        if (item !== '') {
            const pos = item.lastIndexOf('>')
            let key = item.substr(1, pos - 1)
            let value = item.substr(pos + 1)

            let result = {}
            result[key] = value

            return result
        }
        
        return null
    }).filter((item) => {
        if (item === null) {
            return false
        }

        return true
    })

    results.push({ TranCode: tranCode })

    return results
}

const messageHandler = (parser, channel, message) => {
    try {
        const [ts, line, module, process, payload] = message.message.split('|')
        let record = null

        switch (payload) {
            case START_TOKEN:
            if (lut.lookup(process) === undefined) {
                // goto state.pairing
                lut.insert(process, state.pairing, {
                    localTs: new Date(), // add local ts so offline tests don't timeout
                    ts: parseTs(ts),
                    line: Number(line),
                    module
                })
            }
            else {
                // process exists, this is unrecoverable, drop both record
                const existed = lut.pop(process)
                const current = {
                    ts: parseTs(ts),
                    line: Number(line),
                    module
                }
                console.log('Existed process in LUT', process, existed, current);
                parser.sendError(message, '',
                    {message: 'Existed process in LUT', process, existed, current})
            }

            break

            case END_TOKEN:
            // console.log(payload, process, lut.length)
            record = lut.lookup(process)
            if (record === undefined) {
                // no such process
                parser.sendError(message, 'tploader.js::messageHandler()',
                    {message: 'No such process in LUT', process})
            }
            else {
                if (record.state !== state.pairing) {
                    // unwanted message, go back to state.idle (drop record)
                    lut.pop(process)

                    parser.sendError(message, 'tploader.js::messageHandler()',
                        {message: 'Unwanted message', process})
                }
                else {
                    // go to state.reading
                    lut.update(process, state.reading)
                }
            }
            break

            default:
            record = lut.lookup(process)
            if (record !== undefined && record.state === state.reading) {
                // console.log('payload', process, lut.length)
                try {
                    const resp = parseKv(payload)
                    let meta = {
                        startTs: record.history[0].ts.getTime() + record.history[0].ts.getTimezoneOffset() * 60 * 1000,
                        endTs: parseTs(ts).getTime() + parseTs(ts).getTimezoneOffset() * 60 * 1000,
                        duration: parseTs(ts) - record.history[0].ts,
                        process
                    }
                    const result = resp.reduce((prev, curr) => {
                        const key = Object.keys(curr)[0]
                        prev[key] = curr[key]

                        return prev
                    }, meta)

                    lut.pop(process)

                    // send result
                    parser.sendResult(result)
                } catch(err) {
                    console.log(err)
                    // failed to parse, go back to state.idle
                    lut.pop(process)

                    parser.sendError(message, 'tploader.js::messageHandler()',
                        {message: 'Failed to parse rsp', err})
                }
            }
        }
    }
    catch(e) {
        console.log(e)
        parser.sendError(message, 'tploader.js::messageHandler()', e)
    }
}

const tploaderParser = new Parser(messageHandler)
tploaderParser.start()
