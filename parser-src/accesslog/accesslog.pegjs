XML =
	ip:FIELD
    _"- -"
    _ "[" time:TIME_FIELD "]"
    _ '"'method:FIELD
    _ address:Message
    '"'
    _ code:Number
    _ byte:Number
    _?{
    	return {
				ip:ip.join(""),
                ts:time.join("").replace(/,/g,""),
                method:method.join(""),
                address:address.join("").replace(/,/g,""),
                state:code,
                byte:byte
        }
    }

Message = "/" FIELD _ FIELD "/" FIELD

TIME_FIELD =  FIELD "/" FIELD "/" Number ":" Number ":" Number ":" Number _ FIELD

FIELD = [a-zA-Z0-9.+?_=]+

Number =  [0-9]+ { return parseInt(text(), 10) }

_ = [ \t\r\n]*

