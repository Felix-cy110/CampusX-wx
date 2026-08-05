// 模拟数据 - 所有数据均来自 Sketch 设计稿
const mock = {

  // 聊天列表
  conversations: [
    { id: 1, name: '高涵', avatar: '/images/avatars/高涵.png', lastMsg: '没问题，你快去吧。我在小区门口等你。', time: '10:37', unread: 3, type: 'friend' },
    { id: 2, name: '于雪', avatar: '/images/avatars/于雪.png', lastMsg: '那你稍等我一会，我马上下来。我们看完展...', time: '昨天', unread: 12, type: 'friend' },
    { id: 3, name: '杨世豪', avatar: '/images/avatars/杨世豪.png', lastMsg: '可能下午我们会一起去新开的一家店吃饭。', time: '前天', unread: 0, type: 'friend' },
    { id: 4, name: '邱玉北', avatar: '/images/avatars/邱玉北.png', lastMsg: '新开的吗？你有去过吗？有什么好吃的推荐...', time: '3天', unread: 0, type: 'friend' },
    { id: 8, name: '黄梦云', avatar: '/images/avatars/default.png', lastMsg: '有很多特色的菜品，都是新推出的，我还没...', time: '28天', unread: 0, type: 'friend' },
    { id: 9, name: '李小宣', avatar: '/images/avatars/default.png', lastMsg: '好的，我先去拿东西。我们一会在车上聊。', time: '29天', unread: 0, type: 'friend' },
    { id: 10, name: '李春雨', avatar: '/images/avatars/default.png', lastMsg: '今天看来天气不错啊。', time: '1个月', unread: 0, type: 'friend' },
    { id: 11, name: '沈晖', avatar: '/images/avatars/沈慧.png', lastMsg: '是的,一点也不像天气预报说的那样。', time: '1个月', unread: 0, type: 'friend' },
    { id: 12, name: '萧晖', avatar: '/images/avatars/default.png', lastMsg: '但愿整个周末都能保持这样的好天气。', time: '1个月', unread: 0, type: 'friend' },
    { id: 5, name: '李天逸', avatar: '/images/avatars/李天逸.png', lastMsg: '没问题，你快去吧。我在小区门口等你。', time: '10:37', unread: 1, type: 'temp' },
    { id: 6, name: '杨泽华', avatar: '/images/avatars/杨泽华.png', lastMsg: '那你稍等我一会，我马上下来。我们看完展...', time: '昨天', unread: 23, type: 'temp' },
    { id: 7, name: '李梦慧', avatar: '/images/avatars/李梦慧.png', lastMsg: '可能下午我们会一起去新开的一家店吃饭。', time: '前天', unread: 0, type: 'temp' },
  ],

  // 动态帖子
  posts: [
    {
      id: 1,
      type: 'feed',
      user: { name: 'Starry', avatar: '/images/avatars/Starry.png', uid: '12345678' },
      title: '文艺青年最后的音乐据点：网易云音乐评论区',
      content: '我们从分享时机、分享形式、分享动机、分享场景4个维度来聊聊「社交分享」的那些事儿。',
      fullContent: '我们从分享时机、分享形式、分享动机、分享场景4个维度来聊聊「社交分享」的那些事儿。\n\n网易云音乐的评论区，是国内互联网里少有的一片「文艺净土」。在这里，听众不只是被动接受音乐，更主动创作文字，把情感投射到旋律里。一首歌下面，往往能看到几百条真情实感的留言。\n\n从分享动机来看，用户在网易云分享，更多是一种情感出口——「这首歌说出了我想说的话」。这和微博的「炫耀型分享」或微信的「社交维系型分享」有本质区别。\n\n分享场景上，深夜是高峰期。孤独感��音乐产生化学反应，促使用户打开评论区倾诉。这也是为什么网易云的评论普遍比其他平台更「走心」。',
      images: ['/images/sketch/179dd70c4388372729a818ff771ec95455423243.png', '/images/sketch/09b3ae480f6328a17c73e1689ba1200d202926f8.png'],
      stats: { likes: 65, comments: 13, shares: 0 },
      time: '3小时',
      liked: false,
      isOwn: false,
      school: '南京信息工程大学'
    },
    {
      id: 2,
      type: 'feed',
      user: { name: '李莎莎', avatar: '/images/avatars/李莎莎.png', uid: '23456789' },
      title: '下面我们会从不同维度来分析一下APP的社交分享功能设计',
      content: '下面我们会从不同维度来分析一下APP的社交分享功能设计，看看这里面有哪些值得注意的点。',
      fullContent: '下面我们会从不同维度来分析一下APP的社交分享功能设计，看看这里面有哪些值得注意的点。\n\n首先是分享时机：被动触发 vs 主动分享。被动触发指系统在某个时机主动提示用户分享，比如截图时弹窗；主动分享则是用户自己找到分享入口操作。\n\n其次是分享形式：图文卡片、链接、截图、海报等。不同形式适合不同场景，海报适合朋友圈，链接适合私聊。\n\n最后是分享动机：炫耀、记录、利益驱动、情感共鸣……理解用户真实动机，才能设计出真正被使用的分享功能，而不是一个没人点的按钮。',
      images: ['/images/sketch/f1ad334c7d5e3be74216154a8a39614c0296aebb.png'],
      stats: { likes: 42, comments: 12, shares: 0 },
      time: '1天',
      liked: true,
      isOwn: true
    },
    {
      id: 3,
      type: 'feed',
      user: { name: '谭明扬', avatar: '/images/avatars/谭明扬.png', uid: '34567890' },
      title: '现在很多APP在用户截图时会自动提示分享',
      content: '现在很多APP在用户截图时会自动提示用户是否要进行分享...',
      fullContent: '现在很多APP在用户截图时会自动提示用户是否要进行分享，这是一种典型的「被动触发」分享设计。\n\n这个功能最早由小红书大规模推广，随后抖音、B站等平台相继跟进。其核心逻辑是：用户截图这个动作本身，就已经说明他对这个内容感兴趣、有保存或分享的意图。\n\n但这类设计也有争议：频繁弹窗会影响体验，尤其是用户只是想截图保存而非分享时。更好的做法是在弹窗中提供「不再提示」选项，或者通过机器学习判断用户截图的真实意图。',
      images: ['/images/sketch/568cc16fcde9d74720e2e0457a806f90c692e7c0.png'],
      stats: { likes: 16, comments: 9, shares: 0 },
      time: '3小时',
      liked: false,
      isOwn: false
    },
    {
      id: 4,
      type: 'feed',
      user: { name: '张德栋', avatar: '/images/avatars/张德栋.png', uid: '45678901' },
      title: '用户主动点击分享的设计思考',
      content: '用户主动点击分享 绝大多数APP都是在详情页等需要分享的页面放置一个分享按钮，由用户自行选择...',
      fullContent: '用户主动点击分享：绝大多数APP都是在详情页等需要分享的页面放置一个分享按钮，由用户自行选择是否分享。\n\n这种方式的优点是不打扰用户，尊重用户的自主意愿；缺点是分享率相对较低，因为需要用户主动发现并点击入口。\n\n提升主动分享率的几个思路：1. 将分享按钮放在更显眼的位置；2. 提供分享激励（积分、解锁内容）；3. 优化分享卡片的视觉效果，让用户觉得「发出去好看」；4. 减少分享步骤，一键直达目标平台。',
      images: [],
      stats: { likes: 23, comments: 5, shares: 0 },
      time: '3天',
      liked: false,
      isOwn: false
    },
    {
      id: 5,
      type: 'feed',
      user: { name: '陈雪', avatar: '/images/avatars/陈雪.png', uid: '56789012' },
      title: '有没有人一起组队参加数学建模比赛',
      content: '找两个队友一起参加今年的数学建模国赛，最好有一定编程基础，会MATLAB或Python都行。',
      images: [],
      stats: { likes: 38, comments: 21, shares: 0 },
      time: '1小时',
      liked: false,
      isOwn: false
    },
    {
      id: 6,
      type: 'feed',
      user: { name: '王涛', avatar: '/images/avatars/王涛.png', uid: '67890123' },
      title: '图书馆三楼空调坏了，太热了',
      content: '有没有人知道啥时候能修好啊，三楼自习室根本没法待，大家都挤到二楼去了...',
      images: ['/images/sketch/568cc16fcde9d74720e2e0457a806f90c692e7c0.png'],
      stats: { likes: 52, comments: 18, shares: 0 },
      time: '2小时',
      liked: true,
      isOwn: false
    },
    {
      id: 7,
      type: 'feed',
      user: { name: '赵敏', avatar: '/images/avatars/赵敏.png', uid: '78901234' },
      title: '分享一个超好用的笔记方法',
      content: '最近试了康奈尔笔记法，真的记东西效率高了很多！尤其适合上课记笔记和期末复习，推荐给学弟学妹们~',
      images: ['/images/sketch/f1ad334c7d5e3be74216154a8a39614c0296aebb.png'],
      stats: { likes: 89, comments: 32, shares: 5 },
      time: '3小时',
      liked: false,
      isOwn: false
    },
    {
      id: 8,
      type: 'feed',
      user: { name: '李天芳', avatar: '/images/avatars/李天芳.png', uid: '89012345' },
      title: '食堂新开的麻辣烫窗口绝了',
      content: '二食堂二楼新开的麻辣烫，汤底特别香，价格也不贵，人均15块就能吃饱，强烈安利！',
      images: ['/images/sketch/179dd70c4388372729a818ff771ec95455423243.png'],
      stats: { likes: 126, comments: 45, shares: 12 },
      time: '5小时',
      liked: true,
      isOwn: false
    },
    {
      id: 9,
      type: 'feed',
      user: { name: '杨世豪', avatar: '/images/avatars/杨世豪.png', uid: '90123456' },
      title: '今天操场有人摆摊卖旧书，淘到几本好书',
      content: '花了不到50块买了三本专业相关的参考书，品相都还不错。听说明天下午还有，大家可以去看看。',
      images: [],
      stats: { likes: 34, comments: 11, shares: 0 },
      time: '6小时',
      liked: false,
      isOwn: false
    },
    {
      id: 10,
      type: 'feed',
      user: { name: '高涵', avatar: '/images/avatars/高涵.png', uid: '01234567' },
      title: '最近学校里的猫越来越多了',
      content: '在宿舍楼下、图书馆门口、教学楼附近都能看到猫，有没有人知道是流浪猫还是有同学养的？有几只特别亲人~',
      images: [],
      stats: { likes: 67, comments: 28, shares: 0 },
      time: '1天',
      liked: false,
      isOwn: false
    },
    {
      id: 11,
      type: 'feed',
      user: { name: '邱玉北', avatar: '/images/avatars/邱玉北.png', uid: '11223344' },
      title: '求推荐学校附近好吃的烧烤店',
      content: '周末想和室友一起去吃烧烤，学校附近有没有性价比高的店推荐？人均50以内，最好能步行到的那种。',
      images: [],
      stats: { likes: 22, comments: 36, shares: 0 },
      time: '1天',
      liked: false,
      isOwn: false
    },
    {
      id: 12,
      type: 'feed',
      user: { name: '李梦慧', avatar: '/images/avatars/李梦慧.png', uid: '22334455' },
      title: '今晚操场有吉他弹唱，气氛超好',
      content: '几个大四学长在操场弹吉他唱歌，围了很多人，感觉这才是大学该有的样子。可惜快要毕业了...',
      images: ['/images/sketch/09b3ae480f6328a17c73e1689ba1200d202926f8.png'],
      stats: { likes: 215, comments: 58, shares: 23 },
      time: '1天',
      liked: true,
      isOwn: false
    }
  ],

  // 集市商品
  marketItems: [
    {
      id: 101,
      type: 'secondhand',
      user: { name: '陈雪', avatar: '/images/avatars/陈雪.png' },
      title: '二手书-高等数学第七版',
      content: '九成新，只用了一学期，笔记很少',
      price: 15.00,
      stats: { likes: 12, comments: 3 },
      time: '46分钟',
      status: 'available',
      tag: '二手书',
      images: ['/images/sketch/374a2aa50c46e233a9cbcefa0489c5c1b7c7adb0.png']
    },
    {
      id: 102,
      type: 'secondhand',
      user: { name: '李天芳', avatar: '/images/avatars/李天芳.png' },
      title: 'iPhone 15 Pro Max 256GB',
      content: '使用半年，无磕碰，配件齐全',
      price: 6800.00,
      stats: { likes: 28, comments: 15 },
      time: '2小时',
      status: 'available',
      tag: '数码',
      images: ['/images/sketch/09b3ae480f6328a17c73e1689ba1200d202926f8.png']
    },
    {
      id: 103,
      type: 'rental',
      user: { name: '王涛', avatar: '/images/avatars/王涛.png' },
      title: '考研数学复习全书',
      content: '可租赁，按月计费',
      price: 8.00,
      originalPrice: 45.00,
      stats: { likes: 8, comments: 2 },
      time: '5小时',
      status: 'available',
      tag: '二手书',
      images: ['/images/sketch/374a2aa50c46e233a9cbcefa0489c5c1b7c7adb0.png'],
      isRent: true,
      images: ['/images/sketch/6818c3def960f792e0ac227d443b4cff71480894.png']
    },
    {
      id: 104,
      type: 'buyout',
      user: { name: '赵敏', avatar: '/images/avatars/赵敏.png' },
      title: '闲置台灯 LED护眼',
      content: '毕业出，功能完好',
      price: 29.90,
      originalPrice: 89.00,
      stats: { likes: 5, comments: 1 },
      time: '1天',
      status: 'available',
      tag: '其他闲置',
      images: ['/images/sketch/7e7d5d041b63078acdcb76505ff820cfe630678b.png']
    }
  ],

  // 组队
  teams: [
    {
      id: 201,
      type: 'carpool',
      user: { name: '陈雪', avatar: '/images/avatars/陈雪.png' },
      title: '周六拼车去市中心',
      content: '周六下午2点出发，学校南门集合，有3个空位',
      reward: null,
      stats: { likes: 8, comments: 4 },
      time: '46分钟',
      status: 'available',
      tag: '拼车'
    },
    {
      id: 202,
      type: 'study',
      user: { name: '李天芳', avatar: '/images/avatars/李天芳.png' },
      title: '期末图书馆组队学习',
      content: '每天下午6点-10点，图书馆4楼，互相监督',
      reward: null,
      stats: { likes: 15, comments: 7 },
      time: '2小时',
      status: 'available',
      tag: '学习'
    },
    {
      id: 203,
      type: 'sport',
      user: { name: '王力', avatar: '/images/avatars/王力.png' },
      title: '羽毛球约球 周末',
      content: '周末上午体育馆，双打缺1人，水平不限',
      reward: null,
      stats: { likes: 6, comments: 3 },
      time: '3小时',
      status: 'available',
      tag: '运动'
    },
    {
      id: 204,
      type: 'game',
      user: { name: '张伟', avatar: '/images/avatars/张伟.png' },
      title: '王者荣耀开黑 缺辅助',
      content: '晚上8点，钻石段位，来不坑的',
      reward: null,
      stats: { likes: 10, comments: 8 },
      time: '1小时',
      status: 'available',
      tag: '游戏'
    }
  ],

  // 评分
  ratings: [
    {
      id: 301,
      type: 'food',
      title: '二食堂麻辣香锅',
      content: '味道正宗，价格实惠，推荐中辣',
      score: 4.5,
      user: { name: '陈雪', avatar: '/images/avatars/陈雪.png' },
      stats: { likes: 32, comments: 8 },
      time: '2小时',
      tag: '美食'
    },
    {
      id: 302,
      type: 'course',
      title: '数据结构-张教授',
      content: '讲课清晰，作业量适中，考前会划重点',
      score: 4.8,
      user: { name: '李明', avatar: '/images/avatars/李明.png' },
      stats: { likes: 45, comments: 12 },
      time: '1天',
      tag: '教师'
    },
    {
      id: 303,
      type: 'other',
      title: '校园猫咪"大橘"',
      content: '图书馆门口的橘猫，每天都来晒太阳',
      score: 4.9,
      user: { name: '王芳', avatar: '/images/avatars/王芳.png' },
      stats: { likes: 88, comments: 20 },
      time: '3天',
      tag: '动物'
    },
    {
      id: 304,
      type: 'course',
      title: '线性代数-刘老师',
      content: '板书工整，深入浅出，期末给分大方',
      score: 4.6,
      user: { name: '蔡俊', avatar: '/images/avatars/蔡俊.png' },
      stats: { likes: 25, comments: 6 },
      time: '5小时',
      tag: '课程'
    },
    {
      id: 305,
      type: 'other',
      title: '计算机学院院花-小林',
      content: '人美声甜，成绩还特别好，公认的学霸女神',
      score: 4.9,
      user: { name: '黎小新', avatar: '/images/avatars/黎小新.png' },
      stats: { likes: 156, comments: 42 },
      time: '6小时',
      tag: '校花'
    },
    {
      id: 306,
      type: 'other',
      title: '校园小狗"豆豆"',
      content: '东门保安养的小黄狗，特别亲人，每次路过都摇尾巴',
      score: 5.0,
      user: { name: '张文春', avatar: '/images/avatars/张文春.png' },
      stats: { likes: 66, comments: 15 },
      time: '12小时',
      tag: '动物'
    },
    {
      id: 307,
      type: 'other',
      title: '校园奶茶店测评',
      content: '新开的那家很不错，珍珠很Q弹，价格也不贵',
      score: 4.3,
      user: { name: '郝小芳', avatar: '/images/avatars/郝小芳.png' },
      stats: { likes: 18, comments: 4 },
      time: '2天',
      tag: '其他'
    }
  ],

  // 跑腿
  errands: [
    {
      id: 401,
      type: 'errand',
      user: { name: '陈雪', avatar: '/images/avatars/陈雪.png' },
      title: '帮忙取快递',
      content: '中通快递，在西门菜鸟驿站，取件码 3-5-8832',
      reward: 15,
      stats: { likes: 3, comments: 2 },
      time: '46分钟',
      status: 'available',
      delivery: '当面交付',
      tag: '默认'
    },
    {
      id: 402,
      type: 'errand',
      user: { name: '李天芳', avatar: '/images/avatars/李天芳.png' },
      title: '带一份二食堂晚饭',
      content: '要一份红烧肉套餐，送到北区3号楼',
      reward: 8,
      stats: { likes: 2, comments: 1 },
      time: '2小时',
      status: 'taken',
      delivery: '当面交付',
      tag: '默认'
    },
    {
      id: 403,
      type: 'errand',
      user: { name: '赵敏', avatar: '/images/avatars/赵敏.png' },
      title: '帮忙打印论文',
      content: '明天上午去图书馆打印店，李老师办公室交',
      reward: 5,
      stats: { likes: 0, comments: 0 },
      time: '15分钟',
      status: 'available',
      delivery: '当面交付',
      tag: '默认'
    },
    {
      id: 404,
      type: 'errand',
      user: { name: '王涛', avatar: '/images/avatars/王涛.png' },
      title: '帮忙搬运教材',
      content: '从教材科搬到教学楼，大概两箱书',
      reward: 12,
      stats: { likes: 5, comments: 3 },
      time: '1小时',
      status: 'taken',
      delivery: '当面交付',
      tag: '默认'
    },
    {
      id: 405,
      type: 'errand',
      user: { name: '王芳', avatar: '/images/avatars/王芳.png' },
      title: '帮忙取外卖',
      content: '北门校门口，美团骑手，送到8号宿舍楼下',
      reward: 6,
      stats: { likes: 1, comments: 0 },
      time: '32分钟',
      status: 'available',
      delivery: '当面交付',
      tag: '默认'
    },
    {
      id: 406,
      type: 'errand',
      user: { name: '蔡俊', avatar: '/images/avatars/蔡俊.png' },
      title: '代买奶茶',
      content: '一点点波霸奶茶大杯少冰三分甜，送到教学楼A区',
      reward: 4,
      stats: { likes: 2, comments: 0 },
      time: '3小时',
      status: 'available',
      delivery: '当面交付',
      tag: '默认'
    }
  ],

  // 帖子评论（供详情页 fallback 使用）
  postComments: [
    {
      id: 101,
      userId: '1001',
      nickname: '测试账号',
      avatarUrl: '/images/avatars/default.png',
      createdAt: '2026-05-31T16:29:00',
      content: '南信大神了',
      likeCount: 1,
      liked: false,
      replies: [
        {
          id: 102,
          userId: '1002',
          nickname: 'xth',
          avatarUrl: '/images/avatars/default.png',
          createdAt: '2026-06-05T16:29:00',
          content: '还有坤哥的事',
          likeCount: 0,
          liked: false,
          replies: []
        },
        {
          id: 103,
          userId: '1002',
          nickname: 'xth',
          avatarUrl: '/images/avatars/default.png',
          createdAt: '2026-06-05T16:30:00',
          content: '1',
          likeCount: 0,
          liked: false,
          replies: []
        },
        {
          id: 104,
          userId: '1002',
          nickname: 'xth',
          avatarUrl: '/images/avatars/default.png',
          createdAt: '2026-06-05T16:31:00',
          content: '123',
          likeCount: 0,
          liked: false,
          replies: []
        }
      ]
    }
  ],

  // 消息通知
  notifications: {
    likes: { count: 3, list: [] },
    followers: { count: 2, list: [] },
    comments: { count: 5, list: [] },
    system: { count: 2, list: [] }
  },

  // 系统消息
  systemMessages: [
    { id: 1, title: '校园卡充值优惠活动', msg: '亲爱的同学，为庆祝新学期开始，校园卡充值享9折优惠，活动时间：2026年6月1日-6月15日。充值满100元立减10元，每个账号限参与一次。', time: '10:37', unread: true },
    { id: 2, title: '二手交易平台升级通知', msg: '亲爱的用户，二手交易模块已全新升级！现在支持商品分类筛选、价格区间搜索、卖家信用评分等功能。欢迎体验并提出宝贵意见。', time: '昨天', unread: true },
    { id: 3, title: '图书馆周末开放时间调整', msg: '接学校通知，本周末（6月6日-6月7日）图书馆开放时间调整为8:00-20:00。请同学们合理安排自习时间。', time: '前天', unread: false },
    { id: 4, title: '校园跑腿服务正式上线', msg: '足不出户也能办事！校园跑腿服务现已上线，支持代取快递、代买餐食、代打印等。新用户首单免跑腿费，快来体验吧！', time: '3天', unread: false },
    { id: 5, title: '关于毕业生离校手续办理通知', msg: '2026届毕业生离校手续办理时间为6月20日-6月30日。请各毕业生提前完成图书馆还书、宿舍退宿、学费结清等事项。', time: '28天', unread: false },
    { id: 6, title: '校园社区公约更新公告', msg: '为进一步营造良好的社区氛围，我们更新了校园社区公约。新增内容：禁止发布商业广告、禁止人身攻击、禁止刷屏行为。详情请查看公约全文。', time: '29天', unread: false }
  ],

  // 点赞列表（谁赞了我）
  likedList: [
    { userId: '1001', name: '张三丰', avatar: '/images/avatars/Starry.png', postId: 1, postTitle: '文艺青年最后的音乐据点' },
    { userId: '1002', name: '李晓明', avatar: '/images/avatars/李莎莎.png', postId: 2, postTitle: '社交分享功能设计分析' },
    { userId: '1003', name: '王语嫣', avatar: '/images/avatars/李天逸.png', postId: 1, postTitle: '文艺青年最后的音乐据点' }
  ],

  // 粉丝列表
  followerList: [
    { userId: '2001', name: '陈独秀', avatar: '/images/avatars/杨泽华.png', campusName: '南京信息工程大学', followedByMe: true },
    { userId: '2002', name: '林徽因', avatar: '/images/avatars/李梦慧.png', campusName: '南京信息工程大学', followedByMe: false }
  ],

  // 关注列表
  followingList: [
    { userId: '3001', name: '徐志摩', avatar: '/images/avatars/于雪.png', campusName: '南京信息工程大学', followedByMe: true },
    { userId: '3002', name: '陆小曼', avatar: '/images/avatars/邱玉北.png', campusName: '南京信息工程大学', followedByMe: true },
    { userId: '3003', name: '沈从文', avatar: '/images/avatars/杨世豪.png', campusName: '南京信息工程大学', followedByMe: true }
  ],

  // 评论和@
  commentsAndAt: [
    { id: 1, user: '李泽夏', userId: '4001', avatar: '/images/avatars/高涵.png', action: '评论了你', content: '分析得太透彻了！尤其是分享动机那段，说到我心坎里了。', ref: '用户主动点击分享 绝大多数APP都是在...', postId: 1 },
    { id: 2, user: '郝小芳', userId: '4002', avatar: '/images/avatars/default.png', action: '提及到你', content: '@Starry 快来看这篇文章，感觉是你喜欢的风格', ref: null, postId: 2 },
    { id: 3, user: '马力扬', userId: '4003', avatar: '/images/avatars/default.png', action: '评论了你', content: '学到了很多，期待更多干货分享！', ref: '下面我们会从不同维度来分析一下APP的社交分享功能设计...', postId: 2 },
    { id: 4, user: '赵灵儿', userId: '4004', avatar: '/images/avatars/沈慧.png', action: '提及到你', content: '@Starry 这个帖子好有意思，你有看到吗', ref: null, postId: 3 },
    { id: 5, user: '唐伯虎', userId: '4005', avatar: '/images/avatars/高涵.png', action: '评论了你', content: '不错不错，顶一个！👍', ref: '文艺青年最后的音乐据点：网易云音乐评论区', postId: 1 }
  ],

  // 搜索历史
  searchHistory: ['马婷云', '邓天宣', '刘康康', '沈慧', '阎伟', '程子云'],

  // 搜索结果-用户
  searchUsers: [
    { name: '张文春', avatar: '/images/avatars/张文春.png', school: '南京信息工程大学' },
    { name: '贾万扬', avatar: '/images/avatars/贾万扬.png', school: '南京信息工程大学' },
    { name: '尹一志', avatar: '/images/avatars/尹一志.png', school: '南京信息工程大学' },
    { name: '戴轩扬', avatar: '/images/avatars/戴轩扬.png', school: '南京信息工程大学' }
  ],

  // 搜索结果-帖子
  searchPosts: [
    {
      user: { name: '唐怡奇', avatar: '/images/avatars/唐怡奇.png' },
      content: '我们从分享时机、分享形式、分享动机、分享场景4个维度来聊聊「社交...',
      stats: { likes: 16, comments: 9 },
      time: '3小时',
      status: '可联系',
      price: 0
    },
    {
      user: { name: '任小平', avatar: '/images/avatars/任小平.png' },
      content: '下面我们会从不同维度来分析一下APP的社交分享功能设计，看看这里面有哪些值...',
      stats: { likes: 12, comments: 5 },
      time: '3天',
      status: '可联系',
      price: 0
    },
    {
      user: { name: '董敏', avatar: '/images/avatars/董敏.png' },
      content: '下面我们会从不同维度来分析一下APP的社交分享功能设计，看看这里面有哪...',
      stats: { likes: 8, comments: 3 },
      time: '3天',
      status: '可联系',
      price: 0
    }
  ],

  // 学校列表
  schools: [
    { id: 1, name: '上海大学', count: '5.5万', province: '上海', city: '上海' },
    { id: 2, name: '中国海洋大学', count: '4.0万', province: '山东', city: '青岛' },
    { id: 3, name: '中国政法大学', count: '3.4万', province: '北京', city: '北京' },
    { id: 4, name: '天津财经大学', count: '6.4万', province: '天津', city: '天津' },
    { id: 5, name: '江苏大学', count: '4.1万', province: '江苏', city: '镇江' },
    { id: 6, name: '南京大学', count: '4.5万', province: '江苏', city: '南京' },
    { id: 7, name: '南京信息工程大学', count: '2.8万', province: '江苏', city: '南京', posts: '2.8w', users: '15463' },
    { id: 8, name: '南京工业大学', count: '3.3万', province: '江苏', city: '南京' }
  ],

  // 院系专业列表（供选择专业页使用）
  departmentMajorMap: [
    {
      id: 1, name: '计算机学院', majors: [
        { id: 101, name: '计算机科学', departmentId: 1 },
        { id: 102, name: '软件工程', departmentId: 1 },
        { id: 103, name: '网络工程', departmentId: 1 }
      ]
    },
    {
      id: 2, name: '电子工程学院', majors: [
        { id: 201, name: '电子工程', departmentId: 2 },
        { id: 202, name: '通信工程', departmentId: 2 }
      ]
    },
    {
      id: 3, name: '外国语学院', majors: [
        { id: 301, name: '英语', departmentId: 3 },
        { id: 302, name: '日语', departmentId: 3 }
      ]
    },
    {
      id: 4, name: '经济管理学院', majors: [
        { id: 401, name: '经济学', departmentId: 4 },
        { id: 402, name: '工商管理', departmentId: 4 },
        { id: 403, name: '会计学', departmentId: 4 }
      ]
    },
    {
      id: 5, name: '文学院', majors: [
        { id: 501, name: '中文系', departmentId: 5 },
        { id: 502, name: '新闻学', departmentId: 5 }
      ]
    },
    {
      id: 6, name: '理学院', majors: [
        { id: 601, name: '数学系', departmentId: 6 },
        { id: 602, name: '物理系', departmentId: 6 },
        { id: 603, name: '统计学', departmentId: 6 }
      ]
    },
    {
      id: 7, name: '法学院', majors: [
        { id: 701, name: '法学', departmentId: 7 },
        { id: 702, name: '马克思主义', departmentId: 7 }
      ]
    },
    {
      id: 8, name: '土木工程学院', majors: [
        { id: 801, name: '土木工程', departmentId: 8 },
        { id: 802, name: '机械工程', departmentId: 8 },
        { id: 803, name: '自动化', departmentId: 8 }
      ]
    }
  ],

  // 专业列表（旧版，保留兼容）
  majors: [
    { name: '1专业', count: '125' },
    { name: '2专业', count: '102' },
    { name: '3专业', count: '78' },
    { name: '4专业', count: '89' },
    { name: '5专业', count: '100' },
    { name: '6专业', count: '102' },
    { name: '7专业', count: '132' },
    { name: '8专业', count: '96' }
  ],

  // 我的书单
  booklist: [
    { title: '书名', publisher: 'xxxx出版社', semester: '大一上', cover: '/images/sketch/179dd70c4388372729a818ff771ec95455423243.png' },
    { title: '书名', publisher: 'xxxx出版社', semester: '大一上', cover: '/images/sketch/09b3ae480f6328a17c73e1689ba1200d202926f8.png' },
    { title: '书名', publisher: 'xxxx出版社', semester: '大一下', cover: '/images/sketch/f1ad334c7d5e3be74216154a8a39614c0296aebb.png' },
    { title: '书名', publisher: 'xxxx出版社', semester: '大一下', cover: '/images/sketch/568cc16fcde9d74720e2e0457a806f90c692e7c0.png' },
    { title: '书名', publisher: 'xxxx出版社', semester: '大二上', cover: '/images/sketch/22b68413c38ca21ddb1d26a74ca0809752385a80.png' },
    { title: '书名', publisher: 'xxxx出版社', semester: '大二上', cover: '/images/sketch/25a8356c47527f2136c2a561a0e9de130e28bffd.png' },
    { title: '书名', publisher: 'xxxx出版社', semester: '大二下', cover: '/images/sketch/29e1e9bda04ee8ec792b868eb3b94e43f2dc88f7.png' },
    { title: '书名', publisher: 'xxxx出版社', semester: '大二下', cover: '/images/sketch/2b9ae21d4113d522a06330b2415e3eb8c44dac50.png' }
  ],

  // 关注/粉丝列表
  followingList: [
    { name: '李常秋', avatar: '/images/avatars/李常秋.png', isFollowed: true, hasNew: true },
    { name: '杨瑶', avatar: '/images/avatars/杨瑶.png', isFollowed: true, hasNew: false },
    { name: '蔡梓芳', avatar: '/images/avatars/蔡梓芳.png', isFollowed: true, hasNew: true },
    { name: '许强', avatar: '/images/avatars/许强.png', isFollowed: true, hasNew: false },
    { name: '汤乐乐', avatar: '/images/avatars/汤乐乐.png', isFollowed: true, hasNew: true },
    { name: '曾冬', avatar: '/images/avatars/曾冬.png', isFollowed: true, hasNew: false },
    { name: '沈慧', avatar: '/images/avatars/沈慧.png', isFollowed: true, hasNew: false },
    { name: '戴轩扬', avatar: '/images/avatars/戴轩扬.png', isFollowed: true, hasNew: true }
  ],
  followerList: [
    { name: '汤乐乐', avatar: '/images/avatars/汤乐乐.png', isMutual: true },
    { name: '许强', avatar: '/images/avatars/许强.png', isMutual: true },
    { name: '曾冬', avatar: '/images/avatars/曾冬.png', isMutual: false }
  ],

  // 关注用户的动态帖子
  followingPosts: [
    {
      id: 201, type: 'feed',
      user: { name: '李常秋', avatar: '/images/avatars/李常秋.png', uid: '11111111' },
      title: '今天在实验室发现了有意思的现象',
      content: '在做机器学习实验的时候，发现当数据集增加到一定程度之后，简单的模型反而表现更好，这跟之前预期完全相反。有没有做过类似实验的同学一起讨论一下？',
      images: [],
      stats: { likes: 23, comments: 7, shares: 0 },
      time: '刚刚', liked: false, isOwn: false, school: '南京信息工程大学'
    },
    {
      id: 202, type: 'feed',
      user: { name: '杨瑶', avatar: '/images/avatars/杨瑶.png', uid: '22222222' },
      title: '分享我最近读的一本好书《设计心理学》',
      content: '唐纳德·诺曼的经典之作，里面关于"示能性"和"意符"的讨论让我对产品设计有了全新的理解。强烈推荐给做交互设计的朋友们！',
      images: ['/images/sketch/f1ad334c7d5e3be74216154a8a39614c0296aebb.png'],
      stats: { likes: 56, comments: 14, shares: 3 },
      time: '12分钟前', liked: true, isOwn: false, school: '南京大学'
    },
    {
      id: 203, type: 'feed',
      user: { name: '蔡梓芳', avatar: '/images/avatars/蔡梓芳.png', uid: '33333333' },
      title: '周末去紫金山爬山，有人一起吗',
      content: '这周六早上7点出发，预计中午下山。目前有三个人了，再找两个小伙伴一起。体力要求不高，主要是休闲爬山，沿途可以拍照。',
      images: ['/images/sketch/09b3ae480f6328a17c73e1689ba1200d202926f8.png'],
      stats: { likes: 41, comments: 19, shares: 0 },
      time: '28分钟前', liked: false, isOwn: false, school: '南京信息工程大学'
    },
    {
      id: 204, type: 'feed',
      user: { name: '许强', avatar: '/images/avatars/许强.png', uid: '44444444' },
      title: '考研英语阅读理解技巧分享',
      content: '做了三年真题之后总结了几条规律：1. 选项中出现绝对化表达的基本都是错的；2. 同义替换才是正确答案的关键；3. 首段和尾段往往藏有主旨大意。',
      images: [],
      stats: { likes: 132, comments: 45, shares: 28 },
      time: '1小时前', liked: false, isOwn: false, school: '南京信息工程大学'
    },
    {
      id: 205, type: 'feed',
      user: { name: '汤乐乐', avatar: '/images/avatars/汤乐乐.png', uid: '55555555' },
      title: '校园樱花开了，拍了几张',
      content: '今天路过图书馆后面的时候发现樱花全开了，赶紧拍了几张。真的太美了，每年这个时候校园都变成粉色海洋。分享给大家一起欣赏~',
      images: ['/images/sketch/179dd70c4388372729a818ff771ec95455423243.png', '/images/sketch/568cc16fcde9d74720e2e0457a806f90c692e7c0.png'],
      stats: { likes: 198, comments: 36, shares: 15 },
      time: '2小时前', liked: true, isOwn: false, school: '东南大学'
    },
    {
      id: 206, type: 'feed',
      user: { name: '曾冬', avatar: '/images/avatars/曾冬.png', uid: '66666666' },
      title: '有没有人想一起参加互联网+比赛',
      content: '我们已经有三个同学，一个做后端，一个做前端，还缺一个做UI设计的同学。项目方向是校园生活服务类小程序，已经有初步方案。',
      images: [],
      stats: { likes: 15, comments: 22, shares: 0 },
      time: '3小时前', liked: false, isOwn: false, school: '南京信息工程大学'
    },
    {
      id: 207, type: 'feed',
      user: { name: '沈慧', avatar: '/images/avatars/沈慧.png', uid: '77777777' },
      title: '推荐一个超好用的时间管理方法',
      content: '最近在尝试番茄工作法+GTD结合的方式管理学习和项目。上午用番茄钟集中精力写代码，下午处理杂事和开会。效率提升至少30%。',
      images: ['/images/sketch/f1ad334c7d5e3be74216154a8a39614c0296aebb.png'],
      stats: { likes: 77, comments: 18, shares: 8 },
      time: '4小时前', liked: false, isOwn: false, school: '南京大学'
    },
    {
      id: 208, type: 'feed',
      user: { name: '戴轩扬', avatar: '/images/avatars/戴轩扬.png', uid: '88888888' },
      title: '关于前端性能优化的一些心得',
      content: '做了三个月的项目优化，总结了几个关键点：1. 图片懒加载和WebP格式；2. 虚拟列表处理长列表；3. 代码分割和Tree Shaking。具体方案在文章里写了。',
      images: [],
      stats: { likes: 94, comments: 31, shares: 12 },
      time: '5小时前', liked: true, isOwn: false, school: '南京信息工程大学'
    },
    {
      id: 209, type: 'feed',
      user: { name: '李常秋', avatar: '/images/avatars/李常秋.png', uid: '11111111' },
      title: '求助：谁有高等数学下册的复习资料',
      content: '马上期末了，急需高数下册的复习笔记和往年真题。如果有同学有整理好的资料，麻烦分享一下，万分感谢！可以请喝奶茶作为报答~',
      images: [],
      stats: { likes: 8, comments: 15, shares: 0 },
      time: '1天前', liked: false, isOwn: false, school: '南京信息工程大学'
    },
    {
      id: 210, type: 'feed',
      user: { name: '杨瑶', avatar: '/images/avatars/杨瑶.png', uid: '22222222' },
      title: '食堂三楼新开的奶茶店测评',
      content: '点了招牌波波奶茶和杨枝甘露，波波奶茶偏甜但是珍珠很Q弹，杨枝甘露芒果味很足。价格在12-18元之间，比校外的便宜。总体推荐！',
      images: ['/images/sketch/09b3ae480f6328a17c73e1689ba1200d202926f8.png'],
      stats: { likes: 65, comments: 28, shares: 3 },
      time: '2天前', liked: false, isOwn: false, school: '南京信息工程大学'
    }
  ],

  // 点赞/收藏/购买列表
  likedBy: [
    { name: '蔡俊', avatar: '/images/avatars/蔡俊.png' },
    { name: '黎小新', avatar: '/images/avatars/黎小新.png' },
    { name: '陈玉芳', avatar: '/images/avatars/陈玉芳.png' }
  ],
  favoritedBy: [
    { name: '张文春', avatar: '/images/avatars/张文春.png' },
    { name: '贾万扬', avatar: '/images/avatars/贾万扬.png' },
    { name: '尹一志', avatar: '/images/avatars/尹一志.png' }
  ],
  purchasedBy: [
    { name: '熊力平', avatar: '/images/avatars/熊力平.png' },
    { name: '李小彤', avatar: '/images/avatars/李小彤.png' },
    { name: '姜子华', avatar: '/images/avatars/姜子华.png' }
  ],

  // 发布分类
  publishCategories: {
    post: { label: '图文帖子', default: true },
    errand: { label: '发布跑腿', groups: ['默认', '拼车', '学习', '运动', '游戏', '其他'] },
    rating: { label: '发起评分', groups: ['默认', '美食', '课程', '校花', '动物', '其他'] },
    secondhand: { label: '二手挂单', groups: ['其他闲置', '二手书'] }
  },

  // 充值选项
  rechargeOptions: [
    { amount: 1, label: '1次' },
    { amount: 5, label: '5次' },
    { amount: 10, label: '10次' },
    { amount: 20, label: '20次' }
  ],

  // 订单
  orders: [
    {
      id: 501,
      type: 'secondhand',
      side: 'buy',
      user: { name: '陈雪', avatar: '/images/avatars/陈雪.png' },
      content: '二手书-高等数学第七版，九成新，只用了一学期，笔记很少',
      image: '/images/sketch/179dd70c4388372729a818ff771ec95455423243.png',
      typeLabel: '二手',
      typeLabelColor: '#255AC5',
      priceLabel: '实付款',
      price: 15.00,
      status: '已关闭',
      statusBg: '#14B554',
      remark: '',
      showConfirmBtn: false,
      targetId: 101,
      targetType: 'market'
    },
    {
      id: 502,
      type: 'secondhand',
      side: 'sell',
      user: { name: '李天芳', avatar: '/images/avatars/李天芳.png' },
      content: 'iPhone 15 Pro Max 256GB，使用半年，无磕碰，配件齐全',
      image: '/images/sketch/03bd5cf7ab2b7663764c7eba2bfcce3875faf9e5.png',
      typeLabel: '二手',
      typeLabelColor: '#255AC5',
      priceLabel: '实付款',
      price: 6800.00,
      status: '已付款',
      statusBg: '#255AC5',
      remark: '',
      showConfirmBtn: false,
      targetId: 102,
      targetType: 'market'
    },
    {
      id: 503,
      type: 'rental',
      side: 'buy',
      user: { name: '王涛', avatar: '/images/avatars/王涛.png' },
      content: '考研数学复习全书，可租赁，按月计费',
      image: '/images/sketch/09b3ae480f6328a17c73e1689ba1200d202926f8.png',
      typeLabel: '租赁',
      typeLabelColor: '#FF9500',
      priceLabel: '实付款',
      price: 8.00,
      status: '已付款',
      statusBg: '#255AC5',
      remark: '正在租用中，归还时间2026-4-17 08:45:23',
      showConfirmBtn: false,
      targetId: 103,
      targetType: 'market'
    },
    {
      id: 504,
      type: 'rental',
      side: 'sell',
      user: { name: '赵敏', avatar: '/images/avatars/赵敏.png' },
      content: '闲置台灯 LED护眼，毕业出，功能完好',
      image: '/images/sketch/0aa656cd8b1bf992846a1f8e01181ba7d89b04d9.png',
      typeLabel: '租赁',
      typeLabelColor: '#FF9500',
      priceLabel: '实付款',
      price: 29.90,
      status: '已关闭',
      statusBg: '#14B554',
      remark: '',
      showConfirmBtn: false,
      targetId: 104,
      targetType: 'market'
    },
    {
      id: 505,
      type: 'errand',
      side: 'buy',
      user: { name: '高涵', avatar: '/images/avatars/高涵.png' },
      content: '文艺青年最后的音乐据点：网易云音乐评论区',
      image: '/images/sketch/179dd70c4388372729a818ff771ec95455423243.png',
      typeLabel: '跑腿',
      typeLabelColor: '#255AC5',
      priceLabel: '应付款',
      price: 0,
      status: '待付款',
      statusBg: '#FF4D4F',
      remark: '等待交接',
      showConfirmBtn: false,
      targetId: 1,
      targetType: 'post'
    },
    {
      id: 506,
      type: 'errand',
      side: 'sell',
      user: { name: '李莎莎', avatar: '/images/avatars/李莎莎.png' },
      content: '下面我们会从不同维度来分析一下APP的社交分享功能设计',
      image: '/images/sketch/2b9ae21d4113d522a06330b2415e3eb8c44dac50.png',
      typeLabel: '跑腿',
      typeLabelColor: '#255AC5',
      priceLabel: '实付款',
      price: 0,
      status: '已付款',
      statusBg: '#255AC5',
      remark: '',
      showConfirmBtn: true,
      targetId: 2,
      targetType: 'post'
    },
    {
      id: 507,
      type: 'shopping',
      side: 'buy',
      user: { name: '谭明扬', avatar: '/images/avatars/谭明扬.png' },
      content: '现在很多APP在用户截图时会自动提示分享...',
      image: '/images/sketch/568cc16fcde9d74720e2e0457a806f90c692e7c0.png',
      typeLabel: '常规购物',
      typeLabelColor: '#255AC5',
      priceLabel: '实付款',
      price: 0,
      status: '已关闭',
      statusBg: '#14B554',
      remark: '',
      showConfirmBtn: false,
      targetId: 3,
      targetType: 'post'
    },
    {
      id: 508,
      type: 'shopping',
      side: 'sell',
      user: { name: '张德栋', avatar: '/images/avatars/张德栋.png' },
      content: '用户主动点击分享的设计思考...',
      image: '/images/sketch/22b68413c38ca21ddb1d26a74ca0809752385a80.png',
      typeLabel: '常规购物',
      typeLabelColor: '#255AC5',
      priceLabel: '实付款',
      price: 0,
      status: '已关闭',
      statusBg: '#14B554',
      remark: '',
      showConfirmBtn: false,
      targetId: 4,
      targetType: 'post'
    }
  ],

  // 聊天消息
  chatMessages: [
    { id: 1, from: 'other', type: 'text', content: '这是一段文字', time: '2025-12-23 19:48' },
    { id: 2, from: 'other', type: 'link', content: '【工作技巧】产品经...', desc: '作为用户和产品之间的桥梁，社交分享...', time: '2025-12-23 19:49' },
    { id: 3, from: 'other', type: 'text', content: '这是一段长文字这是一段长文字这是一段长文字这是一段长文字这是一段长文字这是一段长文字这是一段长文字这是一段长文字这是一段长文字', time: '2025-12-23 19:50' },
    { id: 4, from: 'me', type: 'text', content: '我想购买"商品名"', time: '2025-12-23 19:51' },
    { id: 5, from: 'me', type: 'text', content: '请卖家尽快处理', time: '2025-12-23 19:52' },
    { id: 6, from: 'other', type: 'text', content: '这是一段文字', time: '2025-12-23 19:53' },
    { id: 7, from: 'system', type: 'system', content: '发起购买"商品名"', time: '2025-12-23 19:54' }
  ],

  // 抽奖活动（邀请新人有奖）
  lotteryActivities: [
    {
      id: 1, title: '五四青年节邀请有奖活动', description: '邀请好友加入校园，赢取精美奖品！活动期间每成功邀请1位新用户注册并加入学校，即可获得1个抽奖号码。',
      startTime: '2026-05-01', endTime: '2026-05-31', status: 0,
      coverImage: '/images/sketch/179dd70c4388372729a818ff771ec95455423243.png',
      prizes: [
        { id: 1, level: '特等奖', description: 'AirPods Pro 耳机一副', sort: 1, winningCode: null, winnerUserId: null },
        { id: 2, level: '一等奖', description: '星巴克咖啡券 × 5', sort: 2, winningCode: null, winnerUserId: null },
        { id: 3, level: '二等奖', description: '校园周边礼包', sort: 3, winningCode: null, winnerUserId: null }
      ]
    },
    {
      id: 2, title: '新学期开学邀请活动', description: '新学期开始，邀请同学加入平台，共享校园生活。邀请越多，号码越多，中奖概率越大！',
      startTime: '2026-02-20', endTime: '2026-03-20', status: 1,
      coverImage: '/images/sketch/f1ad334c7d5e3be74216154a8a39614c0296aebb.png',
      prizes: [
        { id: 4, level: '特等奖', description: '小米手环 8 一条', sort: 1, winningCode: 'A3F7K2P9', winnerUserId: 1001 },
        { id: 5, level: '一等奖', description: '瑞幸咖啡券 × 10', sort: 2, winningCode: 'B8M1Q4R6', winnerUserId: null }
      ]
    }
  ],

  // 我的抽奖号码
  lotteryTickets: [
    { id: 1, activityId: 1, code: 'C5N2T8W1', source: 3 },
    { id: 2, activityId: 1, code: 'D9P3U7X4', source: 3 },
    { id: 3, activityId: 2, code: 'E1Q6V0Y5', source: 3 }
  ],

  // 图书预购活动
  presales: [
    {
      id: 1, bookName: '高等数学（第七版）上册', author: '同济大学数学系', publisher: '高等教育出版社',
      isbn: '9787040396638', price: '38.00', depositAmount: '15.20', finalAmount: '22.80',
      stock: 200, orderedCount: 87, status: 1,
      coverImage: '/images/sketch/09b3ae480f6328a17c73e1689ba1200d202926f8.png',
      startTime: '2026-05-10', endTime: '2026-06-10', remark: '教材统一发放，预计开学前到货'
    },
    {
      id: 2, bookName: '大学英语四级词汇手册', author: '华研外语', publisher: '华中科技大学出版社',
      isbn: '9787568093842', price: '22.00', depositAmount: '8.80', finalAmount: '13.20',
      stock: 0, orderedCount: 134, status: 1,
      coverImage: '/images/sketch/568cc16fcde9d74720e2e0457a806f90c692e7c0.png',
      startTime: '2026-05-15', endTime: '2026-06-15', remark: ''
    },
    {
      id: 3, bookName: '线性代数（第六版）', author: '同济大学数学系', publisher: '高等教育出版社',
      isbn: '9787040396621', price: '28.00', depositAmount: '11.20', finalAmount: '16.80',
      stock: 150, orderedCount: 150, status: 2,
      coverImage: '/images/sketch/f1ad334c7d5e3be74216154a8a39614c0296aebb.png',
      startTime: '2026-03-01', endTime: '2026-04-01', remark: ''
    },
    {
      id: 4, bookName: '概率论与数理统计（第四版）', author: '浙江大学', publisher: '高等教育出版社',
      isbn: '9787040058918', price: '32.00', depositAmount: '12.80', finalAmount: '19.20',
      stock: 100, orderedCount: 100, status: 2,
      coverImage: '',
      startTime: '2026-02-01', endTime: '2026-03-01', remark: ''
    }
  ],

  // 图书预购订单（当前用户）
  presaleOrders: [
    {
      id: 1001, orderNo: 'BP1716000000001', presaleId: 3, quantity: 2,
      unitPrice: '28.00', totalAmount: '56.00', depositAmount: '22.40', finalAmount: '33.60',
      status: 2, finalPayDeadline: '2026-04-08'
    }
  ],

  // 学校切换-冷却提示 (天数)
  schoolSwitchCooldown: 7,
  majorSwitchCooldown: 3,

  // 二手书市场商品
  bookMarketItems: [
    {
      id: 1001,
      title: '《高等数学》同济第七版 上下册 无笔记',
      images: ['/images/sketch/09b3ae480f6328a17c73e1689ba1200d202926f8.png'],
      price: 15,
      originalPrice: 50,
      condition: '9成新',
      certTags: ['已验正版', '无笔记'],
      category: '教材教辅',
      seller: { name: '陈雪', avatar: '/images/avatars/陈雪.png', school: '南京信息工程大学', major: '软件工程' },
      extraInfo: '仅1本・3人咨询',
      isFree: false,
      isFavorite: false,
      distance: '0.8km'
    },
    {
      id: 1002,
      title: '《考研英语历年真题》黄皮书 全套',
      images: ['/images/sketch/568cc16fcde9d74720e2e0457a806f90c692e7c0.png', '/images/sketch/f1ad334c7d5e3be74216154a8a39614c0296aebb.png'],
      price: 28,
      originalPrice: 89,
      condition: '几乎全新',
      certTags: ['无笔记'],
      category: '考研考证',
      seller: { name: '李天芳', avatar: '/images/avatars/李天芳.png', school: '南京信息工程大学', major: '英语' },
      extraInfo: '同专业已卖12本',
      isFree: false,
      isFavorite: false,
      distance: '1.2km'
    },
    {
      id: 1003,
      title: '《百年孤独》精装版 马尔克斯',
      images: ['/images/sketch/179dd70c4388372729a818ff771ec95455423243.png'],
      price: 12,
      originalPrice: 39,
      condition: '8成新',
      certTags: ['有少量笔记'],
      category: '文学小说',
      seller: { name: '王涛', avatar: '/images/avatars/王涛.png', school: '南京大学', major: '中文系' },
      extraInfo: '可自提 / 可邮寄',
      isFree: false,
      isFavorite: false,
      distance: '2.5km'
    },
    {
      id: 1004,
      title: '《C程序设计》谭浩强 第五版',
      images: ['/images/sketch/22b68413c38ca21ddb1d26a74ca0809752385a80.png'],
      price: 10,
      originalPrice: 35,
      condition: '9成新',
      certTags: ['已验正版'],
      category: '计算机',
      seller: { name: '赵敏', avatar: '/images/avatars/赵敏.png', school: '南京信息工程大学', major: '计算机科学' },
      extraInfo: '仅1本・5人咨询',
      isFree: false,
      isFavorite: false,
      distance: '0.5km'
    },
    {
      id: 1005,
      title: '《大学英语四级词汇手册》乱序版',
      images: ['/images/sketch/25a8356c47527f2136c2a561a0e9de130e28bffd.png'],
      price: 8,
      originalPrice: 25,
      condition: '几乎全新',
      certTags: ['无笔记'],
      category: '四六级',
      seller: { name: '高涵', avatar: '/images/avatars/高涵.png', school: '南京工业大学', major: '自动化' },
      extraInfo: '已认证 / 个人闲置',
      isFree: false,
      isFavorite: false,
      distance: '3.1km'
    },
    {
      id: 1006,
      title: '《线性代数》同济第六版 附习题解答',
      images: ['/images/sketch/29e1e9bda04ee8ec792b868eb3b94e43f2dc88f7.png'],
      price: 0,
      originalPrice: 32,
      condition: '7成新',
      certTags: ['有少量笔记'],
      category: '教材教辅',
      seller: { name: '李莎莎', avatar: '/images/avatars/李莎莎.png', school: '南京信息工程大学', major: '数学系' },
      extraInfo: '免费赠送・需自提',
      isFree: true,
      isFavorite: false,
      distance: '1.0km'
    },
    {
      id: 1007,
      title: '《肖秀荣考研政治1000题》2026版',
      images: ['/images/sketch/2b9ae21d4113d522a06330b2415e3eb8c44dac50.png'],
      price: 22,
      originalPrice: 58,
      condition: '全新',
      certTags: ['未拆封'],
      category: '考研政治',
      seller: { name: '谭明扬', avatar: '/images/avatars/谭明扬.png', school: '南京信息工程大学', major: '马克思主义' },
      extraInfo: '同专业已卖8本',
      isFree: false,
      isFavorite: false,
      distance: '0.3km'
    },
    {
      id: 1008,
      title: '《数据结构》严蔚敏 清华版',
      images: ['/images/sketch/03bd5cf7ab2b7663764c7eba2bfcce3875faf9e5.png'],
      price: 18,
      originalPrice: 45,
      condition: '9成新',
      certTags: ['已验正版', '无笔记'],
      category: '计算机',
      seller: { name: '张德栋', avatar: '/images/avatars/张德栋.png', school: '东南大学', major: '软件工程' },
      extraInfo: '可自提 / 可邮寄',
      isFree: false,
      isFavorite: false,
      distance: '4.2km'
    },
    {
      id: 1009,
      title: '《概率论与数理统计》浙大第四版',
      images: ['/images/sketch/0aa656cd8b1bf992846a1f8e01181ba7d89b04d9.png'],
      price: 14,
      originalPrice: 38,
      condition: '8成新',
      certTags: ['有少量笔记'],
      category: '教材教辅',
      seller: { name: '邱玉北', avatar: '/images/avatars/邱玉北.png', school: '南京信息工程大学', major: '统计学' },
      extraInfo: '仅1本・2人咨询',
      isFree: false,
      isFavorite: false,
      distance: '0.6km'
    },
    {
      id: 1010,
      title: '《小王子》中英双语版',
      images: ['/images/sketch/374a2aa50c46e233a9cbcefa0489c5c1b7c7adb0.png'],
      price: 9,
      originalPrice: 28,
      condition: '几乎全新',
      certTags: ['无笔记'],
      category: '文学小说',
      seller: { name: '杨世豪', avatar: '/images/avatars/杨世豪.png', school: '南京大学', major: '外语系' },
      extraInfo: '已认证 / 个人闲置',
      isFree: false,
      isFavorite: false,
      distance: '2.0km'
    },
    {
      id: 1011,
      title: '《通信原理》樊昌信 第七版',
      images: ['/images/sketch/3cac049cfa1b96c01f69455b7802e1871b42096c.png'],
      price: 20,
      originalPrice: 55,
      condition: '9成新',
      certTags: ['已验正版'],
      category: '专业教材',
      seller: { name: '沈慧', avatar: '/images/avatars/沈慧.png', school: '南京信息工程大学', major: '通信工程' },
      extraInfo: '同专业已卖15本',
      isFree: false,
      isFavorite: false,
      distance: '0.4km'
    },
    {
      id: 1012,
      title: '《考研数学复习全书》李永乐',
      images: ['/images/sketch/3e2f66805880c20793643e7396411a477aa98297.png'],
      price: 35,
      originalPrice: 98,
      condition: '几乎全新',
      certTags: ['无笔记'],
      category: '考研考证',
      seller: { name: '曾冬', avatar: '/images/avatars/曾冬.png', school: '南京工业大学', major: '机械工程' },
      extraInfo: '可自提 / 可邮寄',
      isFree: false,
      isFavorite: false,
      distance: '2.8km'
    },
    {
      id: 1013,
      title: '《活着》余华 正版',
      images: ['/images/sketch/402ef5a16ed1b5f6f04221522fb5adc7b991f5bb.png'],
      price: 0,
      originalPrice: 22,
      condition: '8成新',
      certTags: ['有少量笔记'],
      category: '文学小说',
      seller: { name: '李小宣', avatar: '/images/avatars/李小宣.png', school: '南京信息工程大学', major: '新闻学' },
      extraInfo: '免费赠送',
      isFree: true,
      isFavorite: false,
      distance: '1.5km'
    },
    {
      id: 1014,
      title: '《操作系统概念》恐龙书 英文版',
      images: ['/images/sketch/444a4e0ca51ad7236dce0b41002d1a246803ee32.png'],
      price: 45,
      originalPrice: 128,
      condition: '9成新',
      certTags: ['已验正版', '无笔记'],
      category: '计算机',
      seller: { name: '戴轩扬', avatar: '/images/avatars/戴轩扬.png', school: '东南大学', major: '计算机科学' },
      extraInfo: '仅1本・8人咨询',
      isFree: false,
      isFavorite: false,
      distance: '3.5km'
    },
    {
      id: 1015,
      title: '《电路分析》邱关源 第五版',
      images: ['/images/sketch/47ceeeb558b9caef8da3de4f8752c6d3090ca95f.png'],
      price: 16,
      originalPrice: 42,
      condition: '8成新',
      certTags: ['有少量笔记'],
      category: '专业教材',
      seller: { name: '黄梦云', avatar: '/images/avatars/黄梦云.png', school: '南京信息工程大学', major: '电子工程' },
      extraInfo: '同专业已卖6本',
      isFree: false,
      isFavorite: false,
      distance: '0.7km'
    },
    {
      id: 1016,
      title: '《六级真题全解》新东方',
      images: ['/images/sketch/4b9f998d6fd7bfb0773a84d623d751e07293f806.png'],
      price: 11,
      originalPrice: 32,
      condition: '几乎全新',
      certTags: ['无笔记'],
      category: '四六级',
      seller: { name: '李春雨', avatar: '/images/avatars/李春雨.png', school: '南京工业大学', major: '土木工程' },
      extraInfo: '已认证 / 个人闲置',
      isFree: false,
      isFavorite: false,
      distance: '2.2km'
    },
    {
      id: 1017,
      title: '《徐涛考研政治核心考案》2026',
      images: ['/images/sketch/4d985c7ee67646fc3e2ca4171f4c9d25c6359137.png'],
      price: 19,
      originalPrice: 48,
      condition: '全新',
      certTags: ['未拆封'],
      category: '考研政治',
      seller: { name: '萧晖', avatar: '/images/avatars/萧晖.png', school: '南京信息工程大学', major: '法学' },
      extraInfo: '仅1本・4人咨询',
      isFree: false,
      isFavorite: false,
      distance: '0.9km'
    },
    {
      id: 1018,
      title: '《三体》全集 刘慈欣',
      images: ['/images/sketch/4dace08c4004e50d5c3ce57682c293cfb9529a18.png'],
      price: 25,
      originalPrice: 68,
      condition: '9成新',
      certTags: ['无笔记'],
      category: '文学小说',
      seller: { name: '贾万扬', avatar: '/images/avatars/贾万扬.png', school: '南京大学', major: '物理系' },
      extraInfo: '可自提 / 可邮寄',
      isFree: false,
      isFavorite: false,
      distance: '1.8km'
    },
    {
      id: 1019,
      title: '《数字信号处理》程佩青',
      images: ['/images/sketch/4e1c2c69affa78842a62e2a132fe6c32a96327c1.png'],
      price: 17,
      originalPrice: 46,
      condition: '8成新',
      certTags: ['有少量笔记'],
      category: '专业教材',
      seller: { name: '尹一志', avatar: '/images/avatars/尹一志.png', school: '南京信息工程大学', major: '通信工程' },
      extraInfo: '同专业已卖9本',
      isFree: false,
      isFavorite: false,
      distance: '0.5km'
    },
    {
      id: 1020,
      title: '《计算机网络》谢希仁 第七版',
      images: ['/images/sketch/09b3ae480f6328a17c73e1689ba1200d202926f8.png'],
      price: 13,
      originalPrice: 38,
      condition: '9成新',
      certTags: ['已验正版'],
      category: '计算机',
      seller: { name: '张文春', avatar: '/images/avatars/张文春.png', school: '南京工业大学', major: '网络工程' },
      extraInfo: '已认证 / 个人闲置',
      isFree: false,
      isFavorite: false,
      distance: '2.6km'
    }
  ]
}

module.exports = mock
