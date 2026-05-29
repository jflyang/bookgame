#!/usr/bin/env python3
"""Add Leng Shuang performance sound mappings to manifest.json"""
import json

manifest_path = "C:/Users/Administrator/Documents/GitHub/game/apps/data/task-packages/story_N1WIx-Y0J8/manifest.json"
with open(manifest_path, "r", encoding="utf-8") as f:
    manifest = json.load(f)

AUDIO = "assets/performances/wuxia_sfx/audio"

skill_perfs = {
    # === Struggling / Resistance ===
    "skill_resist": {
        "name": "冷霜·武者反抗",
        "renderer": "audio", "durationMs": 3000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_resist"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_breath_quick_01.mp3"},
    },
    "skill_endure_pain": {
        "name": "冷霜·痛苦忍耐",
        "renderer": "audio", "durationMs": 3500,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_endure_pain"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_breath_heavy_01.mp3"},
    },
    "skill_despair_collapse": {
        "name": "冷霜·绝望崩溃",
        "renderer": "audio", "durationMs": 5000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_despair_collapse"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_intense_01.mp3"},
    },
    "skill_shame_struggle": {
        "name": "冷霜·羞耻挣扎",
        "renderer": "audio", "durationMs": 3500,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_shame_struggle"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_short_01.mp3"},
    },
    "skill_shame_endure": {
        "name": "冷霜·羞耻忍耐",
        "renderer": "audio", "durationMs": 3000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_shame_endure"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_soft_01.mp3"},
    },
    "skill_forced_obey": {
        "name": "冷霜·被迫服从",
        "renderer": "audio", "durationMs": 3000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_forced_obey"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_exhale_pleasure_01.mp3"},
    },
    # === Oil / Touch / Training ===
    "skill_oil_tremble": {
        "name": "冷霜·精油颤栗",
        "renderer": "audio", "durationMs": 4000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_oil_tremble"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_short_02.mp3"},
    },
    "skill_deepthroat_choke": {
        "name": "冷霜·深喉窒息",
        "renderer": "audio", "durationMs": 3000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_deepthroat_choke"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_gasp_pleasure_01.mp3"},
    },
    "skill_blindfold_tremble": {
        "name": "冷霜·蒙眼颤栗",
        "renderer": "audio", "durationMs": 3500,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_blindfold_tremble"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_soft_02.mp3"},
    },
    "skill_triple_stuffed": {
        "name": "冷霜·三穴闷绝",
        "renderer": "audio", "durationMs": 5000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_triple_stuffed"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_intense_04.mp3"},
    },
    "skill_helpless_wait": {
        "name": "冷霜·无助等待",
        "renderer": "audio", "durationMs": 2400,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_helpless_wait"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_breath_long_01.mp3"},
    },
    "skill_sensitive_tremble": {
        "name": "冷霜·敏感颤抖",
        "renderer": "audio", "durationMs": 3000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_sensitive_tremble"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_short_03.mp3"},
    },
    # === Edge / Breaking ===
    "skill_edge_struggle": {
        "name": "冷霜·边缘挣扎",
        "renderer": "audio", "durationMs": 4500,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_edge_struggle"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_long_01.mp3"},
    },
    "skill_dual_collapse": {
        "name": "冷霜·夹击崩溃",
        "renderer": "audio", "durationMs": 5000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_dual_collapse"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_intense_07.mp3"},
    },
    "skill_wet_sleep": {
        "name": "冷霜·湿梦难眠",
        "renderer": "audio", "durationMs": 3000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_wet_sleep"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_soft_03.mp3"},
    },
    "skill_inner_wavering": {
        "name": "冷霜·内心动摇",
        "renderer": "audio", "durationMs": 2800,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_inner_wavering"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_breath_heavy_02.mp3"},
    },
    "skill_body_betrayal": {
        "name": "冷霜·身体觉醒",
        "renderer": "audio", "durationMs": 3500,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_body_betrayal"},
        "playOnce": "never",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_short_04.mp3"},
    },
    "skill_first_begging": {
        "name": "冷霜·首次乞求",
        "renderer": "audio", "durationMs": 3500,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_first_begging"},
        "playOnce": "story",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_soft_short_01.mp3"},
    },
    "skill_begging": {
        "name": "冷霜·屈辱乞求",
        "renderer": "audio", "durationMs": 4000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_begging"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_short_05.mp3"},
    },
    # === Serving ===
    "skill_first_serve": {
        "name": "冷霜·初次侍寝",
        "renderer": "audio", "durationMs": 5000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_first_serve"},
        "playOnce": "story",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_long_02.mp3"},
    },
    "skill_punish_endure": {
        "name": "冷霜·惩戒忍耐",
        "renderer": "audio", "durationMs": 4500,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_punish_endure"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_intense_10.mp3"},
    },
    "skill_suspension_serve": {
        "name": "冷霜·悬吊侍奉",
        "renderer": "audio", "durationMs": 4500,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_suspension_serve"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_long_03.mp3"},
    },
    "skill_edge_breakdown": {
        "name": "冷霜·边缘崩溃",
        "renderer": "audio", "durationMs": 5000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_edge_breakdown"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_intense_02.mp3"},
    },
    "skill_final_serve": {
        "name": "冷霜·终极侍奉",
        "renderer": "audio", "durationMs": 6000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_final_serve"},
        "playOnce": "story",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_intense_03.mp3"},
    },
    "skill_ultimate_breakdown": {
        "name": "冷霜·终极崩溃",
        "renderer": "audio", "durationMs": 6000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_ultimate_breakdown"},
        "playOnce": "story",
        "audio": {"main": f"{AUDIO}/lengshuang_orgasm_01.mp3"},
    },
    "skill_orgasm_release": {
        "name": "冷霜·高潮释放",
        "renderer": "audio", "durationMs": 5000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_orgasm_release"},
        "playOnce": "story",
        "audio": {"main": f"{AUDIO}/lengshuang_orgasm_02.mp3"},
    },
    # === Aftermath ===
    "skill_after_peace": {
        "name": "冷霜·事后安宁",
        "renderer": "audio", "durationMs": 3500,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_after_peace"},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_breath_long_02.mp3"},
    },
    "skill_servant_declaration": {
        "name": "冷霜·侍女宣言",
        "renderer": "audio", "durationMs": 2000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_servant_declaration"},
        "playOnce": "story",
        "audio": {"main": f"{AUDIO}/lengshuang_exhale_pleasure_03.mp3"},
    },
    "skill_eternal_belonging": {
        "name": "冷霜·永恒归属",
        "renderer": "audio", "durationMs": 3000,
        "trigger": {"type": "skillUse", "characterId": "leng_shuang", "skillId": "skill_eternal_belonging"},
        "playOnce": "story",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_soft_04.mp3"},
    },
    # === Scene-based performances (triggered by knowledge keywords) ===
    "leng_shuang_kiss_scene": {
        "name": "冷霜·接吻音效",
        "renderer": "audio", "durationMs": 2500,
        "trigger": {"type": "knowledgeUse", "characterId": "leng_shuang",
                    "knowledgeTitle": "冷霜接吻场景",
                    "keywords": ["亲吻", "接吻", "轻吻", "吻上", "以口封缄"]},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_kiss_01.mp3"},
    },
    "leng_shuang_bed_scene": {
        "name": "冷霜·床榻音效",
        "renderer": "audio", "durationMs": 4000,
        "trigger": {"type": "knowledgeUse", "characterId": "leng_shuang",
                    "knowledgeTitle": "冷霜床榻场景",
                    "keywords": ["床榻", "龙床", "被褥", "床第", "床上", "床垫"]},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_bed_creak_01.mp3"},
    },
    "leng_shuang_wet_sound": {
        "name": "冷霜·湿润触感",
        "renderer": "audio", "durationMs": 2000,
        "trigger": {"type": "knowledgeUse", "characterId": "leng_shuang",
                    "knowledgeTitle": "冷霜湿润触感",
                    "keywords": ["湿", "润滑", "湿润", "蜜液", "爱液", "淫水"]},
        "playOnce": "never",
        "audio": {"main": f"{AUDIO}/lengshuang_wet_bite_01.mp3"},
    },
    "leng_shuang_submit_pant": {
        "name": "冷霜·臣服喘息",
        "renderer": "audio", "durationMs": 3500,
        "trigger": {"type": "knowledgeUse", "characterId": "leng_shuang",
                    "knowledgeTitle": "冷霜臣服喘息",
                    "keywords": ["臣服", "屈服", "认命", "臣妾", "贱婢", "奴家"]},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_pant_pleasure_01.mp3"},
    },
    "leng_shuang_shiver": {
        "name": "冷霜·身体颤栗",
        "renderer": "audio", "durationMs": 3000,
        "trigger": {"type": "knowledgeUse", "characterId": "leng_shuang",
                    "knowledgeTitle": "冷霜身体颤栗",
                    "keywords": ["颤栗", "颤抖", "发抖", "战栗", "抽搐"]},
        "playOnce": "never",
        "audio": {"main": f"{AUDIO}/lengshuang_breath_quick_02.mp3"},
    },
    "leng_shuang_pleasure_gasp": {
        "name": "冷霜·快感喘息",
        "renderer": "audio", "durationMs": 3000,
        "trigger": {"type": "knowledgeUse", "characterId": "leng_shuang",
                    "knowledgeTitle": "冷霜快感喘息",
                    "keywords": ["快感", "酥麻", "电流", "酥软", "瘫软", "舒服"]},
        "playOnce": "never",
        "audio": {"main": f"{AUDIO}/lengshuang_gasp_pleasure_02.mp3"},
    },
    "leng_shuang_suppress_moan": {
        "name": "冷霜·压抑呻吟",
        "renderer": "audio", "durationMs": 3000,
        "trigger": {"type": "knowledgeUse", "characterId": "leng_shuang",
                    "knowledgeTitle": "冷霜压抑呻吟",
                    "keywords": ["压抑", "忍住", "咬着唇", "闷哼", "低吟", "不敢出声"]},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_soft_short_02.mp3"},
    },
    "leng_shuang_intense_scene": {
        "name": "冷霜·激烈场景",
        "renderer": "audio", "durationMs": 5000,
        "trigger": {"type": "knowledgeUse", "characterId": "leng_shuang",
                    "knowledgeTitle": "冷霜激烈场景",
                    "keywords": ["疯狂", "猛烈", "激烈", "加速", "狠狠", "用力"]},
        "playOnce": "session",
        "audio": {"main": f"{AUDIO}/lengshuang_moan_intense_05.mp3"},
    },
    "leng_shuang_climax_build": {
        "name": "冷霜·高潮前奏",
        "renderer": "audio", "durationMs": 4000,
        "trigger": {"type": "knowledgeUse", "characterId": "leng_shuang",
                    "knowledgeTitle": "冷霜高潮前奏",
                    "keywords": ["顶峰", "快要", "来了", "意识远去", "空白", "白光"]},
        "playOnce": "never",
        "audio": {"main": f"{AUDIO}/lengshuang_orgasm_04.mp3"},
    },
}

# Build performances object
manifest["capabilities"] = manifest.get("capabilities", {})
manifest["capabilities"]["performances"] = True
manifest["capabilities"]["audio"] = True
manifest["performances"] = manifest.get("performances", {})
for key, perf in skill_perfs.items():
    manifest["performances"][key] = perf

with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print(f"Done! {len(skill_perfs)} performance mappings added to manifest.json")
print(f"  - {sum(1 for k in skill_perfs if k.startswith('skill_'))} skill-triggered")
print(f"  - {sum(1 for k in skill_perfs if not k.startswith('skill_'))} scene/knowledge-triggered")
