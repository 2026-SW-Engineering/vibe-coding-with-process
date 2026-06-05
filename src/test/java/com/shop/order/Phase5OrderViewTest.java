package com.shop.order;

import com.shop.order.domain.Order;
import com.shop.order.domain.Product;
import com.shop.order.service.CartService;
import com.shop.order.service.OrderService;
import com.shop.order.service.UserService;
import com.shop.order.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class Phase5OrderViewTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserService userService;
    @Autowired CartService cartService;
    @Autowired OrderService orderService;
    @Autowired ProductRepository productRepository;

    private Product product;
    private Order paidOrder;

    @BeforeEach
    void setUp() {
        userService.register("viewer@test.com", "password123", "조회유저");
        userService.register("other@test.com", "password123", "타인");

        product = productRepository.findAll().get(0);
        product.setStock(10);
        product.setCurrentPrice(15000);
        productRepository.save(product);

        cartService.addItem("viewer@test.com", product.getProductId(), 2);
        List<Long> ids = cartService.getCart("viewer@test.com").getItems().stream()
            .map(i -> i.getCartItemId()).toList();
        Order order = orderService.createOrder("viewer@test.com", ids, "서울시 강남구", "010-9999-0000").order();
        orderService.confirmPayment("viewer@test.com", order.getOrderId(), true);
        paidOrder = orderService.findMyOrder("viewer@test.com", order.getOrderId());
    }

    // TC-F06: 주문 상세 → 항목·확정가격·총액·상태 표시
    @Test
    void TC_F06_orderDetail_showsCorrectData() throws Exception {
        mockMvc.perform(get("/orders/{id}", paidOrder.getOrderId())
                .with(user("viewer@test.com").roles("CUSTOMER")))
            .andExpect(status().isOk())
            .andExpect(view().name("orders/detail"))
            .andExpect(content().string(containsString(product.getName())))
            .andExpect(content().string(containsString("15,000")))   // 확정가격
            .andExpect(content().string(containsString("30,000")))   // 총액 (15000 * 2)
            .andExpect(content().string(containsString("PAID")));    // 상태
    }

    // TC-F06: 주문 목록에 본인 주문이 표시됨
    @Test
    void TC_F06_orderList_showsMyOrders() throws Exception {
        mockMvc.perform(get("/orders")
                .with(user("viewer@test.com").roles("CUSTOMER")))
            .andExpect(status().isOk())
            .andExpect(view().name("orders/list"))
            .andExpect(content().string(containsString("PAID")));
    }

    // TC-F06: 확정가격은 주문 시점에 고정 — 이후 가격 변경 무관
    @Test
    void TC_F06_confirmedPrice_immutableAfterPriceChange() throws Exception {
        // 가격 변경
        product.setCurrentPrice(99999);
        productRepository.save(product);

        // 주문 상세에서 확정가격(15000)이 유지되어야 함
        mockMvc.perform(get("/orders/{id}", paidOrder.getOrderId())
                .with(user("viewer@test.com").roles("CUSTOMER")))
            .andExpect(status().isOk())
            .andExpect(content().string(containsString("15,000")))
            .andExpect(content().string(containsString("30,000")));
    }

    // TC-P01: 타인의 주문 조회 → 403 (AccessDeniedException → Spring Security가 Forbidden 처리)
    @Test
    void TC_P01_otherUserOrder_accessDenied() throws Exception {
        mockMvc.perform(get("/orders/{id}", paidOrder.getOrderId())
                .with(user("other@test.com").roles("CUSTOMER")))
            .andExpect(status().isForbidden());
    }

    // TC-P02: 일반 회원이 관리자 페이지 접근 → 403
    @Test
    void TC_P02_customerAccessAdminPage_forbidden() throws Exception {
        mockMvc.perform(get("/admin/orders")
                .with(user("viewer@test.com").roles("CUSTOMER")))
            .andExpect(status().isForbidden());
    }

    // 관리자는 전체 주문 목록 조회 가능 (UC-07 기본 흐름 3)
    @Test
    void adminOrderList_adminRole_showsAllOrders() throws Exception {
        mockMvc.perform(get("/admin/orders")
                .with(user("admin@shop.com").roles("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(view().name("admin/orders"));
    }
}
