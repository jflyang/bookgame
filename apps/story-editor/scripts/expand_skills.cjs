const fs = require('fs');
const storyPath = 'C:/Users/Administrator/Documents/GitHub/game/apps/data/task-packages/story_a_CW69KOgU/story.json';
const story = JSON.parse(fs.readFileSync(storyPath, 'utf-8'));

// ═══════════════════════════════════════════
// 大姐 — 16 调教技能
// ═══════════════════════════════════════════
story.actions = [
  // --- 束缚系 ---
  {id:'act_da_bind',    name:'M字开腿束缚',   ownerId:'da_jie', description:'用黑色皮革束缚带将小薇双腿摆成M字形固定于床架两侧，手腕反绑在身后，最私密部位完全敞开一览无余'},
  {id:'act_da_suspend', name:'吊脚悬吊术',    ownerId:'da_jie', description:'将小薇双脚脚踝用绳索吊起，身体悬空离地，双臂反绑，全身重量集中在手腕和脚踝的束缚处，彻底失去对身体的控制'},
  {id:'act_da_blind',   name:'蒙眼感官剥夺',  ownerId:'da_jie', description:'用黑色丝绸眼罩遮住小薇双眼——视线消失的瞬间，黑暗将所有触觉放大十倍。此后每一次触碰都变成未知的突袭'},

  // --- 药剂系 ---
  {id:'act_da_drug',    name:'高浓度媚药涂抹', ownerId:'da_jie', description:'将琥珀色催情精油在掌心暖热至体温，从小薇锁骨倒下，缓慢涂遍全身每一寸皮肤——乳沟、小腹、大腿内侧。精油的催情成分渗入血液，全身滚烫发亮'},
  {id:'act_da_icefire', name:'冰火交替刺激',  ownerId:'da_jie', description:'一手持冰块沿脊椎下滑，一手滴落温热蜡烛——极寒与灼热在同一片皮肤上交替炸开，感官系统彻底陷入混乱'},

  // --- 乳头系 ---
  {id:'act_da_nipple',  name:'乳房吸吮与乳环牵引', ownerId:'da_jie', description:'从身后环住小薇，双手握住乳房开始揉捏。用舌尖沿乳晕画圈，牙齿轻咬乳头直至完全硬挺，再用银环牵引拉扯，叮当作响'},

  // --- 阴部系 ---
  {id:'act_da_finger',  name:'阴部按摩指技',  ownerId:'da_jie', description:'手指沾满温热的精油，在小薇穴口画8字绕圈，时而滑入一节指节又退出，精确控制节奏——快感堆积到高潮边缘时立刻停下手指'},
  {id:'act_da_thrust',  name:'极慢脉动抽插',  ownerId:'da_jie', description:'用假阳具以极慢速度有节奏地抽送，保持"九浅一深"的频率，在深处停留3秒后缓缓退出。在小薇腰肢开始不自觉上挺时——戛然而止'},

  // --- 道具系 ---
  {id:'act_da_gag',     name:'口塞封唇术',    ownerId:'da_jie', description:'将黑色球形口塞塞入小薇口中，扣带在脑后系紧——所有呻吟、求饶、哭喊都被堵在喉咙里，只剩含糊的呜咽和从嘴角淌下的唾液'},
  {id:'act_da_plug',    name:'后庭肛塞训练',  ownerId:'da_jie', description:'先用精油充分润滑后庭，再将金属肛塞缓慢旋转推入。小薇从未被触碰过的后穴在异物撑开下剧烈收缩，异物感与羞耻同时炸开'},
  {id:'act_da_clamp',   name:'乳夹折磨术',    ownerId:'da_jie', description:'将银质乳夹夹上完全硬挺的乳头，夹力逐步收紧。下方悬吊小铜铃——每一次身体的微小颤抖都会牵动铜铃发出羞耻的叮当声'},
  {id:'act_da_whip',    name:'皮鞭惩戒',      ownerId:'da_jie', description:'用软皮鞭轻抽小薇大腿内侧和臀部——力道控制在疼痛与酥麻的边界，每一鞭落下都在白皙皮肤上留下一道粉色印记。不破皮，只留羞耻'},
  {id:'act_da_multi',   name:'多道具同步调教', ownerId:'da_jie', description:'乳夹震颤+肛塞抽送+跳蛋贴穴——三件道具同时从不同位置进攻，多重快感在体内交汇叠加，任何一处都无法单独承受'},

  // --- 心理系 ---
  {id:'act_da_psych',   name:'心理边缘控制',  ownerId:'da_jie', description:'在小薇耳边用优雅冷静的语调逐一描述她身体每一处羞耻反应的细节——"你看，这里已经湿成这样了"。用精准的羞辱瓦解最后的自尊'},
  {id:'act_da_force',   name:'强制高潮术',    ownerId:'da_jie', description:'在小薇已被边缘折磨至崩溃临界点时，不再停下——手指、跳蛋、假阳具同时加速到最高强度，以碾压式的刺激将她强行推过高潮线'},
  {id:'act_da_handover',name:'最终交接宣言',  ownerId:'da_jie', description:'小薇彻底屈服后，将她摆成跪姿——双腿分开、双手背后、低头。向少爷正式通报："少爷，她已经准备好了。"'}
];

