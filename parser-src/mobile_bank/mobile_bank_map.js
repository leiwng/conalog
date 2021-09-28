class MobileBank_map {
  constructor(parser) {
    this.parser = parser
    this.map = new Map()
    this.scanTime = 3600000 //1h
    this.timeout = 36000000 //10h
    this.add = this.add.bind(this)
    this.get = this.get.bind(this)
    this.delete = this.delete.bind(this)
    setInterval(() => this.scan(),this.scanTime)
  }

  add(key, msg) {
      var newmsg = {
        t: +new Date(),
        data: msg
      }
      this.map.set(key, newmsg)
  }

  lookup(key) {
    return this.map.has(key)
  }

  get(key) {
    return this.map.get(key)
  }

  delete(key) {
    this.map.delete(key)
  }

  scan(){
    var keys = this.map.keys()
    for (let key of keys) {
      var time = this.map.get(key).t
      var now = new Date()
      if(now-time >= this.timeout){
        this.delete(key)
      }
    }
  }

}

export default MobileBank_map

