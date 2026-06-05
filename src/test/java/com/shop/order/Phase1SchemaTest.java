package com.shop.order;

import com.shop.order.domain.User;
import com.shop.order.domain.enums.UserRole;
import com.shop.order.repository.ProductRepository;
import com.shop.order.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phase 1 검증: Flyway 스키마 생성 + DataInitializer 시드 데이터 적재 확인.
 * application-test.properties 의 로컬 PostgreSQL(localhost:5432/shopdb_test)을 사용한다.
 */
@SpringBootTest
@ActiveProfiles("test")
class Phase1SchemaTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Test
    void adminSeedDataExists() {
        Optional<User> admin = userRepository.findByEmail("admin@shop.com");
        assertThat(admin).isPresent();
        assertThat(admin.get().getRole()).isEqualTo(UserRole.ADMIN);
    }

    @Test
    void passwordIsHashed() {
        User admin = userRepository.findByEmail("admin@shop.com").orElseThrow();
        assertThat(admin.getPasswordHash()).startsWith("$2"); // BCrypt prefix
        assertThat(admin.getPasswordHash()).isNotEqualTo("admin1234");
    }

    @Test
    void productsSeeded() {
        assertThat(productRepository.count()).isGreaterThanOrEqualTo(6);
    }

    @Test
    void allProductsHaveNonNegativeStock() {
        productRepository.findAll().forEach(p ->
            assertThat(p.getStock()).isGreaterThanOrEqualTo(0)
        );
    }

    @Test
    void schemaValidationPassedByFlyway() {
        // 앱 컨텍스트 로드 성공 = Flyway 마이그레이션 완료 + ddl-auto=validate 통과
        assertThat(userRepository).isNotNull();
        assertThat(productRepository).isNotNull();
    }
}