// ═══════════════════════════════════════════
// 二姐 — 12 辅助技能
// ═══════════════════════════════════════════
const erActions = [
  {id:'act_er_bind',    name:'温柔辅助捆绑',  ownerId:'er_jie', description:'温柔但坚定地从身后擒住小薇双臂，配合大姐用绳索辅助固定关节位置——力道刚好压住挣扎却不会勒伤皮肤'},
  {id:'act_er_observe', name:'实时状态汇报',  ownerId:'er_jie', description:'俯身贴近小薇的身体，仔细观察每一个变化——乳头硬度、蜜穴湿润度、皮肤潮红范围、呼吸频率、瞳孔放大程度——用甜软嗓音向少爷和姐姐逐一汇报'},
  {id:'act_er_tool',    name:'道具递送与准备',ownerId:'er_jie', description:'在大姐需要时精准递送道具——束缚带、精油、跳蛋、口塞、肛塞、乳夹——所有道具提前暖好（精油温热、金属件捂到体温），确保流程无缝衔接'},
  {id:'act_er_lick',    name:'舌尖辅助刺激',  ownerId:'er_jie', description:'在大姐专注调教一处时，俯身用舌尖沿小薇的另一处敏感带缓缓滑过——耳垂、后颈、锁骨、大腿内侧——同时刺激多个点位，让快感无处逃避'},
  {id:'act_er_whisper', name:'耳畔淫语攻心',  ownerId:'er_jie', description:'嘴唇几乎贴着小薇的耳朵，用最甜软最温柔的声音说出最下流的话——"你看，你自己的水都流到大腿上了，还说不想要？"——温柔与羞辱的反差让羞耻感加倍'},
  {id:'act_er_blind',   name:'蒙眼辅助偷袭',  ownerId:'er_jie', description:'大姐给小薇戴上眼罩后，二姐从意想不到的角度突然施加刺激——完全黑暗中小薇不知道下一次触碰来自哪里，每一下都是惊吓与快感的混合'},
  {id:'act_er_lube',    name:'后庭润滑准备',  ownerId:'er_jie', description:'用温热精油细致润滑肛塞和小薇的后庭——手指在入口处轻柔打圈直到肌肉放松——"别怕，慢慢来，放松这里……"'},
  {id:'act_er_icefire', name:'冰火辅助配合',  ownerId:'er_jie', description:'在大姐用冰块刺激时，二姐同时在另一侧滴落热蜡——冰火两重的感官轰炸让小薇连尖叫都分不清是冷还是烫'},
  {id:'act_er_edge',    name:'高潮边缘预警',  ownerId:'er_jie', description:'俯身盯住小薇的蜜穴和腹部肌肉——在小穴开始无意识收缩、腰肢开始不由自主上挺的瞬间，准确预判并轻声提醒："大姐，她快到了……"'},
  {id:'act_er_comfort', name:'反差安抚术',    ownerId:'er_jie', description:'在小薇崩溃大哭时，用最温柔的语气在她耳边安抚，手掌轻抚她的头发——同时另一只手却继续毫不留情地刺激她的敏感带。温柔与残酷并存的极致反差'},
  {id:'act_er_clean',   name:'事后清理护理',  ownerId:'er_jie', description:'调教结束后，用温热毛巾细致擦拭小薇身体的每一处——从泪痕到腿间的蜜液——动作轻柔如护理珍宝，与小薇瘫软的身体形成鲜明对比'},
  {id:'act_er_handover',name:'成果展示辅助',  ownerId:'er_jie', description:'帮助大姐将彻底屈服的小薇摆成跪姿——掰开双腿、托起下巴——"少爷请看，她的身体已经彻彻底底属于您了"'}
];

