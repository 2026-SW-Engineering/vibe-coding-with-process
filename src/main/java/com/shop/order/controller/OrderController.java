package com.shop.order.controller;

import com.shop.order.domain.enums.OrderStatus;
import com.shop.order.exception.InsufficientStockException;
import com.shop.order.service.OrderService;
import com.shop.order.service.RefundService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.time.LocalDateTime;
import java.util.List;

@Controller
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final RefundService refundService;

    // 장바구니 → 주문 생성 (Step 1)
    @PostMapping
    public String createOrder(@AuthenticationPrincipal UserDetails user,
                              @RequestParam List<Long> selectedItemIds,
                              @RequestParam String address,
                              @RequestParam String phone,
                              RedirectAttributes ra) {
        try {
            OrderService.OrderResult result = orderService.createOrder(
                user.getUsername(), selectedItemIds, address, phone);

            if (!result.excludedItems().isEmpty()) {
                ra.addFlashAttribute("warning",
                    "품절로 제외된 상품: " + String.join(", ", result.excludedItems()));
            }
            return "redirect:/orders/" + result.order().getOrderId() + "/payment";

        } catch (InsufficientStockException e) {
            ra.addFlashAttribute("error", e.getMessage());
            return "redirect:/cart";
        } catch (IllegalArgumentException | IllegalStateException e) {
            ra.addFlashAttribute("error", e.getMessage());
            return "redirect:/cart";
        }
    }

    // Mock 결제 페이지 (Step 2)
    @GetMapping("/{orderId}/payment")
    public String paymentPage(@AuthenticationPrincipal UserDetails user,
                              @PathVariable Long orderId,
                              Model model) {
        model.addAttribute("order", orderService.findMyOrder(user.getUsername(), orderId));
        return "orders/payment";
    }

    // 결제 확인 (Step 3)
    @PostMapping("/{orderId}/payment")
    public String confirmPayment(@AuthenticationPrincipal UserDetails user,
                                 @PathVariable Long orderId,
                                 @RequestParam boolean success,
                                 RedirectAttributes ra) {
        orderService.confirmPayment(user.getUsername(), orderId, success);
        if (success) {
            ra.addFlashAttribute("message", "결제가 완료되었습니다.");
        } else {
            ra.addFlashAttribute("error", "결제에 실패했습니다. 재고가 복원되었습니다.");
        }
        return "redirect:/orders/" + orderId;
    }

    // 내 주문 목록
    @GetMapping
    public String myOrders(@AuthenticationPrincipal UserDetails user, Model model) {
        model.addAttribute("orders", orderService.findMyOrders(user.getUsername()));
        return "orders/list";
    }

    // 주문 취소 (PAID or PREPARING)
    @PostMapping("/{orderId}/cancel")
    public String cancelOrder(@AuthenticationPrincipal UserDetails user,
                              @PathVariable Long orderId,
                              RedirectAttributes ra) {
        try {
            orderService.cancelOrder(user.getUsername(), orderId);
            ra.addFlashAttribute("message", "주문이 취소되었습니다. 재고가 복원되었습니다.");
        } catch (IllegalStateException | AccessDeniedException e) {
            ra.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/orders/" + orderId;
    }

    // 부분 환불 요청 (DELIVERED, 7일 이내)
    @PostMapping("/{orderId}/refund")
    public String requestRefund(@AuthenticationPrincipal UserDetails user,
                                @PathVariable Long orderId,
                                @RequestParam List<Long> orderItemIds,
                                @RequestParam List<Integer> quantities,
                                @RequestParam(required = false) String reason,
                                RedirectAttributes ra) {
        try {
            refundService.requestRefund(user.getUsername(), orderId, orderItemIds, quantities, reason);
            ra.addFlashAttribute("message", "환불 요청이 접수되었습니다. 관리자 승인을 대기합니다.");
        } catch (IllegalStateException | IllegalArgumentException | AccessDeniedException e) {
            ra.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/orders/" + orderId;
    }

    // 주문 상세
    @GetMapping("/{orderId}")
    public String orderDetail(@AuthenticationPrincipal UserDetails user,
                              @PathVariable Long orderId,
                              Model model) {
        var order = orderService.findMyOrder(user.getUsername(), orderId);
        model.addAttribute("order", order);
        boolean canRefund = order.getStatus() == OrderStatus.DELIVERED
            && order.getDeliveredAt() != null
            && !order.getDeliveredAt().plusDays(7).isBefore(LocalDateTime.now());
        model.addAttribute("canRefund", canRefund);
        return "orders/detail";
    }
}
