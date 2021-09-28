XML =
	_ val:Value+{
    	return {
        	listener:val[0][2].join().replace(/,/g,""),
        }
    }

Value = FIELD "(" FIELD ")" _

FIELD = [a-zA-Z0-9._/-]+

_ = [ \t\r\n]*

