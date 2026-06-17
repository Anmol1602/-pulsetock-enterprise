from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import models, schemas

# Products
def get_product(db: Session, product_id: int):
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def get_product_by_sku(db: Session, sku: str):
    return db.query(models.Product).filter(models.Product.sku == sku).first()

def get_products(db: Session, skip: int = 0, limit: int = 100, sort_by: str = "id", order: str = "asc", search: str = None):
    query = db.query(models.Product)
    
    if search:
        query = query.filter(models.Product.name.ilike(f"%{search}%"))
        
    if hasattr(models.Product, sort_by):
        order_col = getattr(models.Product, sort_by)
        if order == "desc":
            query = query.order_by(order_col.desc())
        else:
            query = query.order_by(order_col.asc())
            
    total = query.count()
    products = query.offset(skip).limit(limit).all()
    return products, total

def create_product(db: Session, product: schemas.ProductCreate):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

def update_product(db: Session, product_id: int, product: schemas.ProductUpdate):
    db_product = get_product(db, product_id)
    if db_product:
        update_data = product.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_product, key, value)
        db.commit()
        db.refresh(db_product)
    return db_product

def delete_product(db: Session, product_id: int):
    db_product = get_product(db, product_id)
    if db_product:
        db.delete(db_product)
        db.commit()
    return db_product

# Customers
def get_customer(db: Session, customer_id: int):
    return db.query(models.Customer).filter(models.Customer.id == customer_id).first()

def get_customer_by_email(db: Session, email: str):
    return db.query(models.Customer).filter(models.Customer.email == email).first()

def get_customers(db: Session, skip: int = 0, limit: int = 100, sort_by: str = "id", order: str = "asc", search: str = None):
    query = db.query(models.Customer)
    if search:
        query = query.filter(models.Customer.full_name.ilike(f"%{search}%"))
    if hasattr(models.Customer, sort_by):
        order_col = getattr(models.Customer, sort_by)
        if order == "desc":
            query = query.order_by(order_col.desc())
        else:
            query = query.order_by(order_col.asc())
    total = query.count()
    customers = query.offset(skip).limit(limit).all()
    return customers, total

def create_customer(db: Session, customer: schemas.CustomerCreate):
    db_customer = models.Customer(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

def delete_customer(db: Session, customer_id: int):
    db_customer = get_customer(db, customer_id)
    if db_customer:
        db.delete(db_customer)
        db.commit()
    return db_customer

# Orders
def create_order(db: Session, order: schemas.OrderCreate):
    # Check customer
    db_customer = get_customer(db, order.customer_id)
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    total_amount = 0.0
    order_items = []

    # Verify inventory and calculate total
    for item in order.items:
        db_product = get_product(db, item.product_id)
        if not db_product:
            raise HTTPException(status_code=404, detail=f"Product with ID {item.product_id} not found")
        if db_product.quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient inventory for product {db_product.name}. Available: {db_product.quantity}"
            )
        
        total_amount += db_product.price * item.quantity
        order_items.append((db_product, item.quantity))

    # Create Order
    db_order = models.Order(customer_id=order.customer_id, total_amount=total_amount)
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    # Create Order Items and update inventory
    for db_product, quantity in order_items:
        db_order_item = models.OrderItem(
            order_id=db_order.id,
            product_id=db_product.id,
            quantity=quantity,
            price_at_time=db_product.price
        )
        db.add(db_order_item)
        
        # Decrease inventory
        db_product.quantity -= quantity
        db.add(db_product)

    db.commit()
    db.refresh(db_order)
    return db_order

def get_orders(db: Session, skip: int = 0, limit: int = 100, sort_by: str = "id", order: str = "desc"):
    query = db.query(models.Order)
    if hasattr(models.Order, sort_by):
        order_col = getattr(models.Order, sort_by)
        if order == "desc":
            query = query.order_by(order_col.desc())
        else:
            query = query.order_by(order_col.asc())
    total = query.count()
    orders = query.offset(skip).limit(limit).all()
    return orders, total

def get_order(db: Session, order_id: int):
    return db.query(models.Order).filter(models.Order.id == order_id).first()

def delete_order(db: Session, order_id: int):
    db_order = get_order(db, order_id)
    if db_order:
        # Restore inventory
        for item in db_order.items:
            db_product = get_product(db, item.product_id)
            if db_product:
                db_product.quantity += item.quantity
                db.add(db_product)
        
        db.delete(db_order)
        db.commit()
    return db_order