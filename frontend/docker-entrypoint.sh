#!/bin/sh
# 啟動前把 nginx.conf 樣板裡的 ${BACKEND_HOST}／${BACKEND_PORT} 換成環境變數（只換這兩個，不動 nginx 自己的 $ 變數）。
set -eu
envsubst '${BACKEND_HOST} ${BACKEND_PORT}' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf
