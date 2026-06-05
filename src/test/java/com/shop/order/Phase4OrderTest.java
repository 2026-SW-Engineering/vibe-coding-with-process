package com.shop.order;

import com.shop.order.domain.Order;
import com.shop.order.domain.Product;
import com.shop.order.domain.enums.OrderStatus;
import com.shop.order.exception.InsufficientStockException;
import com.shop.order.repository.OrderRepository;
import com.shop.order.repository.ProductRepository;
import com.shop.order.service.CartService;
import com.shop.order.service.OrderService;
import com.shop.order.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class Phase4OrderTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserService userService;
    @Autowired CartService cartService;
    @Autowired OrderService orderService;
    @Autowired ProductRepository productRepository;
    @Autowired OrderRepository orderRepository;

    private Product productA;
    private Product productB;

    @BeforeEach
    void setUp() {
        userService.register("orderuser@test.com", "password123", "주문유저");
        userService.register("other@test.com", "password123", "타인");

        List<Product> products = productRepository.findAll();
        productA = products.get(0);
        productB = products.get(1);
    }

    private List<Long> addAndGetCartItemIds(String email, Long productId, int quantity) {
        cartService.addItem(email, productId, quantity);
        return cartService.getCart(email).getItems().stream()
            .map(i -> i.getCartItemId())
            .toList();
    }

    // TC-B01: 재고 5개, 5개 주문 → 성공, 재고 0
    @Test
    void TC_B01_orderExactStock_success() {
        productA.setStock(5);
        productRepository.save(productA);

        List<Long> ids = addAndGetCartItemIds("orderuser@test.com", productA.getProductId(), 5);
        OrderService.OrderResult result = orderService.createOrder("orderuser@test.com", ids, "서울시", "010-1234-5678");

        assertThat(result.order().getStatus()).isEqualTo(OrderStatus.PAYMENT_PENDING);
        Product updated = productRepository.findById(productA.getProductId()).orElseThrow();
        assertThat(updated.getStock()).isEqualTo(0);
    }

    // TC-B02: 재고 5개, 6개 주문 → InsufficientStockException
    @Test
    void TC_B02_orderMoreThanStock_throws() {
        productA.setStock(5);
        productRepository.save(productA);

        List<Long> ids = addAndGetCartItemIds("orderuser@test.com", productA.getProductId(), 6);
        assertThatThrownBy(() ->
            orderService.createOrder("orderuser@test.com", ids, "서울시", "010-1234-5678")
        ).isInstanceOf(InsufficientStockException.class);
    }

    // TC-B03: 재고 0개 → 품절로 제외, 다른 상품 없으면 IllegalStateException
    @Test
    void TC_B03_orderZeroStock_excluded() {
        productA.setStock(0);
        productRepository.save(productA);

        List<Long> ids = addAndGetCartItemIds("orderuser@test.com", productA.getProductId(), 1);
        assertThatThrownBy(() ->
            orderService.createOrder("orderuser@test.com", ids, "서울시", "010-1234-5678")
        ).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("품절");
    }

    // TC-B03 (3A 변형): 품절 항목은 제외하고 나머지 상품으로 주문 계속 진행
    @Test
    void TC_B03_mixedStock_excludesSoldOut() {
        productA.setStock(0);
        productB.setStock(3);
        productRepository.save(productA);
        productRepository.save(productB);

        cartService.addItem("orderuser@test.com", productA.getProductId(), 1);
        cartService.addItem("orderuser@test.com", productB.getProductId(), 2);
        List<Long> ids = cartService.getCart("orderuser@test.com").getItems().stream()
            .map(i -> i.getCartItemId()).toList();

        OrderService.OrderResult result = orderService.createOrder("orderuser@test.com", ids, "서울시", "010-1234-5678");

        assertThat(result.excludedItems()).hasSize(1);
        assertThat(result.order().getItems()).hasSize(1);
    }

    // TC-B04: 수량 0 → CartService에서 거부 (장바구니 레이어에서 검증)
    @Test
    void TC_B04_zeroQuantity_rejected() {
        assertThatThrownBy(() ->
            cartService.addItem("orderuser@test.com", productA.getProductId(), 0)
        ).isInstanceOf(IllegalArgumentException.class);
    }

    // TC-B05: 수량 음수 → CartService에서 거부
    @Test
    void TC_B05_negativeQuantity_rejected() {
        assertThatThrownBy(() ->
            cartService.addItem("orderuser@test.com", productA.getProductId(), -1)
        ).isInstanceOf(IllegalArgumentException.class);
    }

    // TC-B09: 총액 = Σ(확정가격 × 수량)
    @Test
    void TC_B09_totalAmount_correctCalculation() {
        productA.setStock(10);
        productA.setCurrentPrice(10000);
        productB.setStock(10);
        productB.setCurrentPrice(5000);
        productRepository.save(productA);
        productRepository.save(productB);

        cartService.addItem("orderuser@test.com", productA.getProductId(), 2);
        cartService.addItem("orderuser@test.com", productB.getProductId(), 3);
        List<Long> ids = cartService.getCart("orderuser@test.com").getItems().stream()
            .map(i -> i.getCartItemId()).toList();

        OrderService.OrderResult result = orderService.createOrder("orderuser@test.com", ids, "서울시", "010-1234-5678");

        int expected = 10000 * 2 + 5000 * 3;
        assertThat(result.order().getTotalAmount()).isEqualTo(expected);
    }

    // TC-S01: 결제대기 → 결제완료 (결제 성공)
    @Test
    void TC_S01_paymentPending_to_paid() {
        productA.setStock(5);
        productRepository.save(productA);

        List<Long> ids = addAndGetCartItemIds("orderuser@test.com", productA.getProductId(), 2);
        Order order = orderService.createOrder("orderuser@test.com", ids, "서울시", "010-1234-5678").order();

        orderService.confirmPayment("orderuser@test.com", order.getOrderId(), true);

        Order updated = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(OrderStatus.PAID);
    }

    // TC-S02: 결제대기 → 취소완료 (결제 실패), 재고 복원
    @Test
    void TC_S02_paymentFailed_stockRestored() {
        productA.setStock(5);
        productRepository.save(productA);

        List<Long> ids = addAndGetCartItemIds("orderuser@test.com", productA.getProductId(), 3);
        Order order = orderService.createOrder("orderuser@test.com", ids, "서울시", "010-1234-5678").order();

        // 주문 후 재고 5-3=2
        assertThat(productRepository.findById(productA.getProductId()).orElseThrow().getStock()).isEqualTo(2);

        orderService.confirmPayment("orderuser@test.com", order.getOrderId(), false);

        Order updated = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(updated.getTotalAmount()).isEqualTo(0);
        // 재고 복원: 2 + 3 = 5
        assertThat(productRepository.findById(productA.getProductId()).orElseThrow().getStock()).isEqualTo(5);
    }

    // TC-F05: 장바구니에서 주문·결제 성공 → 재고 차감, 결제완료
    @Test
    void TC_F05_fullOrderFlow_success() {
        productA.setStock(10);
        productRepository.save(productA);

        List<Long> ids = addAndGetCartItemIds("orderuser@test.com", productA.getProductId(), 2);
        Order order = orderService.createOrder("orderuser@test.com", ids, "서울시", "010-0000-0000").order();
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAYMENT_PENDING);

        orderService.confirmPayment("orderuser@test.com", order.getOrderId(), true);

        Order paid = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertThat(paid.getStatus()).isEqualTo(OrderStatus.PAID);
        assertThat(productRepository.findById(productA.getProductId()).orElseThrow().getStock()).isEqualTo(8);

        // 주문 후 장바구니에서 제거됨
        assertThat(cartService.getCart("orderuser@test.com").getItems()).isEmpty();
    }

    // TC-P01: 타인의 주문 조회 → 접근 거부
    @Test
    void TC_P01_otherUserOrder_accessDenied() {
        productA.setStock(5);
        productRepository.save(productA);

        List<Long> ids = addAndGetCartItemIds("orderuser@test.com", productA.getProductId(), 1);
        Order order = orderService.createOrder("orderuser@test.com", ids, "서울시", "010-1234-5678").order();

        assertThatThrownBy(() ->
            orderService.findMyOrder("other@test.com", order.getOrderId())
        ).isInstanceOf(AccessDeniedException.class);
    }

    // HTTP: 결제 페이지 접근
    @Test
    void paymentPage_authenticated_showsOrder() throws Exception {
        productA.setStock(5);
        productRepository.save(productA);

        List<Long> ids = addAndGetCartItemIds("orderuser@test.com", productA.getProductId(), 1);
        Order order = orderService.createOrder("orderuser@test.com", ids, "서울시", "010-1234-5678").order();

        mockMvc.perform(get("/orders/{id}/payment", order.getOrderId())
                .with(user("orderuser@test.com").roles("CUSTOMER")))
            .andExpect(status().isOk())
            .andExpect(view().name("orders/payment"));
    }

    // HTTP: 비인증 사용자가 주문 목록 접근 → 리다이렉트
    @Test
    void orderList_unauthenticated_redirectsToLogin() throws Exception {
        mockMvc.perform(get("/orders"))
            .andExpect(status().is3xxRedirection());
    }

    // HTTP: 주문 목록 조회 (인증)
    @Test
    void orderList_authenticated_showsList() throws Exception {
        mockMvc.perform(get("/orders")
                .with(user("orderuser@test.com").roles("CUSTOMER")))
            .andExpect(status().isOk())
            .andExpect(view().name("orders/list"));
    }
}
