import os
import random
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models, security

# Database connection
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/inventory_db")
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_data():
    db = SessionLocal()
    try:
        # Check if we already have users (minimal data check)
        if db.query(models.User).filter(models.User.email == "admin@pulsetock.com").first():
             # If users exist, we might still want to add more orders, but let's just 
             # ensure we don't duplicate the core products/customers for now.
             print("Core data (admin user) already exists.")
        else:
            # 0. Seed Users
            admin_user = models.User(
                email="admin@pulsetock.com",
                hashed_password=security.get_password_hash("admin123"),
                role="admin"
            )
            db.add(admin_user)
            
            staff_user = models.User(
                email="staff@pulsetock.com",
                hashed_password=security.get_password_hash("staff123"),
                role="staff"
            )
            db.add(staff_user)

        # 1. Seed Products if empty
        db_products = db.query(models.Product).all()
        if not db_products:
            products_data = [
                {"name": "MacBook Pro 14\"", "sku": "LAP-MBP-14", "price": 1999.99, "quantity": 15},
                {"name": "Dell XPS 15", "sku": "LAP-DXP-15", "price": 1499.00, "quantity": 8},
                {"name": "iPhone 15 Pro", "sku": "PHN-I15P", "price": 999.00, "quantity": 25},
                {"name": "Sony WH-1000XM5", "sku": "AUD-SWH-M5", "price": 348.00, "quantity": 40},
                {"name": "Logitech MX Master 3S", "sku": "ACC-LMX-3S", "price": 99.00, "quantity": 60},
                {"name": "Keychron K2 V2", "sku": "ACC-KK2-V2", "price": 79.99, "quantity": 30},
                {"name": "Samsung Odyssey G7", "sku": "MON-SOG-G7", "price": 699.99, "quantity": 12},
                {"name": "iPad Air M2", "sku": "TAB-IPA-M2", "price": 599.00, "quantity": 20},
                {"name": "Nintendo Switch OLED", "sku": "GAM-NS-OLED", "price": 349.99, "quantity": 18},
                {"name": "Kindle Paperwhite", "sku": "TAB-KIN-PW", "price": 139.99, "quantity": 45},
            ]

            for p in products_data:
                product = models.Product(**p)
                db.add(product)
                db_products.append(product)
            db.flush()

        # 2. Seed Customers if empty
        db_customers = db.query(models.Customer).all()
        if not db_customers:
            customers_data = [
                {"full_name": "Alice Johnson", "email": "alice.j@example.com", "phone_number": "+1234567890"},
                {"full_name": "Bob Smith", "email": "bob.smith@example.com", "phone_number": "+1987654321"},
                {"full_name": "Charlie Davis", "email": "charlie.d@example.com", "phone_number": "+1122334455"},
                {"full_name": "Diana Prince", "email": "diana.p@example.com", "phone_number": "+1555010203"},
                {"full_name": "Ethan Hunt", "email": "ethan.h@example.com", "phone_number": "+1777888999"},
            ]

            for c in customers_data:
                customer = models.Customer(**c)
                db.add(customer)
                db_customers.append(customer)
            db.flush()

        # 3. Seed Orders
        statuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"]
        for _ in range(15):
            customer = random.choice(db_customers)
            status = random.choice(statuses)
            order = models.Order(
                customer_id=customer.id, 
                total_amount=0,
                status=status
            )
            db.add(order)
            db.flush()

            order_total = 0
            num_items = random.randint(1, 3)
            sampled_products = random.sample(db_products, num_items)

            for product in sampled_products:
                qty = random.randint(1, 2)
                item = models.OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=qty,
                    price_at_time=product.price
                )
                db.add(item)
                order_total += product.price * qty
            
            order.total_amount = order_total

        db.commit()
        print("Database seeded successfully!")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
