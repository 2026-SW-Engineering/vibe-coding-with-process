from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class UserCreate(BaseModel):
    email: str
    name: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str

    class Config:
        from_attributes = True


class ProductOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    price: float
    stock: int
    category: str

    class Config:
        from_attributes = True


class ProductPriceUpdate(BaseModel):
    price: float


class CartItemCreate(BaseModel):
    product_id: int
    quantity: int


class CartItemUpdate(BaseModel):
    quantity: int


class OrderCreate(BaseModel):
    cart_item_ids: List[int]
    payment_success: bool = True


class RefundItemData(BaseModel):
    order_item_id: int
    quantity: int


class RefundRequestCreate(BaseModel):
    items: List[RefundItemData]


class ChatRequest(BaseModel):
    messages: List[dict]
    session_id: str
