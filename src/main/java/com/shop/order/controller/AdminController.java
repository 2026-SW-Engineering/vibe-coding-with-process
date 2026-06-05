package com.shop.order.controller;

import com.shop.order.service.OrderService;
import com.shop.order.service.ProductService;
import com.shop.order.service.RefundService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final OrderService orderService;
    private final RefundService refundService;
    private final ProductService productService;

    @GetMapping("/orders")
    public String allOrders(Model model) {
        model.addAttribute("orders", orderService.findAllOrders());
        return "admin/orders";
    }

    @GetMapping("/refunds")
    public String pendingRefunds(Model model) {
        model.addAttribute("refunds", refundService.findPendingRefunds());
        return "admin/refunds";
    }

    @PostMapping("/refunds/{refundId}/approve")
    public String approveRefund(@PathVariable Long refundId, RedirectAttributes ra) {
        try {
            refundService.approveRefund(refundId);
            ra.addFlashAttribute("message", "환불이 승인되었습니다.");
        } catch (IllegalStateException e) {
            ra.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/refunds";
    }

    @PostMapping("/refunds/{refundId}/reject")
    public String rejectRefund(@PathVariable Long refundId, RedirectAttributes ra) {
        try {
            refundService.rejectRefund(refundId);
            ra.addFlashAttribute("message", "환불이 거부되었습니다.");
        } catch (IllegalStateException e) {
            ra.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/refunds";
    }

    // TC-F11: 주문 출고 (PAID → PREPARING)
    @PostMapping("/orders/{orderId}/ship")
    public String shipOrder(@PathVariable Long orderId, RedirectAttributes ra) {
        try {
            orderService.shipOrder(orderId);
            ra.addFlashAttribute("message", "출고 처리되었습니다.");
        } catch (IllegalStateException e) {
            ra.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/orders";
    }

    // TC-F12: 배송 진행 통지 (PREPARING → SHIPPING)
    @PostMapping("/orders/{orderId}/shipping")
    public String markShipping(@PathVariable Long orderId, RedirectAttributes ra) {
        try {
            orderService.markShipping(orderId);
            ra.addFlashAttribute("message", "배송 진행으로 변경되었습니다.");
        } catch (IllegalStateException e) {
            ra.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/orders";
    }

    // 배송 완료 통지 (SHIPPING → DELIVERED)
    @PostMapping("/orders/{orderId}/delivered")
    public String markDelivered(@PathVariable Long orderId, RedirectAttributes ra) {
        try {
            orderService.markDelivered(orderId);
            ra.addFlashAttribute("message", "배송완료 처리되었습니다.");
        } catch (IllegalStateException e) {
            ra.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/orders";
    }

    // TC-F10: 상품 가격 관리
    @GetMapping("/products")
    public String productList(Model model) {
        model.addAttribute("products", productService.findAll());
        return "admin/products";
    }

    @PostMapping("/products/{productId}/price")
    public String updatePrice(@PathVariable Long productId,
                              @RequestParam int newPrice,
                              RedirectAttributes ra) {
        try {
            productService.updatePrice(productId, newPrice);
            ra.addFlashAttribute("message", "가격이 변경되었습니다.");
        } catch (IllegalArgumentException e) {
            ra.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/products";
    }
}
