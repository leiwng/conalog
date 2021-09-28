XML =
	ProgName:NAME
    _ QueueName:NAME
    _ Serve:NAME
    _ WkQueued:NAME
    _ Queued:NAME
    _ AveLen:NAME
    _ Machine:FIELD {
    	Serve = Serve.join("").replace(/,/g,"")
        WkQueued = WkQueued.join("").replace(/,/g,"")
        Queued = Queued.join("").replace(/,/g,"")
        AveLen = AveLen.join("").replace(/,/g,"")
    	return {
        	ProgName:ProgName.join("").replace(/,/g,""),
            QueueName:QueueName.join("").replace(/,/g,""),
            Serve:~~Serve.indexOf('-') ? parseFloat(Serve) : 0,
            WkQueued:~~WkQueued.indexOf('-') ? parseFloat(WkQueued) : 0,
            Queued:~~Queued.indexOf('-') ? parseFloat(Queued) : 0,
            AveLen:~~AveLen.indexOf('-') ? parseFloat(AveLen) : 0,
            Machine:Machine.join("")
        }
    }

NAME = FIELD ([_.] FIELD)?

FIELD = [-a-zA-Z0-9]+

_ = [ \t\r\n]*

//ACCT 00002.00008 1 0 0 0.0 SITE1
//TMS_ORA        BANKB1_TMS        2         0         0       0.0      SITE1
