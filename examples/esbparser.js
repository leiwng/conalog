var Program = require('commander');
var readline = require('readline');
var xmlreader = require("xmlreader");
var _ = require('lodash');
var Client = require('ssh2').Client;
var Iconv = require('iconv').Iconv;
var jschardet = require('jschardet');
var lineArray = [];
var xmlpush = 0;
var xmlstr = "";
var pheader = {};
var esbout = {};
var pmtsTime="";

Program
  .version('2.0.0')
  .usage('[options]')
    .option('-h, --host <host>', 'ssh host', '127.0.0.1')
    .option('-p, --port <port>', 'ssh port', '22')
    .option('-u, --user <user>', 'ssh user', 'user')
    .option('-k, --pass <pass>', 'ssh password', 'pass')
    .option('-f, --file <file>', 'file path to tail', '/var/log/esb.log')
  .parse(process.argv);

// console.log(Program.file)

var conn =  new Client();
var iconv =  new Iconv('GB18030','UTF-8');

  conn.on('ready', () => {
    conn.exec('tail -F ' + Program.file, (err, stream) => {
       if(err) {
         // console.error(JSON.stringify(err));
         conn.end();
         process.exit()
       }

       stream
        .on('end',() => {
          conn.end();
          process.exit()
        })
        .on('data', data => {
          // console.log(data)
          try {
            var parserstr = iconv.convert(new Buffer(data)).toString();
            var strarray = parserstr.split('\n');
            for(idx in strarray)
                findXML(strarray[idx]);
          }
          catch(err) {
            // print to stderr
            // console.error(JSON.stringify(err))
          }
        });
      });
    })
    .connect({
      host: Program.host,
      username: Program.user,
      password: Program.pass,
      keepaliveInterval: 30000
     });

function parsrtime(str)
{
  if (str.length > 0)
  {
    pheader.beginFlag = str.substring(0, 7);
    if ((pheader.beginFlag != 'RECVXML')&&(pheader.beginFlag != 'SENDXML'))
       return;
    // console.log(str);
    var strsz = str.split(',');
    // console.log('SEQ='+trim(strsz[1]).substring(4,26));

    if(pheader.beginFlag == 'RECVXML')
    {
       esbout.SEQ = trim(strsz[1]).substring(4,26);
       esbout.RECVTIME = trim(strsz[3]).substring(5,28);
    }

    if(pheader.beginFlag == 'SENDXML')
    {
       if(esbout.SENDTIME != undefined)
       {
          console.log(JSON.stringify(esbout));
       }
       //clear old
       esbout = {};
       esbout.SEQ = trim(strsz[1]).substring(4,26);
       esbout.SENDTIME = trim(strsz[3]).substring(5,28);
    }
  }
}


function findXML(str)
{
    parsrtime(str);
    if (str.substring(0,5) == '<?xml')
    {
      if (xmlpush == 1)
        xmlstr = "";
      xmlpush = 1;
    }

    if (xmlpush == 1)
    {
      xmlstr += trim(str) + ' ';
    }

    if((xmlpush == 1) && (str.substring(0,6) == '</TLS>' || str.substr(str.length-6,6) == '</TLS>'))
      {
        xmlpush = 0;
        parseXML(xmlstr,pheader);
        xmlstr = "";
        pheader = {};
      }
}

function trim(str)
{
  return str.replace(/(^\s*)|(\s*$)/g, "");
}

function trimStr(str)
{
  var re = /\s*([^\s\0]*)\s*/;
  re.exec(str);
  return RegExp.$1;
}


function readTag(ob)
{
    for(var p in ob)
     {
       if(!_.isFunction(ob[p]))
        {
          if (_.has(ob[p],'text'))
            {
                // console.log(p + ':' + ob[p].text());
                esbout[p] = ob[p].text();
            }
          if (_.has(ob[p],'each'))
                readTag(ob[p]);
        }
     }
}

function parseXML(str,header)
{
   var temp = (str);
   xmlreader.read(temp, (err, res) => {
     if (err) {
       // console.error(JSON.stringify(err))
       return
     }
     readTag(res['TLS']);
     return;
   });
}
