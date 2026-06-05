package com.shop.order;

import com.shop.order.domain.Order;
import com.shop.order.domain.Product;
import com.shop.order.domain.Refund;
import com.shop.order.domain.enums.ItemStatus;
import com.shop.order.domain.enums.OrderStatus;
import com.shop.order.exception.InsufficientStockException;
import com.shop.order.repository.OrderRepository;
import com.shop.order.repository.ProductRepository;
import com.shop.order.service.CartService;
import com.shop.order.service.OrderService;
import com.shop.order.service.RefundService;
import com.shop.order.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class Phase6CancelRefundTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserService userService;
    @Autowired CartService cartService;
    @Autowired OrderService orderService;
    @Autowired RefundService refundService;
    @Autowired ProductRepository productRepository;
    @Autowired OrderRepository orderRepository;

    private static final String EMAIL = "cancel@test.com";
    private Product product;

    @BeforeEach
    void setUp() {
        userService.register(EMAIL, "password123", "취소환불유저");
        product = productRepository.findAll().get(0);
        product.setStock(20);
        product.setCurrentPrice(10000);
        productRepository.save(product);
    }

    private Order createPaidOrder(int quantity) {
        cartService.addItem(EMAIL, product.getProductId(), quantity);
        List<Long> ids = cartService.getCartItemIds(EMAIL);
        Order order = orderService.createOrder(EMAIL, ids, "서울", "010-0000-0000").order();
        orderService.confirmPayment(EMAIL, order.getOrderId(), true);
        return orderRepository.findById(order.getOrderId()).orElseThrow();
    }

    private Order setDelivered(Order order, LocalDateTime deliveredAt) {
        order.setStatus(OrderStatus.DELIVERED);
        order.setDeliveredAt(deliveredAt);
        return orderRepository.save(order);
    }

    // TC-D01: 결제완료 → 전체 취소 가능
    @Test
    void TC_D01_paid_cancelPossible() {
        Order order = createPaidOrder(2);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);

        orderService.cancelOrder(EMAIL, order.getOrderId());

        Order cancelled = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertThat(cancelled.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(cancelled.getTotalAmount()).isEqualTo(0); // SRS 6.1
        assertThat(productRepository.findById(product.getProductId()).orElseThrow().getStock()).isEqualTo(20);
    }

    // TC-D02: 배송준비 → 전체 취소 가능
    @Test
    void TC_D02_preparing_cancelPossible() {
        Order order = createPaidOrder(3);
        order.setStatus(OrderStatus.PREPARING);
        orderRepository.save(order);

        orderService.cancelOrder(EMAIL, order.getOrderId());

        Order cancelled = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertThat(cancelled.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(cancelled.getTotalAmount()).isEqualTo(0);
        assertThat(productRepository.findById(product.getProductId()).orElseThrow().getStock()).isEqualTo(20);
    }

    // TC-D03: 배송중 → 취소·환불 모두 거부
    @Test
    void TC_D03_shipping_cancelAndRefundRejected() {
        Order order = createPaidOrder(1);
        order.setStatus(OrderStatus.SHIPPING);
        orderRepository.save(order);

        assertThatThrownBy(() ->
            orderService.cancelOrder(EMAIL, order.getOrderId())
        ).isInstanceOf(IllegalStateException.class);

        assertThatThrownBy(() ->
            refundService.requestRefund(EMAIL, order.getOrderId(),
                List.of(order.getItems().get(0).getOrderItemId()), List.of(1), "테스트")
        ).isInstanceOf(IllegalStateException.class);
    }

    // TC-D04: 배송완료, 7일 이내, 미환불 → 환불 요청 가능
    @Test
    void TC_D04_delivered_withinDeadline_refundPossible() {
        Order order = createPaidOrder(2);
        setDelivered(order, LocalDateTime.now().minusDays(3));

        Long orderItemId = order.getItems().get(0).getOrderItemId();
        Refund refund = refundService.requestRefund(EMAIL, order.getOrderId(),
            List.of(orderItemId), List.of(1), "단순 변심");

        assertThat(refund).isNotNull();
        Order updated = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(OrderStatus.REFUND_REQUESTED);
    }

    // TC-D05: 이미 부분환불 상태 → 재환불 거부
    @Test
    void TC_D05_partiallyRefunded_reRefundRejected() {
        Order order = createPaidOrder(2);
        order.setStatus(OrderStatus.PARTIALLY_REFUNDED);
        orderRepository.save(order);

        assertThatThrownBy(() ->
            refundService.requestRefund(EMAIL, order.getOrderId(),
                List.of(order.getItems().get(0).getOrderItemId()), List.of(1), "재환불 시도")
        ).isInstanceOf(IllegalStateException.class);
    }

    // TC-D06: 배송완료, 7일 초과 → 기한 초과로 거부
    @Test
    void TC_D06_delivered_pastDeadline_rejected() {
        Order order = createPaidOrder(1);
        setDelivered(order, LocalDateTime.now().minusDays(8));

        assertThatThrownBy(() ->
            refundService.requestRefund(EMAIL, order.getOrderId(),
                List.of(order.getItems().get(0).getOrderItemId()), List.of(1), "기한 초과")
        ).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("기한");
    }

    // TC-D07: 결제완료 상태 → 부분 환불 거부 (배송완료 아님)
    @Test
    void TC_D07_paid_refundRejected() {
        Order order = createPaidOrder(2);

        assertThatThrownBy(() ->
            refundService.requestRefund(EMAIL, order.getOrderId(),
                List.of(order.getItems().get(0).getOrderItemId()), List.of(1), "잘못된 요청")
        ).isInstanceOf(IllegalStateException.class);
    }

    // TC-S06: 환불요청 → 부분환불 (관리자 승인, 재고 복원)
    @Test
    void TC_S06_refundRequested_to_partiallyRefunded() {
        Order order = createPaidOrder(3);
        setDelivered(order, LocalDateTime.now().minusDays(2));

        Long orderItemId = order.getItems().get(0).getOrderItemId();
        Refund refund = refundService.requestRefund(EMAIL, order.getOrderId(),
            List.of(orderItemId), List.of(2), "일부 반품");

        int stockBefore = productRepository.findById(product.getProductId()).orElseThrow().getStock();
        refundService.approveRefund(refund.getRefundId());

        Order updated = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(OrderStatus.PARTIALLY_REFUNDED);
        int stockAfter = productRepository.findById(product.getProductId()).orElseThrow().getStock();
        assertThat(stockAfter).isEqualTo(stockBefore + 2); // 환불 수량만큼 복원
        // OrderItem itemStatus 확인
        assertThat(order.getItems().get(0).getItemStatus()).isEqualTo(ItemStatus.REFUNDED);
    }

    // TC-S07: 환불요청 → 배송완료 (관리자 거부, 변경 없음)
    @Test
    void TC_S07_refundRequested_rejected_backToDelivered() {
        Order order = createPaidOrder(2);
        setDelivered(order, LocalDateTime.now().minusDays(1));

        Long orderItemId = order.getItems().get(0).getOrderItemId();
        Refund refund = refundService.requestRefund(EMAIL, order.getOrderId(),
            List.of(orderItemId), List.of(1), "반품 시도");

        int totalBefore = orderRepository.findById(order.getOrderId()).orElseThrow().getTotalAmount();
        int stockBefore = productRepository.findById(product.getProductId()).orElseThrow().getStock();

        refundService.rejectRefund(refund.getRefundId());

        Order updated = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(OrderStatus.DELIVERED);
        assertThat(updated.getTotalAmount()).isEqualTo(totalBefore); // 금액 변경 없음
        assertThat(productRepository.findById(product.getProductId()).orElseThrow().getStock())
            .isEqualTo(stockBefore); // 재고 변경 없음
    }

    // TC-S10: 배송중에서 전체 취소 시도 → 거부
    @Test
    void TC_S10_shipping_cancelRejected() {
        Order order = createPaidOrder(1);
        order.setStatus(OrderStatus.SHIPPING);
        orderRepository.save(order);

        assertThatThrownBy(() ->
            orderService.cancelOrder(EMAIL, order.getOrderId())
        ).isInstanceOf(IllegalStateException.class);
    }

    // TC-S11: 배송중에서 부분 환불 시도 → 거부
    @Test
    void TC_S11_shipping_refundRejected() {
        Order order = createPaidOrder(1);
        order.setStatus(OrderStatus.SHIPPING);
        orderRepository.save(order);

        assertThatThrownBy(() ->
            refundService.requestRefund(EMAIL, order.getOrderId(),
                List.of(order.getItems().get(0).getOrderItemId()), List.of(1), "배송중 환불")
        ).isInstanceOf(IllegalStateException.class);
    }

    // TC-B06~B08: 7일 기한 경계값 (배송완료 후 N일째)
    @ParameterizedTest(name = "배송완료 후 {0}일, 환불 가능={1}")
    @CsvSource({"6,true", "7,true", "8,false"})
    void TC_B06_B07_B08_refundDeadlineBoundary(int daysAgo, boolean expectSuccess) {
        Order order = createPaidOrder(2);
        // 7일 경계는 30초 여유를 두어 타이밍 오차 방지
        LocalDateTime deliveredAt = daysAgo == 7
            ? LocalDateTime.now().minusDays(7).plusSeconds(30)
            : LocalDateTime.now().minusDays(daysAgo);
        setDelivered(order, deliveredAt);

        Long orderItemId = order.getItems().get(0).getOrderItemId();
        if (expectSuccess) {
            Refund refund = refundService.requestRefund(EMAIL, order.getOrderId(),
                List.of(orderItemId), List.of(1), "기한 테스트");
            assertThat(refund).isNotNull();
        } else {
            assertThatThrownBy(() ->
                refundService.requestRefund(EMAIL, order.getOrderId(),
                    List.of(orderItemId), List.of(1), "기한 초과")
            ).isInstanceOf(IllegalStateException.class);
        }
    }

    // TC-B10: 환불 금액 = 확정가격 × 환불 수량
    @Test
    void TC_B10_refundAmount_confirmedPrice_times_quantity() {
        product.setCurrentPrice(1000);
        productRepository.save(product);

        cartService.addItem(EMAIL, product.getProductId(), 5);
        List<Long> ids = cartService.getCartItemIds(EMAIL);
        Order order = orderService.createOrder(EMAIL, ids, "서울", "010-0000-0000").order();
        orderService.confirmPayment(EMAIL, order.getOrderId(), true);
        Order saved = orderRepository.findById(order.getOrderId()).orElseThrow();
        setDelivered(saved, LocalDateTime.now().minusDays(1));

        Long orderItemId = saved.getItems().get(0).getOrderItemId();
        Refund refund = refundService.requestRefund(EMAIL, saved.getOrderId(),
            List.of(orderItemId), List.of(2), "환불 금액 테스트");

        assertThat(refund.getRefundAmount()).isEqualTo(1000 * 2); // TC-B10
    }

    // TC-F07: 전체 취소 — 장바구니→주문→취소 전체 흐름
    @Test
    void TC_F07_fullCancelFlow() {
        Order order = createPaidOrder(3);
        int stockBefore = productRepository.findById(product.getProductId()).orElseThrow().getStock(); // 17

        orderService.cancelOrder(EMAIL, order.getOrderId());

        Order cancelled = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertThat(cancelled.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(cancelled.getTotalAmount()).isEqualTo(0);
        assertThat(productRepository.findById(product.getProductId()).orElseThrow().getStock())
            .isEqualTo(stockBefore + 3);
    }

    // TC-F08: 부분 환불 요청 흐름
    @Test
    void TC_F08_fullRefundRequestFlow() {
        Order order = createPaidOrder(3);
        setDelivered(order, LocalDateTime.now().minusDays(2));

        Long orderItemId = order.getItems().get(0).getOrderItemId();
        Refund refund = refundService.requestRefund(EMAIL, order.getOrderId(),
            List.of(orderItemId), List.of(2), "일부 불만족");

        assertThat(refund.getStatus().name()).isEqualTo("PENDING");
        assertThat(orderRepository.findById(order.getOrderId()).orElseThrow().getStatus())
            .isEqualTo(OrderStatus.REFUND_REQUESTED);
    }

    // TC-F09: 환불 승인 흐름
    @Test
    void TC_F09_adminApproveRefundFlow() {
        Order order = createPaidOrder(4);
        setDelivered(order, LocalDateTime.now().minusDays(1));

        Long orderItemId = order.getItems().get(0).getOrderItemId();
        Refund refund = refundService.requestRefund(EMAIL, order.getOrderId(),
            List.of(orderItemId), List.of(2), "환불 승인 테스트");

        int originalTotal = orderRepository.findById(order.getOrderId()).orElseThrow().getTotalAmount();
        int expectedRefundAmount = 10000 * 2;

        refundService.approveRefund(refund.getRefundId());

        Order approved = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertThat(approved.getStatus()).isEqualTo(OrderStatus.PARTIALLY_REFUNDED);
        // SRS 6.1: 부분환불 금액 = 원래 금액 - 환불 금액
        assertThat(approved.getTotalAmount()).isEqualTo(originalTotal - expectedRefundAmount);
    }

    // HTTP: 취소 요청 → 리다이렉트
    @Test
    void cancelOrder_http_redirectsToDetail() throws Exception {
        Order order = createPaidOrder(1);

        mockMvc.perform(post("/orders/{id}/cancel", order.getOrderId())
                .with(user(EMAIL).roles("CUSTOMER"))
                .with(csrf()))
            .andExpect(status().is3xxRedirection())
            .andExpect(redirectedUrl("/orders/" + order.getOrderId()));
    }

    // HTTP: 관리자 환불 목록 접근
    @Test
    void adminRefundList_admin_showsRefunds() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/admin/refunds")
                .with(user("admin@shop.com").roles("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .view().name("admin/refunds"));
    }
}
