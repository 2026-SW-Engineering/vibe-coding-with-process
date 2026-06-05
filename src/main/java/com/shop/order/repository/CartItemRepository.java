package com.shop.order.repository;

import com.shop.order.domain.Cart;
import com.shop.order.domain.CartItem;
import com.shop.order.domain.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {
    Optional<CartItem> findByCartAndProduct(Cart cart, Product product);
}
