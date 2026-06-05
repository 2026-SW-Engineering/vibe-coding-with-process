package com.shop.order.service;

import com.shop.order.domain.*;
import com.shop.order.domain.enums.ItemStatus;
import com.shop.order.domain.enums.OrderStatus;
import com.shop.order.domain.enums.RefundStatus;
import com.shop.order.repository.OrderRepository;
import com.shop.order.repository.ProductRepository;
import com.shop.order.repository.RefundRepository;
import com.shop.order.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RefundService {

    private final RefundRepository refundRepository;
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Transactional
    public Refund requestRefund(String email, Long orderId,
                                List<Long> orderItemIds, List<Integer> quantities,
                                String reason) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new IllegalArgumentException("주문을 찾을 수 없습니다."));

        if (!order.getUser().getEmail().equals(email))
            throw new AccessDeniedException("접근 권한이 없습니다.");
        if (order.getStatus() != OrderStatus.DELIVERED)
            throw new IllegalStateException("배송완료 상태에서만 환불 요청이 가능합니다.");
        if (order.getDeliveredAt() == null ||
            order.getDeliveredAt().plusDays(7).isBefore(LocalDateTime.now()))
            throw new IllegalStateException("환불 요청 기한이 지났습니다. (배송완료 후 7일 이내)");
        if (orderItemIds == null || orderItemIds.isEmpty() ||
            orderItemIds.size() != quantities.size())
            throw new IllegalArgumentException("환불 대상 항목 정보가 올바르지 않습니다.");

        Refund refund = new Refund();
        refund.setOrder(order);
        refund.setUser(user);
        refund.setStatus(RefundStatus.PENDING);
        refund.setReason(reason);

        int totalRefundAmount = 0;
        for (int i = 0; i < orderItemIds.size(); i++) {
            int qty = quantities.get(i);
            if (qty <= 0) continue;

            final Long itemId = orderItemIds.get(i);
            OrderItem orderItem = order.getItems().stream()
                .filter(it -> it.getOrderItemId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("주문 항목을 찾을 수 없습니다."));

            if (qty > orderItem.getQuantity())
                throw new IllegalArgumentException("환불 수량이 주문 수량을 초과합니다.");

            int itemRefundAmount = orderItem.getConfirmedPrice() * qty;
            totalRefundAmount += itemRefundAmount;

            RefundItem refundItem = new RefundItem();
            refundItem.setRefund(refund);
            refundItem.setOrderItem(orderItem);
            refundItem.setQuantityToRefund(qty);
            refundItem.setRefundAmount(itemRefundAmount);
            refund.getItems().add(refundItem);
        }

        if (refund.getItems().isEmpty())
            throw new IllegalArgumentException("환불 대상 항목을 1개 이상 선택해주세요.");

        refund.setRefundAmount(totalRefundAmount);
        order.setStatus(OrderStatus.REFUND_REQUESTED);
        refundRepository.save(refund);
        return refund;
    }

    @Transactional
    public void approveRefund(Long refundId) {
        Refund refund = refundRepository.findById(refundId)
            .orElseThrow(() -> new IllegalArgumentException("환불 요청을 찾을 수 없습니다."));
        if (refund.getStatus() != RefundStatus.PENDING)
            throw new IllegalStateException("처리할 수 없는 환불 요청입니다.");

        Order order = refund.getOrder();

        refund.getItems().stream()
            .sorted(Comparator.comparing(i -> i.getOrderItem().getProduct().getProductId()))
            .forEach(refundItem -> {
                Product product = productRepository
                    .findByIdForUpdate(refundItem.getOrderItem().getProduct().getProductId())
                    .orElseThrow();
                product.setStock(product.getStock() + refundItem.getQuantityToRefund());
                refundItem.getOrderItem().setItemStatus(ItemStatus.REFUNDED);
            });

        // SRS 6.1: 부분환불 주문 결제 금액 = 원래 금액 - 환불 금액
        order.setTotalAmount(order.getTotalAmount() - refund.getRefundAmount());
        order.setStatus(OrderStatus.PARTIALLY_REFUNDED);
        refund.setStatus(RefundStatus.APPROVED);
        refund.setProcessedAt(LocalDateTime.now());
    }

    @Transactional
    public void rejectRefund(Long refundId) {
        Refund refund = refundRepository.findById(refundId)
            .orElseThrow(() -> new IllegalArgumentException("환불 요청을 찾을 수 없습니다."));
        if (refund.getStatus() != RefundStatus.PENDING)
            throw new IllegalStateException("처리할 수 없는 환불 요청입니다.");

        refund.getOrder().setStatus(OrderStatus.DELIVERED);
        refund.setStatus(RefundStatus.REJECTED);
        refund.setProcessedAt(LocalDateTime.now());
    }

    @Transactional(readOnly = true)
    public List<Refund> findPendingRefunds() {
        return refundRepository.findPendingWithDetails(RefundStatus.PENDING);
    }
}