story.actions.push(...erActions);

// ═══════════════════════════════════════════
// 少爷 — 14 指挥技能
// ═══════════════════════════════════════════
const syActions = [
  {id:'act_sy_command', name:'全面指挥统御',  ownerId:'shao_ye', description:'坐在天鹅绒扶手椅上，用低沉从容的声音下达调教指令。不亲自出手，只用目光和简短词句精准指挥大姐和二姐协同配合，掌控全局节奏'},
  {id:'act_sy_start',   name:'开场仪式指挥',  ownerId:'shao_ye', description:'在小薇被带入调教室后，身体前倾，说出开场指令："过来。别怕。"——用一句话设定基调，既是安抚也是命令'},
  {id:'act_sy_bind',    name:'束缚姿势指定',  ownerId:'shao_ye', description:'指定捆绑的姿势和松紧度——"M字开腿"、"反绑手腕留一指空隙"——每个细节都精确到不勒伤但绝对无法挣脱'},
  {id:'act_sy_drug',    name:'媚药剂量指挥',  ownerId:'shao_ye', description:'指定催情精油的用量和涂抹顺序——"从锁骨开始，锁骨到小腹，大腿内侧要涂三遍"——控制药物吸收的深度和速度'},
  {id:'act_sy_blind',   name:'蒙眼时机指令',  ownerId:'shao_ye', description:'决定何时剥夺小薇的视觉——"现在，遮住她的眼睛"——以及何时摘下——"让她看着我"——精准控制每一次感官剥夺与恢复的心理冲击'},
  {id:'act_sy_nipple',  name:'乳环调教指令',  ownerId:'shao_ye', description:'指挥大姐和二姐从两侧同时进攻小薇的乳房——"左边用舌尖，右边用乳夹"——双重刺激让两边的快感无法同时承受'},
  {id:'act_sy_finger',  name:'按摩节奏指令',  ownerId:'shao_ye', description:'亲自设定手指按摩的节奏和强度——"快一点"、"慢下来"、"停"、"继续"——用简短口令精确控制小薇快感曲线的每一个波峰和波谷'},
  {id:'act_sy_thrust',  name:'抽插频率指挥',  ownerId:'shao_ye', description:'设定抽插的频率和深度——"九浅一深"、"停在深处数三秒"、"在她快到的时候停"——在小薇即将高潮的那一刻，他说"停"，所有人立刻停手'},
  {id:'act_sy_gag',     name:'口塞与静音指令',ownerId:'shao_ye', description:'决定何时堵住小薇的嘴——"让她安静"——以及何时摘下口塞——"让她说。我想听听她怎么求我"——声音的剥夺与归还都是武器'},
  {id:'act_sy_psych',   name:'心理压迫指令',  ownerId:'shao_ye', description:'用沉默和目光施加压力。长时间一言不发地注视小薇的眼睛——不怒自威。偶尔简短评价："还不够。"——用最少的话造成最大的心理崩坏'},
  {id:'act_sy_multi',   name:'多道具调度指令',ownerId:'shao_ye', description:'统筹所有道具的使用顺序和强度组合——"乳夹先上，肛塞五分钟后再加，跳蛋保持最低档"——如交响乐指挥般精确编排感官轰炸的每一个声部'},
  {id:'act_sy_force',   name:'高潮许可指令',  ownerId:'shao_ye', description:'在小薇被边缘折磨至崩溃边缘、哭着求饶时，他微微点头——"允许。"——简单的两个字，是小薇从地狱到天堂的唯一通道。这道许可本身就是最强的控制'},
  {id:'act_sy_conquer', name:'最终征服',      ownerId:'shao_ye', description:'从扶手椅上缓缓起身，解开裤链。小薇被摆成跪姿，他托起她的下巴，第一次用自己的身体进入。全程沉默或只说一句："看着我。"'},
  {id:'act_sy_accept',  name:'调教成果验收',  ownerId:'shao_ye', description:'征服结束后，检查小薇的每一处反应——眼神是否涣散、身体是否彻底瘫软、回答是否温顺——"告诉我，你是谁的女人。"——等待她亲口说出最终答案'}
];

