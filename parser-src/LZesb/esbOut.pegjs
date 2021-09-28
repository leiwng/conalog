XML = WORD "(" WORD ")" _+ HEX* _+ val:(.*) {
	return val.join('')
}

HEX = WORD " "

WORD = [a-zA-Z0-9]+

_ = [ \t\r\n]

