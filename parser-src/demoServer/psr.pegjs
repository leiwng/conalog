XML =
	progName:NAME
    _ queueName:Number2
    _ grpName:FIELD
    _ id:Number
    _ RqDone:Number
    _ LoadDone:Number
    _ "(" CurrentService:CurrentService ")"{
    	return {
        	ProgName:progName.join("").replace(/,/g, ''),
            QueueName:queueName.join("").replace(/,/g, ''),
            GrpName:grpName.join(""),
            ID:parseInt(id.join("")),
            RqDone:parseInt(RqDone.join("")),
            LoadDone:parseInt(LoadDone.join("")),
            CurrentService:CurrentService.join("").replace(/,/g, '').trim()
        }
    }

Number2 = NAME? (Number "." Number)?

NAME = FIELD ("_" FIELD)?

CurrentService =  _ FIELD _

FIELD = [a-zA-Z1-9]+

Number =  [0-9]+

_ = [ \t\r\n]*



//TMS_ORA BANKB1_TMS BANKB1 30002 0 0 ( IDLE )
//BALC           00001.00027 BANKB1        27      0         0 (  IDLE )
