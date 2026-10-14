// 웹과 앱(구글플레이용 Capacitor 앱)에서 다르게 동작해야 하는 기능을 이곳 한 군데에 모은다.
// 게임 코드는 이 함수들만 부르므로, 앱으로 감쌀 때는 이 파일만 확인하면 된다.
// 앱에서는 Capacitor가 window.Capacitor와 플러그인(window.Capacitor.Plugins)을 넣어 준다.
// 웹에서는 그런 것이 없으므로 모두 브라우저 기능으로 대신한다.

const plugins = () => window.Capacitor?.Plugins || {};

/** 구글플레이 앱 안에서 실행 중인가 */
export function isNativeApp() {
  return !!window.Capacitor?.isNativePlatform?.();
}

/** 저장소: 웹·앱 모두 WebView의 localStorage를 쓴다. 막혀 있으면 조용히 실패한다 */
export const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  },
};

/** 진동: 앱은 Haptics 플러그인, 웹은 브라우저 진동(지원하는 휴대폰만) */
export function haptic(pattern) {
  try {
    const h = plugins().Haptics;
    if (h && isNativeApp()) {
      const ms = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern;
      h.vibrate?.({ duration: ms });
      return;
    }
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* 진동이 없는 기기 */ }
}

/**
 * 보상형 광고 자리. 광고를 끝까지 보면 true.
 * 웹(광고 없음)과 광고 플러그인이 없는 앱에서는 광고 없이 바로 true(보상 지급).
 * 앱에 AdMob 플러그인(@capacitor-community/admob)을 넣으면 실제 광고를 보여 준다.
 */
export const AD_UNITS = { rewarded: '' };   // 앱 출시 때 AdMob 광고 단위 ID를 넣는다(비어 있으면 광고 없음)
export async function showRewardedAd() {
  const ad = plugins().AdMob;
  if (!isNativeApp() || !ad || !AD_UNITS.rewarded) return true;
  try {
    await ad.prepareRewardVideoAd({ adId: AD_UNITS.rewarded });
    const reward = await ad.showRewardVideoAd();
    return !!reward;
  } catch {
    return true;   // 광고를 못 불러오면 사용자를 막지 않고 그냥 보상한다
  }
}

/** 안드로이드 뒤로가기 버튼. 앱에서만 연결된다(웹은 브라우저가 처리) */
export function onBackButton(handler) {
  const app = plugins().App;
  if (!isNativeApp() || !app?.addListener) return;
  app.addListener('backButton', () => {
    if (!handler()) app.exitApp?.();   // 처리할 것이 없으면(시작 화면) 앱을 닫는다
  });
}

/** 오프라인 실행용 서비스 워커: 앱은 파일이 이미 앱 안에 있으므로 쓰지 않는다 */
export function useServiceWorker() {
  return !isNativeApp() && 'serviceWorker' in navigator;
}
