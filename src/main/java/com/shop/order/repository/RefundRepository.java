package com.shop.order.repository;

import com.shop.order.domain.Order;
import com.shop.order.domain.Refund;
import com.shop.order.domain.enums.RefundStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RefundRepository extends JpaRepository<Refund, Long> {
    Optional<Refund> findByOrder(Order order);

    @Query("""
        SELECT DISTINCT r FROM Refund r
        JOIN FETCH r.order
        JOIN FETCH r.user
        JOIN FETCH r.items ri
        JOIN FETCH ri.orderItem oi
        JOIN FETCH oi.product
        WHERE r.status = :status
        ORDER BY r.requestedAt DESC
        """)
    List<Refund> findPendingWithDetails(@Param("status") RefundStatus status);
}
