import { describe, test, expect } from "vitest";
import {
  runMatching,
  distributeToGroups,
  calculateGroupSizes,
  type Participant,
} from "../matching-engine";

function makeUser(
  instagram: string,
  streak: number,
  sessionType: string
): Participant {
  return { userId: instagram, instagram, streak, sessionType };
}

describe("Matching Engine", () => {
  test("4 users in same session should split into 2+2 groups", () => {
    const users = [
      makeUser("@u1", 10, "Session A"),
      makeUser("@u2", 20, "Session A"),
      makeUser("@u3", 30, "Session A"),
      makeUser("@u4", 40, "Session A"),
    ];

    const result = runMatching(users);

    expect(result.groups.length).toBe(2);
    expect(result.groups[0].members.length).toBe(2);
    expect(result.groups[1].members.length).toBe(2);
    expect(result.lobbyUsers.length).toBe(0);
  });

  test("single users from different sessions merge in Universal Pool", () => {
    const users = [
      makeUser("@u1", 10, "Session A"),
      makeUser("@u2", 20, "Session B"),
      makeUser("@u3", 30, "Session C"),
    ];

    const result = runMatching(users);

    expect(result.groups.length).toBe(1);
    expect(result.groups[0].members.length).toBe(3);
    expect(result.groups[0].type).toBe("universal");
  });

  test("single user goes to lobby", () => {
    const users = [makeUser("@lonely", 5, "Session A")];

    const result = runMatching(users);

    expect(result.groups.length).toBe(0);
    expect(result.lobbyUsers.length).toBe(1);
    expect(result.lobbyUsers[0].instagram).toBe("@lonely");
  });

  test("users are sorted by streak descending", () => {
    const users = [
      makeUser("@low", 10, "Session A"),
      makeUser("@high", 100, "Session A"),
      makeUser("@mid", 50, "Session A"),
    ];

    const result = runMatching(users);

    expect(result.groups.length).toBe(1);
    const members = result.groups[0].members;
    expect(members[0].streak).toBe(100);
    expect(members[1].streak).toBe(50);
    expect(members[2].streak).toBe(10);
  });

  test("complex case: grouping and Universal Pool mix", () => {
    const users = [
      makeUser("@a1", 10, "A"),
      makeUser("@a2", 10, "A"),
      makeUser("@b1", 10, "B"),
      makeUser("@c1", 10, "C"),
    ];

    const result = runMatching(users);

    expect(result.groups.length).toBe(2);
    const types = result.groups.map((g) => g.type);
    expect(types).toContain("matched");
    expect(types).toContain("universal");
  });

  test("5 users → 3+2 groups", () => {
    const users = [
      makeUser("@u1", 50, "A"),
      makeUser("@u2", 40, "A"),
      makeUser("@u3", 30, "A"),
      makeUser("@u4", 20, "A"),
      makeUser("@u5", 10, "A"),
    ];

    const result = runMatching(users);

    expect(result.groups.length).toBe(2);
    expect(result.groups[0].members.length).toBe(3);
    expect(result.groups[1].members.length).toBe(2);
  });

  test("6 users → 3+3 groups", () => {
    const users = Array.from({ length: 6 }, (_, i) =>
      makeUser(`@u${i}`, 10, "A")
    );

    const result = runMatching(users);

    expect(result.groups.length).toBe(2);
    expect(result.groups[0].members.length).toBe(3);
    expect(result.groups[1].members.length).toBe(3);
  });

  test("7 users → 3+2+2 groups", () => {
    const users = Array.from({ length: 7 }, (_, i) =>
      makeUser(`@u${i}`, 10, "A")
    );

    const result = runMatching(users);

    expect(result.groups.length).toBe(3);
    expect(result.groups[0].members.length).toBe(3);
    expect(result.groups[1].members.length).toBe(2);
    expect(result.groups[2].members.length).toBe(2);
  });

  test("0 users → empty result", () => {
    const result = runMatching([]);
    expect(result.groups.length).toBe(0);
    expect(result.lobbyUsers.length).toBe(0);
  });

  test("avg streak calculated correctly", () => {
    const users = [
      makeUser("@a", 10, "A"),
      makeUser("@b", 20, "A"),
      makeUser("@c", 30, "A"),
    ];

    const result = runMatching(users);
    expect(result.groups[0].avgStreak).toBe(20);
  });
});

describe("calculateGroupSizes", () => {
  test("returns correct sizes for various inputs", () => {
    expect(calculateGroupSizes(0)).toEqual([]);
    expect(calculateGroupSizes(1)).toEqual([]);
    expect(calculateGroupSizes(2)).toEqual([2]);
    expect(calculateGroupSizes(3)).toEqual([3]);
    expect(calculateGroupSizes(4)).toEqual([2, 2]);
    expect(calculateGroupSizes(5)).toEqual([3, 2]);
    expect(calculateGroupSizes(6)).toEqual([3, 3]);
    expect(calculateGroupSizes(7)).toEqual([3, 2, 2]);
    expect(calculateGroupSizes(8)).toEqual([3, 3, 2]);
    expect(calculateGroupSizes(9)).toEqual([3, 3, 3]);
    expect(calculateGroupSizes(10)).toEqual([3, 3, 2, 2]);
  });
});
