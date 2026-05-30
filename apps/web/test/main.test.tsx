import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const render = vi.fn();
  return {
    createRoot: vi.fn(() => ({ render })),
    registerSW: vi.fn(),
    render,
  };
});

vi.mock("react-dom/client", () => ({
  createRoot: mocks.createRoot,
}));

vi.mock("virtual:pwa-register", () => ({
  registerSW: mocks.registerSW,
}));

vi.mock("../src/App", () => ({
  App: () => "Farfield",
}));

async function importMain(): Promise<void> {
  await import("../src/main");
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="root"></div>';
  localStorage.clear();
  mocks.createRoot.mockClear();
  mocks.registerSW.mockClear();
  mocks.render.mockClear();
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistrations: vi.fn(async () => []),
    },
  });
});

describe("main entrypoint service worker handling", () => {
  it("renders on insecure network origins without service worker APIs", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });

    await expect(importMain()).resolves.toBeUndefined();

    expect(mocks.createRoot).toHaveBeenCalledWith(
      document.getElementById("root"),
    );
    expect(mocks.render).toHaveBeenCalledOnce();
    expect(mocks.registerSW).not.toHaveBeenCalled();
  });

  it("clears service workers on secure dev origins before rendering", async () => {
    const unregister = vi.fn(async () => true);
    const getRegistrations = vi.fn(async () => [{ unregister }]);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations,
      },
    });

    await importMain();
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });

    expect(getRegistrations).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledOnce();
    expect(mocks.render).toHaveBeenCalledOnce();
  });
});
