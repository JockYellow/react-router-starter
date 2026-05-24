import type {
  FoodMindAnswer,
  FoodMindCard,
  FoodMindCompatibility,
  FoodMindMindRead,
  FoodMindPlayer,
  FoodMindPlayerRoundResult,
  FoodMindRankingAnswer,
  FoodMindRankingDiff,
  FoodMindRankingResultItem,
  FoodMindRankingReveal,
  FoodMindRankingSet,
  FoodMindResultItem,
  FoodMindResultPayload,
  FoodMindReveal,
  FoodMindRoom,
  FoodMindScore,
  FoodMindThemeConfig,
} from "./food-mind.types";

const SCORE_LABELS: Record<FoodMindScore, string> = {
  0: "不行",
  1: "不太想",
  2: "看情況",
  3: "可以",
  4: "喜歡",
  5: "超愛",
};

export function getFoodMindScoreLabel(score: FoodMindScore): string {
  return SCORE_LABELS[score];
}

export function isFoodMindScore(value: unknown): value is FoodMindScore {
  return Number.isInteger(value) && typeof value === "number" && value >= 0 && value <= 5;
}

export function getCompatibility(a: FoodMindScore, b: FoodMindScore): FoodMindCompatibility {
  if (a === 0 || b === 0) {
    return {
      key: "hard_no",
      label: "明確地雷",
      description: "至少一方明確不行，這題先不要硬推。",
    };
  }

  if (a <= 1 && b <= 1) {
    return {
      key: "mutual_avoid",
      label: "共同避開",
      description: "兩個人都不太想碰，默契是一起跳過。",
    };
  }

  if (a >= 4 && b >= 4) {
    return {
      key: "mutual_love",
      label: "雙向喜歡",
      description: "雙方都有熱情，是可以放心點的選項。",
    };
  }

  if (a >= 3 && b >= 3) {
    return {
      key: "safe_pick",
      label: "安全可吃",
      description: "至少都能接受，適合當低風險選擇。",
    };
  }

  if ((a >= 4 && b === 2) || (b >= 4 && a === 2)) {
    return {
      key: "conditional_open",
      label: "附條件開放",
      description: "一方很喜歡，另一方需要看店、心情或搭配。",
    };
  }

  if ((a >= 4 && b === 1) || (b >= 4 && a === 1)) {
    return {
      key: "one_sided_heat",
      label: "單方熱情",
      description: "有人很想點，但另一方大概不會主動靠近。",
    };
  }

  return {
    key: "normal_split",
    label: "普通分歧",
    description: "不是地雷，但偏好明顯不同。",
  };
}

export function getMindRead(guessScore: FoodMindScore, actualScore: FoodMindScore): FoodMindMindRead {
  if (guessScore === 0 && actualScore === 0) {
    return {
      error: 0,
      label: "地雷偵測成功",
      special: "mine_detected",
      prompt: "你怎麼發現這是對方的明確地雷？",
    };
  }

  if (guessScore >= 3 && actualScore === 0) {
    return {
      error: Math.abs(guessScore - actualScore),
      label: "踩雷警報",
      special: "mine_alert",
      prompt: "這題要補問一下，對方不行的原因是味道、口感還是回憶？",
    };
  }

  if (guessScore <= 1 && actualScore >= 4) {
    return {
      error: Math.abs(guessScore - actualScore),
      label: "低估熱情",
      special: "underestimated_heat",
      prompt: "原來對方比你想像中更愛，這題可以追問喜歡哪一種版本。",
    };
  }

  const error = Math.abs(guessScore - actualScore);
  if (error === 0) {
    return {
      error,
      label: "完全猜中",
      special: null,
      prompt: "你是靠什麼線索猜到的？",
    };
  }
  if (error === 1) {
    return {
      error,
      label: "差一點",
      special: null,
      prompt: "只差一格，問問看對方差在哪個細節。",
    };
  }
  if (error === 2) {
    return {
      error,
      label: "印象偏移",
      special: null,
      prompt: "你的印象有點偏，可能要更新對方的早餐設定。",
    };
  }
  return {
    error,
    label: "大誤判",
    special: null,
    prompt: "這題很值得聊，可能藏著一個你不知道的地雷或熱情。",
  };
}

