import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models, security

# Database connection
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/inventory_db")
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def ensure_admin():
    db = SessionLocal()
    try:
        admin_email = "admin@pulsetock.com"
        admin = db.query(models.User).filter(models.User.email == admin_email).first()
        if not admin:
            print(f"Creating admin user: {admin_email}")
            admin_user = models.User(
                email=admin_email,
                hashed_password=security.get_password_hash("admin123"),
                role="admin"
            )
            db.add(admin_user)
            db.commit()
            print("Admin user created successfully.")
        else:
            print("Admin user already exists.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    ensure_admin()
