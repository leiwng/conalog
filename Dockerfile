FROM registry.orientsoft.cn/orientsoft/node:6.11.1
MAINTAINER Timothy <yexiaozhou@orientsoft.cn>

ADD config /conalog/config
ADD lib /conalog/lib
ADD parser-src /conalog/parser-src
ADD src /conalog/src
ADD views /conalog/views
ADD README.md /conalog/README.md
ADD doc /conalog/doc
# Should copy generated node_modules from other place
ADD node_modules /conalog/node_modules
ADD public /conalog/public
ADD test /conalog/test
ADD app.js /conalog/app.js
ADD examples /conalog/examples
ADD package.json /conalog/package.json
ADD routes /conalog/routes
ADD tools /conalog/tools
ADD bin /conalog/bin
ADD gulpfile.js /conalog/gulpfile.js
ADD routes-src /conalog/routes-src
ADD util /conalog/util
ADD entrypoint.sh /conalog/entrypoint.sh

WORKDIR /conalog

EXPOSE 19527

CMD ["/conalog/entrypoint.sh"]
#CMD ["/bin/sh", "-c", "while true; do echo hello world; sleep 1; done"]
