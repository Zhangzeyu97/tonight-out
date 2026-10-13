# 今晚谁出局 · Who's Out Tonight

古典大师也会翻车：贝多芬卡在《致爱丽丝》的两个音里，莫扎特越弹越慌，维瓦尔第被不速之客抢了舞台。翻车剧场用公有领域古典作品的乐谱合成演奏，把卡壳、跑调、加速和喜剧停顿直接写进音乐；肖像、字幕与舞台反应同步上演。每段完整演出都能存成带声音的竖屏视频。**[打开就能玩](https://zeyuniverse.github.io/tonight-out/)**，中英双语。

Classical maestros flop live: Beethoven gets stuck in Für Elise, Mozart panics, and an unexpected guest steals Vivaldi's stage. The flop theater synthesizes performances from scores of public-domain classical works, with comic timing built into the music: wrong notes, runaway tempos, and awkward pauses. Portraits, captions, and stage reactions follow the performance. Save a full clip as a vertical video with sound. **[Play in your browser](https://zeyuniverse.github.io/tonight-out/)** in Chinese or English.

翻车背后是一个硬核的 3 对 3 心理博弈：每轮全场最低分出局，1–5 分各只能用一次。全部 **9,601 个局面**通过逆向归纳与线性规划（LP）精确求出纳什均衡。AI 在你行动前先锁定出招，公布 SHA-256 指纹；每一步都对照 AI 当轮真实的混合策略评级，揭晓后还能核对指纹。你在出招、猜招和抽签之间学习混合策略，而不是读公式。

Under the comedy is an exactly solved 3v3 bluffing game: the lowest score is out each round, and each level from 1 to 5 can be used once. Nash equilibria for all **9,601 states** are solved by backward induction and linear programming (LP). Before you move, the AI commits its choice and publishes a SHA-256 fingerprint. Every move is graded against the AI's real mixed strategy for that round, with the commitment revealed for verification. Learn mixed strategies by playing and seeing how choices, reads, and tie draws change your chances.

## 玩法 / Play

1. 双方各派 3 位大师，每位有 1–5 分五种发挥，各用一次。 / Three maestros per side; each has levels 1–5, used once each.
2. 默认点一个大分数按钮，全队立刻一起出；“分开出 / Split”可给每位单独选分数。 / Tap one big level button to play your whole team immediately; Split lets you choose separately.
3. 全场最低分出局，同分随机淘汰一人。先淘汰对方全部 3 人即获胜，最多 5 轮。 / Lowest score is out; ties eliminate one player at random. Eliminate all three rivals to win, within five rounds.

低分出局播放低分车祸，高分抽签出局播放高分意外。每日一演每天共享同一阵容、曲目和随机种子；在比赛中遇到演出即可解锁对应曲目的翻车图鉴。终局有 MVP、最佳翻车奖、重播和战报图。 / Low-score eliminations play wrecks; high-score tie losses play accidents. The daily game shares a cast, repertoire, and seed. Discover performances in games to unlock the collection; the finale awards an MVP and flop of the night, with replays and a share card.

## 三个对手 / Rivals

| 难度 / Tier | 对手 / Rival | 风格 / Play |
|---|---|---|
| 普通 / Normal | 票友 / Amateur | 正常水平，偶尔失手 / Plays sensibly, slips now and then. |
| 职业 / Pro | 教科书 / Textbook | 完美策略对手，打平就是高手 / Plays perfectly. A draw is a win. |
| 魔王 / Boss | 读心评委 / Mind Reader | 以纳什策略为底，记住并克制你的习惯 / Starts from Nash, learns your habits and counters them |

AI 不用大模型；精确策略离线计算并随页面加载。读心评委运行六个习惯模型，只在有把握时偏离均衡，风险预算限制偏离幅度，吃亏后退回均衡。 / No language model powers the AI. Exact strategies are computed offline and shipped with the page. Mind Reader uses six habit models, deviates only with confidence and a bounded risk budget, and returns to equilibrium when exploitation fails.

## 素材与许可 / Credits and licences

作品本身均为公有领域；现代乐谱录入及改编的许可另列如下，不能把它们全部当作公有领域。录音由本项目自行合成，不使用商业录音。完整出处、署名、修改说明、源文件哈希及音色库许可通知见 [`assets/audio/pilot/credits.json`](assets/audio/pilot/credits.json)。 / The compositions are public domain; modern score editions and arrangements have the separate licences below. Audio is synthesized by this project, without commercial recordings. The complete source credits, attribution, changes, source hashes, and SoundFont notices are in [`assets/audio/pilot/credits.json`](assets/audio/pilot/credits.json).

| 曲目 / Work | 乐谱出处与录入者 / Score and typesetter | 乐谱许可 / Score licence | 合成音频许可 / Audio licence |
|---|---|---|---|
| 巴赫：C 大调前奏曲（意外版引用赋格） / Bach: Prelude in C (accident quotes the Fugue) | [Prelude: Mutopia 5](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5); [Fugue: Mutopia 4](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=4); Prelude: Tobias Erbsland (header maintainer: Tobias Erbsland); Fugue: Andreas Scherer | Public Domain | CC0-1.0 |
| 巴赫：托卡塔与赋格 / Bach: Toccata and Fugue | [Mutopia-2011/09/11-1780; Bach-Gesellschaft Ausgabe, 1867](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1780); Anonymous | Public Domain | CC0-1.0 |
| 贝多芬：致爱丽丝 / Beethoven: Für Elise | [Mutopia-2015/08/18-931](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931); Stelios Samelis | Public Domain | CC0-1.0 |
| 贝多芬：第五交响曲 / Beethoven: Symphony No. 5 | [Mutopia-2017/11/05-941](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=941); Stelios Samelis (adapted to LilyPond 2.16.2 by Johannes Heinecke) | Public Domain | CC0-1.0 |
| 肖邦：小狗圆舞曲 / Chopin: Minute Waltz | [Mutopia-2015/01/17-483](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=483); Magnus Lewis-Smith | Public Domain | CC0-1.0 |
| 肖邦：夜曲 Op. 9 No. 2 / Chopin: Nocturne | [Mutopia-2014/12/18-1590](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590); Renato Biolcati Rinaldi | CC BY-SA 3.0 Unported | CC BY-SA 3.0 Unported |
| 莫扎特：小夜曲 / Mozart: Eine kleine Nachtmusik | [Mutopia-2007/01/01-900](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=900); Anonymous (Mutopia maintainer) | Public Domain | CC0-1.0 |
| 莫扎特：土耳其进行曲 / Mozart: Rondo alla Turca | [Mutopia-2015/08/13-108](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=108); Rune Zedeler and Chris Sawer | Public Domain | CC0-1.0 |
| 柴可夫斯基：糖果仙子之舞 / Tchaikovsky: Sugar Plum Fairy | [IMSLP PMLP3607-Sugarplum.mid (The Nutcracker page)](https://imslp.org/wiki/File:PMLP3607-Sugarplum.mid); Charles A. Johnson (2023) | Creative Commons Attribution 4.0 | CC BY 4.0 |
| 柴可夫斯基：天鹅湖 / Tchaikovsky: Swan Lake | Public-domain composition; theme arranged for this game; Tonight Out contributors | Public Domain | CC0-1.0 |
| 维瓦尔第：春 / Vivaldi: Spring | [Mutopia-2010/02/08-301](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=301); Anonymous | CC BY-SA 3.0 Unported | CC BY-SA 3.0 Unported |
| 维瓦尔第：冬 / Vivaldi: Winter | [Mutopia-2010/02/08-351](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=351); Anonymous (Mutopia maintainer smailliw) | CC BY-SA 3.0 Unported | CC BY-SA 3.0 Unported |

肖邦《夜曲》、维瓦尔第《春》《冬》的音频、衍生 cue、演出计划及复核图遵循 **[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)**：保留作曲家、录谱者、Mutopia 与 Singer Game contributors (2026) 的署名及修改说明，衍生作品同许可分享。柴可夫斯基《糖果仙子之舞》源自 Charles A. Johnson (2023) 的五支长笛编配（IMSLP / Clsmaestro），遵循 **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**；本项目改配为钢片琴、拨弦与低音单簧管，修改速度、力度并加入喜剧段落。其他合成录音采用 CC0-1.0，音色库许可通知仍须保留。

Nocturne, Spring, and Winter audio and derived cues, performance plans, and review figures are **CC BY-SA 3.0**: retain the composer, typesetter, Mutopia, Singer Game contributors (2026), and change notices; distribute adaptations under the same licence. Sugar Plum Fairy derives from Charles A. Johnson's (2023) arrangement for four flutes and alto flute (IMSLP / Clsmaestro), under **CC BY 4.0**. This project re-orchestrates it for celesta, pizzicato strings, and bass clarinet, changes tempo and dynamics, and adds comic edits. Other synthesized recordings are CC0-1.0; retain the SoundFont notices.

- **音色库 / SoundFont:** MuseScore_General.sf2 0.2 (13 May 2020), MIT, based on FluidR3 / FluidR3Mono. Credits: Frank Wen (2000–02 / 2008), Michael Cowgill (2014–17), S. Christian Collins (2018–19), Ethan Winer (Temple Blocks, 2002), Michael Schorsch (Drumline Cymbals, 2016). Complete copyright, acknowledgements, MIT text, README, and sample-source notes are preserved in each score's `soundfont.complete_notices` in `assets/audio/pilot/credits.json`; retain these notices with derivatives.
- **字体 / Fonts:** ZCOOL QingKe HuangYou、Big Shoulders Display，均为 SIL Open Font License 1.1，裁剪后内嵌；完整许可见 `fonts/`。 / Both fonts use SIL OFL 1.1, subset and embedded; complete licences are in `fonts/`.
- **肖像 / Portraits:** Wikimedia Commons public-domain paintings, cropped and colour-adjusted; full source URLs and licences in [`assets/portraits/credits.json`](assets/portraits/credits.json):
  - [Beethoven — Joseph Karl Stieler, 1820](https://commons.wikimedia.org/wiki/File:Joseph_Karl_Stieler%27s_Beethoven_mit_dem_Manuskript_der_Missa_solemnis.jpg) · Public domain
  - [Mozart — Barbara Krafft, 1819](https://commons.wikimedia.org/wiki/File:Barbara_Krafft_-_Portr%C3%A4t_Wolfgang_Amadeus_Mozart_(1819).jpg) · Public domain
  - [Bach — Elias Gottlob Haussmann, 1748](https://commons.wikimedia.org/wiki/File:Johann_Sebastian_Bach.jpg) · Public domain
  - [Chopin — Ary Scheffer, 1847](https://commons.wikimedia.org/wiki/File:Ary_Scheffer_-_Portret_van_Fr%C3%A9d%C3%A9ric_Chopin_-_DM-S-79_-_Dordrechts_Museum.jpg) · Public domain
  - [Vivaldi — Unidentified painter, 1723](https://commons.wikimedia.org/wiki/File:Antonio_Vivaldi_portrait.jpg) · Public domain
  - [Tchaikovsky — Nikolai Kuznetsov, 1906](https://commons.wikimedia.org/wiki/File:Portr%C3%A4t_des_Komponisten_Pjotr_I._Tschaikowski_(1840-1893).jpg) · Public domain

导出视频含乐谱署名、许可、改编标记及来源网址。 / Exported videos include score attribution, licence, adaptation notice, and source URLs.

静态页面、肖像、字体和音频全部自行托管，无后端或第三方资源请求。 / The static site hosts its own portraits, fonts, and audio, with no backend or third-party asset requests.
