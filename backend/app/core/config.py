"""設定：全部從環境變數讀，沒有任何金鑰寫在程式裡。"""

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """後端設定（環境變數優先，其次 .env）。"""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Tandelo POC API"
    app_env: str = Field(default="dev", description="dev / test / prod，只影響文件與日誌")
    database_url: str = Field(default="sqlite:///./data/tandelo.db", description="SQLAlchemy 連線字串；換 Postgres 只要改這裡")
    cors_origins: str = Field(default="http://localhost:8080,http://127.0.0.1:8080", description="逗號分隔的白名單")
    admin_token: str = Field(default="", description="讀招募表單用的 X-Admin-Token；空字串＝關閉管理端點")
    rate_limit_per_minute: int = Field(default=120, description="每個來源 IP 每分鐘的請求上限（記憶體計數）")
    coach_provider: str = Field(default="rules", description="小陪回覆的提供者：rules（規則引擎）或 anthropic（接模型；沒有金鑰或沒裝 SDK 會自動退回 rules）")
    anthropic_api_key: str = Field(default="", description="Anthropic API 金鑰，只從環境變數 ANTHROPIC_API_KEY 讀；空字串＝不接模型")
    coach_model: str = Field(default="claude-sonnet-5-5", description="COACH_PROVIDER=anthropic 時用的模型 id（環境變數 COACH_MODEL）")
    timezone: str = Field(default="Asia/Taipei", description="關燈判斷與日期用的時區")
    lights_out_start: str = Field(default="22:30", description="關燈開始（含）")
    lights_out_end: str = Field(default="06:00", description="關燈結束（不含）")
    seed_on_startup: bool = Field(default=False, description="啟動時若資料庫是空的就灌種子資料")
    variant_secret: str = Field(default="", description="題目變體 answer_token 的簽章金鑰；空字串＝啟動時隨機產生（重啟後舊 token 失效）")

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
