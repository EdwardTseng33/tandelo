# Tandelo 後端：多階段建置、非 root、含 healthcheck。
# 階段一：把相依裝進 /opt/venv
FROM python:3.12.8-slim-bookworm AS builder
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1
WORKDIR /build
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install -r requirements.txt

# 階段二：只帶程式與 venv
FROM python:3.12.8-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/opt/venv/bin:$PATH" \
    DATABASE_URL=sqlite:////data/tandelo.db SEED_ON_STARTUP=true TZ=Asia/Taipei
RUN apt-get update && apt-get install -y --no-install-recommends curl tzdata \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r tandelo && useradd -r -g tandelo -d /app -s /usr/sbin/nologin tandelo \
  && mkdir -p /app /data && chown -R tandelo:tandelo /app /data
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=tandelo:tandelo app ./app
USER tandelo
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
