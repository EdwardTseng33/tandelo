# Tandelo POC：常用指令。後端用 backend/.venv；前端不需要建置。
SHELL := /bin/bash
PY := backend/.venv/bin/python
PIP := backend/.venv/bin/pip
FRONTEND_PORT ?= 8080
BACKEND_PORT ?= 8000

.PHONY: help venv dev dev-backend dev-frontend seed test lint build up down logs smoke clean

help: ## 列出指令
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

venv: ## 建後端虛擬環境並安裝相依
	test -d backend/.venv || python3 -m venv backend/.venv
	$(PIP) install -q -r backend/requirements-dev.txt

seed: venv ## 灌種子資料（虛構隊友、老師）
	cd backend && .venv/bin/python -m app.seed

dev-backend: venv ## 後端開發伺服器（http://localhost:8000/docs）
	cd backend && .venv/bin/uvicorn app.main:app --reload --port $(BACKEND_PORT)

dev-frontend: ## 前端靜態伺服（http://localhost:8080；離線示範模式，除非改 frontend/config.js）
	cd frontend && python3 -m http.server $(FRONTEND_PORT)

dev: ## 同時跑前後端（Ctrl+C 一起停）
	@$(MAKE) -j2 dev-backend dev-frontend

test: venv ## 後端 pytest
	cd backend && .venv/bin/python -m pytest

lint: venv ## 後端 ruff＋前端 node --check＋禁字檢查
	cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .
	@for f in $$(find frontend -name '*.js'); do node --check "$$f" || exit 1; done; echo "node --check：全部通過"
	@if grep -rn --include='*.html' --include='*.js' --include='*.css' --include='*.md' --include='*.py' --include='*.json' -E '萬通|OneClass|南一' frontend backend README.md docs 2>/dev/null; then echo '禁字出現，請移除'; exit 1; else echo '禁字檢查：0 筆'; fi

build: ## docker compose build
	docker compose build

up: ## docker compose up -d
	docker compose up -d

down: ## docker compose down
	docker compose down

logs: ## 看容器日誌
	docker compose logs -f --tail=100

smoke: ## 對 compose 起來的服務做冒煙測試
	./scripts/smoke.sh

clean: ## 清掉暫存
	rm -rf backend/.pytest_cache backend/.ruff_cache
	find . -name '__pycache__' -type d -prune -exec rm -rf {} +
