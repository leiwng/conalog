var iconv = require("iconv-lite");

class Param{
  start(a){
		var b = a.replace(/(^\s+)|(\s+$)/g,"")
    var chars = b.split('')
    var buffer = []

    for (var i = 0, step = 1; i < chars.length; i += step) {
      if (chars[i] === '%') {
        step = 3
        buffer.push(parseInt(chars[i + 1] + chars[i + 2], 16))
      } else {
        step = 1
        buffer.push(chars[i].charCodeAt())
      }
    }
    let params = iconv.decode(Buffer.from(buffer), 'gbk')
		var params2 = params.split("&")
     var xmlJson ={}
     for(var i=0; i<params2.length;i++){
        var item = params2[i].split("=")
        var name = item[0]
        var value = item[1]
        xmlJson[name] = value
     }
     return xmlJson
  }
}
export default new Param()
