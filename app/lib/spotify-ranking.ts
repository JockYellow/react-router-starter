export type MergeStateStatus = "IDLE" | "PLAYING" | "FINISHED";

export type MergeState = {
  sublists: string[][];
  currentPair: [number, number] | null;
  tempMerged: string[];
  leftIndex: number;
  rightIndex: number;
  totalCount: number;
  comparisonCount: number;
  status: MergeStateStatus;
};

export type MergeChoice = "left" | "right";

export function initMergeState(artistIds: string[]): MergeState {
  const sublists = artistIds.map((id) => [id]);
  const hasPair = sublists.length > 1;
  const status: MergeStateStatus = sublists.length <= 1 && sublists.length > 0 ? "FINISHED" : "PLAYING";

  return {
    sublists,
    currentPair: hasPair ? [0, 1] : null,
    tempMerged: [],
    leftIndex: 0,
    rightIndex: 0,
    totalCount: artistIds.length,
    comparisonCount: 0,
    status,
  };
}

export function getCurrentPairIds(state: MergeState): [string, string] | null {
  if (!state.currentPair) return null;
  const [leftListIndex, rightListIndex] = state.currentPair;
  const leftList = state.sublists[leftListIndex];
  const rightList = state.sublists[rightListIndex];
  const leftId = leftList?.[state.leftIndex];
  const rightId = rightList?.[state.rightIndex];

  if (!leftId || !rightId) return null;
  return [leftId, rightId];
}

export function applyChoice(state: MergeState, choice: MergeChoice): MergeState {
  if (!state.currentPair || state.status === "FINISHED") return state;
  const [leftListIndex, rightListIndex] = state.currentPair;
  const leftList = state.sublists[leftListIndex] ?? [];
  const rightList = state.sublists[rightListIndex] ?? [];

  const nextTemp = state.tempMerged.slice();
  let nextLeftIndex = state.leftIndex;
  let nextRightIndex = state.rightIndex;

  if (choice === "left") {
    if (leftList[nextLeftIndex]) nextTemp.push(leftList[nextLeftIndex]);
    nextLeftIndex += 1;
  } else {
    if (rightList[nextRightIndex]) nextTemp.push(rightList[nextRightIndex]);
    nextRightIndex += 1;
  }

  const nextComparisonCount = state.comparisonCount + 1;
  const leftDone = nextLeftIndex >= leftList.length;
  const rightDone = nextRightIndex >= rightList.length;

  if (leftDone || rightDone) {
    if (!leftDone) {
      nextTemp.push(...leftList.slice(nextLeftIndex));
    }
    if (!rightDone) {
      nextTemp.push(...rightList.slice(nextRightIndex));
    }

    const remaining = state.sublists.slice(2);
    const nextSublists = [...remaining, nextTemp];

    if (nextSublists.length <= 1) {
      return {
        ...state,
        sublists: nextSublists,
        currentPair: null,
        tempMerged: nextSublists[0] ?? nextTemp,
        leftIndex: 0,
        rightIndex: 0,
        comparisonCount: nextComparisonCount,
        status: "FINISHED",
      };
    }

    return {
      ...state,
      sublists: nextSublists,
      currentPair: [0, 1],
      tempMerged: [],
      leftIndex: 0,
      rightIndex: 0,
      comparisonCount: nextComparisonCount,
      status: "PLAYING",
    };
  }

  return {
    ...state,
    tempMerged: nextTemp,
    leftIndex: nextLeftIndex,
    rightIndex: nextRightIndex,
    comparisonCount: nextComparisonCount,
  };
}

export function getRankedIds(state: MergeState): string[] {
  if (state.status === "FINISHED") {
    return state.sublists[0] ?? state.tempMerged;
  }
  return state.sublists.flat();
}

export function getMergeProgress(state: MergeState) {
  const total = Math.max(state.totalCount, 1);
  const mergedCount = Math.min(total, state.tempMerged.length);
  const percent = Math.round((mergedCount / total) * 100);
  return { mergedCount, total, percent };
}
