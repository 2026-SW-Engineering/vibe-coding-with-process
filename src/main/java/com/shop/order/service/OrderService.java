package com.shop.order.service;

import com.shop.order.domain.*;
import com.shop.order.domain.enums.OrderStatus;
import com.shop.order.domain.enums.PaymentStatus;
import com.shop.order.exception.InsufficientStockException;
import com.shop.order.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final PaymentRepository paymentRepository;
    private final CartRepository cartRepository;
    private final UserRepository userRepository;

    public record OrderResult(Order order, List<String> excludedItems) {}

    /**
     * 주문 생성 (재고 차감 + PAYMENT_PENDING).
     * - 비관적 락으로 동시 주문 시 초과 판매 방지
     * - 데드락 방지를 위해 product_id 오름차순으로 잠금 획득
     * - stock == 0인 항목은 UC-05 3A에 따라 제외하고 계속 진행
     * - 잔여 재고 < 주문 수량이면 InsufficientStockException (UC-05 3B)
     */
    @Transactional
    public OrderResult createOrder(String email, List<Long> cartItemIds, String address, String phone) {
        User user = getUser(email);
        Cart cart = cartRepository.findByUser(user)
            .orElseThrow(() -> new IllegalStateException("장바구니를 찾을 수 없습니다."));

        List<CartItem> selectedItems = cart.getItems().stream()
            .filter(i -> cartItemIds.contains(i.getCartItemId()))
            .sorted(Comparator.comparing(i -> i.getProduct().getProductId())) // 데드락 방지
            .toList();

        if (selectedItems.isEmpty()) throw new IllegalArgumentException("선택된 항목이 없습니다.");

        Order order = new Order();
        order.setUser(user);
        order.setStatus(OrderStatus.PAYMENT_PENDING);
        order.setAddress(address);
        order.setPhone(phone);

        List<String> excluded = new ArrayList<>();
        List<Long> orderedCartItemIds = new ArrayList<>();
        int totalAmount = 0;

        for (CartItem cartItem : selectedItems) {
            Product product = productRepository
                .findByIdForUpdate(cartItem.getProduct().getProductId())
                .orElseThrow(() -> new IllegalArgumentException("상품을 찾을 수 없습니다."));

            int qty = cartItem.getQuantity();

            if (product.getStock() == 0) {
                excluded.add(product.getName()); // UC-05 3A: 품절 항목 제외
                continue;
            }
            if (product.getStock() < qty) {
                throw new InsufficientStockException(
                    "재고 부족: " + product.getName() +
                    " (남은 재고: " + product.getStock() + ", 요청: " + qty + ")");
            }

            product.setStock(product.getStock() - qty);

            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setProduct(product);
            item.setQuantity(qty);
            item.setConfirmedPrice(product.getCurrentPrice()); // 확정 가격 고정
            order.getItems().add(item);

            totalAmount += product.getCurrentPrice() * qty;
            orderedCartItemIds.add(cartItem.getCartItemId());
        }

        if (order.getItems().isEmpty()) {
            throw new IllegalStateException("주문 가능한 상품이 없습니다. (모두 품절)");
        }

        order.setTotalAmount(totalAmount);
        orderRepository.save(order);

        // 주문된 항목만 장바구니에서 제거 (D8 결정: 선택 항목만)
        cart.getItems().removeIf(i -> orderedCartItemIds.contains(i.getCartItemId()));

        return new OrderResult(order, excluded);
    }

    /**
     * 결제 확인 (2단계 결제 흐름 Step 2).
     * - 성공: PAYMENT_PENDING → PAID, Payment 레코드 생성
     * - 실패: 재고 복원 → CANCELLED, total_amount = 0 (SRS 6.1)
     */
    @Transactional
    public void confirmPayment(String email, Long orderId, boolean paymentSuccess) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new IllegalArgumentException("주문을 찾을 수 없습니다."));

        if (!order.getUser().getEmail().equals(email)) {
            throw new AccessDeniedException("접근 권한이 없습니다.");
        }
        if (order.getStatus() != OrderStatus.PAYMENT_PENDING) {
            throw new IllegalStateException("결제 대기 상태가 아닙니다.");
        }

        if (paymentSuccess) {
            order.setStatus(OrderStatus.PAID);

            Payment payment = new Payment();
            payment.setOrder(order);
            payment.setAmount(order.getTotalAmount());
            payment.setStatus(PaymentStatus.COMPLETED);
            payment.setPaidAt(LocalDateTime.now());
            paymentRepository.save(payment);

        } else {
            // 재고 복원 (데드락 방지: product_id 오름차순 잠금)
            order.getItems().stream()
                .sorted(Comparator.comparing(i -> i.getProduct().getProductId()))
                .forEach(item -> {
                    Product product = productRepository
                        .findByIdForUpdate(item.getProduct().getProductId())
                        .orElseThrow();
                    product.setStock(product.getStock() + item.getQuantity());
                });

            order.setStatus(OrderStatus.CANCELLED);
            order.setTotalAmount(0); // SRS 6.1: 취소완료 주문의 결제 금액 = 0

            Payment payment = new Payment();
            payment.setOrder(order);
            payment.setAmount(0);
            payment.setStatus(PaymentStatus.FAILED);
            paymentRepository.save(payment);
        }
    }

    @Transactional
    public void cancelOrder(String email, Long orderId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new IllegalArgumentException("주문을 찾을 수 없습니다."));
        if (!order.getUser().getEmail().equals(email))
            throw new AccessDeniedException("접근 권한이 없습니다.");
        if (order.getStatus() != OrderStatus.PAID && order.getStatus() != OrderStatus.PREPARING)
            throw new IllegalStateException("결제완료 또는 배송준비 상태에서만 취소할 수 있습니다.");

        order.getItems().stream()
            .sorted(Comparator.comparing(i -> i.getProduct().getProductId()))
            .forEach(item -> {
                Product product = productRepository
                    .findByIdForUpdate(item.getProduct().getProductId())
                    .orElseThrow();
                product.setStock(product.getStock() + item.getQuantity());
            });

        order.setStatus(OrderStatus.CANCELLED);
        order.setTotalAmount(0); // SRS 6.1
    }

    @Transactional(readOnly = true)
    public List<Order> findMyOrders(String email) {
        User user = getUser(email);
        return orderRepository.findByUserOrderByCreatedAtDesc(user);
    }

    @Transactional(readOnly = true)
    public Order findMyOrder(String email, Long orderId) {
        Order order = orderRepository.findByIdWithDetails(orderId)
            .orElseThrow(() -> new IllegalArgumentException("주문을 찾을 수 없습니다."));
        if (!order.getUser().getEmail().equals(email)) {
            throw new AccessDeniedException("접근 권한이 없습니다.");
        }
        return order;
    }

    // TC-S03: PAID → PREPARING (관리자 출고)
    @Transactional
    public void shipOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new IllegalArgumentException("주문을 찾을 수 없습니다."));
        if (order.getStatus() != OrderStatus.PAID)
            throw new IllegalStateException("결제완료 상태에서만 출고할 수 있습니다.");
        order.setStatus(OrderStatus.PREPARING);
    }

    // TC-S04: PREPARING → SHIPPING (배송 시스템 통지)
    @Transactional
    public void markShipping(Long orderId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new IllegalArgumentException("주문을 찾을 수 없습니다."));
        if (order.getStatus() != OrderStatus.PREPARING)
            throw new IllegalStateException("배송준비 상태에서만 배송 진행으로 전이할 수 있습니다.");
        order.setStatus(OrderStatus.SHIPPING);
    }

    // TC-S05: SHIPPING → DELIVERED (배송 시스템 통지), deliveredAt 기록
    @Transactional
    public void markDelivered(Long orderId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new IllegalArgumentException("주문을 찾을 수 없습니다."));
        if (order.getStatus() != OrderStatus.SHIPPING)
            throw new IllegalStateException("배송중 상태에서만 배송완료로 전이할 수 있습니다.");
        order.setStatus(OrderStatus.DELIVERED);
        order.setDeliveredAt(LocalDateTime.now());
    }

    @Transactional(readOnly = true)
    public List<Order> findAllOrders() {
        return orderRepository.findAllWithUser();
    }

    private User getUser(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }
}
