import Promise from 'bluebird'
import Config from '../config/config'
let config = Config.parseArgs()
import HttpProvider from './HttpProvider'

class GatewayProvider {
  constructor() {
    let opts = {
      hostname: config.apiGatewayHost,
      port: config.apiGatewayPort,
      headers: {
        'borgnix-api-token': config.apiGatewayToken,
        'borgnix-api-uid': config.apiGatewayUid,
        'borgnix-api-type': config.apiGatewayType
      }
    }

    this.httpProvider = new HttpProvider(opts)
  }

  deployPlan(nodes) {
    return this.httpProvider.request('/deployplan', 'POST', nodes)
  }

  deletePlan(flowId) {
    let path
    if (flowId !== undefined && flowId !== null)
      path = '/deployPlan/' + flowId
    else
      path = '/deployPlan'

    return this.httpProvider.request(path, 'DELETE')
  }

  startApi(flowId) {
    let path
    if (flowId !== undefined && flowId !== null)
      path = '/startapi/' + flowId
    else
      path = '/startapi'

    return this.httpProvider.request(path, 'GET')
  }

  stopApi(flowId) {
    let path
    if (flowId !== undefined && flowId !== null)
      path = '/stopapi/' + flowId
    else
      path = '/stopapi'

    return this.httpProvider.request(path, 'GET')
  }
}

export default GatewayProvider
