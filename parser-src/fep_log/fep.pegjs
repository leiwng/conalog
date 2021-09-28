XML =
	time:TIME_FIELD
    _ "[" info:FIELD "]"
    _ file:FIELD ".c("
    lineno:Number "):"
     _ text:(FIELD _)+"."?":"?_
     text2:(_"[" FIELD "=" Number "]")? {
    	return {
        	ts:(new Date(time.join(''))).getTime()/1000,
            level:info.toString().replace(/,/g, ''),
             filename:file.join('')+".c",
             lines:lineno,
             action:text.toString().replace(/,/g, '').split(" ").splice(0,text.toString().replace(/,/g, '').split(" ").length-1).join(" "),
             subject:text.toString().replace(/,/g, '').split(" ").pop(),
            datalen:text2?text2[4]:null
        }
    }

FIELD = [a-zA-Z]+

TIME_FIELD =  Number "-" Number "-" Number " " Number ":" Number ":" Number

Number =  [0-9]+ { return parseInt(text(), 10) }

_ = [ \t\r\n]*
