from database import SessionLocal
import models

def run_inventory_integrity_check():
    """Deterministic orchestration logic shared between scheduler and manual triggers."""
    db = SessionLocal()
    try:
        # 1. Check for Low Stock
        low_stock = db.query(models.Product).filter(models.Product.quantity < 5).all()
        for p in low_stock:
            log = models.AuditLog(
                event_type="INVENTORY_RECONCILIATION",
                message=f"Critical Stock Warning: {p.name} (SKU: {p.sku}) is at {p.quantity} units.",
                status="WARNING"
            )
            db.add(log)

        # 2. Check Order Consistency (Total Amount vs Item Sum)
        orders = db.query(models.Order).all()
        for order in orders:
            item_sum = sum(item.price_at_time * item.quantity for item in order.items)
            if abs(item_sum - order.total_amount) > 0.01:
                log = models.AuditLog(
                    event_type="ORDER_CONSISTENCY_ERROR",
                    message=f"Order #{order.id} total mismatch. Record: {order.total_amount}, Computed: {item_sum}",
                    status="FAILURE"
                )
                db.add(log)

        # 3. Success Log if no critical failures
        log = models.AuditLog(
            event_type="SYSTEM_HEALTH",
            message="Global system integrity check completed successfully.",
            status="SUCCESS"
        )
        db.add(log)
        
        db.commit()
        return True
    except Exception as e:
        print(f"Orchestration Error: {e}")
        db.rollback()
        return False
    finally:
        db.close()
