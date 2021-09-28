import Config from '../config/config'
let config = Config.parseArgs()

let authorize = (req, res, next) => {
  // console.log('authorize() - session', req.sessionToken, JSON.stringify(req.session))

  // Issue #55 - switched off, just go on
  if (config.userAuthSwitch !== undefined && config.userAuthSwitch == false) {
    next()
  }
  else {
    // we're logging in, just let it go
    if (req.originalUrl == '/users/login') {
      next()
    }

    // 1. check session to detect redis connection lost
    if (!req.session) {
      // redis connection lost
      res.sendStatus(500)
    }

    // 2.check if we're logged in
    if (!req.session.user) {
      res.sendStatus(401)
    }   
    else {
      // 3. check user authorization for requested resource
      // 2017.02.21 - for now, any logged user could do anything
      return
      /*
      let method = req.method
      let baseUrl = req.baseUrl
      let path = req.path

      let baseAuth = req.session.securityBits[baseUrl]
      if (baseAuth) {
        let pathAuth = baseAuth[path]
        if (pathAuth) {
          let methodAuth = pathAuth[method]
          if (methodAuth) {
            next()
            return
          }
          else
            res.sendStatus(401)
        }
        else
          res.sendStatus(401)
      }
      else
        res.sendStatus(401)
      */
    }
  }

}

export default authorize
