// parser framework

import http from 'http'
import nsq from 'nsqjs'
import url from 'url'
import Redis from 'redis'
import constants from '../util/constants'

class Parser {
    constructor(messageHandler) {
        this.redisUrl = process.argv[2]
        this.nsqdUrl = process.argv[3]
        this.nsqlookupdUrl = process.argv[4]
        this.subChannel = process.argv[5]
        this.subType = process.argv[6]
        this.pubChannel = process.argv[7]
        this.pubType = process.argv[8]
        this.customArg = process.argv[9]

        this.messageHandler = messageHandler

        switch (this.subType) {
            case 'Redis PubSub':
            this.subClient = Redis.createClient(this.redisUrl)
            break

            case 'Nsq Queue':
            this.subClient = new nsq.Reader(this.subChannel, constants.NSQ_CHANNEL, {
                lookupdHTTPAddresses: this.nsqlookupdUrl
            })
            break

            default:
            this.subClient = Redis.createClient(this.redisUrl)
            break
        }

        switch (this.pubType) {
            case 'Redis PubSub':
            this.pubClient = Redis.createClient(this.redisUrl)
            break

            default:
            this.pubClient = Redis.createClient(this.redisUrl)
            break
        }

        this.lastActivity = {count: 0, message: ''}

        this.collectorMetaList = []

        process.on('message', message => {
            if (message.GET === 'lastActivity')
                process.send(this.lastActivity)
        })

        process.on('disconnect', () => {
            console.log('Parser disconnected, exiting...')
            process.exit()
        })

        // interface
        this.start = this.start.bind(this)
        this.stop = this.stop.bind(this)
        this.sendResult = this.sendResult.bind(this)
        this.sendError = this.sendError.bind(this)

        // helper
        this.updateLastActivity = this.updateLastActivity.bind(this)
        this.messageHandlerWrapper = this.messageHandlerWrapper.bind(this)
        this.collectMetaData = this.collectMetaData.bind(this)
        this.storeMetaData = this.storeMetaData.bind(this)
    }

    start() {
        let that = this
        switch (this.subType) {
            case 'Redis PubSub':
            this.subClient.subscribe(this.subChannel)
            this.subClient.on('message', this.messageHandlerWrapper)
            break

            case 'Nsq Queue':
            this.subClient.connect()
            this.subClient.on('message', msg => {
                this.messageHandlerWrapper(this.subChannel, JSON.stringify(msg.json()))
                msg.finish()
            })
            break

            default:
            this.subClient.subscribe(this.subChannel)
            this.subClient.on('message', this.messageHandlerWrapper)
            break
        }
    }

    stop() {
        switch (this.subType) {
            case 'Redis PubSub':
            this.subClient.unsubscribe(this.subChannel)
            break

            case 'Nsq Queue':
            this.subClient.close()
            break

            default:
            this.subClient.unsubscribe(this.subChannel)
            break
        }
        
    }

    updateLastActivity(message) {
        // console.log('updateLastActivity', message)
        this.lastActivity.count++
        this.lastActivity.message = message
        let now = new Date()
        this.lastActivity.ts = now.getTime()
    }

    sendResult(message) {
        let msg = this.collectMetaData(message)
        if (msg === null) {
            // this.sendError(message, 'sendResult Error', new Error('Parser Error in Single Line.'))
            return
        }

        try {
            switch (this.pubType) {
                case 'Redis PubSub':
                this.pubClient.publish(constants.PARSER_PREFIX + this.pubChannel, JSON.stringify(msg))
                break

                case 'Nsq Queue':
                let urlJson = url.parse(this.nsqdUrl, false, true)
                let req = http.request({
                    ...urlJson,
                    path: '/pub?topic=' + constants.PARSER_PREFIX + this.pubChannel,
                    headers: { 'Connection': 'keep-alive' },
                    method: 'POST',
                }, res => {
                    let data = ''
    
                    res.on('data', chunk => {
                        data += chunk
                    })
    
                    res.on('end', () => {
                        // do nothing
                    })
                })
    
                req.on('error', err => {
                    console.log('Parser Error', err)
                })
    
                req.write(JSON.stringify(msg))
                req.end()
                break

                default:
                this.pubClient.publish(constants.PARSER_PREFIX + this.pubChannel, JSON.stringify(msg))
                break
            }
        }
        catch(err) {
            console.log('Parser.js', 'sendResult Error', err)
        }

        this.updateLastActivity(JSON.stringify(msg))
    }

    sendError(message, info, error) {
        try {
            switch (this.pubType) {
                case 'Redis PubSub':
                this.pubClient.publish(constants.PARSER_ERROR_PREFIX + this.pubChannel, JSON.stringify({message: message, info: info, error: error}))
                break

                case 'Nsq Queue':
                let urlJson = url.parse(this.nsqdUrl, false, true)
                let req = http.request({
                    ...urlJson,
                    path: '/pub?topic=' + constants.PARSER_ERROR_PREFIX + this.pubChannel,
                    headers: { 'Connection': 'keep-alive' },
                    method: 'POST',
                }, res => {
                    let data = ''
    
                    res.on('data', chunk => {
                        data += chunk
                    })
    
                    res.on('end', () => {
                        // do nothing
                    })
                })
    
                req.on('error', err => {
                    console.log('Parser Error', err)
                })
    
                req.write(JSON.stringify({message: message, info: info, error: error}))
                req.end()
                break

                default:
                this.pubClient.publish(constants.PARSER_ERROR_PREFIX + this.pubChannel, JSON.stringify({message: message, info: info, error: error}))
                break
            }
        }
        catch(ex) {
            console.log('Parser.js', 'sendError Error', ex)
        }
    }

    collectMetaData(message) {
        let meta = this.collectorMetaList.reduce((prev, curr) => {
            if (prev === null) {
                let json = {host: curr.host, source: curr.source, startTs: curr.startTs}
                return json
            }
            else {
                prev['endTs'] = curr.startTs
                return prev
            }
        }, null)

        let msg = null
        if (meta !== null) {
            if (meta['endTs'] !== undefined)
                meta['duration'] = meta['endTs'] - meta['startTs']

            if (typeof(message) == 'string' || typeof(message) == 'String') {
                try {
                    message = JSON.parse(message)
                }
                catch(err) {
                    console.log('collectMetaData Error', err)
                    // this.sendError(message, 'collectorMetaData', err)
                }
            }

            msg = {message: message, host: meta.host, startTs: meta.startTs}
            if (meta['endTs'] !== undefined) {
                msg['endTs'] = meta.endTs
                msg['duration'] = meta.duration
            }
        }
        this.collectorMetaList = []
        return msg
    }

    storeMetaData(channel, message) {
        let now = new Date()
        try {
            let json = JSON.parse(message)
            let meta = {host: json.host, source: channel, startTs: now.getTime()}

            this.collectorMetaList.push(meta)

            return json.msg 
        }
        catch(err) {
            // console.log(err)
            return message
        }
    }
    
    messageHandlerWrapper(channel, message) {

        let msg = this.storeMetaData(channel, message)
        try {
            this.messageHandler(this, channel, msg)
        }
        catch(err) {
            console.log('messageHandlerWrapper Error', err, message)
            this.sendError(message, 'messageHandlerWrapper', new Error('messageHandler Error'))
        }
    }
}

export default Parser