export function buildReveal(
  card: FoodMindCard,
  players: FoodMindPlayer[],
  answers: FoodMindAnswer[],
): FoodMindReveal | null {
  if (players.length !== 2 || answers.length !== 2) return null;

  const [playerA, playerB] = players.sort((a, b) => a.slot - b.slot);
  const answerA = answers.find((answer) => answer.playerId === playerA.id);
  const answerB = answers.find((answer) => answer.playerId === playerB.id);
  if (!answerA || !answerB) return null;

  const compatibility = getCompatibility(answerA.selfScore, answerB.selfScore);
  const playerResults: FoodMindPlayerRoundResult[] = [
    {
      player: playerA,
      partner: playerB,
      selfScore: answerA.selfScore,
      partnerGuessedSelfScore: answerB.predictPartnerScore,
      predictPartnerScore: answerA.predictPartnerScore,
      partnerActualScore: answerB.selfScore,
      mindRead: getMindRead(answerA.predictPartnerScore, answerB.selfScore),
    },
    {
      player: playerB,
      partner: playerA,
      selfScore: answerB.selfScore,
      partnerGuessedSelfScore: answerA.predictPartnerScore,
      predictPartnerScore: answerB.predictPartnerScore,
      partnerActualScore: answerA.selfScore,
      mindRead: getMindRead(answerB.predictPartnerScore, answerA.selfScore),
    },
  ];

  return { card, compatibility, playerResults };
}

