from database import SessionLocal
import models
from auth import hash_password


def seed_db():
    db = SessionLocal()
    try:
        if db.query(models.User).count() > 0:
            return

        admin = models.User(
            email="admin@shop.com",
            name="관리자",
            password_hash=hash_password("admin123"),
            role="admin"
        )
        db.add(admin)

        user = models.User(
            email="user@shop.com",
            name="테스트 유저",
            password_hash=hash_password("user123"),
            role="user"
        )
        db.add(user)

        products = [
            {
                "name": "게이밍 노트북 Pro",
                "description": "RTX 4080 탑재, 144Hz QHD 디스플레이, 32GB RAM, 1TB NVMe SSD. 게이머를 위한 최고 사양의 노트북",
                "price": 2500000,
                "stock": 10,
                "category": "전자기기"
            },
            {
                "name": "무선 노이즈캔슬링 헤드폰",
                "description": "40시간 배터리, 액티브 노이즈 캔슬링, 프리미엄 오디오. 집중력 향상에 최적화",
                "price": 350000,
                "stock": 50,
                "category": "전자기기"
            },
            {
                "name": "스마트워치 Ultra",
                "description": "심박수/혈중산소 측정, GPS 내장, 방수 IP68. 건강 관리와 운동 트래킹에 최적",
                "price": 580000,
                "stock": 30,
                "category": "전자기기"
            },
            {
                "name": "4K UHD 모니터 27인치",
                "description": "4K 해상도, 144Hz, HDR600, USB-C 충전 지원. 게이밍과 전문 작업 모두 완벽",
                "price": 650000,
                "stock": 20,
                "category": "전자기기"
            },
            {
                "name": "기계식 키보드 RGB",
                "description": "청축 기계식, RGB 백라이팅, 알루미늄 바디, N-Key Rollover 지원",
                "price": 120000,
                "stock": 40,
                "category": "전자기기"
            },
            {
                "name": "무선 게이밍 마우스",
                "description": "25,600 DPI, 70시간 배터리, 초경량 68g, RGB 조명. 반응속도 0.1ms",
                "price": 89000,
                "stock": 60,
                "category": "전자기기"
            },
            {
                "name": "프리미엄 오가닉 면 티셔츠",
                "description": "100% 오가닉 코튼, 6가지 색상, S-XXL, 부드럽고 통기성 우수",
                "price": 45000,
                "stock": 200,
                "category": "의류"
            },
            {
                "name": "러닝화 에어쿠션",
                "description": "에어 쿠셔닝 시스템, 통기성 메쉬 소재, 남녀공용 230-290mm",
                "price": 180000,
                "stock": 60,
                "category": "의류"
            },
            {
                "name": "빈티지 데님 재킷",
                "description": "워싱 처리된 빈티지 데님, 봄/가을 적합, 남녀공용 오버핏",
                "price": 129000,
                "stock": 45,
                "category": "의류"
            },
            {
                "name": "요가 레깅스 프로",
                "description": "고탄력 4방향 스트레치, 스쿼트 프루프, 주머니 있음. 요가/필라테스/러닝 다목적",
                "price": 65000,
                "stock": 80,
                "category": "의류"
            },
            {
                "name": "프리미엄 원두 커피 세트",
                "description": "에티오피아 예가체프 250g + 콜롬비아 수프리모 250g 세트. 핸드픽 선별 스페셜티 원두",
                "price": 58000,
                "stock": 150,
                "category": "식품"
            },
            {
                "name": "단백질 바 20개입",
                "description": "초콜릿/바닐라/땅콩버터 맛 혼합, 단백질 20g/개, 저당 고단백. 운동 후 회복식",
                "price": 35000,
                "stock": 300,
                "category": "식품"
            },
            {
                "name": "히알루론산 수분크림",
                "description": "히알루론산 5%, 나이아신아마이드 함유, 72시간 수분 지속. 건성/복합성 피부 최적",
                "price": 68000,
                "stock": 100,
                "category": "뷰티"
            },
            {
                "name": "케라틴 헤어 에센스",
                "description": "케라틴 집중 케어, 손상모 복구, 열 보호 기능. 드라이 전 사용 권장 100ml",
                "price": 48000,
                "stock": 90,
                "category": "뷰티"
            },
            {
                "name": "아로마 디퓨저 홈 세트",
                "description": "초음파 LED 디퓨저 + 라벤더/유칼립투스/페퍼민트 에센셜 오일 3종 세트",
                "price": 85000,
                "stock": 35,
                "category": "홈/리빙"
            },
            {
                "name": "메모리폼 경추 베개",
                "description": "저반발 메모리폼, 경추 지지 인체공학 설계, 항균 竹 커버 포함. 2개 세트",
                "price": 98000,
                "stock": 40,
                "category": "홈/리빙"
            },
        ]

        for p_data in products:
            product = models.Product(**p_data)
            db.add(product)

        db.commit()
        print("✅ 시드 데이터가 생성되었습니다!")
    finally:
        db.close()
