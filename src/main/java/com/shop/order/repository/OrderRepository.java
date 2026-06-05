package com.shop.order.repository;

import com.shop.order.domain.Order;
import com.shop.order.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserOrderByCreatedAtDesc(User user);

    @Query("SELECT o FROM Order o JOIN FETCH o.user LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.product WHERE o.orderId = :id")
    Optional<Order> findByIdWithDetails(@Param("id") Long id);

    @Query("SELECT DISTINCT o FROM Order o JOIN FETCH o.user ORDER BY o.createdAt DESC")
    List<Order> findAllWithUser();
}
