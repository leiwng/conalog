import Promise from 'bluebird'
import http from 'http'
import _ from 'lodash'

import constants from '../util/constants'
import Config from '../config/config'
let config = Config.parseArgs()

import Logger from '../lib/Logger'
// let logger = new Logger()

Promise.promisifyAll(http)

class HttpProvider {
  constructor(opts) {
    // template
    /*
    this.opts = {
      hostname: config.apiGatewayHost,
      port: config.apiGatewayPort,
      headers: {
        borgnix-api-token: config.apiGatewayToken,
        borgnix-api-uid: config.apiGatewayUid,
        borgnix-api-type: config.apiGatewayType
      }
    }
    */
    _.assign(this.opts, opts)
  } // constructor

  request(path, method, dataJson, extraHeaders) {
    return new Promise((resolve, reject) => {
      let opts = {}

      _.assign(opts, this.opts)
      if (extraHeaders !== undefined && extraHeaders != null)
        _.assign(opts.headers, extraHeaders)

      opts.method = method
      opts.path = path

      let resData = {}

      let data = JSON.stringify(dataJson)

      let req = http.requestAsync(opts)
        .then((res) => {
          resData.statusCode = res.statusCode

          res.onAsync('data')
            .then((chunk) => {
              // collect data
              resData.data += chunk
            })

          res.onAsync('end')
            .then(() => {
              resolve(resData)
            })
        }) // http.requestAsync

      req.onAsync('error')
        .then((err) => {
          reject(err)
        })

      req.write(data)
      req.end()
    })
  } // post

} // class HttpProvider

export default HttpProvider
