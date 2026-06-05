package com.shop.order.domain;

import com.shop.order.domain.enums.RefundStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "refunds")
@Getter @Setter @NoArgsConstructor
public class Refund {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long refundId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private int refundAmount;

    @Column(nullable = false)
    private String type = "partial_refund";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RefundStatus status;

    private String reason;

    @Column(nullable = false, updatable = false)
    private LocalDateTime requestedAt;

    private LocalDateTime processedAt;

    @OneToMany(mappedBy = "refund", cascade = CascadeType.ALL)
    private List<RefundItem> items = new ArrayList<>();

    @PrePersist
    private void onCreate() { requestedAt = LocalDateTime.now(); }
}
