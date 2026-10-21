import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://strapi:strapi@project-postgres:5432/strapi")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "5001"))
    
    # Scheduler: run once per day (default 03:00 AM)
    SCHEDULE_HOUR: int = int(os.getenv("SCHEDULE_HOUR", "3"))
    SCHEDULE_MINUTE: int = int(os.getenv("SCHEDULE_MINUTE", "0"))
    SCRAPE_ON_STARTUP: bool = os.getenv("SCRAPE_ON_STARTUP", "true").lower() in ("true", "1", "yes")
    
    # Scraping limits
    MAX_BOOKS_PER_SOURCE: int = int(os.getenv("MAX_BOOKS_PER_SOURCE", "30"))
    REQUEST_TIMEOUT: int = int(os.getenv("REQUEST_TIMEOUT", "30"))
    USER_AGENT: str = os.getenv(
        "USER_AGENT",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )

settings = Settings()
