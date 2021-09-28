header
	= "{H:" data: [^}]+ "}" [ \t\r\n ]* { return { header: data.join("") } }


