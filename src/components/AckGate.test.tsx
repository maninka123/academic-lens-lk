import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AckGate } from "./AckGate";
import { ACK_KEY, ACK_WINDOW_MS, ackRequired, lastVisit, recordVisit } from "./ackPolicy";

const NOW = new Date("2026-11-14T10:00:00Z").getTime();
const H = 3600_000;
const dialog = () => screen.queryByRole("dialog");

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ack policy", () => {
  it("requires the notice on a first visit", () => {
    expect(ackRequired()).toBe(true);
  });
  it("does not require it within 24 hours", () => {
    localStorage.setItem(ACK_KEY, String(NOW - 23 * H));
    expect(ackRequired()).toBe(false);
  });
  it("requires it at 24 hours and beyond", () => {
    localStorage.setItem(ACK_KEY, String(NOW - ACK_WINDOW_MS));
    expect(ackRequired()).toBe(true);
    localStorage.setItem(ACK_KEY, String(NOW - 72 * H));
    expect(ackRequired()).toBe(true);
  });
  it.each(["", "abc", "-5", "1e12", "{}", String(NOW + 5 * H)])("treats %j as invalid", (v) => {
    localStorage.setItem(ACK_KEY, v);
    expect(lastVisit()).toBeNull();
    expect(ackRequired()).toBe(true);
  });
  it("is safe when storage throws", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(ackRequired(NOW, bad)).toBe(true);
    expect(() => recordVisit(NOW, bad)).not.toThrow();
  });
});

describe("AckGate", () => {
  it("shows on the first visit and stores a timestamp on accepting", () => {
    render(<AckGate />);
    expect(dialog()).not.toBeNull();
    const enter = screen.getByRole("button", { name: "Enter platform" });
    expect(enter).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(enter);
    expect(dialog()).toBeNull();
    expect(localStorage.getItem(ACK_KEY)).toBe(String(NOW));
  });
  it("stays hidden within 24 hours and refreshes the timestamp", () => {
    localStorage.setItem(ACK_KEY, String(NOW - 10 * H));
    render(<AckGate />);
    expect(dialog()).toBeNull();
    expect(localStorage.getItem(ACK_KEY)).toBe(String(NOW));
  });
  it("shows again after 24 hours and leaves the stale timestamp untouched", () => {
    const old = NOW - 25 * H;
    localStorage.setItem(ACK_KEY, String(old));
    render(<AckGate />);
    expect(dialog()).not.toBeNull();
    expect(localStorage.getItem(ACK_KEY)).toBe(String(old));
  });
  it("shows again after storage is cleared", () => {
    const { unmount } = render(<AckGate />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Enter platform" }));
    unmount();
    localStorage.clear();
    render(<AckGate />);
    expect(dialog()).not.toBeNull();
  });
  it("does not update the timestamp in the background", () => {
    localStorage.setItem(ACK_KEY, String(NOW - 5 * H));
    render(<AckGate />);
    vi.setSystemTime(NOW + 6 * H);
    expect(localStorage.getItem(ACK_KEY)).toBe(String(NOW));
  });
  it("asks again when a tab is resumed after 24 hours", () => {
    render(<AckGate />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Enter platform" }));
    vi.setSystemTime(NOW + 25 * H);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(dialog()).not.toBeNull();
  });
  it("only refreshes the timestamp when resumed within 24 hours", () => {
    render(<AckGate />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Enter platform" }));
    vi.setSystemTime(NOW + 3 * H);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(dialog()).toBeNull();
    expect(localStorage.getItem(ACK_KEY)).toBe(String(NOW + 3 * H));
  });
});

describe("legacy value", () => {
  it("the old accepted flag '1' no longer skips the notice", () => {
    localStorage.setItem(ACK_KEY, "1");
    expect(ackRequired()).toBe(true);
  });
});
