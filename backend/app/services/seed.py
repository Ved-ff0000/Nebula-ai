"""One-time seeding: demo user (for the bundled preview/demo) — real auth only."""
import logging

from app.config import settings
from app.database.db import SessionLocal
from app.database.models import User

log = logging.getLogger("nebula.seed")


def seed() -> None:
    if not settings.seed_demo_user:
        return
    db = SessionLocal()
    try:
        from app.api.auth import hash_password
        if not db.query(User).filter(User.email == settings.demo_user_email).one_or_none():
            db.add(User(email=settings.demo_user_email,
                        password_hash=hash_password(settings.demo_user_password),
                        display_name="Demo Operator"))
            db.commit()
            log.info("Seeded demo user %s", settings.demo_user_email)
    finally:
        db.close()
