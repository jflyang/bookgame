const fs = require('fs');

// ============================================================
// 心有所想 — 技能 + 阶段Details + 铁律
// ============================================================

const xysSkills = [
  { id: "skill_dunk", name: "飞人灌篮", ownerId: "zhongping", cost: { mp: 20 }, damage: { min: 30, max: 45 }, effect: "赛场上的绝对统治力，大幅提升观众狂热度和丽云好感", description: "周仲平腾空而起，如飞人般单手劈扣，全场沸腾", sampleLine: "还有谁！" },
  { id: "skill_leadership", name: "领袖气质", ownerId: "zhongping", cost: { mp: 15 }, damage: { min: 15, max: 25 }, effect: "稳定军心，提升全队士气，同时吸引更多女粉丝关注", description: "周仲平站在场中央，一个眼神就让全队安定下来", sampleLine: "把球给我，我来。" },
  { id: "skill_gentle_comfort", name: "温柔安抚", ownerId: "zhongping", cost: { mp: 10 }, damage: { min: 5, max: 15 }, effect: "安抚美云的不安情绪，维持家庭和谐但可能降低暧昧值", description: "周仲平轻轻搂住美云的肩膀，在她耳边低声细语", sampleLine: "傻瓜，我心里只有你。" },
  { id: "skill_passion_burst", name: "激情爆发", ownerId: "zhongping", cost: { mp: 30 }, damage: { min: 40, max: 60 }, effect: "在关键时刻情感决堤，做出不可挽回的亲密举动", description: "周仲平再也控制不住内心的冲动，猛地将对方拉入怀中", sampleLine: "我不管了……" },
  { id: "skill_gentle_watch", name: "温柔守望", ownerId: "meiyun", cost: { mp: 5 }, damage: { min: 0, max: 5 }, effect: "默默观察丈夫的一举一动，积累不安与醋意", description: "美云坐在观众席角落，目光始终追随着丈夫的身影", sampleLine: "（默默攥紧了手帕）" },
  { id: "skill_jealousy_surge", name: "醋意暗涌", ownerId: "meiyun", cost: { mp: 15 }, damage: { min: 10, max: 20 }, effect: "向丈夫表达不满，引发情感冲突，可能触发丽云的反击", description: "美云终于忍不住质问丈夫，眼眶泛红声音颤抖", sampleLine: "那个丽云……她为什么总是缠着你？" },
  { id: "skill_wife_guardian", name: "贤妻守护", ownerId: "meiyun", cost: { mp: 20 }, damage: { min: 15, max: 25 }, effect: "主动出面维护丈夫，在公开场合宣示主权", description: "美云端出亲手做的点心和煲好的老火汤，用温柔的方式宣告正牌地位", sampleLine: "仲平打完球一定累了，我煲了汤。" },
  { id: "skill_secret_observer", name: "暗中观察", ownerId: "meiyun", cost: { mp: 10 }, damage: { min: 5, max: 10 }, effect: "发现丈夫和丽云之间不对劲的蛛丝马迹，推动剧情转折", description: "美云提前回家，在窗外看到不该看到的一幕", sampleLine: "（站在窗外，手里的饭盒掉在地上）" },
  { id: "skill_black_rose_dom", name: "黑玫瑰霸气", ownerId: "liyun", cost: { mp: 25 }, damage: { min: 25, max: 40 }, effect: "用泼辣气场震慑其他女粉丝，宣示自己对仲平的专属保护权", description: "丽云双手叉腰挡在仲平面前，眼神凌厉地扫视周围女生", sampleLine: "谁敢再靠近他一步试试看！" },
  { id: "skill_fierce_escort", name: "泼辣护驾", ownerId: "liyun", cost: { mp: 20 }, damage: { min: 20, max: 35 }, effect: "强势陪同仲平出入公共场合，制造二人独处机会", description: "丽云挽着仲平的胳膊大摇大摆穿过人群，谁敢拦就怼谁", sampleLine: "今天你归我管，谁也不许抢。" },
  { id: "skill_bold_tease", name: "大胆挑逗", ownerId: "liyun", cost: { mp: 25 }, damage: { min: 30, max: 50 }, effect: "在私密场合主动进攻，大幅推进暧昧关系和身体接触", description: "丽云穿着紧身泳衣在仲平面前展示健美身材，眼神大胆直视", sampleLine: "表哥……你觉得我身材怎么样？" },
  { id: "skill_swim_champion", name: "游泳健将", ownerId: "liyun", cost: { mp: 15 }, damage: { min: 10, max: 20 }, effect: "展现健美身材和运动能力，为水中亲密接触创造条件", description: "丽云如美人鱼般在水中翻腾，湿透的身体在阳光下闪闪发光", sampleLine: "来啊，追得上我今晚就归你！" },
  { id: "skill_river_rescue", name: "水中救援", ownerId: "liyun", cost: { mp: 30 }, damage: { min: 35, max: 55 }, effect: "假装抽筋让仲平下水救她，制造不可抗拒的身体接触", description: "丽云在水中突然大叫，身体下沉，仲平冲过去一把抱住她", sampleLine: "表哥！我腿抽筋了……抱紧我！" }
];

