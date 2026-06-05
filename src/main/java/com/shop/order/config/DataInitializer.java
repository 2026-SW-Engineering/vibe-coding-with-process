package com.shop.order.config;

import com.shop.order.domain.Product;
import com.shop.order.domain.User;
import com.shop.order.domain.enums.UserRole;
import com.shop.order.repository.ProductRepository;
import com.shop.order.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        seedAdmin();
        seedProducts();
    }

    private void seedAdmin() {
        if (userRepository.existsByEmail("admin@shop.com")) return;
        User admin = new User();
        admin.setEmail("admin@shop.com");
        admin.setPasswordHash(passwordEncoder.encode("admin1234"));
        admin.setName("관리자");
        admin.setRole(UserRole.ADMIN);
        userRepository.save(admin);
    }

    private void seedProducts() {
        if (productRepository.count() > 0) return;
        List.of(
            product("노트북", 1_200_000, 10),
            product("마우스", 35_000, 50),
            product("키보드", 85_000, 30),
            product("모니터", 450_000, 15),
            product("헤드셋", 120_000, 20),
            product("USB 허브", 28_000, 40)
        ).forEach(productRepository::save);
    }

    private Product product(String name, int price, int stock) {
        Product p = new Product();
        p.setName(name);
        p.setCurrentPrice(price);
        p.setStock(stock);
        return p;
    }
}
