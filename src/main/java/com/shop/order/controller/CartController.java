package com.shop.order.controller;

import com.shop.order.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public String view(@AuthenticationPrincipal UserDetails user, Model model) {
        model.addAttribute("cart", cartService.getCartWithItems(user.getUsername()));
        return "cart/view";
    }

    @PostMapping("/items")
    public String addItem(@AuthenticationPrincipal UserDetails user,
                          @RequestParam Long productId,
                          @RequestParam int quantity,
                          RedirectAttributes ra) {
        cartService.addItem(user.getUsername(), productId, quantity);
        ra.addFlashAttribute("message", "장바구니에 담았습니다.");
        return "redirect:/cart";
    }

    @PostMapping("/items/{cartItemId}/quantity")
    public String updateQuantity(@AuthenticationPrincipal UserDetails user,
                                 @PathVariable Long cartItemId,
                                 @RequestParam int quantity,
                                 RedirectAttributes ra) {
        cartService.updateQuantity(user.getUsername(), cartItemId, quantity);
        ra.addFlashAttribute("message", "수량을 변경했습니다.");
        return "redirect:/cart";
    }

    @PostMapping("/items/{cartItemId}/delete")
    public String removeItem(@AuthenticationPrincipal UserDetails user,
                             @PathVariable Long cartItemId,
                             RedirectAttributes ra) {
        cartService.removeItem(user.getUsername(), cartItemId);
        ra.addFlashAttribute("message", "항목을 삭제했습니다.");
        return "redirect:/cart";
    }
}
