XML =
	ServiceName:NAME
    _ RoutineName:NAME
    _ ProgName:NAME
    _ GrpName:FIELD
    _ ID:Number
    _ Machine:FIELD
    _ Done:Number
    _ Status:FIELD {
    	return {
        	ServiceName:ServiceName.join("").replace(/,/g,''),
            RoutineName:RoutineName.join("").replace(/,/g,''),
            ProgName:ProgName.join("").replace(/,/g,''),
            GrpName:GrpName.join(""),
            ID:parseInt(ID),
            Machine:Machine.join(""),
            Done:parseInt(Done),
            Status:Status.join("")
        }
    }

NAME = FIELD ("_" FIELD)?

FIELD = [a-zA-Z1-9]+

Number =  [0-9]+ { return parseInt(text(), 10) }

_ = [ \t\r\n]*


//TMS TMS TMS_ORA BANKB1 30002 SITE1 0 AVAIL
//ABALC_BID    ABALC_BID    BALC       BANKB3    29      SITE1       0 AVAIL