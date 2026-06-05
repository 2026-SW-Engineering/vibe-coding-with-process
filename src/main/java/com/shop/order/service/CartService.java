package com.shop.order.service;

import com.shop.order.domain.Cart;
import com.shop.order.domain.CartItem;
import com.shop.order.domain.Product;
import com.shop.order.domain.User;
import com.shop.order.repository.CartRepository;
import com.shop.order.repository.ProductRepository;
import com.shop.order.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CartService {

    private final CartRepository cartRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Cart getCart(String email) {
        User user = getUser(email);
        return cartRepository.findByUser(user)
            .orElseThrow(() -> new IllegalStateException("장바구니를 찾을 수 없습니다."));
    }

    @Transactional(readOnly = true)
    public Cart getCartWithItems(String email) {
        User user = getUser(email);
        return cartRepository.findByUserWithItems(user)
            .orElseThrow(() -> new IllegalStateException("장바구니를 찾을 수 없습니다."));
    }

    @Transactional
    public void addItem(String email, Long productId, int quantity) {
        if (quantity <= 0) throw new IllegalArgumentException("수량은 1 이상이어야 합니다.");

        Cart cart = getCart(email);
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new IllegalArgumentException("상품을 찾을 수 없습니다."));

        // Cart 컬렉션을 직접 조작해야 JPA 1차 캐시와 DB 양쪽이 일관성을 유지한다
        cart.getItems().stream()
            .filter(i -> i.getProduct().getProductId().equals(productId))
            .findFirst()
            .ifPresentOrElse(
                item -> item.setQuantity(item.getQuantity() + quantity),
                () -> {
                    CartItem item = new CartItem();
                    item.setCart(cart);
                    item.setProduct(product);
                    item.setQuantity(quantity);
                    item.setPriceAtAddTime(product.getCurrentPrice());
                    cart.getItems().add(item); // cascade = ALL 이 DB 저장까지 처리
                }
            );
    }

    @Transactional
    public void updateQuantity(String email, Long cartItemId, int quantity) {
        if (quantity <= 0) throw new IllegalArgumentException("수량은 1 이상이어야 합니다.");
        CartItem item = getOwnedItem(email, cartItemId);
        item.setQuantity(quantity);
    }

    @Transactional
    public void removeItem(String email, Long cartItemId) {
        Cart cart = getCart(email);
        boolean removed = cart.getItems().removeIf(i -> {
            if (!i.getCartItemId().equals(cartItemId)) return false;
            // 소유권 확인
            if (!i.getCart().getUser().getEmail().equals(email))
                throw new IllegalArgumentException("해당 장바구니 항목을 찾을 수 없습니다.");
            return true;
        });
        if (!removed) throw new IllegalArgumentException("해당 장바구니 항목을 찾을 수 없습니다.");
    }

    @Transactional(readOnly = true)
    public List<Long> getCartItemIds(String email) {
        return getCart(email).getItems().stream()
            .map(CartItem::getCartItemId)
            .toList();
    }

    // 선택한 항목만 장바구니에서 제거 (주문 후 호출)
    @Transactional
    public void removeItems(String email, List<Long> cartItemIds) {
        Cart cart = getCart(email);
        cart.getItems().removeIf(item -> cartItemIds.contains(item.getCartItemId()));
    }

    private CartItem getOwnedItem(String email, Long cartItemId) {
        Cart cart = getCart(email);
        return cart.getItems().stream()
            .filter(i -> i.getCartItemId().equals(cartItemId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("해당 장바구니 항목을 찾을 수 없습니다."));
    }

    private User getUser(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }
}