const xysStageDetails = [
  { id: "stage_tournament", title: "① 冠军之路", description: "篮球场上大展神威，连胜强队，冠军在望。粉丝们开始注意这位球场英雄。预计2~3轮。", enterWhen: "故事开始时", guidance: "氛围：炎热夏日的篮球馆，汗水、尖叫、球鞋摩擦地板的声响。仲平是全场焦点。\n\n仲平：**飞人灌篮**或**领袖气质**统治赛场\n美云：**温柔守望**，坐在角落默默关注丈夫\n丽云：第一次出现在观众席，被仲平的球技吸引\n\n→ 推进条件：仲平赢得关键比赛，女粉丝开始围上来" },
  { id: "stage_admirers", title: "② 粉丝包围", description: "比赛结束后，大批女学生将仲平团团围住索要签名合影。美云在远处不安地看着。预计2~3轮。", enterWhen: "赢得重要比赛后女粉丝涌上来", guidance: "氛围：球场外的狂热。女生们尖叫着挤向仲平，有人递情书有人求合影。美云站在人群外攥紧了手帕。\n\n仲平：被粉丝包围，礼貌应对但有些手足无措\n美云：**醋意暗涌**，不安地看着丈夫被女生包围\n丽云：**黑玫瑰霸气**出现，用泼辣方式帮仲平解围\n\n→ 推进条件：丽云成功为仲平解围，美云的不安感明显加深" },
  { id: "stage_jealousy", title: "③ 美云的烦恼", description: "美云表达不安，担心丈夫被女生纠缠。丽云的反常关心让仲平心猿意马。预计2~3轮。", enterWhen: "回到家中或丽云介入后", guidance: "氛围：家里的晚餐桌上气氛微妙。美云欲言又止，仲平心不在焉。\n\n美云：**贤妻守护**或**醋意暗涌**，温柔地表达担忧\n仲平：**温柔安抚**试图让美云放心，但心里想着丽云\n丽云：发信息约仲平下次比赛见\n\n→ 推进条件：美云表达不安，丽云发出游泳邀约" },
  { id: "stage_lily_accompany", title: "④ 黑玫瑰护驾", description: "丽云强势陪仲平出战球场，用泼辣作风震慑狂热粉丝。两人的暧昧开始公开化。预计2~3轮。", enterWhen: "下一场比赛前丽云主动出现", guidance: "氛围：丽云挽着仲平的胳膊走进球场，全场的目光都变了。\n\n丽云：**泼辣护驾**挡在仲平前面，**大胆挑逗**在众人面前宣示主权\n仲平：**飞人灌篮**在丽云的注视下更加卖力\n美云：**暗中观察**，发现丽云和仲平的互动越来越亲密\n\n→ 推进条件：丽云公开宣示主权，向仲平提出“陪我去西沙湾”的要求" },
  { id: "stage_swimming_invite", title: "⑤ 西沙湾之约", description: "丽云要求仲平单独陪她去西沙湾游泳作为保护费。偏僻沙滩，孤男寡女。预计2~3轮。", enterWhen: "丽云提出游泳邀约后", guidance: "氛围：傍晚的西沙湾，夕阳把沙滩染成金色。只有海浪声和两人的呼吸声。\n\n丽云：**游泳健将**展示身材，身穿紧身泳衣在仲平面前戏水\n仲平：被丽云的大胆和身材震撼，心跳加速\n丽云：**大胆挑逗**拉仲平下水，两人的距离越来越近\n\n→ 推进条件：两人下水游泳，身体接触逐渐增多" },
  { id: "stage_cramps", title: "⑥ 水中救援", description: "游泳时丽云突然抽筋，仲平冲过去救她。两人紧紧相拥，暧昧达到沸点。预计2~3轮。", enterWhen: "两人在水中游泳时", guidance: "氛围：丽云在水中惊叫，身体下沉。仲平本能地冲过去一把抱住。水花四溅中两人紧紧贴在一起。\n\n丽云：**水中救援**触发，假装抽筋让仲平救她（也可能是真的），双臂紧紧搂住仲平的脖子\n仲平：抱住丽云往岸边拖，感受到她湿滑的皮肤和剧烈的心跳\n丽云：在仲平耳边低声说“抱紧我……”\n\n→ 推进条件：两人上岸，丽云仍赖在仲平怀里不愿下来" },
  { id: "stage_intimacy", title: "⑦ 沙滩激情", description: "在无人沙滩上，丽云主动进攻，两人发生亲密关系。这是不可回头的一步。预计2~3轮。", enterWhen: "上岸后情感爆发无法再克制", guidance: "氛围：沙滩上只剩下海浪声和两人的喘息。夕阳已经沉入海面，暮色笼罩。一切都不重要了。\n\n丽云：主动亲吻仲平，“表哥……我喜欢你很久了……”\n仲平：**激情爆发**，再也控制不住自己，将丽云按在沙滩上\n丽云：展现**健美身体**的全部魅力，热烈回应\n\n→ 推进条件：两人在沙滩上完成亲密接触" },
  { id: "stage_aftermath", title: "⑧ 余韵与归途", description: "事后两人相拥，处理关系变化。如何面对美云？这段关系该走向何方？预计2~3轮。", enterWhen: "激情结束后", guidance: "氛围：海风吹拂，两人并肩坐在沙滩上。满足、愧疚、期待交织在一起。\n\n丽云：靠在仲平肩上，“没关系……我不后悔。但我不想伤害美云姐。”\n仲平：陷入沉默和内心挣扎，**温柔安抚**丽云\n美云：（不在场但笼罩着一切）\n\n→ 此阶段为结局阶段，留下开放式结尾" }
];

