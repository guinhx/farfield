import { describe, expect, it } from "vitest";
import { resolveDefaultServerBaseUrlFromLocation } from "../src/lib/server-target";

describe("server target defaults", () => {
  it("uses the backend port for remote Vite dev origins", () => {
    expect(
      resolveDefaultServerBaseUrlFromLocation({
        origin: "http://192.168.10.5:4312",
        hostname: "192.168.10.5",
        port: "4312",
      }),
    ).toBe("http://192.168.10.5:4311");
  });

  it("keeps same-origin targets for non-dev remote origins", () => {
    expect(
      resolveDefaultServerBaseUrlFromLocation({
        origin: "https://farfield.example",
        hostname: "farfield.example",
        port: "",
      }),
    ).toBe("https://farfield.example");
  });

  it("uses loopback backend for local browser origins", () => {
    expect(
      resolveDefaultServerBaseUrlFromLocation({
        origin: "http://localhost:4312",
        hostname: "localhost",
        port: "4312",
      }),
    ).toBe("http://127.0.0.1:4311");
  });
});
