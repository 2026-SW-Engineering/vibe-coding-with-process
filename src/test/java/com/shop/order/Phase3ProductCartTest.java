package com.shop.order;

import com.shop.order.domain.Cart;
import com.shop.order.domain.CartItem;
import com.shop.order.domain.Product;
import com.shop.order.repository.ProductRepository;
import com.shop.order.service.CartService;
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
class Phase3ProductCartTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserService userService;
    @Autowired CartService cartService;
    @Autowired ProductRepository productRepository;

    private Product testProduct;

    @BeforeEach
    void setUp() {
        userService.register("cartuser@test.com", "password123", "카트유저");
        testProduct = productRepository.findAll().get(0);
    }

    // TC-F03: 비회원이 상품 목록 조회 → 상품명·가격 표시 (재고 미표시)
    @Test
    void TC_F03_productList_anonymous_showsNameAndPrice() throws Exception {
        mockMvc.perform(get("/products"))
            .andExpect(status().isOk())
            .andExpect(view().name("product/list"))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("노트북")))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("원")))
            // 재고 수량 노출 없음
            .andExpect(content().string(org.hamcrest.Matchers.not(
                org.hamcrest.Matchers.containsString("stock"))));
    }

    // TC-F03: 상품 목록 페이지는 로그인 없이 접근 가능
    @Test
    void TC_F03_productList_accessible_without_login() throws Exception {
        mockMvc.perform(get("/products"))
            .andExpect(status().isOk());
    }

    // TC-F04: 장바구니에 상품 담기
    @Test
    void TC_F04_addToCart_success() {
        cartService.addItem("cartuser@test.com", testProduct.getProductId(), 2);

        Cart cart = cartService.getCart("cartuser@test.com");
        assertThat(cart.getItems()).hasSize(1);
        assertThat(cart.getItems().get(0).getQuantity()).isEqualTo(2);
        assertThat(cart.getItems().get(0).getProduct().getProductId())
            .isEqualTo(testProduct.getProductId());
    }

    // TC-F04: 같은 상품을 다시 담으면 수량 합산
    @Test
    void TC_F04_addSameProduct_quantityMerged() {
        cartService.addItem("cartuser@test.com", testProduct.getProductId(), 2);
        cartService.addItem("cartuser@test.com", testProduct.getProductId(), 3);

        Cart cart = cartService.getCart("cartuser@test.com");
        assertThat(cart.getItems()).hasSize(1);
        assertThat(cart.getItems().get(0).getQuantity()).isEqualTo(5);
    }

    // TC-F04: 장바구니 수량 변경
    @Test
    void TC_F04_updateCartItemQuantity() {
        cartService.addItem("cartuser@test.com", testProduct.getProductId(), 2);
        Cart cart = cartService.getCart("cartuser@test.com");
        Long itemId = cart.getItems().get(0).getCartItemId();

        cartService.updateQuantity("cartuser@test.com", itemId, 5);

        Cart updated = cartService.getCart("cartuser@test.com");
        assertThat(updated.getItems().get(0).getQuantity()).isEqualTo(5);
    }

    // TC-F04: 장바구니 항목 삭제
    @Test
    void TC_F04_removeCartItem() {
        cartService.addItem("cartuser@test.com", testProduct.getProductId(), 2);
        Cart cart = cartService.getCart("cartuser@test.com");
        Long itemId = cart.getItems().get(0).getCartItemId();

        cartService.removeItem("cartuser@test.com", itemId);

        Cart updated = cartService.getCart("cartuser@test.com");
        assertThat(updated.getItems()).isEmpty();
    }

    // 장바구니 표시 가격은 상품의 현재 가격 (가격 변경 시 반영)
    @Test
    void TC_F04_cartDisplaysCurrentPrice() {
        cartService.addItem("cartuser@test.com", testProduct.getProductId(), 1);
        int originalPrice = testProduct.getCurrentPrice();

        // 가격 변경
        testProduct.setCurrentPrice(originalPrice + 10000);
        productRepository.save(testProduct);

        Cart cart = cartService.getCart("cartuser@test.com");
        // CartItem은 product를 참조하므로 현재 가격 = product.currentPrice
        CartItem item = cart.getItems().get(0);
        assertThat(item.getProduct().getCurrentPrice()).isEqualTo(originalPrice + 10000);
    }

    // 수량 0 이하 → 거부
    @Test
    void addToCart_zeroQuantity_rejected() {
        assertThatThrownBy(() ->
            cartService.addItem("cartuser@test.com", testProduct.getProductId(), 0)
        ).isInstanceOf(IllegalArgumentException.class);
    }

    // 수량 음수 → 거부
    @Test
    void addToCart_negativeQuantity_rejected() {
        assertThatThrownBy(() ->
            cartService.addItem("cartuser@test.com", testProduct.getProductId(), -1)
        ).isInstanceOf(IllegalArgumentException.class);
    }

    // HTTP: 장바구니 뷰 — 로그인한 사용자
    @Test
    void cartView_authenticatedUser_showsCart() throws Exception {
        mockMvc.perform(get("/cart").with(user("cartuser@test.com").roles("CUSTOMER")))
            .andExpect(status().isOk())
            .andExpect(view().name("cart/view"));
    }

    // HTTP: 장바구니 담기 → POST 성공 후 리다이렉트
    @Test
    void addToCart_post_redirectsToCart() throws Exception {
        mockMvc.perform(post("/cart/items")
                .param("productId", testProduct.getProductId().toString())
                .param("quantity", "2")
                .with(user("cartuser@test.com").roles("CUSTOMER"))
                .with(csrf()))
            .andExpect(status().is3xxRedirection())
            .andExpect(redirectedUrl("/cart"));
    }

    // HTTP: 다른 사람의 카트 항목 삭제 시도 → 예외
    @Test
    void removeCartItem_otherUserItem_rejected() {
        userService.register("other@test.com", "password123", "타인");
        cartService.addItem("cartuser@test.com", testProduct.getProductId(), 1);
        Cart cart = cartService.getCart("cartuser@test.com");
        Long itemId = cart.getItems().get(0).getCartItemId();

        assertThatThrownBy(() ->
            cartService.removeItem("other@test.com", itemId)
        ).isInstanceOf(IllegalArgumentException.class);
    }
}
