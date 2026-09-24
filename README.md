# 🧊 우리집 냉장고

냉동실정리하다 빡쳐서 만듦

부부가 냉장고 속 재료를 함께 실시간으로 관리하는 웹앱입니다.
빌드 도구 없이 순수 HTML/CSS/JS로 만들어졌고, Firebase(Authentication + Firestore)를 DB로 사용하며 GitHub Pages로 배포합니다.

## 주요 기능

- Google 계정 로그인 (미리 등록한 두 명의 이메일만 접근 가능)
- 재료 추가/수정/삭제 (이름, 수량, 카테고리, 보관 위치, 유통기한, 메모)
- 유통기한 임박(3일 이내)·경과 항목 자동 강조 및 상단 요약
- 이름 검색, 카테고리/위치 필터, 정렬(유통기한순/이름순/최근추가순)
- Firestore 실시간 동기화 → 한 명이 추가/수정하면 상대방 화면에 바로 반영

## 파일 구조

```
index.html            메인 화면 마크업
css/style.css          스타일
js/firebase-config.js  Firebase 설정 + 허용 이메일 목록 (직접 채워야 함)
js/app.js               앱 로직 (인증, Firestore 연동, 렌더링)
firestore.rules         Firestore 보안 규칙 (허용된 두 이메일만 read/write)
```

---

## 1단계. Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속 후 **프로젝트 추가**
2. 프로젝트 이름 입력 (예: `our-fridge`) → 애널리틱스는 꺼도 무방 → 프로젝트 생성

### 1-1. 웹 앱 등록

1. 프로젝트 개요 화면에서 **`</>` (웹)** 아이콘 클릭
2. 앱 닉네임 입력 (예: `fridge-web`) → Firebase 호스팅은 체크하지 않아도 됩니다 (GitHub Pages 사용) → 앱 등록
3. 화면에 나오는 `firebaseConfig` 객체를 복사해서 이 프로젝트의 `js/firebase-config.js` 파일 안의 `firebaseConfig` 값에 그대로 붙여넣으세요.

### 1-2. Authentication(로그인) 설정

1. 왼쪽 메뉴 **Authentication** → **시작하기**
2. **Sign-in method** 탭 → **Google** 선택 → 사용 설정 → 프로젝트 지원 이메일 선택 → 저장

### 1-3. Firestore Database 만들기

1. 왼쪽 메뉴 **Firestore Database** → **데이터베이스 만들기**
2. 위치는 가까운 리전 선택(예: `asia-northeast3` 서울) → **프로덕션 모드**로 시작 (규칙은 3단계에서 교체합니다)

---

## 2단계. 허용할 두 계정 이메일 등록

두 곳에 **동일하게** 입력해야 합니다.

1. `js/firebase-config.js` 의 `ALLOWED_EMAILS` 배열에 남편/아내의 구글 계정 이메일 두 개를 입력
2. `firestore.rules` 파일의 `isAllowedUser()` 함수 안 이메일 배열에도 동일하게 입력

두 곳 모두 바꿔야 하는 이유: `firebase-config.js` 쪽은 사용자 경험(로그인 후 안내 메시지)을 위한 것이고, `firestore.rules` 쪽이 실제 데이터베이스를 보호하는 서버 측 규칙입니다.

## 3단계. Firestore 보안 규칙 적용

1. Firebase 콘솔 → Firestore Database → **규칙** 탭
2. 이 저장소의 `firestore.rules` 파일 내용을 그대로 복사해서 붙여넣고(이메일은 2단계에서 수정한 값으로) **게시**

---

## 4단계. GitHub 저장소 만들고 푸시하기

```bash
cd WhatsInMyRefrigerator
git init
git add .
git commit -m "Initial commit: 우리집 냉장고 웹앱"
```

GitHub에서 새 저장소를 만든 뒤 (예: `whats-in-my-refrigerator`), 원격 저장소를 연결하고 푸시합니다.

```bash
git branch -M main
git remote add origin https://github.com/<본인계정>/<저장소이름>.git
git push -u origin main
```

## 5단계. GitHub Pages로 배포

1. GitHub 저장소 → **Settings → Pages**
2. **Source**: `Deploy from a branch` 선택
3. **Branch**: `main` / `/ (root)` 선택 → Save
4. 잠시 후 `https://<본인계정>.github.io/<저장소이름>/` 주소로 접속 가능해집니다.

## 6단계. Firebase에 GitHub Pages 도메인 허용 등록

Google 로그인 팝업이 GitHub Pages 도메인에서도 동작하도록 승인해야 합니다.

1. Firebase 콘솔 → Authentication → **Settings** 탭 → **승인된 도메인(Authorized domains)**
2. **도메인 추가** → `<본인계정>.github.io` 입력 후 추가

---

## 완료 후 확인

- `https://<본인계정>.github.io/<저장소이름>/` 접속 → Google 로그인
- 허용된 두 이메일이 아니면 자동으로 로그인이 거부됩니다
- 한 사람이 재료를 추가하면 다른 사람 화면에도 새로고침 없이 바로 나타나는지 확인

## 나중에 설정을 바꾸면

`js/firebase-config.js` 나 `firestore.rules`를 수정한 뒤에는:
- `firebase-config.js` 변경 → `git add`, `git commit`, `git push` 하면 GitHub Pages에 자동 반영됩니다 (Pages는 push할 때마다 재배포됩니다)
- `firestore.rules` 변경 → Firebase 콘솔의 Firestore **규칙** 탭에서 다시 붙여넣고 게시해야 실제로 적용됩니다 (저장소에 있는 파일은 참고용이며 자동 배포되지 않습니다)
