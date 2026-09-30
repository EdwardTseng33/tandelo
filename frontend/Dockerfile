# Tandelo 前端：純靜態檔，用 nginx 伺服（非 root、含 healthcheck）。
FROM nginx:1.27.3-alpine

# 讓 nginx 以非 root 跑在 8080：清掉預設設定、把暫存與 pid 放到可寫的 /tmp
RUN rm -f /etc/nginx/conf.d/default.conf \
  && mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp \
  && chown -R nginx:nginx /tmp /var/cache/nginx /usr/share/nginx/html

COPY --chown=nginx:nginx nginx.conf /etc/nginx/templates/nginx.conf.template
COPY --chown=nginx:nginx . /usr/share/nginx/html/
RUN rm -f /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/nginx.conf /usr/share/nginx/html/.dockerignore

# 後端位置由環境變數決定（compose 用服務名）；啟動時把樣板替換成正式設定
ENV BACKEND_HOST=backend BACKEND_PORT=8000
COPY --chown=nginx:nginx docker-entrypoint.sh /docker-entrypoint.d/40-tandelo-config.sh
RUN chmod +x /docker-entrypoint.d/40-tandelo-config.sh && chown nginx:nginx /etc/nginx/nginx.conf

USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
