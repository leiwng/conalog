XML =
	left:([A-Z]+ _)
    right:(
		(FIELD _)+
		TIME_FIELD _
        FIELD
    ) {
    	right[1].shift()
        right[1].pop()
    	return {
        	"header": {
            	seq: right[0][0][0][2],
                service: right[0][1][0][2],
                time: right[1].join().replace(/,/g, ''),
                len: right[3][2]
            }
        }
    }

FIELD = [A-Z]+ "[" Number "]"

TIME_FIELD = "TIME[" Number "/" Number "/" Number " " Number ":" Number ":" Number "." Number "]"

Number =  [0-9]+ { return parseInt(text(), 10) }

_ = left:"," right:[ \t\r\n]*