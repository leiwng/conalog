XML =
	_ c:( content:content )+{
    	return {
            content: c.map(v => ({
             key:v[1].join(''),
             value: v[3].join('')
            }))
        }
    }

content = '<' FIELD '>' [^<>]* '</>'

FIELD = [a-zA-Z0-9-]+

Number =  [0-9]+ { return parseInt(text(), 10) }

_ = [ \t\r\n]*

