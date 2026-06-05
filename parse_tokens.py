#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
============================================================
 Claude Code 토큰 사용량 집계 스크립트
============================================================

  Claude Code로 작업한 대화 기록(자동저장, jsonl)을 읽어서,
  "내가 보낸 프롬프트별로 토큰을 얼마나 썼는지"를 CSV 표로 만들어준다.

  - Claude Code 작업 기록 ~/.claude/projects/ 에 자동저장됨

[사용법] 터미널에서:

  1) 내 프로젝트 목록 먼저 보기:
        python3 parse_tokens.py --list

  2) 특정 프로젝트 폴더 분석:
        python3 parse_tokens.py "/Users/본인이름/.claude/projects/-Users-..."

  3) 세션 파일 하나만 분석:
        python3 parse_tokens.py "/Users/.../어떤세션.jsonl"

  -> 끝나면 token_usage.csv 파일이 생성됨

[CSV 컬럼 설명]
  - turn           : 몇 번째 프롬프트(수정 요청)인지
  - prompt_preview : 그 프롬프트 내용 앞부분
  - input          : 새로 들어간 입력 토큰
  - output         : 모델이 생성한 출력 토큰
  - cache_creation : 캐시에 새로 저장한 토큰
  - cache_read     : 캐시에서 읽은 토큰
  - total          : 위 4종 합계  <- 보통 이 값으로 비교하면 됩니다
============================================================
"""

import json
import sys
import csv
import glob
import os


def extract_text(content):
    """user content에서 사람이 친 텍스트만 추출. 없으면 None(=시스템 메시지)."""
    if isinstance(content, str):
        return content.strip() or None
    if isinstance(content, list):
        texts = [b.get("text", "") for b in content
                 if isinstance(b, dict) and b.get("type") == "text"]
        joined = " ".join(t for t in texts if t).strip()
        return joined or None
    return None


def sum_usage(u):
    """usage dict -> 4종 토큰 평탄화."""
    return {
        "input": u.get("input_tokens", 0),
        "output": u.get("output_tokens", 0),
        "cache_creation": u.get("cache_creation_input_tokens", 0),
        "cache_read": u.get("cache_read_input_tokens", 0),
    }


def parse_session(path):
    """세션 1개 -> 턴 리스트. 사람 프롬프트 단위로 토큰 합산."""
    turns = []
    cur = None

    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue

            if "message" not in rec:   # ai-title 등 메타 레코드 스킵
                continue

            m = rec["message"]
            role = m.get("role")

            if role == "user":
                text = extract_text(m.get("content"))
                if text is not None:           # 진짜 사람 프롬프트 = 새 턴 시작
                    if cur is not None:
                        turns.append(cur)
                    cur = {
                        "prompt": text,
                        "ts": rec.get("timestamp", ""),
                        "input": 0, "output": 0,
                        "cache_creation": 0, "cache_read": 0,
                        "assistant_msgs": 0,
                    }
                # tool_result만 있는 user 메시지는 현재 턴에 흡수(무시)

            elif role == "assistant":
                if cur is None:
                    cur = {"prompt": "(no preceding user prompt)",
                           "ts": rec.get("timestamp", ""),
                           "input": 0, "output": 0,
                           "cache_creation": 0, "cache_read": 0,
                           "assistant_msgs": 0}
                u = m.get("usage")
                if u:
                    s = sum_usage(u)
                    for k in ("input", "output", "cache_creation", "cache_read"):
                        cur[k] += s[k]
                    cur["assistant_msgs"] += 1

    if cur is not None:
        turns.append(cur)
    return turns


def list_projects():
    base = os.path.expanduser("~/.claude/projects")
    if not os.path.isdir(base):
        print("기록 폴더가 없습니다:", base)
        print("Claude Code로 작업한 적이 있는지 확인하세요.")
        return
    dirs = sorted(glob.glob(os.path.join(base, "*")))
    if not dirs:
        print("프로젝트 기록이 없습니다.")
        return
    print("\n=== 내 Claude Code 프로젝트 목록 ===\n")
    for d in dirs:
        n = len(glob.glob(os.path.join(d, "*.jsonl")))
        print(f"  세션 {n:>3}개  |  {d}")
    print("\n위 경로 하나를 골라 아래처럼 실행하세요:")
    print('  python3 parse_tokens.py "위_경로_붙여넣기"\n')


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)

    if sys.argv[1] == "--list":
        list_projects()
        sys.exit(0)

    target = sys.argv[1]
    if os.path.isdir(target):
        files = sorted(glob.glob(os.path.join(target, "*.jsonl")))
    else:
        files = [target]

    if not files:
        print("JSONL 파일을 찾지 못했습니다:", target)
        print("경로가 맞는지 확인하거나, 먼저 'python3 parse_tokens.py --list' 로 목록을 보세요.")
        sys.exit(1)

    all_rows = []
    grand = {"input": 0, "output": 0, "cache_creation": 0, "cache_read": 0}

    for path in files:
        if not os.path.exists(path):
            print("파일 없음, 건너뜀:", path)
            continue
        session = os.path.basename(path).replace(".jsonl", "")
        for i, t in enumerate(parse_session(path), 1):
            total = t["input"] + t["output"] + t["cache_creation"] + t["cache_read"]
            all_rows.append({
                "session": session,
                "turn": i,
                "timestamp": t["ts"],
                "prompt_preview": t["prompt"][:80].replace("\n", " "),
                "assistant_msgs": t["assistant_msgs"],
                "input": t["input"],
                "output": t["output"],
                "cache_creation": t["cache_creation"],
                "cache_read": t["cache_read"],
                "total": total,
            })
            for k in grand:
                grand[k] += t[k]

    if not all_rows:
        print("분석할 메시지가 없습니다.")
        sys.exit(1)

    # 콘솔 요약
    print(f"\n{'turn':>4} {'in':>7} {'out':>7} {'c.create':>9} {'c.read':>8} {'total':>8}  prompt")
    print("-" * 90)
    for r in all_rows:
        print(f"{r['turn']:>4} {r['input']:>7} {r['output']:>7} "
              f"{r['cache_creation']:>9} {r['cache_read']:>8} {r['total']:>8}  "
              f"{r['prompt_preview']}")

    grand_total = sum(grand.values())
    print("\n=== 세션 합계 ===")
    for k, v in grand.items():
        print(f"  {k:>16}: {v:,}")
    print(f"  {'총 토큰(total)':>16}: {grand_total:,}")
    print(f"  {'사람 프롬프트 수':>16}: {len(all_rows)}")

    out = "token_usage.csv"
    with open(out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(all_rows[0].keys()))
        w.writeheader()
        w.writerows(all_rows)
    print(f"\n저장 완료: {out}  (엑셀에서 열어 비교하세요)")


if __name__ == "__main__":
    main()