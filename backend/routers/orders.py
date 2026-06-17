from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud, models, schemas, security
from database import get_db

router = APIRouter()

@router.post("/", response_model=schemas.Order, status_code=status.HTTP_201_CREATED)
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    return crud.create_order(db=db, order=order)

@router.get("/", response_model=schemas.PaginatedResponse[schemas.Order])
def read_orders(page: int = 1, limit: int = 100, sort_by: str = "id", order: str = "desc", db: Session = Depends(get_db)):
    skip = (page - 1) * limit
    orders, total = crud.get_orders(db, skip=skip, limit=limit, sort_by=sort_by, order=order)
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    return {
        "data": orders,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@router.get("/{order_id}", response_model=schemas.Order)
def read_order(order_id: int, db: Session = Depends(get_db)):
    db_order = crud.get_order(db, order_id=order_id)
    if db_order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return db_order

@router.patch("/{order_id}/status", response_model=schemas.Order)
def update_order_status(order_id: int, status_update: schemas.OrderStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(security.check_admin_role)):
    valid_transitions = {
        "pending": ["confirmed", "cancelled"],
        "confirmed": ["shipped", "cancelled"],
        "shipped": ["delivered"],
        "delivered": [],
        "cancelled": []
    }
    
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    current_status = db_order.status
    new_status = status_update.status
    
    if new_status not in valid_transitions.get(current_status, []):
        raise HTTPException(status_code=400, detail=f"Invalid state transition from {current_status} to {new_status}")
        
    db_order.status = new_status
    
    # If cancelled, restore inventory
    if new_status == "cancelled":
        for item in db_order.items:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
            if product:
                product.quantity += item.quantity
                db.add(product)
                
                log = models.AuditLog(
                    event_type="INVENTORY_RESTORED",
                    message=f"Restored {item.quantity} units of {product.sku} due to order {order_id} cancellation.",
                    status="SUCCESS"
                )
                db.add(log)
                
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.check_admin_role)):
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if db_order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    crud.delete_order(db=db, order_id=order_id)
    return None