// Tap messages extracted from Murasame.model3.json
const tapMessages: Record<string, string[]> = {
  face: [
    `吾名丛雨，乃是这\u201c丛雨丸\u201d的管理者……简单来说，也算是\u201c丛雨丸\u201d的灵魂`,
    "你，就是本座的主人？",
  ],
  hair: ["在这里，这里", "你看，复原了"],
  xiongbu: ["主人就是主人。是你拔出了丛雨丸吧？", "你这————！！"],
  qunzi: [
    "——着陆",
    "本座才不是幽灵！完全不是！不要把幽灵和本座相提并论！",
  ],
  leg: [
    "哪是什么幽灵，别……别别别把本座和那种毫无事实依据的东西混为一谈",
    "你醒了吗，主人。早上好",
    "本座不是幻觉，更不是幽灵，主人！",
  ],
};

const idleMessages = [
  "主人，在看什么呢？",
  "游戏库里又多了什么好作品吗？",
  "要不要启动一个游戏来玩？",
  "本座一直在守护着这里。",
  "最近有什么新游戏入手了吗？",
  "感觉有点无聊……",
  "主人，不要只顾着看，也注意休息哦。",
  "这里的游戏真不少呢。",
  "主人有什么吩咐吗？",
];

export const systemMessages: Record<string, string[]> = {
  gameAdded: [
    "新游戏！本座来帮你管理。",
    "又多了一部作品，主人品味不错。",
    "这部本座也想玩呢……",
    "欢迎新游戏入库！",
  ],
  gameCompleted: [
    "通关了！故事怎么样？",
    "主人真厉害，这么快就通关了！",
    "这部作品有打动你吗？",
    "感想是什么呢，主人？",
  ],
  startup: [
    "本座在此等候，主人。",
    "欢迎回来，主人。",
    "今天想玩什么？",
    "丛雨守护着游戏库，请放心。",
  ],
};

export function getTapMessages(hitArea: string): string[] {
  return tapMessages[hitArea.toLowerCase()] ?? [];
}

export function getIdleMessages(): string[] {
  return idleMessages;
}

export function getRandomFrom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}
