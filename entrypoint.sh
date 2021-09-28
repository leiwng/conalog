#!/bin/sh
export HOST=127.0.0.1
export FRONT_PORT=9527
export MONGODBURL=127.0.0.1:27017
export REDISURL=127.0.0.1:6379
export NSQDURL=127.0.0.1:4150
export NSQLOOKUPDURL=127.0.0.1:4160
sed -i -e 's/127.0.0.1/'$HOST'/g' /conalog/config/config.js
sed -i -e 's/ 9527/ '$FRONT_PORT'/g' /conalog/config/config.js
sed -i -e 's/127.0.0.1:27017/'$MONGODBURL'/g' /conalog/config/config.js
sed -i -e 's/127.0.0.1:6379/'$REDISURL'/g' /conalog/config/config.js
sed -i -e 's/replace:4150/'$NSQDURL'/g' /conalog/config/config.js
sed -i -e 's/replace:4160/'$NSQLOOKUPDURL'/g' /conalog/config/config.js
node /conalog/bin/www
