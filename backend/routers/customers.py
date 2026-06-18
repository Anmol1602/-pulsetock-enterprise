from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud, models, schemas, security
from database import get_db

router = APIRouter()

@router.post("/", response_model=schemas.Customer, status_code=status.HTTP_201_CREATED)
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    db_customer = crud.get_customer_by_email(db, email=customer.email)
    if db_customer:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_customer(db=db, customer=customer)

@router.get("/", response_model=schemas.PaginatedResponse[schemas.Customer])
def read_customers(page: int = 1, limit: int = 100, sort_by: str = "id", order: str = "asc", search: str = None, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    skip = (page - 1) * limit
    customers, total = crud.get_customers(db, skip=skip, limit=limit, sort_by=sort_by, order=order, search=search)
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    return {
        "data": customers,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@router.get("/{customer_id}", response_model=schemas.Customer)
def read_customer(customer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    db_customer = crud.get_customer(db, customer_id=customer_id)
    if db_customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return db_customer

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.check_admin_role)):
    db_customer = crud.get_customer(db, customer_id=customer_id)
    if db_customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    crud.delete_customer(db=db, customer_id=customer_id)
    return None