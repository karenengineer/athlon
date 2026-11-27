import { TestBed } from "@angular/core/testing";
import { SwUpdate, VersionEvent } from "@angular/service-worker";
import { Subject } from "rxjs";
import {
  BeforeInstallPromptEvent,
  INSTALL_DISMISSED_KEY,
  isIosSafari,
  PwaService,
} from "./pwa.service";

const iphoneSafari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

function fakeInstallEvent(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt", {
    cancelable: true,
  }) as BeforeInstallPromptEvent;
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  });
  return { event, prompt };
}

describe("PwaService", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function create(providers: unknown[] = []) {
    TestBed.configureTestingModule({ providers: providers as never[] });
    return TestBed.inject(PwaService);
  }

  it("offers the browser install dialog and remembers a dismissal", async () => {
    const pwa = create();
    const { event, prompt } = fakeInstallEvent("dismissed");
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(pwa.install()).toBe("prompt");
    await pwa.promptInstall();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(pwa.install()).toBe("none");
    expect(Number(localStorage.getItem(INSTALL_DISMISSED_KEY))).toBeGreaterThan(
      0,
    );
  });

  it("stays quiet for 30 days after a dismissal", () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now() - 1000));
    const pwa = create();
    window.dispatchEvent(fakeInstallEvent("accepted").event);
    expect(pwa.install()).toBe("none");
  });

  it("asks again once the 30 days have passed", () => {
    localStorage.setItem(
      INSTALL_DISMISSED_KEY,
      String(Date.now() - 31 * 24 * 60 * 60 * 1000),
    );
    const pwa = create();
    window.dispatchEvent(fakeInstallEvent("accepted").event);
    expect(pwa.install()).toBe("prompt");
  });

  it("never suggests installing inside the installed app", () => {
    // jsdom has no matchMedia; the installed app reports standalone mode.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }) as MediaQueryList,
    });
    try {
      const pwa = create();
      window.dispatchEvent(fakeInstallEvent("accepted").event);
      expect(pwa.install()).toBe("none");
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  it("follows the browser's online and offline events", () => {
    const pwa = create();
    window.dispatchEvent(new Event("offline"));
    expect(pwa.online()).toBe(false);
    window.dispatchEvent(new Event("online"));
    expect(pwa.online()).toBe(true);
  });

  it("flags a ready update from the service worker", () => {
    const versionUpdates = new Subject<VersionEvent>();
    const pwa = create([
      {
        provide: SwUpdate,
        useValue: {
          isEnabled: true,
          versionUpdates,
          unrecoverable: new Subject(),
        },
      },
    ]);
    versionUpdates.next({
      type: "VERSION_DETECTED",
      version: { hash: "b" },
    });
    expect(pwa.updateReady()).toBe(false);
    versionUpdates.next({
      type: "VERSION_READY",
      currentVersion: { hash: "a" },
      latestVersion: { hash: "b" },
    });
    expect(pwa.updateReady()).toBe(true);
  });

  it.each([
    [iphoneSafari, 0, true],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
      5,
      true,
    ],
    [iphoneSafari.replace("Version/18.1", "CriOS/131.0"), 0, false],
    [`${iphoneSafari} Instagram 350.0`, 0, false],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
      0,
      false,
    ],
    [
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
      5,
      false,
    ],
  ])("detects iOS Safari for %s (touch %s)", (userAgent, touch, expected) => {
    expect(isIosSafari({ userAgent, maxTouchPoints: touch } as Navigator)).toBe(
      expected,
    );
  });
});
