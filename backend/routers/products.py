from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud, models, schemas, security
from database import get_db

router = APIRouter()

@router.post("/", response_model=schemas.Product, status_code=status.HTTP_201_CREATED)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    db_product = crud.get_product_by_sku(db, sku=product.sku)
    if db_product:
        raise HTTPException(status_code=400, detail="SKU already registered")
    return crud.create_product(db=db, product=product)

@router.get("/", response_model=schemas.PaginatedResponse[schemas.Product])
def read_products(page: int = 1, limit: int = 100, sort_by: str = "id", order: str = "asc", search: str = None, db: Session = Depends(get_db)):
    skip = (page - 1) * limit
    products, total = crud.get_products(db, skip=skip, limit=limit, sort_by=sort_by, order=order, search=search)
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    return {
        "data": products,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@router.get("/{product_id}", response_model=schemas.Product)
def read_product(product_id: int, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

@router.put("/{product_id}", response_model=schemas.Product)
def update_product(product_id: int, product: schemas.ProductUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    db_product = crud.get_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.sku:
        existing = crud.get_product_by_sku(db, sku=product.sku)
        if existing and existing.id != product_id:
            raise HTTPException(status_code=400, detail="SKU already registered by another product")
    return crud.update_product(db=db, product_id=product_id, product=product)

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.check_admin_role)):
    db_product = crud.get_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    crud.delete_product(db=db, product_id=product_id)
    return None