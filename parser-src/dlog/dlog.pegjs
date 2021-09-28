ALL = val:([^|]+ "|")+ {
	 val = val.map(v => v[0].join('').trim())
     return{
     	ts:val[0],
       	key:val[1],
        line:val[2],
        function:val[3],
        msg:val[4]
     }
}
