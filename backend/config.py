import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "VITAL — Vital Information Transplant Allocation & Logistics"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Oracle Database Configuration
    ORACLE_USER: str = os.getenv("ORACLE_USER", "VITAL")
    ORACLE_PASSWORD: str = os.getenv("ORACLE_PASSWORD", "VitalSecure2026!")
    ORACLE_DSN: str = os.getenv("ORACLE_DSN", "localhost:1521/XEPDB1")
    ORACLE_MODE: str = os.getenv("ORACLE_MODE", "thin")  # 'thin' or 'thick'
    
    # Backend Server
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    
    # Security & Demonstration JWT
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "vital_jwt_secret_key_demo_2026_kidney_matching")
    JWT_ALGORITHM: str = "HS256"

    model_config = SettingsConfigDict(env_file=".env", extra="allow")

settings = Settings()
