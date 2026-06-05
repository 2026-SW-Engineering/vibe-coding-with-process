package com.shop.order.domain.enums;

public enum OrderStatus {
    PAYMENT_PENDING,    // 결제대기
    PAID,               // 결제완료
    PREPARING,          // 배송준비
    SHIPPING,           // 배송중
    DELIVERED,          // 배송완료
    CANCELLED,          // 취소완료
    REFUND_REQUESTED,   // 환불요청
    PARTIALLY_REFUNDED  // 부분환불
}
