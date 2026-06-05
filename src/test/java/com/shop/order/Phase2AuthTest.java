package com.shop.order;

import com.shop.order.domain.User;
import com.shop.order.domain.enums.UserRole;
import com.shop.order.repository.CartRepository;
import com.shop.order.repository.UserRepository;
import com.shop.order.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestBuilders.formLogin;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestBuilders.logout;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.authenticated;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.unauthenticated;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class Phase2AuthTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserService userService;
    @Autowired UserRepository userRepository;
    @Autowired CartRepository cartRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        // 각 테스트마다 테스트 전용 계정 생성 (admin은 DataInitializer가 이미 생성)
    }

    // TC-F01: 유효한 이메일/비밀번호로 가입 → 일반 사용자 계정 생성
    @Test
    void TC_F01_register_validInput_createsCustomerAccount() {
        userService.register("newuser@test.com", "password123", "홍길동");

        User saved = userRepository.findByEmail("newuser@test.com").orElseThrow();
        assertThat(saved.getRole()).isEqualTo(UserRole.CUSTOMER);
        assertThat(saved.getName()).isEqualTo("홍길동");
    }

    // TC-P04: 회원가입 후 저장된 비밀번호는 평문이 아닌 해시
    @Test
    void TC_P04_register_passwordStoredAsHash() {
        userService.register("hash@test.com", "password123", "테스트");

        User saved = userRepository.findByEmail("hash@test.com").orElseThrow();
        assertThat(saved.getPasswordHash()).isNotEqualTo("password123");
        assertThat(passwordEncoder.matches("password123", saved.getPasswordHash())).isTrue();
    }

    // TC-P05: 이메일 중복 회원가입 → 거부
    @Test
    void TC_P05_register_duplicateEmail_rejected() {
        userService.register("dup@test.com", "password123", "첫번째");

        assertThatThrownBy(() ->
            userService.register("dup@test.com", "password456", "두번째")
        ).isInstanceOf(IllegalArgumentException.class)
         .hasMessageContaining("이미 사용 중인 이메일");
    }

    // 회원가입 시 장바구니 자동 생성 (회원 1명 = 카트 1개)
    @Test
    void register_customerGetsCartCreated() {
        userService.register("cart@test.com", "password123", "카트유저");

        User saved = userRepository.findByEmail("cart@test.com").orElseThrow();
        assertThat(cartRepository.findByUser(saved)).isPresent();
    }

    // TC-F02: 로그인 성공 → 세션 시작
    @Test
    void TC_F02_login_validCredentials_authenticated() throws Exception {
        userService.register("login@test.com", "password123", "로그인유저");

        mockMvc.perform(formLogin("/auth/login")
                .user("username", "login@test.com")
                .password("password", "password123"))
            .andExpect(authenticated().withUsername("login@test.com"));
    }

    // TC-F02: 로그아웃 → 세션 종료
    @Test
    void TC_F02_logout_terminatesSession() throws Exception {
        mockMvc.perform(logout("/auth/logout"))
            .andExpect(unauthenticated());
    }

    // 잘못된 자격증명 로그인 → 실패
    @Test
    void login_wrongPassword_fails() throws Exception {
        userService.register("wrong@test.com", "password123", "유저");

        mockMvc.perform(formLogin("/auth/login")
                .user("username", "wrong@test.com")
                .password("password", "wrongpassword"))
            .andExpect(unauthenticated());
    }

    // TC-P03: 비회원이 장바구니 접근 → 로그인 요구 (redirect to login)
    @Test
    void TC_P03_anonymous_cartAccess_redirectsToLogin() throws Exception {
        mockMvc.perform(get("/cart"))
            .andExpect(status().is3xxRedirection())
            .andExpect(redirectedUrlPattern("**/auth/login**"));
    }

    // TC-P03: 비회원이 주문 접근 → 로그인 요구
    @Test
    void TC_P03_anonymous_orderAccess_redirectsToLogin() throws Exception {
        mockMvc.perform(get("/orders"))
            .andExpect(status().is3xxRedirection())
            .andExpect(redirectedUrlPattern("**/auth/login**"));
    }

    // TC-P02: 일반 사용자가 관리자 API 접근 → 403
    @Test
    void TC_P02_customerRole_adminEndpoint_forbidden() throws Exception {
        userService.register("customer@test.com", "password123", "일반유저");

        mockMvc.perform(get("/admin/orders")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
                    .user("customer@test.com").roles("CUSTOMER")))
            .andExpect(status().isForbidden());
    }

    // 이메일 형식 오류 → 가입 거부 (컨트롤러 유효성)
    @Test
    void register_invalidEmail_rejectedByController() throws Exception {
        mockMvc.perform(post("/auth/register")
                .param("email", "not-an-email")
                .param("password", "password123")
                .param("name", "홍길동")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
            .andExpect(status().isOk())  // 폼 재표시
            .andExpect(view().name("auth/register"));
    }

    // 비밀번호 8자 미만 → 가입 거부
    @Test
    void register_shortPassword_rejectedByController() throws Exception {
        mockMvc.perform(post("/auth/register")
                .param("email", "short@test.com")
                .param("password", "1234567")
                .param("name", "홍길동")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
            .andExpect(status().isOk())
            .andExpect(view().name("auth/register"));
    }
}
