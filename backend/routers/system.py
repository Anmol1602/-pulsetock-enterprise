from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import func
import models, schemas, system_service, security
from database import get_db

router = APIRouter()

@router.get("/stats")
def get_global_stats(db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    total_products = db.query(func.count(models.Product.id)).scalar()
    total_inventory_value = db.query(func.sum(models.Product.price * models.Product.quantity)).scalar() or 0.0
    total_revenue = db.query(func.sum(models.Order.total_amount)).scalar() or 0.0
    total_audit_logs = db.query(func.count(models.AuditLog.id)).scalar()
    total_customers = db.query(func.count(models.Customer.id)).scalar()
    low_stock_products = db.query(func.count(models.Product.id)).filter(models.Product.quantity < 5).scalar()
    
    return {
        "total_products": total_products,
        "total_inventory_value": total_inventory_value,
        "total_revenue": total_revenue,
        "total_audit_logs": total_audit_logs,
        "total_customers": total_customers,
        "low_stock_products": low_stock_products
    }

@router.post("/trigger-sync")
def trigger_sync(current_user: models.User = Depends(security.check_admin_role)):
    success = system_service.run_inventory_integrity_check()
    return {"status": "success" if success else "failed"}

@router.post("/seed")
def seed_database(db: Session = Depends(get_db), current_user: models.User = Depends(security.check_admin_role)):
    import seed
    try:
        seed.seed_data()
        return {"status": "success", "message": "Database seeded successfully"}
    except Exception as e:
        return {"status": "failed", "message": str(e)}

@router.get("/audit-logs", response_model=List[schemas.AuditLog])
def read_audit_logs(skip: int = 0, limit: int = 50, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    return db.query(models.AuditLog).order_by(models.AuditLog.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/health")
def health_check():
    return {
        "status": "operational",
        "services": {
            "database": "connected",
            "scheduler": "active",
            "worker_lane_realtime": "idle",
            "worker_lane_batch": "idle"
        }
    }
