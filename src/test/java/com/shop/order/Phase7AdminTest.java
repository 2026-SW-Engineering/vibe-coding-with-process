package com.shop.order;

import com.shop.order.domain.Order;
import com.shop.order.domain.Product;
import com.shop.order.domain.enums.OrderStatus;
import com.shop.order.repository.OrderRepository;
import com.shop.order.repository.ProductRepository;
import com.shop.order.service.CartService;
import com.shop.order.service.OrderService;
import com.shop.order.service.ProductService;
import com.shop.order.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class Phase7AdminTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserService userService;
    @Autowired CartService cartService;
    @Autowired OrderService orderService;
    @Autowired ProductService productService;
    @Autowired ProductRepository productRepository;
    @Autowired OrderRepository orderRepository;

    private static final String CUSTOMER = "customer7@test.com";
    private Product product;

    @BeforeEach
    void setUp() {
        userService.register(CUSTOMER, "password123", "고객");
        product = productRepository.findAll().get(0);
        product.setStock(10);
        product.setCurrentPrice(20000);
        productRepository.save(product);
    }

    private Order createPaidOrder() {
        cartService.addItem(CUSTOMER, product.getProductId(), 2);
        List<Long> ids = cartService.getCartItemIds(CUSTOMER);
        Order order = orderService.createOrder(CUSTOMER, ids, "서울", "010-0000-0000").order();
        orderService.confirmPayment(CUSTOMER, order.getOrderId(), true);
        return orderRepository.findById(order.getOrderId()).orElseThrow();
    }

    // TC-S03: 결제완료 → 배송준비 (관리자 출고)
    @Test
    void TC_S03_paid_to_preparing() {
        Order order = createPaidOrder();
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);

        orderService.shipOrder(order.getOrderId());

        assertThat(orderRepository.findById(order.getOrderId()).orElseThrow().getStatus())
            .isEqualTo(OrderStatus.PREPARING);
    }

    // TC-S04: 배송준비 → 배송중
    @Test
    void TC_S04_preparing_to_shipping() {
        Order order = createPaidOrder();
        orderService.shipOrder(order.getOrderId());

        orderService.markShipping(order.getOrderId());

        assertThat(orderRepository.findById(order.getOrderId()).orElseThrow().getStatus())
            .isEqualTo(OrderStatus.SHIPPING);
    }

    // TC-S05: 배송중 → 배송완료 (deliveredAt 기록)
    @Test
    void TC_S05_shipping_to_delivered() {
        Order order = createPaidOrder();
        orderService.shipOrder(order.getOrderId());
        orderService.markShipping(order.getOrderId());

        orderService.markDelivered(order.getOrderId());

        Order delivered = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertThat(delivered.getStatus()).isEqualTo(OrderStatus.DELIVERED);
        assertThat(delivered.getDeliveredAt()).isNotNull();
    }

    // TC-S08: 배송완료 → 배송중 (역행 거부)
    @Test
    void TC_S08_delivered_to_shipping_rejected() {
        Order order = createPaidOrder();
        orderService.shipOrder(order.getOrderId());
        orderService.markShipping(order.getOrderId());
        orderService.markDelivered(order.getOrderId());

        assertThatThrownBy(() -> orderService.markShipping(order.getOrderId()))
            .isInstanceOf(IllegalStateException.class);
    }

    // TC-S09: 결제완료 → 배송완료 (건너뛰기 거부)
    @Test
    void TC_S09_paid_to_delivered_skip_rejected() {
        Order order = createPaidOrder();

        assertThatThrownBy(() -> orderService.markDelivered(order.getOrderId()))
            .isInstanceOf(IllegalStateException.class);
    }

    // TC-F10: 상품 가격 변경 후 기존 주문 확정가격 불변
    @Test
    void TC_F10_priceChange_doesNotAffectExistingOrder() {
        Order order = createPaidOrder();
        int confirmedPrice = order.getItems().get(0).getConfirmedPrice();
        assertThat(confirmedPrice).isEqualTo(20000);

        // 관리자가 가격을 99999원으로 변경
        productService.updatePrice(product.getProductId(), 99999);

        // 기존 주문의 확정가격은 변하지 않음
        Order reloaded = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertThat(reloaded.getItems().get(0).getConfirmedPrice()).isEqualTo(20000);
        assertThat(productRepository.findById(product.getProductId()).orElseThrow().getCurrentPrice())
            .isEqualTo(99999);
    }

    // TC-F10: 가격 변경 후 새 주문은 새 가격으로 확정
    @Test
    void TC_F10_priceChange_newOrderUsesNewPrice() {
        productService.updatePrice(product.getProductId(), 50000);

        cartService.addItem(CUSTOMER, product.getProductId(), 1);
        List<Long> ids = cartService.getCartItemIds(CUSTOMER);
        Order order = orderService.createOrder(CUSTOMER, ids, "서울", "010-0000-0000").order();

        assertThat(order.getItems().get(0).getConfirmedPrice()).isEqualTo(50000);
    }

    // TC-F11: HTTP - 관리자가 출고 처리
    @Test
    void TC_F11_admin_ship_http() throws Exception {
        Order order = createPaidOrder();

        mockMvc.perform(post("/admin/orders/{id}/ship", order.getOrderId())
                .with(user("admin@shop.com").roles("ADMIN"))
                .with(csrf()))
            .andExpect(status().is3xxRedirection())
            .andExpect(redirectedUrl("/admin/orders"));

        assertThat(orderRepository.findById(order.getOrderId()).orElseThrow().getStatus())
            .isEqualTo(OrderStatus.PREPARING);
    }

    // TC-F12: HTTP - 배송 시스템이 배송중 통지
    @Test
    void TC_F12_deliverySystem_shipping_http() throws Exception {
        Order order = createPaidOrder();
        orderService.shipOrder(order.getOrderId());

        mockMvc.perform(post("/admin/orders/{id}/shipping", order.getOrderId())
                .with(user("admin@shop.com").roles("ADMIN"))
                .with(csrf()))
            .andExpect(status().is3xxRedirection())
            .andExpect(redirectedUrl("/admin/orders"));

        assertThat(orderRepository.findById(order.getOrderId()).orElseThrow().getStatus())
            .isEqualTo(OrderStatus.SHIPPING);
    }

    // 관리자 상품 가격 페이지 접근
    @Test
    void adminProducts_showsProductList() throws Exception {
        mockMvc.perform(get("/admin/products")
                .with(user("admin@shop.com").roles("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(view().name("admin/products"));
    }

    // HTTP - 관리자 가격 변경
    @Test
    void adminPriceChange_http_updates() throws Exception {
        mockMvc.perform(post("/admin/products/{id}/price", product.getProductId())
                .param("newPrice", "35000")
                .with(user("admin@shop.com").roles("ADMIN"))
                .with(csrf()))
            .andExpect(status().is3xxRedirection())
            .andExpect(redirectedUrl("/admin/products"));

        assertThat(productRepository.findById(product.getProductId()).orElseThrow().getCurrentPrice())
            .isEqualTo(35000);
    }

    // 일반 회원이 출고 엔드포인트 호출 → 403
    @Test
    void shipOrder_customer_forbidden() throws Exception {
        Order order = createPaidOrder();

        mockMvc.perform(post("/admin/orders/{id}/ship", order.getOrderId())
                .with(user(CUSTOMER).roles("CUSTOMER"))
                .with(csrf()))
            .andExpect(status().isForbidden());
    }
}
