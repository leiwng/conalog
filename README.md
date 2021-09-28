# conalog
# Document
[Conalog Document Center](https://orientsoft.github.io/conalog-doc/)  
# Depoly
Suppose ./ = /home/voyager/xd/docker/conalog/  
Also suppose you have prepared a mongodb docker container named 'mongo' and a redis docker container named 'redis'.  
```
sudo docker run -d --hostname mongo --name mongo -p 27017:27017 -v /home/voyager/xd/docker/conalog/mongo-data:/data/db mongo
```
```  
git clone https://github.com/Orientsoft/conalog.git  
cd conalog  
vim config/config.js  
npm i  
gulp install  
gulp go  
sudo docker run --hostname conalog --name conalog -p 19527:19527 -p 19537:19537 --expose 19627-19927 -P -v /home/voyager/xd/docker/conalog/conalog:/conalog --link mongo --link redis -d xiedidan/conalog
```  
# Startup Parameters  
```  
  Usage: www [options]

  Options:

    -h, --help                             output usage information
    -V, --version                          output the version number
    --logLevel [logLevel]                  Log Level [info]
    --logLifespan [logLifespan]            Log Lifespan[604800000]
    --userAuthSwitch                       User Authorization Switch
    --redisUrl [redisUrl]                  Redis URL [redis://127.0.0.1:6379]
    --mongoUrl [mongoUrl]                  MongoDB URL [mongodb://127.0.0.1:27017/conalog]
    --conalogHost [conalogHost]            Conalog Backend Host [127.0.0.1]
    --conalogPort [conalogPort]            Conalog Backend Port [19527]
    --conalogFrontHost [conalogFrontHost]  Conalog Frontend Host [127.0.0.1]
    --conalogFrontPort [conalogFrontPort]  Conalog Frontend Port [9527]
    --filebeatChannel [filebeatChannel]    Filebeat Redis Publish Channel [conalog-filebeat]
    --parserPathPrefix [parserPathPrefix]  Parser Sub-path [./parser/]
```  
# config.js Description
```  
var config = {
  logLevel: 'info', (may be debug, info, warning, error)
  logLifespan: 604800000, (log rotation - defaults to 7 days, in ms)
  userAuthSwitch: true, (user auth could be switched off, BE CAREFUL!!)
  conalogHost: '192.168.0.230', (set to user browser address)
  conalogPort: 19527,
  conalogFrontHost: '192.168.0.230', (set to user browser address)
  conalogFrontPort: 9527,
  mongoUrl: 'mongodb://mongo:27017/conalog', (don't touch this if you use docker)
  redisUrl: 'redis://redis:6379', (don't touch this if you use docker)
  nanomsgProtocol: 'tcp://', (please check Issue #18 for detailed nanomsg configs)
  nanomsgHost: '0.0.0.0',
  nanomsgRequestPort: 19537,
  nanomsgStartPort: 19627,
  nanomsgEndPort: 19927
}

module.exports = config;
```  
# Sub-Module  
## Nanomsg Queue Support  
[队列支持](Issue #18)  
[查找Docker Port Mapping的工具](Issue #48)  
[Nanomsg Queue Client Example](https://github.com/Orientsoft/conalog/wiki/Nanomsg-Queue-Client-Example)  
