import nsq from 'nsqjs'
import http from 'http'
import url from 'url'

import Promise from 'bluebird'
import Config from '../config/config'
let config = Config.parseArgs()
import constants from '../util/constants'
import Logger from '../lib/Logger'
let logger = new Logger('conalog-lib', 'NsqProvider')

let readers = {}

class NsqProvider {
    constructor() {
        logger.info(1901,
            null,
            'Nsq provider init',
            'OK'
        )
    }

    publish(topic, str) {
        // use http post for load balance, use keep-alive to avoid too many TIME_WAITs
        return new Promise((resolve, reject) => {
            let urlJson = url.parse(config.nsqdUrl, false, true)

            let req = http.request({
                ...urlJson,
                path: '/pub?topic=' + topic,
                headers: { 'Connection': 'keep-alive' },
                method: 'POST',
            }, res => {
                let data = ''

                res.on('data', chunk => {
                    data += chunk
                })

                res.on('end', () => {
                    resolve(data)
                })
            })

            req.on('error', err => {
                logger.error(3902,
                    null,
                    'Nsq publish error',
                    err
                )

                reject(err)
            })

            req.write(str)
            req.end()
        })
    } // publish

    listen(topic, callback) {
        try {
            let reader = new nsq.Reader(topic, constants.NSQ_CHANNEL, {
                lookupdHTTPAddresses: config.nsqLookupdUrl
            })

            reader.connect()

            reader.on('message', msg => {
                callback(msg.json())
                msg.finish()
            })

            let now = new Date()
            let serial = now.getTime().toString()

            let topicDict = readers[topic]
            if (topicDict === undefined || topicDict == null)
                topicDict = {}

            topicDict[serial] = reader
            readers[topic] = topicDict

            logger.info(1903,
                null,
                'Nsq listen',
                'Topic ' + topic + ' ,serial ' + serial
            )

            return serial
        }
        catch(err) {
            logger.error(3904,
                null,
                'Nsq listen error',
                err
            )

            return null
        }
    } // listen()

    close(topic, serial) {
        if (readers[topic] === undefined || readers[topic] == null) {
            logger.warning(2905,
                null,
                'Nsq close warning',
                'No reader is listening to topic ' + topic 
            )

            return false
        }
        else {
            let topicDict = readers[topic]
            if (topicDict[serial] === undefined || topicDict[serial] == null) {
                logger.warning(2906,
                    null,
                    'Nsq close warning',
                    'No reader is found, serial: ' + serial 
                )

                return false
            }

            let reader = topicDict[serial]
            reader.close()
            topicDict[serial] = undefined
            readers[topic] = topicDict

            logger.info(1907,
                null,
                'Nsq close',
                'Topic ' + topic
            )

            return true
        }
    } // close()

} // class NsqProvider

export default NsqProvider
