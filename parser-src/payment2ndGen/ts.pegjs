starter
	= "[" ts: ts "]" .+ { return {ts: ts} }
    
ts
	= year: number+ "-" month: number+ "-" day: number+ space hour: number+ ":" minute: number+ ":" second: number+ "." us: number+ { return year.join("") + "-" + month.join("") + "-" + day.join("") + " " + hour.join("") + ":" + minute.join("") + ":" + second.join("") + "." + us.join("") }
    
number
	= [0-9]
    
space
	= [ \t]
