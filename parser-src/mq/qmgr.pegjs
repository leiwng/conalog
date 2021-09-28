ALL = data:(_ XML _)+ {
		return data.map(a => a[1])
	}

XML = key:FIELD ("(" _)? value:FIELD? _ ")"? {
    	return {
        	key: key.join(''),
            value: value ? value.join('').trim() : null
        }
    }

FIELD = [a-zA-Z0-9./_-]+

_ = [ \t\r\n]*
