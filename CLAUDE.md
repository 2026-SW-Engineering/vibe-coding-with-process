# CLAUDE.md

## Project Context
이 프로젝트는 "쇼핑몰 주문 시스템"을 대상으로, 구현은 설계 문서를 충실히 따르는 것을 최우선으로 한다.

## Tech Stack
구현은 아래 스택을 따른다. 명세 없이 임의로 다른 스택/라이브러리를 선택하지 말 것.

- 백엔드: Spring Boot (Java)
- 뷰: Thymeleaf (서버사이드 렌더링)
- DB: PostgreSQL
- ORM/영속성: Spring Data JPA
- 테스트: JUnit, 동시성·트랜잭션 검증은 Testcontainers(PostgreSQL)로 실제 DB 위에서 수행
- 추가 의존성이 필요하면 도입 전에 먼저 제안하고 이유를 설명할 것.

## Design Documents (Source of Truth)
구현 전 반드시 아래 설계 문서를 읽고, 구현은 이 문서들과 일치해야 한다.

- 요구사항명세서:        design/srs.md
- 유스케이스 명세:        design/usecase-spec.md
- 유스케이스 다이어그램:  design/usecase-diagram.mmd
- 클래스 다이어그램:      design/class_diagram.mmd
- 상태 다이어그램:        design/state_diagram.mmd
- 시퀀스 다이어그램:      design/sequence_diagrams.mmd
- ERD:                  design/erd.mmd
- 테스트 계획서:          design/test-plan.md

## Reference Scope
- 구현 시 참조 대상은 design/ 디렉터리뿐이다.
- docs/ 디렉터리는 회의록·조사 자료이므로 구현 시 참조하지 않는다.
- process_output/ 디렉터리는 사람 제출용 사본(docx/png 등)이다. 참조·수정하지 않는다.

## Design Adherence Rules
- 명세에 정의된 예외 흐름(재고 동시성, 부분 환불, 주문 취소, 결제 실패 시 재고 원복,
  확정 가격 고정 등)을 임의로 단순화하거나 생략하지 말 것.
- 명세에 없는 동작이 필요하면 구현 전에 먼저 질문할 것. 임의로 가정해 채우지 말 것.
- 명세와 구현이 어긋나면 코드를 임의로 만들지 말고 불일치를 먼저 보고할 것.
- 각 기능의 success criteria는 design/test-plan.md의 해당 테스트 케이스 통과로 삼는다.

---

## Behavioral Guidelines
Behavioral guidelines to reduce common LLM coding mistakes.
**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---
**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.