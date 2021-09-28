var iconv = require("iconv-lite")

class Packet {
  xml(message){
    let buf = Buffer.from(message.split(' ').map(x => parseInt(x,16)))
    let result = iconv.decode(buf, 'UTF-8')
	  let result2 = result.substr(0,result.lastIndexOf('>')+1)
    let xml = result2.substr(result.indexOf('<?xml'))
		let xml2 = result2.substr(result.indexOf('<xml'))
    if(xml.indexOf('<?xml') != -1){
      return xml
    }else if(xml2.indexOf('<xml') != -1){
			return xml2
		}else{
      return false
    }
  }

  param(message){
    let index = message.indexOf("06 82")
    let index2 = message.substr(index+12)
    let arr = index2.split(' ')
    let buf = Buffer.from(arr.map(x => parseInt(x,16)))
    let result = iconv.decode(buf, 'gbk')

    if( result.split('&').length>1 && result.split('&').every(v => v.split('=').length > 1)){
      return result
    }else{
      return false
    }
  }

  json(message){
    let index = message.indexOf("06 82")
    let match = message.substr(index+12)
    let arr = match.split(' ')
    let buf = Buffer.from(arr.map(x => parseInt(x,16)))
    let result = iconv.decode(buf, 'gbk')
    let result2  =  result.substr(0,result.lastIndexOf('}')+1)
    if(JSON.parse(result2)){
      return result2
    }
  }

}

export default new Packet()
