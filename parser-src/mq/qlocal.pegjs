XML =
	_  val:Value+{
    	return {
        	name:val[0][2].join().replace(/,/g,""),
            type:val[1][2].join().replace(/,/g,""),
            depth:parseInt(val[2][2].join()),
        }
    }

Value = FIELD "(" FIELD ")" _

FIELD = [a-zA-Z0-9._/-]+

_ = [ \t\r\n]*