story.actions.push(...syActions);

// ═══════════════════════════════════════════
// 小薇 — 30 被动反应（按触发类型分组）
// ═══════════════════════════════════════════
story.reactions = [
  // ── 束缚相关 ──
  {id:'react_xw_bind_fear',     name:'被束缚的恐惧',     ownerId:'xiao_wei', trigger:'束缚', description:'双手被反剪到身后的瞬间，恐惧如冰水灌入脊椎。肩膀被迫展开，呼吸变得急促——"你们要干什么！放我出去！"声音颤抖但仍在逞强'},
  {id:'react_xw_bind_struggle', name:'剧烈挣扎扭动',     ownerId:'xiao_wei', trigger:'束缚', description:'拼命扭动身体试图挣脱束缚带——手腕在皮革下磨得发红，身体像离水的鱼一样在床上挣扎弹动，但每一次挣扎都让束缚带收得更紧'},
  {id:'react_xw_suspend_panic', name:'悬吊失控恐慌',     ownerId:'xiao_wei', trigger:'悬吊', description:'双脚离地的瞬间，胃部猛然下坠。全身重量悬吊在手腕和脚踝上，完全失去对身体的控制——"放我下去！求你们！"——悬空的恐惧让声音彻底变成尖叫'},

  // ── 视觉剥夺 ──
  {id:'react_xw_blind_helpless',name:'蒙眼后的无助感',   ownerId:'xiao_wei', trigger:'蒙眼', description:'黑暗笼罩的瞬间，所有触觉被放大十倍。不知道下一次触碰来自哪里、是谁——每一次意外的接触都让她全身猛地一颤，无助感在黑暗中迅速膨胀'},
  {id:'react_xw_blind_sensitive',name:'蒙眼感官超载',     ownerId:'xiao_wei', trigger:'蒙眼', description:'视觉被剥夺后，黑暗将每一丝触碰都放大了十倍——指尖划过皮肤的触感变得像电流，舌尖的温热变得像灼烧。连空气的流动都变成了挑逗'},

  // ── 媚药相关 ──
  {id:'react_xw_drug_flush',    name:'媚药敏感潮红',     ownerId:'xiao_wei', trigger:'涂抹媚药', description:'精油渗入皮肤的瞬间，一股灼热从涂抹处向全身扩散。皮肤泛起大片粉色潮红，体温急剧升高，连自己的呼吸打在皮肤上都觉得滚烫。身体开始不受控制地微微颤抖'},
  {id:'react_xw_drug_desperate',name:'媚药发作的渴求',   ownerId:'xiao_wei', trigger:'涂抹媚药', description:'药效深入后，双腿不自觉地夹紧磨蹭。下体传来从未有过的空虚感——想要被触碰、被填满。连自己都不敢相信这种渴望来自她的身体——"怎么会……我怎么会……"'},

  // ── 乳头相关 ──
  {id:'react_xw_nipple_harden', name:'乳头硬挺羞耻',     ownerId:'xiao_wei', trigger:'乳头调教', description:'舌尖触碰到乳头的瞬间，它们不受控制地立刻硬挺起来——即使她拼命摇头否认自己的身体有反应。乳尖在吸吮下充血胀大，她羞耻地闭上了眼睛'},
  {id:'react_xw_nipple_moan',   name:'乳头刺激呻吟',     ownerId:'xiao_wei', trigger:'乳头调教', description:'乳环被轻轻拉扯时，一阵酥麻从乳尖直冲小腹——一声压抑不住的呻吟从喉咙里溢出来。她立刻咬紧嘴唇，但第二声呻吟已经藏不住了'},

  // ── 阴部/抽插相关 ──
  {id:'react_xw_finger_pleasure',name:'初感快感的惊慌',   ownerId:'xiao_wei', trigger:'按摩', description:'手指第一次触碰到那个最私密的地方时，一阵陌生的快感电流般窜过脊椎——她的身体背叛了意志。小穴不受控制地渗出蜜液，她惊恐地发现：自己的身体在渴求更多'},
  {id:'react_xw_finger_buildup', name:'快感层层累积',     ownerId:'xiao_wei', trigger:'按摩', description:'手指画8字的节奏越来越快，快感像潮水一层层堆叠上来——呼吸变得急促紊乱，腰肢开始不自觉地向上挺起迎合手指的动作，她已经无法控制自己的身体了'},
  {id:'react_xw_thrust_rhythm',  name:'抽插中的身体迎合', ownerId:'xiao_wei', trigger:'抽插', description:'假阳具以九浅一深的频率进出时，她的腰开始不由自主地跟着节奏摆动——嘴上说着"不要"，身体却完美地迎合着每一次深入。在深处停留的3秒里，小穴会贪婪地收缩吸住它'},
  {id:'react_xw_thrust_denial',  name:'被中止的失落呜咽', ownerId:'xiao_wei', trigger:'抽插', description:'在高潮即将来临的前一秒，抽插戛然而止。快感断崖式坠落——下体痉挛着却什么都得不到。一声近乎哭泣的呜咽从她喉咙深处挤出来——"不要停……求你……"——说完她自己都愣住了'},

  // ── 高潮相关 ──
  {id:'react_xw_edge_shake',     name:'高潮边缘的颤抖',   ownerId:'xiao_wei', trigger:'边缘控制', description:'在快感被反复堆积又反复抽走的折磨下，她整个人悬在高潮的边缘剧烈颤抖——双眼翻白，指甲掐进掌心，脚趾蜷缩成一团。身体已经不受任何意志控制，全部感官都集中在那个即将爆炸的点上'},
  {id:'react_xw_first_climax',   name:'初次高潮的崩溃',   ownerId:'xiao_wei', trigger:'强制高潮', description:'高潮第一次席卷她的身体——小穴剧烈收缩，蜜液喷涌而出。她发出一声自己都没听过的尖叫，全身痉挛着向上弓起——眼泪、唾液、淫水同时涌出。处女之身被强制高潮夺走后的羞耻与释放一起淹没她'},
  {id:'react_xw_multi_climax',   name:'连续高潮失神',     ownerId:'xiao_wei', trigger:'强制高潮', description:'第一波高潮还没完全褪去，第二波已经接踵而至——连续的高潮让她完全失去意识片刻。双眼失焦地望向空中，嘴唇微张，只有破碎的呻吟从喉咙里断断续续地漏出来'},
  {id:'react_xw_intense_climax', name:'激烈高潮虚脱',     ownerId:'xiao_wei', trigger:'强制高潮', description:'最猛烈的一次高潮——身体如被闪电击中般剧烈抽搐了十几秒，然后彻底瘫软。全身肌肉松弛，大腿内侧满是淫水的痕迹，她躺在那里一动不动，只有小穴还在微弱地痉挛着'},

  // ── 口塞相关 ──
  {id:'react_xw_gag_muffled',    name:'被封住的求饶声',   ownerId:'xiao_wei', trigger:'堵嘴', description:'口塞塞入的瞬间，所有声音都被堵在喉咙里——想尖叫变成含糊的"唔——唔——"，想求饶变成无意义的呜咽。嘴角淌下的唾液落在胸口，连擦拭都做不到——这种彻底的失声比任何羞辱都更摧毁自尊'},
  {id:'react_xw_gag_drool',      name:'口塞流涎的屈辱',   ownerId:'xiao_wei', trigger:'堵嘴', description:'含住口塞太久，唾液不受控制地从嘴角滑落——顺着下巴滴到锁骨，又流向乳房。她拼命想抿紧嘴唇阻止，但口塞让她连合上嘴都做不到。一道晶莹的口水线挂在胸前，被大姐用指尖挑起——"看看你现在的样子。"'},

  // ── 肛塞相关 ──
  {id:'react_xw_plug_intrude',   name:'后庭初次被入侵',   ownerId:'xiao_wei', trigger:'肛塞', description:'肛塞触碰到后庭入口的瞬间，她全身僵硬——那是她从来不知道可以被触碰的地方。金属的冰凉感与精油的热滑同时传来，后穴在异物撑开下剧烈收缩——"那里不行……那里真的不行……"'},
  {id:'react_xw_plug_shame',     name:'双穴被占的羞耻',   ownerId:'xiao_wei', trigger:'肛塞', description:'前穴被跳蛋震动、后穴被肛塞填满——两个最私密的地方同时被异物占据，前后夹击的快感与羞耻同时在体内炸开。连夹紧双腿都做不到，只能敞开着被彻底使用'},

  // ── 鞭打相关 ──
  {id:'react_xw_whip_pain',      name:'鞭打的疼痛忍耐',   ownerId:'xiao_wei', trigger:'鞭打', description:'皮鞭落在大腿内侧的瞬间，一道火辣辣的刺痛炸开——她嘶声倒吸一口冷气，眼泪立刻涌了上来。但疼痛过后，被鞭打处的皮肤却传来一阵诡异的温热酥麻——痛和痒的边界开始模糊'},
  {id:'react_xw_whip_tears',     name:'疼痛中的泪水',     ownerId:'xiao_wei', trigger:'鞭打', description:'第三鞭落下时，她终于忍不住了——泪水无声地滑落。不是因为痛，而是因为羞耻：她发现自己竟然在等下一鞭落下。疼痛已经变成了某种她不愿承认的期待'},

  // ── 言语/心理相关 ──
  {id:'react_xw_shame_break',    name:'被羞辱的心理崩坏', ownerId:'xiao_wei', trigger:'言语羞辱', description:'听到二姐详细描述自己下体湿润程度的那一刻，羞耻感如拳头击穿了最后的心理防线——眼泪大颗大颗掉下来。她用尽全力喊出"我不是那样的女人"，但声音虚弱得连自己都不信'},
  {id:'react_xw_beg_meat',       name:'崩溃后的渴求肉棒', ownerId:'xiao_wei', trigger:'言语羞辱', description:'在长期的边缘折磨和言语攻心下，意志彻底崩坏。她从喉咙深处挤出连自己都不敢相信的话——"给我……求你们……让我……"——眼睛不受控制地望向少爷的方向，身体不自觉地朝他爬过去半步'},

  // ── 冰火相关 ──
  {id:'react_xw_icefire_confuse',name:'冰火交替感官错乱', ownerId:'xiao_wei', trigger:'冰火交替', description:'冰块沿脊椎滑下的极寒与热蜡滴在乳尖的灼烫同时炸开——大脑来不及分辨冷和热，全部感官信号变成了一团混乱的电流。她发出的声音介于尖叫和呻吟之间，连自己都不知道是抗拒还是渴求'},

  // ── 最终屈服 ──
  {id:'react_xw_serve_instantly',name:'少爷临幸的即堕反应',ownerId:'xiao_wei', trigger:'最终征服', description:'少爷的肉棒第一次碰到她穴口的瞬间——仅仅是触碰——她就全身猛地一颤。敏感度已被推至极限的身体在几次抽送后就再也控制不住——"少爷……少爷……我不行了……"——从未有过的高潮如海啸般碾过身体'},
  {id:'react_xw_yield_answer',   name:'彻底屈服后的告白', ownerId:'xiao_wei', trigger:'最终征服', description:'高潮的余韵中，她瘫软在少爷身下。他托起她的下巴——"告诉我，你是谁的女人。"她攥紧手中那条被泪水浸透的丝带，嘴唇颤抖着说出了答案——"是……我是少爷的女人。"这句话出口的瞬间，最后一丝骄傲也消散了'},
  {id:'react_xw_yield_empty',    name:'屈服后的虚脱茫然', ownerId:'xiao_wei', trigger:'任何调教行动', description:'一切结束后的寂静中，她躺在被汗水、泪水、淫水浸透的床单上——眼神空洞地望向天花板，身体完全瘫软，连抬起一只手的力量都没有。从骄傲的女大学生到少爷的专属物，只有她知道这中间经过了什么'}
];

console.log('Actions:', story.actions.length);
console.log('Reactions:', story.reactions.length);

fs.writeFileSync(storyPath, JSON.stringify(story, null, 2), 'utf-8');
console.log('Done - written to', storyPath);
