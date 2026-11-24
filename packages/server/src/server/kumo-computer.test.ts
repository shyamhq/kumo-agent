import { describe, expect, test } from "vitest";
import { readKumoComputer } from "./kumo-computer.js";

describe("readKumoComputer", () => {
  test.each([
    [
      "https://6868--kumox-sg-rustic-jackal.staging.mykumo.xyz",
      { handle: "kumox-sg-rustic-jackal", host: "kumox-sg-rustic-jackal.staging.mykumo.xyz" },
    ],
    [
      "https://6868--deep-badger.mykumo.xyz/",
      { handle: "deep-badger", host: "deep-badger.mykumo.xyz" },
    ],
  ])("reads the computer from %s", (publicUrl, computer) => {
    expect(readKumoComputer(publicUrl)).toEqual(computer);
  });

  test.each([undefined, "", "http://6868--deep-badger.mykumo.xyz", "https://example.com"])(
    "is null off Kumo (%s)",
    (publicUrl) => {
      expect(readKumoComputer(publicUrl)).toBeNull();
    },
  );
});
