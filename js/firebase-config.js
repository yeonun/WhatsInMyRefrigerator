// ⚙️ Firebase 프로젝트 설정
// Firebase 콘솔(https://console.firebase.google.com) > 프로젝트 설정 > 일반 > "내 앱" 에서
// 웹 앱을 추가하면 아래와 같은 형식의 설정 객체를 확인할 수 있습니다.
// 그 값을 그대로 복사해서 아래에 붙여넣으세요.
//
// 이 파일의 값들은 "비밀키"가 아니라 공개되어도 되는 클라이언트 식별 정보입니다.
// 실제 보안은 Firestore 보안 규칙(firestore.rules)과 아래 ALLOWED_EMAILS 로 처리됩니다.

const firebaseConfig = {
    apiKey: "AIzaSyCeUcz5RORInyHOt0qAJAlBKvdfyuIgimo",
    authDomain: "whatsinmyrefrigerator.firebaseapp.com",
    projectId: "whatsinmyrefrigerator",
    storageBucket: "whatsinmyrefrigerator.firebasestorage.app",
    messagingSenderId: "1041742586102",
    appId: "1:1041742586102:web:26bb2191f154bebc9c0cd7",
    measurementId: "G-6DV6VPZE7C"
};

// 🔒 이 앱에 로그인할 수 있는 두 사람의 구글 계정 이메일을 정확히 입력하세요.
// (여기서 막아도 서버 쪽 방어를 위해 firestore.rules 에도 반드시 동일하게 설정해야 합니다)
const ALLOWED_EMAILS = [
  "derekjychoi@gmail.com",
  "yeongeeeee@gmail.com"
];