const xysSlimRule = `【夏日暧昧推进铁律】

本故事共8个阶段。每个阶段的氛围、技能分配、推进条件详见"剧情阶段信息"中的阶段卡片。必须严格按照①→⑧顺序推进，不得跳跃。

═══════════════════════════════════════
核心铁律
═══════════════════════════════════════

❌ 禁止在①②③阶段发生直接性行为（暧昧和身体接触可以，但不能越界）
❌ 禁止美云过早发现真相（真相揭露在⑦⑧阶段）
❌ 禁止丽云在③阶段之前就表露爱意（要从保护者逐步过渡到追求者）
❌ 禁止跳过水中救援环节直接进入沙滩激情

✅ 每轮必须推进一小步身体接触或情感变化，不能原地踏步
✅ 描写丽云时要突出她健美身材和泼辣外表下的柔情
✅ 描写美云时要突出温柔外表下的敏感和坚强
✅ 所有暧昧场景必须保持感官张力但不过分露骨`;

// ============================================================
// 追女仔 — 技能 + 阶段Details + 铁律
// ============================================================

const znzSkills = [
  { id: "skill_dominate_command", name: "支配命令", ownerId: "zhongping", cost: { mp: 15 }, damage: { min: 15, max: 25 }, effect: "用威严的语气下达命令，压制反抗意志", description: "仲平居高临下地看着对方，简短的话语带着不容置疑的力量", sampleLine: "跪下，张嘴。" },
  { id: "skill_powerful_thrust", name: "强力插入", ownerId: "zhongping", cost: { mp: 30 }, damage: { min: 40, max: 60 }, effect: "以巨大尺寸和超强持久力彻底征服对方身体", description: "仲平挺腰猛刺，粗长的性器直捣花心深处", sampleLine: "受得了吗？才刚刚开始。" },
  { id: "skill_mind_break", name: "心理征服", ownerId: "zhongping", cost: { mp: 25 }, damage: { min: 30, max: 50 }, effect: "通过羞耻话语和精准节奏瓦解最后心理防线", description: "仲平一边抽插一边在对方耳边低语羞辱与赞美交织的话语", sampleLine: "嘴上说不要，下面吸得这么紧？" },
  { id: "skill_washing_ritual", name: "媚药洗穴术", ownerId: "dajie", cost: { mp: 30 }, damage: { min: 35, max: 55 }, effect: "使用特制媚药洗护液深度清洗阴道，大幅提升敏感度和淫水分泌", description: "大姐戴上医用手套，将大量温热媚药液注入阴道深处反复冲洗", sampleLine: "这药会渗进每一层嫩肉里……你会变得很乖。" },
  { id: "skill_silk_bind", name: "丝带束缚", ownerId: "dajie", cost: { mp: 15 }, damage: { min: 15, max: 25 }, effect: "用丝绸缎带将对象捆成羞耻姿势，剥夺行动自由", description: "大姐熟练地用粉色丝带将手腕脚踝分别绑在床柱上", sampleLine: "动不了了吧？放松，越挣扎越紧。" },
  { id: "skill_edge_control", name: "边缘控制", ownerId: "dajie", cost: { mp: 25 }, damage: { min: 30, max: 45 }, effect: "反复将对象推至高潮边缘然后撤去刺激，积累极度饥渴", description: "大姐精准感知身体反应，在即将高潮时突然停手，反复三次", sampleLine: "还不行……还没到让你去的时候。" },
  { id: "skill_mind_lure", name: "心理诱导", ownerId: "dajie", cost: { mp: 20 }, damage: { min: 20, max: 35 }, effect: "用温柔坏笑和羞耻言语引导对象主动说出淫荡求欢话语", description: "大姐俯身在她耳边，用最低沉魅惑的声音说出让她羞耻到极点的话", sampleLine: "想要什么？说出来……不说我怎么知道？" },
  { id: "skill_afterglow_demo", name: "高潮余韵展示", ownerId: "meiyun", cost: { mp: 10 }, damage: { min: 5, max: 15 }, effect: "美云展示自己刚被征服后的淫乱状态，给丽云做'榜样'", description: "美云软在床上双腿大张，阴道还在有节奏地收缩，白色的液体缓缓流出", sampleLine: "丽云你看……被仲平疼爱后就变成这样了……好舒服……" },
  { id: "skill_sister_demo", name: "姐妹示范", ownerId: "meiyun", cost: { mp: 15 }, damage: { min: 10, max: 20 }, effect: "美云配合大姐的指令，向丽云展示应该如何顺从", description: "美云迷离着眼乖乖翻过身，向丽云展示刚被充分开发过的身体", sampleLine: "丽云乖……很快就轮到你了……" },
  { id: "skill_stubborn_resist", name: "嘴硬抵抗", ownerId: "liyun", cost: { mp: 20 }, damage: { min: 10, max: 20 }, effect: "丽云用泼辣嘴硬抵抗，但越抵抗身体越背叛，增加征服成就感", description: "丽云破口大骂拼命扭动挣扎，但乳头已经不受控制地挺立", sampleLine: "放开我！你们这群变态！——嗯啊……别碰那里！" },
  { id: "skill_body_betrayal", name: "身体背叛", ownerId: "liyun", cost: { mp: 25 }, damage: { min: 25, max: 40 }, effect: "媚药生效后丽云身体失控，淫水大量分泌，呻吟藏不住", description: "丽云嘴上还在骂，但小穴已经湿得一塌糊涂，身体不受控制地弓起迎向抚摸", sampleLine: "不……这不是我……嗯啊……为什么身体……" },
  { id: "skill_beg_surrender", name: "崩溃求饶", ownerId: "liyun", cost: { mp: 30 }, damage: { min: 35, max: 55 }, effect: "丽云心理防线彻底崩溃，哭着主动求欢，完成征服", description: "丽云泪流满面浑身颤抖，再也没有了泼辣的样子，只有最原始的渴望", sampleLine: "求求你们……插进来吧……我认输了……怎么都行……" }
];

