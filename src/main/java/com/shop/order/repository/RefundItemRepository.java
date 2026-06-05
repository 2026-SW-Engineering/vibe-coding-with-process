package com.shop.order.repository;

import com.shop.order.domain.Refund;
import com.shop.order.domain.RefundItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RefundItemRepository extends JpaRepository<RefundItem, Long> {
    List<RefundItem> findByRefund(Refund refund);
}
