import fs from 'fs'
import peg from 'pegjs'
import Parser from '../../lib/Parser'

class FrontMap{
  constructor(parser){
    this.parser = parser
    this.map  = new Map()
    this.scanTime = 3600000 //1h
    this.timeout = 3600000 //1h
    this.add = this.add.bind(this)
    this.get = this.get.bind(this)
    this.delete = this.delete.bind(this)
	  this.lookup = this.lookup.bind(this)
    setInterval(() => this.scan(),this.scanTime)
  }

  add(key, msg){
//    console.log('add-add-add',key,msg)
    if(!this.map.has(key)){
      var newmsg = {
        t: +new Date(),
        data: msg
      }
      this.map.set(key,newmsg)
    }else{
      var val = this.map.get(key)
      val.t = +new Date()
      let mapData = val.data.msg
      for(let key in msg) {
        mapData[key] = msg[key]
      }
      val.data.msg = mapData
    }
  }

  lookup(key){
    return this.map.has(key)
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
        this.delete(key)
      }
    }
  }
}

export default FrontMap


