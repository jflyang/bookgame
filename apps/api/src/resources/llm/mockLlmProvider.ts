import type { LlmStoryOutput } from "@story-game/shared";
import type { LlmProvider, LlmRequest } from "./llmProvider.js";

const samples: Record<string, Partial<LlmStoryOutput>> = {
  qiaofeng: {
    narration: "乔峰踏前半步，掌风如墙，将毒雾硬生生压回山道一侧。",
    dialogue: "虚竹，守住他退路，莫让毒气近段公子！",
    action: { type: "command", skillId: "xianglong_kanglongyouhui", targetIds: ["dingchunqiu"] }
  },
  xuzhu: {
    narration: "虚竹合掌运气，北冥真气自掌心回旋，贴着毒雾边缘急转。",
    dialogue: "小僧明白，丁先生，还请收手！",
    action: { type: "skill", skillId: "beiming_zhenqi", targetIds: ["dingchunqiu"] }
  },
  duanyu: {
    narration: "段誉避在石后，见毒雾被掌力撕开，连忙看清丁春秋脚下的退路。",
    dialogue: "乔兄，他右肩微沉，怕是又要借雾遁走！",
    action: { type: "observe", targetIds: ["dingchunqiu"] }
  },
  dingchunqiu: {
    narration: "丁春秋袖袍一甩，惨绿毒粉贴地翻涌，眼中却已有几分忌惮。",
    dialogue: "好个乔峰，好个虚竹，今日便让你们尝尝星宿毒功！",
    action: { type: "skill", skillId: "xingxiu_duwu", targetIds: ["xuzhu"] }
  }
};

export class MockLlmProvider implements LlmProvider {
  async complete(input: LlmRequest): Promise<LlmStoryOutput> {
    const base = samples[input.speakerId] ?? samples.duanyu;
    return {
      speakerId: input.speakerId as LlmStoryOutput["speakerId"],
      narration: base.narration ?? "",
      dialogue: base.dialogue ?? "",
      action: base.action ?? { type: "observe", targetIds: [] },
      stateDeltaSuggestion: {}
    };
  }

  async *stream(input: LlmRequest): AsyncIterable<string> {
    const output = await this.complete(input);
    yield `${output.narration}\n${output.dialogue}`;
  }
}
