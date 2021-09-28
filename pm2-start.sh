# pm2 -n ConaSrv start ./bin/www -o ./logs/pm2-out-ConaSrv.log -e ./logs/pm2-err-ConaSrv.log --interpreter `n bin 6.11.1`
pm2 -n ConaSrv start ./bin/www  --interpreter `n bin 6.11.1`