export function buildResultPayload(
  theme: FoodMindThemeConfig,
  room: FoodMindRoom,
  players: FoodMindPlayer[],
  cards: FoodMindCard[],
  answers: FoodMindAnswer[],
  rankingSets: FoodMindRankingSet[] = [],
  rankingAnswers: FoodMindRankingAnswer[] = [],
): FoodMindResultPayload {
  const sortedPlayers = [...players].sort((a, b) => a.slot - b.slot);
  const allResults: FoodMindResultItem[] = [];
  const rankingResults = buildRankingResultItems(rankingSets, sortedPlayers, rankingAnswers);

  if (theme.mode === "ranking") {
    const totalMisses = rankingResults.flatMap((item) => item.biggestMisses);
    const totalError = totalMisses.reduce((sum, item) => sum + item.error, 0);
    const totalTitle = totalError <= 6 ? "手搖雷達接近型" : "手搖排序校準型";
    const sharedHighlights = rankingResults.flatMap((item) => item.sharedTop);
    return {
      ok: true,
      mode: theme.mode,
      theme,
      room,
      players: sortedPlayers,
      totalTitle,
      totalSummary:
        totalError <= 6
          ? "你們對彼此手搖飲大方向抓得滿近，接下來只要看店家細節。"
          : "手搖飲很吃店家與心情，這局先抓出幾個需要重新校準的類型。",
      nextStarter:
        sharedHighlights.length > 0
          ? `下次可以先從「${sharedHighlights[0]}」開始點，再看當天想不想加料。`
          : "下次點手搖時先問飲料類型，再問要不要加料，會比直接猜品項準。",
      guessSummary: {
        title: totalError <= 6 ? "排序感覺接近" : "排序需要校準",
        detail:
          totalError <= 6
            ? "你們猜對方的手搖大方向沒有差太遠。"
            : "有些類型的排序落差明顯，適合下次點飲料前先問。",
      },
      mutualLoves: [],
      safePicks: [],
      oneSidedHeats: [],
      conditionalItems: [],
      commonPicks: [],
      hardNos: [],
      biggestMisses: [],
      allResults: [],
      rankingResults,
    };
  }

  for (const card of cards) {
    const cardAnswers = answers.filter((answer) => answer.cardId === card.id);
    if (sortedPlayers.length !== 2 || cardAnswers.length !== 2) continue;

    const first = sortedPlayers[0];
    const second = sortedPlayers[1];
    const firstAnswer = cardAnswers.find((answer) => answer.playerId === first.id);
    const secondAnswer = cardAnswers.find((answer) => answer.playerId === second.id);
    if (!firstAnswer || !secondAnswer) continue;

    allResults.push({
      card,
      compatibility: getCompatibility(firstAnswer.selfScore, secondAnswer.selfScore),
      scores: [
        {
          playerId: first.id,
          playerName: first.name,
          selfScore: firstAnswer.selfScore,
          predictPartnerScore: firstAnswer.predictPartnerScore,
          mindRead: getMindRead(firstAnswer.predictPartnerScore, secondAnswer.selfScore),
        },
        {
          playerId: second.id,
          playerName: second.name,
          selfScore: secondAnswer.selfScore,
          predictPartnerScore: secondAnswer.predictPartnerScore,
          mindRead: getMindRead(secondAnswer.predictPartnerScore, firstAnswer.selfScore),
        },
      ],
    });
  }

  const commonPicks = allResults.filter((item) =>
    item.compatibility.key === "mutual_love" || item.compatibility.key === "safe_pick"
  );
  const mutualLoves = allResults.filter((item) => item.compatibility.key === "mutual_love");
  const safePicks = allResults.filter((item) => item.compatibility.key === "safe_pick");
  const oneSidedHeats = allResults.filter((item) => item.compatibility.key === "one_sided_heat");
  const conditionalItems = allResults.filter((item) => item.compatibility.key === "conditional_open");
  const hardNos = allResults.filter((item) =>
    item.compatibility.key === "hard_no" || item.compatibility.key === "mutual_avoid"
  );
  const biggestMisses = [...allResults]
    .filter((item) => item.scores.some((score) => score.mindRead.error >= 2))
    .sort((a, b) => {
      const aMax = Math.max(...a.scores.map((score) => score.mindRead.error));
      const bMax = Math.max(...b.scores.map((score) => score.mindRead.error));
      return bMax - aMax;
    })
    .slice(0, 6);

  const highCommonCount = allResults.filter((item) => item.compatibility.key === "mutual_love").length;
  const highMissCount = allResults.filter((item) => item.scores.some((score) => score.mindRead.error >= 3)).length;
  const exactByPlayer = sortedPlayers.map((player) => ({
    player,
    exact: allResults.filter((item) =>
      item.scores.some((score) => score.playerId === player.id && score.mindRead.error === 0)
    ).length,
  }));
  const missByPlayer = sortedPlayers.map((player) => ({
    player,
    totalError: allResults.reduce((sum, item) => {
      const score = item.scores.find((entry) => entry.playerId === player.id);
      return sum + (score?.mindRead.error ?? 0);
    }, 0),
  }));

  let totalTitle = "正在校準型";
  let totalSummary = "你們已經抓到一些輪廓，但還有不少早餐偏好需要更新。";

  if (hardNos.length >= Math.max(5, Math.ceil(allResults.length * 0.25))) {
    totalTitle = "邊界清楚型";
    totalSummary = "這局清楚標出不少不能亂點的選項，下次踩雷機率會下降。";
  } else if (highMissCount >= Math.max(4, Math.ceil(allResults.length * 0.2))) {
    totalTitle = "正在校準型";
    totalSummary = "大誤判不少，但這正是第一次玩最有價值的地方。";
  } else if (highCommonCount >= Math.max(5, Math.ceil(allResults.length * 0.25))) {
    totalTitle = "早餐默契不錯型";
    totalSummary = "共同高分選項不少，早餐店選擇可以更放心。";
  } else if (exactByPlayer.every((item) => item.exact >= Math.ceil(allResults.length * 0.45))) {
    totalTitle = "食物雷達很準型";
    totalSummary = "雙方猜中率都高，彼此的早餐偏好已經有基本地圖。";
  } else if (Math.abs((exactByPlayer[0]?.exact ?? 0) - (exactByPlayer[1]?.exact ?? 0)) >= 4) {
    totalTitle = "單向讀心型";
    totalSummary = "其中一方比較會猜，另一方還有很多早餐訊號可以補上。";
  }

  const [bestGuesser, otherGuesser] = [...missByPlayer].sort((a, b) => a.totalError - b.totalError);
  const guessSummary =
    bestGuesser && otherGuesser && bestGuesser.totalError < otherGuesser.totalError
      ? {
          title: `${bestGuesser.player.name} 比較會猜`,
          detail: `${bestGuesser.player.name} 的總誤差 ${bestGuesser.totalError}，${otherGuesser.player.name} 的總誤差 ${otherGuesser.totalError}。`,
        }
      : {
          title: "猜測能力差不多",
          detail: "這局看起來沒有明顯單向讀心，兩邊都還在校準。",
        };

  const nextStarter =
    mutualLoves[0]?.card.name
      ? `下次可以優先選「${mutualLoves[0].card.name}」，這是雙方都高分的安全起手式。`
      : safePicks[0]?.card.name
        ? `下次可以先選「${safePicks[0].card.name}」，至少雙方都能接受。`
        : hardNos[0]?.card.name
          ? `下次先避開「${hardNos[0].card.name}」，這題已經被標成明確邊界。`
          : "下次先從今天分歧最大的題目聊起，會比直接點餐更準。";

  return {
    ok: true,
    mode: theme.mode,
    theme,
    room,
    players: sortedPlayers,
    totalTitle,
    totalSummary,
    nextStarter,
    guessSummary,
    mutualLoves,
    safePicks,
    oneSidedHeats,
    conditionalItems,
    commonPicks,
    hardNos,
    biggestMisses,
    allResults,
    rankingResults: [],
  };
}

