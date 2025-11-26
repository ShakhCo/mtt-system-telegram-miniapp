import {
  setDebug,
  themeParams,
  initData,
  viewport,
  init as initSDK,
  mockTelegramEnv,
  retrieveLaunchParams,
  emitEvent,
  miniApp,
  backButton,
} from '@tma.js/sdk-react';

/**
 * Initializes the application and configures its dependencies.
 */
export function init(options: {
  debug: boolean;
  eruda: boolean;
  mockForMacOS: boolean;
}): Promise<void> {
  // Set @telegram-apps/sdk-react debug mode and initialize it.
  setDebug(options.debug);
  initSDK();

  // Add Eruda if needed.
  options.eruda && void import('eruda').then(({ default: eruda }) => {
    eruda.init();
    eruda.position({ x: window.innerWidth / 2 - 25, y: window.innerHeight / 2 - 25 });
  });

  // Telegram for macOS has a ton of bugs, including cases, when the client doesn't
  // even response to the "web_app_request_theme" method. It also generates an incorrect
  // event for the "web_app_request_safe_area" method.
  if (options.mockForMacOS) {
    let firstThemeSent = false;
    mockTelegramEnv({
      onEvent(event, next) {
        if (event.name === 'web_app_request_theme') {
          const tp = firstThemeSent
            ? themeParams.state()
            : retrieveLaunchParams().tgWebAppThemeParams;

          if (!firstThemeSent) {
            firstThemeSent = true;
          }

          return emitEvent('theme_changed', { theme_params: tp as Record<string, `#${string}`> });
        }

        if (event.name === 'web_app_request_safe_area') {
          return emitEvent('safe_area_changed', { left: 0, top: 0, right: 0, bottom: 0 });
        }

        next();
      },
    });
  }

  // Mount all components used in the project.
  backButton.mount.ifAvailable();
  initData.restore();

  if (miniApp.mount.isAvailable()) {
    themeParams.mount();
    miniApp.mount();
    themeParams.bindCssVars();
  }

  if (viewport.mount.isAvailable()) {
    void viewport.mount().then(() => {
      viewport.bindCssVars();
    });
  }

  return Promise.resolve();
}