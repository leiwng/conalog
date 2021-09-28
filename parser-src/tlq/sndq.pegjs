XML =
    _ ?val:(FIELD _)+ {
    	return{
        	Quename:val[0].join().replace(/,/g,"").trim(),
            ID:parseInt(val[1].join().replace(/,/g,"").trim()),
          	QStatus:val[2].join().replace(/,/g,"").trim(),
            QueMode:val[3].join().replace(/,/g,"").trim(),
            Ready:parseInt(val[4].join().replace(/,/g,"").trim()),
            Snding:parseInt(val[5].join().replace(/,/g,"").trim()),
            Rcving:parseInt(val[6].join().replace(/,/g,"").trim()),
            WaitAck:parseInt(val[7].join().replace(/,/g,"").trim())
        }
    }


FIELD = [._a-zA-Z0-9]+

_ = [ \t\r\n]*