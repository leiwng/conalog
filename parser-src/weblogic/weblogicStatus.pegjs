XML =
    status:STATUS
	_"-"_
	time:TIME_FIELD";"
	src:FIELD ";"
	module:FIELD ";"
	state:FIELD  ";"
	msg:.* {
  		return {
			status:status.join().replace(/,/g,""),
            ts:(new Date(time.join(''))).getTime()/1000,
            src:src.join().replace(/,/g,""),
            module:module.join().replace(/,/g,""),
            state:state.join().replace(/,/g,""),
            msg:msg.join().replace(/,/g,"")
  		}
	}

STATUS = FIELD _ FIELD

FIELD = [.:a-zA-Z0-9]+

TIME_FIELD =  Number "-" Number "-" Number " " Number ":" Number ":" Number

Number =  [0-9]+ { return parseInt(text(), 10) }

_ = [ \t\r\n]*

