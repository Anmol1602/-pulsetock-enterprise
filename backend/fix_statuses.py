import os
import random
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

# Database connection
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/inventory_db")
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def randomize_existing_orders():
    db = SessionLocal()
    try:
        statuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"]
        orders = db.query(models.Order).all()
        print(f"Updating {len(orders)} orders...")
        for order in orders:
            order.status = random.choice(statuses)
        db.commit()
        print("Success: Existing orders randomized.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    randomize_existing_orders()
