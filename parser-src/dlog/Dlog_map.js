import fs from 'fs'
import peg from 'pegjs'
import Parser from '../../lib/Parser'

class Dlog_map{
  constructor(parser){
    this.parser = parser
    this.map  = new Map()
    this.scanTime = 5000
    this.parameter = this.parser.customArg
    this.keepContent = parseInt(this.parameter.split(" ")[0]) || 0
    this.timeout = parseInt(this.parameter.split(" ")[1]) || 10000

    this.sendmsg = this.sendmsg.bind(this)
    this.add = this.add.bind(this)
    this.get = this.get.bind(this)
    this.delete = this.delete.bind(this)

    setInterval(() => this.scan(),this.scanTime)
  }

  sendmsg(key){
    // console.log(this.keepContent,this.timeout)
    var msg = this.get(key).data
    var length = msg.length
    var result = {}
    if(this.keepContent == 0){
      result ['pid'] = msg[length-1].key
      result ['msg'] = msg[length-1].msg
      
      result ['counterNumber'] = msg[length-1].counterNumber 			

      this.parser.sendResult(JSON.stringify(result))
      console.log('sendmsgsendmsgsendmsgsendmsg')
     
    }else if(this.keepContent == 1){
      result ['msg'] = msg
      this.parser.sendResult(JSON.stringify(result))
    }
    // msg.map((item) => this.parser.sendResult(JSON.stringify(item)))
    this.map.delete(key)
  }

  add(m){
    console.log('add-add-add')
    var key = m.key
    if(!this.map.has(key)){
      var newmsg = {
        t: +new Date(),
        data: [m]
      }
      this.map.set(key,newmsg)
    }else{
      var val = this.map.get(key)
      val.t = +new Date()
      val.data.push(m)
    }
  }

  get(key){
    return this.map.get(key)
  }

  delete(key){
    this.map.delete(key)
  }

  scan(){
    var keys = this.map.keys()
    for (let key of keys) {
      var time = this.map.get(key).t
      var now = new Date()
      if(now-time >= this.timeout){
        this.sendmsg(key)
      }
    }
  }
}
export default Dlog_map