const znzStageDetails = [
  { id: "stage_after_mei", title: "① 美云余韵", description: "美云刚被仲平激烈抽插后软倒在床，大姐坏笑着转向丽云。新一轮征服即将开始。预计2~3轮。", enterWhen: "故事开始时或上一轮征服完成", guidance: "氛围：房间里弥漫着性爱的气息。美云瘫在床上双腿仍在微微抽搐，阴道口还在滴着白色液体。大姐擦着手上的淫水，目光转向被绑在角落的丽云。\n\n仲平：刚在美云身上释放完，靠在床头喘息，**支配命令**指挥大姐开始新一轮\n大姐：**丝带束缚**检查丽云的束缚状态，坏笑着走到她面前\n美云：**高潮余韵展示**，迷离中向丽云展示自己的状态\n丽云：**嘴硬抵抗**，破口大骂但声音里藏着恐惧\n\n→ 推进条件：大姐开始解开丽云的束缚准备清洗仪式" },
  { id: "stage_washing", title: "② 媚药清洗", description: "大姐对丽云进行详细的媚药洗穴过程，包括乳房刺激、阴道深度清洗和肛门按摩。预计3~4轮。", enterWhen: "丽云被按倒并重新束缚好", guidance: "氛围：大姐拿出医疗托盘，上面摆着温热的特制媚药洗护液、医用手套和各种器具。丽云瞪大了眼睛。\n\n大姐：**媚药洗穴术**开始——先倒出温热液体在丽云乳房上，用手掌打圈按压；然后分开她的大腿，将媚药液大量注入阴道反复冲洗；最后用手指沾满药液按压肛门\n仲平：在旁边观看，**心理征服**用言语羞辱配合\n美云：**姐妹示范**配合大姐，'丽云别怕……很快就舒服了……'\n丽云：从**嘴硬抵抗**逐渐转为**身体背叛**，乳头挺立、淫水大量分泌\n\n→ 推进条件：媚药充分渗透，丽云身体明显失控发红发烫" },
  { id: "stage_submission", title: "③ 彻底臣服", description: "丽云在反复边缘控制下心理崩溃，从泼辣女变成哭着求欢的雌兽。预计2~3轮。", enterWhen: "清洗仪式反复进行后丽云身体已完全失控", guidance: "氛围：丽云全身皮肤泛着淫荡的粉色，汗水混着媚药液在皮肤上闪闪发光。她拼命忍住呻吟但身体在不停颤抖。\n\n大姐：**边缘控制**——精准地推她到高潮边缘然后停手，反复折磨。配合**心理诱导**逼她说出求欢话语\n仲平：**支配命令**逼她亲自开口说'想要'\n美云：轻声劝诱丽云放弃抵抗\n丽云：**崩溃求饶**——终于崩溃大哭，主动说出淫荡求欢话语\n\n→ 推进条件：丽云亲口哭着说出'求求你插进来'或类似话语" },
  { id: "stage_penetration", title: "④ 插入征服", description: "仲平正式插入被洗净调教好的丽云，用超强性能力给她毁灭性的高潮体验。预计2~3轮。", enterWhen: "丽云彻底服软并哭着求欢", guidance: "氛围：大姐解开丽云的束缚，退到一旁观看。仲平走到丽云面前。她仰头看着这个男人，再没有一丝抵抗。\n\n仲平：**强力插入**——粗长的性器缓缓撑开被媚药浸润得极度敏感的阴道，一插到底\n丽云：被插入瞬间尖叫——然后陷入**身体背叛**的狂乱快感中\n大姐和美云：退到一旁，满意地观看征服仪式完成\n\n→ 推进条件：仲平完成抽插，丽云达到高潮" },
  { id: "stage_consolidation", title: "⑤ 仪式巩固", description: "事后巩固支配关系，大姐宣布丽云正式成为仲平后宫的一员。为下一轮征服做准备。预计2~3轮。", enterWhen: "插入征服完成、丽云高潮后", guidance: "氛围：高潮后的平静。丽云和美云并排躺在床上，两人都已被彻底征服。大姐满意地收拾工具。\n\n大姐：宣布丽云正式'通过仪式'，提醒未来的规矩和服从义务\n仲平：**支配命令**巩固自己的绝对支配地位\n美云：温柔地抱着丽云，'欢迎加入……'\n丽云：瘫软在美云怀里，**身体背叛**的余韵未消，彻底认命\n\n→ 循环阶段：可自然过渡到下一轮征服或结束" }
];

