import { describe, expect, it } from "vitest";
import { readKumoPerson } from "./kumo-person.js";

describe("readKumoPerson", () => {
  it("reads the person Kumo's gate names", () => {
    expect(readKumoPerson({ "x-kumo-user": "u_1", "x-kumo-name": "Zo%C3%AB%20Q" })).toEqual({
      id: "u_1",
      name: "Zoë Q",
    });
  });

  it("is nobody off the gate", () => {
    expect(readKumoPerson({ "x-kumo-name": "Zo%C3%AB" })).toBeUndefined();
    expect(readKumoPerson({ "x-kumo-user": "", "x-kumo-name": "Zo%C3%AB" })).toBeUndefined();
    expect(readKumoPerson({ "x-kumo-user": ["u_1", "u_2"] })).toBeUndefined();
  });

  it("calls a grant without a name Someone", () => {
    expect(readKumoPerson({ "x-kumo-user": "u_1", "x-kumo-name": "" })).toEqual({
      id: "u_1",
      name: "Someone",
    });
    expect(readKumoPerson({ "x-kumo-user": "u_1" })).toEqual({ id: "u_1", name: "Someone" });
    expect(readKumoPerson({ "x-kumo-user": "u_1", "x-kumo-name": "%E0%A4%A" })).toEqual({
      id: "u_1",
      name: "Someone",
    });
  });

  it("strips what would break the line a name is drawn on", () => {
    const name = encodeURIComponent(`Eve\u202e\nAdmin${"x".repeat(100)}`);
    expect(readKumoPerson({ "x-kumo-user": "u_1", "x-kumo-name": name })).toEqual({
      id: "u_1",
      name: `EveAdmin${"x".repeat(72)}`,
    });
  });
});
