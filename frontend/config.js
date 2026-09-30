/* Tandelo 前端設定（Pages 版）。
   TANDELO_API_BASE 留空＝離線示範模式，所有資料只存在瀏覽器的 localStorage。
   Docker 版由 nginx 直接回應這個檔案，注入 '/api'（見 frontend/nginx.conf）。
   要接遠端後端時改成完整網址，例如 'https://api.example.com/api'（後端的 CORS_ORIGINS 要放行 Pages 網址）。 */
window.TANDELO_API_BASE = '';