const znzSlimRule = `【征服仪式推进铁律】

本故事共5个阶段。每个阶段的氛围、技能分配、推进条件详见"剧情阶段信息"中的阶段卡片。必须严格按照①→⑤顺序推进。

═══════════════════════════════════════
核心铁律
═══════════════════════════════════════

❌ 禁止跳过清洗仪式阶段直接插入（媚药洗穴是必要的前置仪式）
❌ 禁止在丽云没有主动求饶前插入（心理征服不可跳过）
❌ 禁止同一技能在同一阶段连续使用超过3次
❌ 禁止一次性完成所有清洗步骤（要分步描写，每次只推进一小步）

✅ 所有性行为描写必须高度感官化，注重女性身体反应、声音和心理变化
✅ 大姐主导清洗仪式和道具操作，仲平主导插入和心理征服
✅ 美云作为"已完成征服的样本"配合展示
✅ 丽云从嘴硬→身体背叛→崩溃求饶的转变必须自然递进`;

// ============================================================
// 写回
// ============================================================

function updatePackage(dir, skills, stageDetails, slimRule) {
  const pkgPath = `${dir}/task-package.json`;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Replace skills
  pkg.skills = skills;

  // Replace stageDetails
  pkg.scenario.stageDetails = stageDetails;

  // Replace or add prompt rule
  const existingIdx = pkg.promptRules.findIndex(r => r.id === 'rule_stage_progression');
  const newRule = {
    id: "rule_stage_progression",
    title: slimRule.split('\n')[0].replace('【', '').replace('】', ''),
    category: "custom",
    content: slimRule,
    enabled: true
  };
  if (existingIdx >= 0) {
    pkg.promptRules[existingIdx] = newRule;
  } else {
    pkg.promptRules.push(newRule);
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated: ${pkgPath} (${skills.length} skills, ${stageDetails.length} stages, title: ${pkg.title})`);

  // Also sync skills to skills.json
  const skillsPath = `${dir}/skills.json`;
  fs.writeFileSync(skillsPath, JSON.stringify(skills, null, 2) + '\n');
}

updatePackage(
  'C:/Users/Administrator/Documents/GitHub/game/apps/data/task-packages/story_9ZRsc1nPWk',
  xysSkills, xysStageDetails, xysSlimRule
);

updatePackage(
  'C:/Users/Administrator/Documents/GitHub/game/apps/data/task-packages/story_Jt_yhKCXRp',
  znzSkills, znzStageDetails, znzSlimRule
);

console.log('\n心有所想 + 追女仔 优化完成');
