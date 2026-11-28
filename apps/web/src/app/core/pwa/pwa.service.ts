import { DOCUMENT, isPlatformBrowser } from "@angular/common";
import {
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from "@angular/core";
import { NavigationStart, Router } from "@angular/router";
import { SwUpdate, VersionEvent } from "@angular/service-worker";
import { filter } from "rxjs";

/** Look for a new version at most this often (app resume, timer). */
export const UPDATE_CHECK_THROTTLE_MS = 60_000;
/** While the app stays open, also check this often. */
export const UPDATE_CHECK_INTERVAL_MS = 30 * 60_000;
/** A new version found this soon after opening, before any tap, reloads at once. */
export const SILENT_RELOAD_WINDOW_MS = 15_000;

/** How long a dismissed install suggestion stays hidden. */
export const INSTALL_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;
export const INSTALL_DISMISSED_KEY = "athlon_pwa_install_dismissed_v1";

/** Chrome/Edge/Android event; not in the DOM typings. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * iPhone/iPad browsers that can add a site to the home screen from their Share
 * menu (Safari, and Chrome/Edge/Firefox since iOS 16.4). iOS has no install
 * event, so these get a hint. In-app browsers (Instagram, Facebook, ...) cannot.
 */
export function isIosHomeScreenCapable(navigator: Navigator): boolean {
  const agent = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(agent) ||
    // iPadOS 13+ reports itself as a Mac with touch.
    (agent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (!ios || !/Safari\//.test(agent)) return false;
  return !/FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|TikTok|Snapchat|GSA\//.test(
    agent,
  );
}

/** Where the Share button lives differs per iOS browser. */
export type IosBrowser = "safari" | "chrome" | "other";

export function iosBrowser(userAgent: string): IosBrowser {
  if (/CriOS\//.test(userAgent)) return "chrome";
  if (/FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/.test(userAgent)) return "other";
  return "safari";
}

/**
 * Install suggestion, connectivity and new-version state for the storefront.
 * Everything here is browser-only; on the server it stays inert.
 */
@Injectable({ providedIn: "root" })
export class PwaService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  // Absent in tests and whenever the service worker is not provided.
  private readonly updates = inject(SwUpdate, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private installEvent: BeforeInstallPromptEvent | null = null;
  private lastUpdateCheck = 0;
  private openedAt = Date.now();
  private interacted = false;

  /** False only when the browser reports no connection. */
  readonly online = signal(true);
  /** "prompt": the browser can install; "ios": show the Share hint. */
  readonly install = signal<"none" | "prompt" | "ios">("none");
  /** Set with install "ios": which step-by-step guide to show. */
  readonly iosBrowser = signal<IosBrowser>("safari");
  readonly updateReady = signal(false);

  constructor() {
    const window = this.document.defaultView;
    if (!this.browser || !window) return;
    const destroyRef = inject(DestroyRef);
    const listen = (target: EventTarget, type: string, fn: EventListener) => {
      target.addEventListener(type, fn);
      destroyRef.onDestroy(() => target.removeEventListener(type, fn));
    };

    this.online.set(window.navigator.onLine !== false);
    listen(window, "online", () => this.online.set(true));
    listen(window, "offline", () => this.online.set(false));

    if (!this.standalone() && !this.dismissedRecently()) {
      listen(window, "beforeinstallprompt", (event) => {
        // Keep the browser's mini-infobar quiet; we offer our own button.
        event.preventDefault();
        this.installEvent = event as BeforeInstallPromptEvent;
        this.install.set("prompt");
      });
      if (isIosHomeScreenCapable(window.navigator)) {
        this.iosBrowser.set(iosBrowser(window.navigator.userAgent));
        this.install.set("ios");
      }
    }
    listen(window, "appinstalled", () => {
      this.installEvent = null;
      this.install.set("none");
    });

    const updates = this.updates;
    if (updates?.isEnabled) {
      // An installed app (especially on iPhone) is usually resumed from
      // memory, not reloaded, so the service worker would never look for a
      // new version on its own. Check on start, on every return to the
      // screen, and periodically while open.
      const markInteraction = () => (this.interacted = true);
      listen(window, "pointerdown", markInteraction);
      listen(window, "keydown", markInteraction);
      listen(this.document, "visibilitychange", () => {
        if (this.document.visibilityState !== "visible") return;
        this.openedAt = Date.now();
        this.interacted = false;
        this.checkForUpdate();
      });
      const timer = window.setInterval(() => {
        if (this.document.visibilityState === "visible") this.checkForUpdate();
      }, UPDATE_CHECK_INTERVAL_MS);
      destroyRef.onDestroy(() => window.clearInterval(timer));
      window.setTimeout(() => this.checkForUpdate(), 5_000);

      const subscription = updates.versionUpdates.subscribe(
        (event: VersionEvent) => {
          if (event.type !== "VERSION_READY") return;
          this.updateReady.set(true);
          // Just opened and untouched: switch right away, nobody is mid-task.
          if (
            !this.interacted &&
            Date.now() - this.openedAt < SILENT_RELOAD_WINDOW_MS
          ) {
            this.reload();
          }
        },
      );
      const unrecoverable = updates.unrecoverable.subscribe(() =>
        this.updateReady.set(true),
      );
      // Otherwise move to the new version on the next page change, as a
      // normal page load: no prompt needed, the basket is in storage.
      const navigation = this.router?.events
        .pipe(filter((event) => event instanceof NavigationStart))
        .subscribe((event) => {
          if (this.updateReady()) this.loadFresh(event.url);
        });
      destroyRef.onDestroy(() => {
        subscription.unsubscribe();
        unrecoverable.unsubscribe();
        navigation?.unsubscribe();
      });
    }
  }

  /** Ask the service worker whether a new version was deployed. */
  checkForUpdate(): void {
    const now = Date.now();
    if (
      !this.updates?.isEnabled ||
      now - this.lastUpdateCheck < UPDATE_CHECK_THROTTLE_MS
    ) {
      return;
    }
    this.lastUpdateCheck = now;
    this.updates.checkForUpdate().catch(() => {
      // Offline or the worker is not active yet: try again next time.
    });
  }

  /** Full page load of an in-app URL, picking up the newest version. */
  loadFresh(url: string): void {
    this.document.defaultView?.location.assign(url);
  }

  /** Opens the browser's own install dialog. */
  async promptInstall(): Promise<void> {
    const event = this.installEvent;
    if (!event) return;
    this.installEvent = null;
    this.install.set("none");
    await event.prompt();
    const choice = await event.userChoice.catch(() => null);
    if (choice?.outcome === "dismissed") this.rememberDismissal();
  }

  dismissInstall(): void {
    this.install.set("none");
    this.rememberDismissal();
  }

  reload(): void {
    this.document.defaultView?.location.reload();
  }

  /** Running as the installed app (Android/desktop or iOS home screen). */
  standalone(): boolean {
    const window = this.document.defaultView;
    if (!window) return false;
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true
    );
  }

  private dismissedRecently(): boolean {
    try {
      const value = Number(
        this.document.defaultView?.localStorage.getItem(INSTALL_DISMISSED_KEY),
      );
      return Number.isFinite(value) && Date.now() - value < INSTALL_DISMISS_MS;
    } catch {
      return false;
    }
  }

  private rememberDismissal(): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        INSTALL_DISMISSED_KEY,
        String(Date.now()),
      );
    } catch {
      // Private mode or blocked storage: the suggestion just comes back later.
    }
  }
}
