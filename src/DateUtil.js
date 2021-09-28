import Promise from 'bluebird'
import _ from 'lodash'

import constants from '../util/constants'
import Config from '../config/config'
let config = Config.parseArgs()

let getTimeString = function(date) {
  let hours = date.getUTCHours() > 10 ? date.getUTCHours().toString() : '0' + date.getUTCHours()
  let mins = date.getUTCMinutes() > 10 ? date.getUTCMinutes().toString() : '0' + date.getUTCMinutes()
  let secs = date.getUTCSeconds() > 10 ? date.getUTCSeconds().toString() : '0' + date.getUTCSeconds()
  let dateTs = hours + ':' + mins + ':' + secs

  return dateTs
}

export default getTimeString
