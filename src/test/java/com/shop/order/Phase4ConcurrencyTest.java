package com.shop.order;

import com.shop.order.domain.Product;
import com.shop.order.exception.InsufficientStockException;
import com.shop.order.repository.CartRepository;
import com.shop.order.repository.ProductRepository;
import com.shop.order.repository.UserRepository;
import com.shop.order.service.CartService;
import com.shop.order.service.OrderService;
import com.shop.order.service.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class Phase4ConcurrencyTest {

    @Autowired UserService userService;
    @Autowired CartService cartService;
    @Autowired OrderService orderService;
    @Autowired ProductRepository productRepository;
    @Autowired UserRepository userRepository;
    @Autowired CartRepository cartRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    private Product testProduct;

    @BeforeEach
    void setUp() {
        // 테스트용 상품 재고 설정 (DataInitializer가 넣은 첫 번째 상품 사용)
        testProduct = productRepository.findAll().get(0);
    }

    @AfterEach
    void tearDown() {
        // 생성한 테스트 데이터 정리 (동시성 테스트는 @Transactional 미사용)
        jdbcTemplate.execute("DELETE FROM payments WHERE order_id IN (SELECT order_id FROM orders WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'concurrent%@test.com'))");
        jdbcTemplate.execute("DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'concurrent%@test.com'))");
        jdbcTemplate.execute("DELETE FROM orders WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'concurrent%@test.com')");
        jdbcTemplate.execute("DELETE FROM cart_items WHERE cart_id IN (SELECT cart_id FROM carts WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'concurrent%@test.com'))");
        jdbcTemplate.execute("DELETE FROM carts WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'concurrent%@test.com')");
        jdbcTemplate.execute("DELETE FROM users WHERE email LIKE 'concurrent%@test.com'");
    }

    // TC-C01: 재고 1개, 두 회원이 동시 주문 → 정확히 1건 성공, 1건 실패, 재고 0
    @Test
    void TC_C01_twoUsers_oneStock_exactlyOneSucceeds() throws InterruptedException {
        testProduct.setStock(1);
        productRepository.save(testProduct);

        String email1 = "concurrent1@test.com";
        String email2 = "concurrent2@test.com";
        userService.register(email1, "password123", "동시1");
        userService.register(email2, "password123", "동시2");
        cartService.addItem(email1, testProduct.getProductId(), 1);
        cartService.addItem(email2, testProduct.getProductId(), 1);
        List<Long> ids1 = cartService.getCartItemIds(email1);
        List<Long> ids2 = cartService.getCartItemIds(email2);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(2);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        executor.submit(() -> {
            try {
                startLatch.await();
                orderService.createOrder(email1, ids1, "주소1", "010-1111-1111");
                successCount.incrementAndGet();
            } catch (InsufficientStockException | IllegalStateException e) {
                failCount.incrementAndGet();
            } catch (Exception e) {
                failCount.incrementAndGet();
            } finally {
                doneLatch.countDown();
            }
        });

        executor.submit(() -> {
            try {
                startLatch.await();
                orderService.createOrder(email2, ids2, "주소2", "010-2222-2222");
                successCount.incrementAndGet();
            } catch (InsufficientStockException | IllegalStateException e) {
                failCount.incrementAndGet();
            } catch (Exception e) {
                failCount.incrementAndGet();
            } finally {
                doneLatch.countDown();
            }
        });

        startLatch.countDown();
        doneLatch.await();
        executor.shutdown();

        assertThat(successCount.get()).isEqualTo(1);
        assertThat(failCount.get()).isEqualTo(1);

        Product after = productRepository.findById(testProduct.getProductId()).orElseThrow();
        assertThat(after.getStock()).isEqualTo(0);
    }

    // TC-C02: 재고 N개, N+1건 동시 주문 → 정확히 N건 성공, 초과 1건 실패
    @Test
    void TC_C02_nPlusOneOrders_exactlyNSucceed() throws InterruptedException {
        int N = 3;
        testProduct.setStock(N);
        productRepository.save(testProduct);

        String[] emails = new String[N + 1];
        List<Long>[] cartIds = new List[N + 1];
        for (int i = 0; i < N + 1; i++) {
            emails[i] = "concurrent_n" + i + "@test.com";
            userService.register(emails[i], "password123", "동시" + i);
            cartService.addItem(emails[i], testProduct.getProductId(), 1);
            cartIds[i] = cartService.getCartItemIds(emails[i]);
        }

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(N + 1);
        ExecutorService executor = Executors.newFixedThreadPool(N + 1);

        for (int i = 0; i < N + 1; i++) {
            final String email = emails[i];
            final List<Long> ids = cartIds[i];
            executor.submit(() -> {
                try {
                    startLatch.await();
                    orderService.createOrder(email, ids, "주소", "010-0000-0000");
                    successCount.incrementAndGet();
                } catch (InsufficientStockException | IllegalStateException e) {
                    failCount.incrementAndGet();
                } catch (Exception e) {
                    failCount.incrementAndGet();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        doneLatch.await();
        executor.shutdown();

        assertThat(successCount.get()).isEqualTo(N);
        assertThat(failCount.get()).isEqualTo(1);
    }

    // TC-C03: 동시 주문 후 재고 < 0 발생하지 않음 (초과 판매 없음)
    @Test
    void TC_C03_noNegativeStock_afterConcurrentOrders() throws InterruptedException {
        int stock = 2;
        int threads = 5;
        testProduct.setStock(stock);
        productRepository.save(testProduct);

        String[] emails = new String[threads];
        List<Long>[] cartIds = new List[threads];
        for (int i = 0; i < threads; i++) {
            emails[i] = "concurrent_s" + i + "@test.com";
            userService.register(emails[i], "password123", "동시s" + i);
            cartService.addItem(emails[i], testProduct.getProductId(), 1);
            cartIds[i] = cartService.getCartItemIds(emails[i]);
        }

        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threads);
        ExecutorService executor = Executors.newFixedThreadPool(threads);

        for (int i = 0; i < threads; i++) {
            final String email = emails[i];
            final List<Long> ids = cartIds[i];
            executor.submit(() -> {
                try {
                    startLatch.await();
                    orderService.createOrder(email, ids, "주소", "010-0000-0000");
                } catch (Exception ignored) {
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        doneLatch.await();
        executor.shutdown();

        Product after = productRepository.findById(testProduct.getProductId()).orElseThrow();
        assertThat(after.getStock()).isGreaterThanOrEqualTo(0);
    }
}
