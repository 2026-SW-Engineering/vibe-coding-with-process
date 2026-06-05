package com.shop.order.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "refund_items")
@Getter @Setter @NoArgsConstructor
public class RefundItem {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long refundItemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "refund_id", nullable = false)
    private Refund refund;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id", nullable = false)
    private OrderItem orderItem;

    @Column(nullable = false)
    private int quantityToRefund;

    @Column(nullable = false)
    private int refundAmount;
}
