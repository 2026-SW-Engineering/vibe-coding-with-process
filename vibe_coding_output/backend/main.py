import os
from datetime import datetime, timedelta
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import anthropic
import auth
import models
import schemas
import seed
from database import engine, get_db

load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="VibeMall API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    seed.seed_db()


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ── Auth ───────────────────────────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=schemas.UserOut)
def register(data: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(400, "이미 사용 중인 이메일입니다")
    user = models.User(
        email=data.email,
        name=data.name,
        password_hash=auth.hash_password(data.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/auth/login")
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not auth.verify_password(data.password, user.password_hash):
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다")
    token = auth.create_token(user.id, user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role},
    }


@app.get("/api/auth/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


# ── Products ───────────────────────────────────────────────────────────────────

@app.get("/api/products", response_model=List[schemas.ProductOut])
def list_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Product)
    if category and category != "전체":
        query = query.filter(models.Product.category == category)
    if search:
        query = query.filter(models.Product.name.contains(search))
    return query.all()


@app.get("/api/products/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다")
    return product


# ── Cart ───────────────────────────────────────────────────────────────────────

@app.get("/api/cart")
def get_cart(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    items = db.query(models.CartItem).filter(models.CartItem.user_id == current_user.id).all()
    result = [
        {
            "id": item.id,
            "product_id": item.product_id,
            "quantity": item.quantity,
            "product": {
                "id": item.product.id,
                "name": item.product.name,
                "price": item.product.price,
                "stock": item.product.stock,
                "category": item.product.category,
                "description": item.product.description,
            },
            "subtotal": item.product.price * item.quantity,
        }
        for item in items
    ]
    return {"items": result, "total": sum(i["subtotal"] for i in result), "count": len(result)}


@app.post("/api/cart")
def add_to_cart(
    data: schemas.CartItemCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(models.Product).filter(models.Product.id == data.product_id).first()
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다")
    if product.stock < data.quantity:
        raise HTTPException(400, f"재고가 부족합니다 (남은 재고: {product.stock}개)")

    existing = db.query(models.CartItem).filter(
        models.CartItem.user_id == current_user.id,
        models.CartItem.product_id == data.product_id,
    ).first()

    if existing:
        existing.quantity += data.quantity
        db.commit()
        return {"message": "수량이 업데이트되었습니다"}

    item = models.CartItem(
        user_id=current_user.id,
        product_id=data.product_id,
        quantity=data.quantity,
    )
    db.add(item)
    db.commit()
    return {"message": "장바구니에 추가되었습니다"}


@app.put("/api/cart/{item_id}")
def update_cart_item(
    item_id: int,
    data: schemas.CartItemUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(models.CartItem).filter(
        models.CartItem.id == item_id,
        models.CartItem.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(404, "장바구니 항목을 찾을 수 없습니다")
    if data.quantity <= 0:
        db.delete(item)
    else:
        item.quantity = data.quantity
    db.commit()
    return {"message": "업데이트되었습니다"}


@app.delete("/api/cart/{item_id}")
def remove_cart_item(
    item_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(models.CartItem).filter(
        models.CartItem.id == item_id,
        models.CartItem.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(404, "장바구니 항목을 찾을 수 없습니다")
    db.delete(item)
    db.commit()
    return {"message": "삭제되었습니다"}


@app.delete("/api/cart")
def clear_cart(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    db.query(models.CartItem).filter(models.CartItem.user_id == current_user.id).delete()
    db.commit()
    return {"message": "장바구니가 비워졌습니다"}


# ── Orders ─────────────────────────────────────────────────────────────────────

@app.post("/api/orders")
def create_order(
    data: schemas.OrderCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    cart_items = db.query(models.CartItem).filter(
        models.CartItem.id.in_(data.cart_item_ids),
        models.CartItem.user_id == current_user.id,
    ).all()

    if not cart_items:
        raise HTTPException(400, "선택된 상품이 없습니다")

    for ci in cart_items:
        if ci.product.stock < ci.quantity:
            raise HTTPException(400, f"'{ci.product.name}'의 재고가 부족합니다 (남은 재고: {ci.product.stock}개)")

    total = sum(ci.product.price * ci.quantity for ci in cart_items)

    if data.payment_success:
        order = models.Order(user_id=current_user.id, status="paid", total_amount=total)
        db.add(order)
        db.flush()

        for ci in cart_items:
            db.add(models.OrderItem(
                order_id=order.id,
                product_id=ci.product_id,
                product_name=ci.product.name,
                unit_price=ci.product.price,
                quantity=ci.quantity,
            ))
            ci.product.stock -= ci.quantity
            db.delete(ci)

        db.commit()
        return {"message": "주문이 완료되었습니다", "order_id": order.id, "status": "paid"}
    else:
        order = models.Order(user_id=current_user.id, status="cancelled", total_amount=0)
        db.add(order)
        db.flush()

        for ci in cart_items:
            db.add(models.OrderItem(
                order_id=order.id,
                product_id=ci.product_id,
                product_name=ci.product.name,
                unit_price=ci.product.price,
                quantity=ci.quantity,
            ))

        db.commit()
        return {"message": "결제에 실패했습니다", "order_id": order.id, "status": "cancelled"}


@app.get("/api/orders")
def get_orders(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    orders = (
        db.query(models.Order)
        .filter(models.Order.user_id == current_user.id)
        .order_by(models.Order.created_at.desc())
        .all()
    )
    return [
        {
            "id": o.id,
            "status": o.status,
            "total_amount": o.total_amount,
            "created_at": o.created_at,
            "items_count": len(o.items),
            "items": [
                {"id": i.id, "product_name": i.product_name, "unit_price": i.unit_price, "quantity": i.quantity}
                for i in o.items
            ],
        }
        for o in orders
    ]


@app.get("/api/orders/{order_id}")
def get_order(
    order_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(404, "주문을 찾을 수 없습니다")

    return {
        "id": order.id,
        "status": order.status,
        "total_amount": order.total_amount,
        "created_at": order.created_at,
        "updated_at": order.updated_at,
        "items": [
            {
                "id": i.id,
                "product_id": i.product_id,
                "product_name": i.product_name,
                "unit_price": i.unit_price,
                "quantity": i.quantity,
                "subtotal": i.unit_price * i.quantity,
            }
            for i in order.items
        ],
        "refund_requests": [
            {
                "id": r.id,
                "order_item_id": r.order_item_id,
                "quantity": r.quantity,
                "refund_amount": r.refund_amount,
                "status": r.status,
                "created_at": r.created_at,
            }
            for r in order.refund_requests
        ],
    }


@app.post("/api/orders/{order_id}/cancel")
def cancel_order(
    order_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(404, "주문을 찾을 수 없습니다")
    if order.status not in ("paid", "preparing"):
        raise HTTPException(400, f"현재 상태({order.status})에서는 취소할 수 없습니다")

    for item in order.items:
        if item.product:
            item.product.stock += item.quantity

    order.status = "cancelled"
    order.total_amount = 0
    order.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "주문이 취소되었습니다"}


@app.post("/api/orders/{order_id}/refund-request")
def request_refund(
    order_id: int,
    data: schemas.RefundRequestCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(404, "주문을 찾을 수 없습니다")
    if order.status != "delivered":
        raise HTTPException(400, "배송완료 상태의 주문만 환불 요청이 가능합니다")

    if order.delivered_at and datetime.utcnow() - order.delivered_at > timedelta(days=7):
        raise HTTPException(400, "환불 가능 기간(7일)이 지났습니다")

    pending = db.query(models.RefundRequest).filter(
        models.RefundRequest.order_id == order_id,
        models.RefundRequest.status == "pending",
    ).first()
    if pending:
        raise HTTPException(400, "이미 환불 요청이 진행 중입니다")

    for item_data in data.items:
        order_item = db.query(models.OrderItem).filter(
            models.OrderItem.id == item_data.order_item_id,
            models.OrderItem.order_id == order_id,
        ).first()
        if not order_item:
            raise HTTPException(404, "주문 항목을 찾을 수 없습니다")
        if item_data.quantity > order_item.quantity:
            raise HTTPException(400, "환불 수량이 주문 수량을 초과합니다")

        db.add(models.RefundRequest(
            order_id=order_id,
            order_item_id=order_item.id,
            quantity=item_data.quantity,
            refund_amount=order_item.unit_price * item_data.quantity,
        ))

    order.status = "refund_requested"
    order.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "환불 요청이 완료되었습니다"}


# ── Admin ──────────────────────────────────────────────────────────────────────

@app.get("/api/admin/orders")
def admin_get_orders(
    admin: models.User = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    orders = db.query(models.Order).order_by(models.Order.created_at.desc()).all()
    return [
        {
            "id": o.id,
            "user_email": o.user.email if o.user else "Unknown",
            "user_name": o.user.name if o.user else "Unknown",
            "status": o.status,
            "total_amount": o.total_amount,
            "created_at": o.created_at,
            "items_count": len(o.items),
        }
        for o in orders
    ]


@app.post("/api/admin/orders/{order_id}/ship")
def ship_order(
    order_id: int,
    admin: models.User = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "주문을 찾을 수 없습니다")
    if order.status != "paid":
        raise HTTPException(400, "결제완료 상태의 주문만 출고할 수 있습니다")
    order.status = "preparing"
    order.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "출고 처리되었습니다"}


@app.post("/api/admin/orders/{order_id}/deliver")
def deliver_order(
    order_id: int,
    admin: models.User = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "주문을 찾을 수 없습니다")
    if order.status not in ("preparing", "shipping"):
        raise HTTPException(400, "배송준비/배송중 상태의 주문만 배송완료 처리할 수 있습니다")
    order.status = "delivered"
    order.delivered_at = datetime.utcnow()
    order.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "배송완료 처리되었습니다"}


@app.put("/api/admin/products/{product_id}/price")
def update_product_price(
    product_id: int,
    data: schemas.ProductPriceUpdate,
    admin: models.User = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다")
    if data.price <= 0:
        raise HTTPException(400, "가격은 0보다 커야 합니다")
    product.price = data.price
    db.commit()
    return {"message": "가격이 업데이트되었습니다", "id": product.id, "name": product.name, "price": product.price}


@app.get("/api/admin/refunds")
def get_all_refunds(
    admin: models.User = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    refunds = (
        db.query(models.RefundRequest)
        .filter(models.RefundRequest.status == "pending")
        .order_by(models.RefundRequest.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "order_id": r.order_id,
            "product_name": r.order_item.product_name if r.order_item else "Unknown",
            "quantity": r.quantity,
            "refund_amount": r.refund_amount,
            "status": r.status,
            "created_at": r.created_at,
            "user_email": r.order.user.email if r.order and r.order.user else "Unknown",
        }
        for r in refunds
    ]


@app.post("/api/admin/refunds/{refund_id}/approve")
def approve_refund(
    refund_id: int,
    admin: models.User = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    refund = db.query(models.RefundRequest).filter(models.RefundRequest.id == refund_id).first()
    if not refund:
        raise HTTPException(404, "환불 요청을 찾을 수 없습니다")
    if refund.status != "pending":
        raise HTTPException(400, "대기 중인 환불 요청만 처리할 수 있습니다")

    if refund.order_item and refund.order_item.product:
        refund.order_item.product.stock += refund.quantity

    refund.status = "approved"
    order = db.query(models.Order).filter(models.Order.id == refund.order_id).first()
    if order:
        order.total_amount = max(0, order.total_amount - refund.refund_amount)
        order.status = "partially_refunded"
        order.updated_at = datetime.utcnow()

    db.commit()
    return {"message": "환불이 승인되었습니다"}


@app.post("/api/admin/refunds/{refund_id}/reject")
def reject_refund(
    refund_id: int,
    admin: models.User = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    refund = db.query(models.RefundRequest).filter(models.RefundRequest.id == refund_id).first()
    if not refund:
        raise HTTPException(404, "환불 요청을 찾을 수 없습니다")
    if refund.status != "pending":
        raise HTTPException(400, "대기 중인 환불 요청만 처리할 수 있습니다")

    refund.status = "rejected"
    order = db.query(models.Order).filter(models.Order.id == refund.order_id).first()
    if order:
        order.status = "delivered"
        order.updated_at = datetime.utcnow()

    db.commit()
    return {"message": "환불이 거부되었습니다"}


# ── Chat (AI Product Recommendation) ──────────────────────────────────────────

@app.post("/api/chat")
def chat(data: schemas.ChatRequest, db: Session = Depends(get_db)):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY가 설정되지 않았습니다. backend/.env 파일에 키를 추가하세요.")

    products = db.query(models.Product).filter(models.Product.stock > 0).all()
    product_list = "\n".join([
        f"- [{p.id}] {p.name}: ₩{p.price:,.0f} ({p.category}) | {p.description} | 재고: {p.stock}개"
        for p in products
    ])

    system_prompt = f"""당신은 VibeMall의 AI 쇼핑 어시스턴트입니다.

현재 판매 중인 상품 목록 (재고 있는 상품):
{product_list}

안내 사항:
- 고객의 필요와 예산에 맞는 상품을 추천해주세요
- 상품명은 **굵게** 표시하고 가격을 반드시 포함하세요
- 재고가 있는 상품만 추천하세요
- 친근하고 전문적인 어조로 한국어로 대화하세요
- 최대 3개의 상품을 추천하세요
- 추천 시 왜 이 상품이 고객에게 적합한지 간단히 설명하세요"""

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=system_prompt,
        messages=data.messages,
    )

    usage = response.usage
    cache_creation = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0

    db.add(models.TokenUsageLog(
        session_id=data.session_id,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        cache_creation_tokens=cache_creation,
        cache_read_tokens=cache_read,
    ))
    db.commit()

    return {
        "reply": response.content[0].text,
        "usage": {
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cache_creation_input_tokens": cache_creation,
            "cache_read_input_tokens": cache_read,
        },
    }


@app.get("/api/chat/usage/{session_id}")
def get_chat_usage(session_id: str, db: Session = Depends(get_db)):
    logs = db.query(models.TokenUsageLog).filter(
        models.TokenUsageLog.session_id == session_id
    ).all()

    total_input = sum(l.input_tokens for l in logs)
    total_output = sum(l.output_tokens for l in logs)
    total_cache_creation = sum(l.cache_creation_tokens for l in logs)
    total_cache_read = sum(l.cache_read_tokens for l in logs)

    # claude-sonnet-4-6 pricing
    cost = (
        total_input * 3.0
        + total_output * 15.0
        + total_cache_creation * 3.75
        + total_cache_read * 0.30
    ) / 1_000_000

    return {
        "session_id": session_id,
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_cache_creation_tokens": total_cache_creation,
        "total_cache_read_tokens": total_cache_read,
        "estimated_cost_usd": round(cost, 6),
        "message_count": len(logs),
    }