export function normalizeRankingOrder(order: unknown, options: string[]): string[] | null {
  if (!Array.isArray(order)) return null;
  const allowed = new Set(options);
  const values = order.filter((item): item is string => typeof item === "string" && allowed.has(item));
  if (values.length !== options.length) return null;
  if (new Set(values).size !== options.length) return null;
  return values;
}

export function getRankingDiffs(predictedOrder: string[], actualOrder: string[]): FoodMindRankingDiff[] {
  const actualRank = new Map(actualOrder.map((option, index) => [option, index + 1]));
  return predictedOrder
    .map((option, index) => {
      const predictedRank = index + 1;
      const actual = actualRank.get(option) ?? predictedOrder.length;
      return {
        option,
        predictedRank,
        actualRank: actual,
        error: Math.abs(predictedRank - actual),
      };
    })
    .sort((a, b) => b.error - a.error || a.predictedRank - b.predictedRank);
}

export function buildRankingReveal(
  set: FoodMindRankingSet,
  players: FoodMindPlayer[],
  answers: FoodMindRankingAnswer[],
): FoodMindRankingReveal | null {
  if (players.length !== 2 || answers.length !== 2) return null;
  const [playerA, playerB] = [...players].sort((a, b) => a.slot - b.slot);
  const answerA = answers.find((answer) => answer.playerId === playerA.id);
  const answerB = answers.find((answer) => answer.playerId === playerB.id);
  if (!answerA || !answerB) return null;

  const buildPlayerResult = (
    player: FoodMindPlayer,
    partner: FoodMindPlayer,
    answer: FoodMindRankingAnswer,
    partnerAnswer: FoodMindRankingAnswer,
  ) => {
    const diffs = getRankingDiffs(answer.predictPartnerOrder, partnerAnswer.selfOrder);
    return {
      player,
      partner,
      selfOrder: answer.selfOrder,
      partnerSelfOrder: partnerAnswer.selfOrder,
      predictPartnerOrder: answer.predictPartnerOrder,
      exactMatches: diffs.filter((diff) => diff.error === 0).slice(0, 2),
      biggestMisses: diffs.slice(0, 2),
    };
  };

  return {
    set,
    playerResults: [
      buildPlayerResult(playerA, playerB, answerA, answerB),
      buildPlayerResult(playerB, playerA, answerB, answerA),
    ],
  };
}

function buildRankingResultItems(
  sets: FoodMindRankingSet[],
  players: FoodMindPlayer[],
  answers: FoodMindRankingAnswer[],
): FoodMindRankingResultItem[] {
  const results: FoodMindRankingResultItem[] = [];
  for (const set of sets) {
    const reveal = buildRankingReveal(set, players, answers.filter((answer) => answer.setId === set.id));
    if (!reveal) continue;
    const [first, second] = reveal.playerResults;
    const sharedTop = first.selfOrder.slice(0, 3).filter((option) => second.selfOrder.slice(0, 3).includes(option));
    const biggestMisses = reveal.playerResults.flatMap((result) => result.biggestMisses).sort((a, b) => b.error - a.error).slice(0, 4);
    results.push({ set, playerResults: reveal.playerResults, sharedTop, biggestMisses });
  }
  return results;
}
