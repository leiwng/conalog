XML =
 	time:TIME_FIELD
     _ sys:FIELD
     _ log:FIELD
     ":"_ msg:.* {
     	return{
				time:time.join("").replace(/,/g,""),
                system:sys.join(""),
                application:log.join(""),
                msg:msg.join("")
         }
     }


 TIME_FIELD =  FIELD _ FIELD _ Number ":" Number ":" Number

 FIELD = [-_a-zA-Z0-9\[\]\./]+

 Number =  [0-9]+ { return parseInt(text(), 10) }

 _ = [ \t\r\n]*

