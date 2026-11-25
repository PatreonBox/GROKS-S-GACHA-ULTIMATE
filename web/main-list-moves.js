// Rank, level ID, move name, art, motion, attack multiplier, additional effects, options.
export const mainListMoves=[
 [1,149992717,"Borrowed Finale","abyss","spiral",1.46,[["mark","allOthers",0.23]],{"visual":"mirror","copy":true,"cooldown":5}], // GRIEF
 [2,148598469,"Thirteenth Impact","lunar","slam",2.22,[],{"visual":"artemis","cost":3}], // Artemis 13
 [3,127323087,"Citywide Lockdown","gear","slam",1.42,[["lock","target",2],["strip","neighbors",0.75],["shield","sideAllies",0.26]],{"visual":"city"}], // Society
 [4,119544028,"Cognitive Domain","eye","spiral",1.39,[["lock","allEnemies",3],["weak","target",0.25]],{"visual":"domain","cost":3,"cooldown":6}], // Thinking Space II
 [5,119550490,"Crown of Shards","crystal","slam",1.52,[["hit","neighbors",0.3],["hit","target",0.35,"marked"],["mark","target",0.22]],{"visual":"amethyst"}], // Amethyst
 [6,126242564,"Furnace Wall","magma","stream",1.39,[["hit","allOthers",0.44],["weak","allEnemies",0.2]],{"visual":"firewall","cost":3}], // Flamewall
 [7,86407629,"Shorebreak","wave","stream",1.6,[],{"legacy":true}], // Tidal Wave
 [8,142896409,"Verdant Railshot","bullet","stream",1.6,[],{"legacy":true}], // Green Bullet
 [9,133175713,"Orbital Circuit","orb","orbit",1.37,[["hit","next",0.31],["hit","lowestOther",0.27],["charge","self",1]],{"visual":"orbit"}], // ORBIT
 [10,144988390,"Polar Aurora","prism","sweep",1.41,[["weak","allOthers",0.24],["heal","hurtAlly",0.52,"shielded"]]], // Antarctic Lights
 [11,109780665,"Null Horizon","abyss","spiral",1.61,[["strip","allEnemies",1],["mark","target",0.22,"shielded"]],{"visual":"null","pierce":0.8,"cost":3}], // Nullscapes
 [12,117692518,"Overclock Reboot","gear","pulse",1.35,[["charge","self",1,"full"],["lock","next",2],["shield","self",0.29,"charging"]]], // Quanteuse processing
 [13,110816181,"Bassquake","echo","pulse",1.39,[["hit","target",0.19],["hit","allOthers",0.21],["mark","neighbors",0.17]]], // BOOBAWAMBA
 [14,135661111,"Abyssal Pressure","wave","stream",1.47,[["hit","highestHpOther",0.38],["weak","highestHpOther",0.33],["heal","self",0.22,"half"]]], // The Bloop
 [15,116174063,"Final Cut","scythe","sweep",1.52,[["hit","target",0.57,"half"],["mark","strongestOther",0.35,"knockout"]]], // Every End
 [16,62912799,"Trialbreaker","wave","fan",1.45,[["hit","next",0.34],["hit","target",0.29,"full"],["charge","self",1,"charging"]]], // Ashley Wave Trials
 [17,4125776,"Silence Protocol","echo","sweep",1.5,[["lock","target",3],["mark","target",0.24,"charging"]]], // Silent clubstep
 [18,138704906,"Paracosm Inversion","portal","stream",1.47,[["purge","self",1],["hit","neighbors",0.39],["weak","lowestOther",0.25]],{"visual":"paracosm"}], // Ultra Paracosm
 [19,134942736,"Umbra Phase","lunar","spiral",1.39,[["strip","target",0.5],["shield","self",0.4],["drain","self",0.27,"half"]]], // Penumbral
 [20,114283297,"Galactic Slingshot","comet","fan",1.5,[["hit","strongestOther",0.51],["hit","next",0.24,"full"]]], // andromeda
 [21,138781722,"Claim the Last Breath","scythe","sweep",1.6,[["hit","target",0.52,"half"],["drain","self",0.32,"knockout"]]], // KILLSTEALER
 [22,127997391,"Infall","abyss","spiral",1.38,[["hit","weakOthers",0.35],["hit","markedOthers",0.23],["charge","self",1,"selfHalf"]]], // Subsuming Vortex
 [23,112313819,"Forbidden Seal","eye","pulse",1.44,[["lock","strongestOther",2],["purge","hurtAlly",1],["mark","target",0.3,"full"]]], // Anathema
 [24,120012581,"Ring Grinder","saw","sweep",1.43,[["hit","target",0.23,"shielded"],["hit","target",0.24,"shielded"],["strip","neighbors",0.69]]], // Defeated Circles
 [25,89496627,"Cinder Gate","magma","slam",1.57,[["strip","target",0.85],["hit","shieldedOthers",0.36],["weak","next",0.32,"full"]]], // Avernus
 [26,145709435,"Thorn Canopy","thorns","fan",1.34,[["hit","neighbors",0.24],["mark","allEnemies",0.15,"shielded"]]], // FOREST OF SPIKES
 [27,73667628,"Crossing Toll","wave","stream",1.38,[["hit","strongestOther",0.46],["lock","next",1,"half"]]], // Acheron
 [28,144560194,"Overpass Collapse","gear","slam",1.36,[["hit","neighbors",0.28],["shield","sideAllies",0.32]]], // METROPOLIS
 [29,110815379,"Afterimage Ambush","echo","spiral",1.35,[["hit","markedOthers",0.43],["weak","target",0.28,"marked"],["charge","self",1,"knockout"]]], // Spectre
 [30,107805281,"Threat Radius","thorns","pulse",1.53,[["weak","neighbors",0.31],["lock","target",2,"charging"]]], // Menace
 [31,49896559,"Below the Blackline","abyss","spiral",1.3,[["strip","target",1],["drain","self",0.28],["hit","lowestOther",0.35,"selfHalf"]]], // Abyss of Darkness
 [32,91351939,"Endless Passage","portal","stream",1.42,[["hit","next",0.43],["lock","next",2,"shielded"]]], // Tunnel of Despair
 [33,86018142,"Frenzy Cut","scythe","sweep",1.58,[["hit","target",0.24,"selfHalf"],["hit","lowestOther",0.33,"knockout"]]], // Kyouki
 [34,141052363,"Last Light Pact","halo","pulse",1.2,[["drain","otherHurtAlly",0.55],["shield","self",0.32,"selfHalf"]]], // Sacrifice
 [35,110534288,"Foundation Stack","gear","slam",1.27,[["shield","self",0.45],["shield","sideAllies",0.26,"shielded"],["hit","target",0.34,"full"]]], // Based After Based
 [36,130891319,"Thought Loop","eye","spiral",1.28,[["lock","markedOthers",2],["mark","allEnemies",0.18]]], // cognitohazard
 [37,93917076,"Ground the Storm","storm","fan",1.39,[["hit","highestHpOther",0.52],["shield","hurtAlly",0.27,"charging"]]], // The Lightning Rod
 [38,48991380,"Four-Link Snare","scythe","stream",1.32,[["hit","next",0.34],["weak","highestHpOther",0.38],["lock","strongestOther",2,"marked"]]], // Maniacal Chains
 [39,27690100,"Red Chamber","magma","slam",1.68,[["hit","weakOthers",0.39],["mark","lowestOther",0.24,"knockout"]]], // Slaughterhouse
 [40,113599729,"Zero Coordinate","prism","stream",1.51,[["hit","lowestOther",0.46,"half"],["strip","shieldedOthers",0.36,"full"]]], // Subterminal Point
 [41,87665224,"Cosmic Slingshot","comet","spiral",1.4,[["hit","highestHpOther",0.42],["charge","self",1,"full"]]], // KOCMOC
 [42,130327668,"Homeward Signal","halo","pulse",1.17,[["purge","allAllies",1],["heal","allAllies",0.26],["shield","hurtAlly",0.29,"selfHalf"]]], // BEING HOME
 [43,93091893,"Dread Satellite","lunar","stream",1.48,[["weak","strongestOther",0.34],["hit","target",0.32,"marked"]]], // Deimos (ItsHybrid)
 [44,114281093,"Cold Front","crystal","fan",1.31,[["weak","allOthers",0.2],["lock","target",2,"full"]]], // CHIL
 [45,134541844,"Dawn Prism","prism","sweep",1.51,[["mark","target",0.32],["heal","otherHurtAlly",0.44,"knockout"]]], // zorin
 [46,135148907,"Spectrum Stitch","prism","fan",1.36,[["hit","neighbors",0.29],["mark","markedOthers",0.39],["strip","target",0.6,"full"]]], // Prismline
 [47,76962930,"Feedback Rings","saw","spiral",1.33,[["hit","target",0.19],["hit","target",0.19],["hit","next",0.36,"marked"]]], // Sakupen Circles
 [48,113045735,"Brine Mill","gear","fan",1.38,[["strip","allEnemies",0.65],["hit","shieldedOthers",0.35]]], // The Salt Factory
 [49,136396693,"Marionette Cross","eye","fan",1.37,[["weak","strongestOther",0.42],["mark","next",0.35],["lock","lowestOther",1,"charging"]]], // Master of Puppets
 [50,113959291,"Deadbolt Sequence","portal","slam",1.5,[["lock","target",3],["strip","target",0.55,"charging"]]], // Silentlocked
 [51,95851008,"Undertow Stare","eye","spiral",1.23,[["mark","target",0.32],["hit","markedOthers",0.27]]], // Eyes in the Water
 [52,113322063,"Aftershock Seizure","storm","pulse",1.25,[["hit","target",0.22],["hit","target",0.19],["weak","target",0.26,"full"]]], // CONVULSION
 [53,120289520,"Whiteout Pass","prism","sweep",1.26,[["weak","neighbors",0.28],["shield","sideAllies",0.32]]], // Snowbound
 [54,75206202,"Grand Finale","meteor","fan",1.44,[["hit","allOthers",0.23,"knockout"],["charge","self",1,"knockout"]]], // Firework
 [55,49072489,"Gatecrash Relay","portal","stream",1.37,[["hit","next",0.36],["mark","next",0.28]]], // Through The Gates
 [56,113443235,"Three Omens","magma","slam",1.28,[["hit","highestHpOther",0.37],["weak","lowestOther",0.29],["strip","strongestOther",0.62]]], // Apocalyptic Trilogy
 [57,144012996,"Canopy of Second Chances","thorns","pulse",1.2,[["heal","allAllies",0.22],["purge","hurtAlly",1]]], // Pinnacle of Life
 [58,109439644,"Snowline Reversal","crystal","spiral",1.46,[["drain","self",0.37,"selfHalf"],["hit","strongestOther",0.27,"selfHalf"]]], // KOSETSU
 [59,143757358,"Flashover Lane","magma","stream",1.43,[["hit","shieldedOthers",0.27],["strip","shieldedOthers",0.55]]], // BLAZEIT
 [60,131599104,"Purgatory Ground Fault","storm","stream",1.34,[["lock","strongestOther",2],["hit","neighbors",0.21,"charging"]]], // Voltage (ThePurgatory)
 [61,115077305,"Roving Waystones","comet","sweep",1.37,[["shield","otherHurtAlly",0.6],["hit","lowestOther",0.25]]], // NOMAD
 [62,143718114,"Overload Tremor","eye","stream",1.51,[["weak","target",0.38,"charging"],["lock","target",1,"charging"]]], // NervHell
 [63,126571887,"Rage Circuit","saw","spiral",1.25,[["hit","next",0.27],["hit","target",0.33,"marked"],["charge","self",1,"marked"]]], // Loops of Fury
 [64,99703915,"Faultline Split","gear","slam",1.54,[["strip","target",1,"shielded"],["mark","neighbors",0.28,"shielded"]]], // Fracture
 [65,85133223,"Cube Compactor","gear","fan",1.32,[["hit","lowestOther",0.4,"half"],["shield","self",0.32]]], // poocubed
 [66,136981369,"Zero the Gauge","prism","pulse",1.55,[["purge","self",1],["purge","otherHurtAlly",1],["mark","target",0.25]]], // Calibrate
 [67,89414220,"Evaporation Minus","abyss","sweep",1.29,[["strip","target",0.76],["strip","neighbors",0.42],["drain","hurtAlly",0.31,"shielded"]]], // MINUSdry
 [68,96314787,"Deathstep Ambush","scythe","sweep",1.75,[["hit","target",0.38,"half"],["mark","target",0.32,"full"]]], // Deadlier Clubstep
 [69,81139702,"Phantom Audience","echo","spiral",1.31,[["weak","markedOthers",0.26],["mark","allEnemies",0.19]]], // The Hallucination
 [70,94359172,"Pressure Chamber","meteor","slam",1.47,[["hit","allOthers",0.17,"shielded"],["strip","target",1,"shielded"],["hit","target",0.25,"full"]]], // COMBUSTION
 [71,90477539,"Objection Sustained","shield","pulse",1.23,[["lock","target",2,"charging"],["shield","allAllies",0.21,"charging"],["heal","self",0.2,"knockout"]]], // Saul Goodman
 [72,125317359,"Encore Barrage","pulse","fan",1.35,[["hit","highestHpOther",0.41,"knockout"],["heal","otherHurtAlly",0.36,"knockout"]]], // BRITNEY NO SCLEARS
 [73,83244159,"Midnight Constellation","lunar","spiral",1.41,[["hit","highestHpOther",0.36],["shield","self",0.45,"full"]]], // Stellar Night
 [74,114990369,"Gravity Maw","abyss","slam",1.38,[["hit","weakOthers",0.32],["drain","self",0.27,"half"],["weak","highestHpOther",0.22]]], // Gaggatrondra
 [75,120255728,"Seventh Chamber","portal","fan",1.22,[["hit","target",0.24],["hit","neighbors",0.17],["lock","lowestOther",1,"marked"]]], // Sevvend Clubstep
 [76,89187968,"Destiny’s Edge","scythe","sweep",1.58,[["stagger","target",4,"full"],["fury","self",.37,"knockout"]],{visual:'bladeArc',school:'lance',pierce:.32}], // Edge of Destiny
 [77,139508889,"Thought Spiral","eye","spiral",1.27,[["weak","strongestOther",.41],["mark","weakOthers",.22],["purge","self",1,"selfHalf"]],{visual:'coilwell',school:'vortex'}], // Losing Your Mind
 [78,143523624,"Phantom Broadside","echo","stream",1.32,[["hit","neighbors",.34],["evade","self",.48],["mark","lowestOther",.27,"knockout"]],{visual:'spectralKeel',school:'chain'}], // Haunted Ship
 [79,113220284,"Pressure Drop","wave","slam",1.53,[["hit","highestHpOther",.48],["stagger","neighbors",4,"marked"]],{visual:'waterfall',school:'surge'}], // The Plunge
 [80,90390075,"Corona Breach","magma","pulse",1.37,[["strip","allEnemies",.48],["hit","target",.31,"shielded"],["mark","allOthers",.21,"full"]],{visual:'secondSun',school:'shatter'}], // Solar Flare
 [81,104232191,"Crypt Conveyor","saw","stream",1.49,[["hit","next",.24],["hit","next",.24],["stagger","lowestOther",4,"half"]],{visual:'scrapTurbine',school:'shatter'}], // The Catacombs
 [82,86084399,"False Key","portal","orbit",1.44,[],{visual:'keyCascade',legacy:true}], // LIMBO
 [83,62556400,"Paired Escape","portal","spiral",1.21,[["haste","otherHurtAlly",3],["evade","sideAllies",.32],["mark","target",.24,"selfHalf"]],{visual:'gateRelay',school:'ward'}], // Codependence (Solo)
 [84,113256247,"Falling Foundation","gear","slam",1.78,[["stagger","neighbors",4],["strip","strongestOther",.68,"full"]],{visual:'shockGrid',school:'rupture'}], // Collapse
 [85,94969889,"Nightshade Bloom","thorns","fan",1.26,[["weak","neighbors",.34],["drain","otherHurtAlly",.43],["lock","lowestOther",2,"marked"]],{visual:'spikeQuake',school:'siphon'}], // Belladonna
 [86,82544060,"Crossfire Riot","bullet","fan",1.36,[["hit","allOthers",.25],["hit","markedOthers",.22],["stagger","lowestOther",4,"knockout"]],{visual:'crossfire',school:'chain'}], // Mayhem
 [87,131497860,"Chromatic Fault","crystal","spiral",1.31,[["mark","shieldedOthers",.28],["steal","target",.76,"shielded"],["fury","sideAllies",.21]],{visual:'prismBloom',school:'shatter',pierce:.25}], // CHROMACAVE
 [88,128093374,"Terminal Zigzag","wave","stream",1.44,[["hit","next",.37],["hit","target",.32,"full"],["haste","self",1,"knockout"]],{visual:'gateRelay',school:'surge'}], // Wavterminal
 [89,81011195,"Unstable Batch","pulse","pulse",1.17,[["weak","target",.45,"half"],["mend","otherHurtAlly",.15],["fury","self",.26,"shielded"]],{visual:'coilwell',school:'siphon'}], // walter white
 [90,119689515,"Chaos Recursion","abyss","orbit",1.38,[["hit","markedOthers",.35],["mark","allEnemies",.17],["evade","self",.54,"selfHalf"]],{visual:'coilwell',school:'vortex',cooldown:6}], // Infinite Chaos
 [91,115860808,"One More Beat","echo","pulse",1.18,[["haste","sideAllies",2],["fury","otherHurtAlly",.31],["charge","self",1,"charging"]],{visual:'shockGrid',school:'ward'}], // Make Paul Dance
 [92,114999625,"Adaptive Countermeasure","shield","fan",1.28,[["purge","allAllies",1],["shield","self",.49],["evade","otherHurtAlly",.58,"charging"]],{visual:'rampart',school:'ward'}], // Operation Evolution
 [93,93339534,"Pattern-Weld Cleaver","scythe","sweep",1.73,[["steal","target",1,"shielded"],["hit","target",.29,"full"]],{visual:'bladeArc',school:'shatter',pierce:.28}], // Damascus
 [94,95719795,"Black Deck Undertow","wave","orbit",1.32,[["hit","lowestOther",.44],["weak","weakOthers",.41,"marked"],["mend","self",.1,"knockout"]],{visual:'waterfall',school:'siphon'}], // Decks Dark
 [95,95998005,"Never-Clear Override","storm","fan",1.32,[["stagger","strongestOther",5],["lock","target",2,"charging"],["mark","next",.29,"selfHalf"]],{visual:'shockGrid',school:'chain'}], // SARYYX NEVER CLEAR
 [96,110500920,"Scarlet Pursuit","scythe","stream",1.57,[["hit","target",.53,"half"],["fury","self",.43,"knockout"]],{visual:'bladeArc',school:'lance',cooldown:6}], // The Yangire
 [97,95049815,"Peak Discharge","prism","slam",1.92,[["hit","target",.23,"marked"],["hit","highestHpOther",.42,"charging"]],{visual:'prismBloom',school:'lance',cost:3}], // Climax
 [98,105593215,"Quietly Dangerous","bullet","sweep",1.26,[["evade","self",.61],["mark","strongestOther",.39,"full"],["hit","next",.21]],{visual:'crossfire',school:'lance',cooldown:4}], // ORDINARY
 [99,82249742,"Dead Air","abyss","pulse",1.28,[["lock","target",3],["weak","allOthers",.20,"charging"],["stagger","next",4,"charging"]],{visual:'keyCascade',school:'vortex'}], // Sinister Silence
 [100,122941596,"Afterburner Wash","magma","stream",1.40,[["hit","allOthers",.29],["haste","self",2,"knockout"],["fury","sideAllies",.23,"full"]],{visual:'crossfire',school:'surge'}], // THE JET ENGINE
 [101,108708033,"Converging Halos","halo","orbit",1.25,[["shield","allAllies",.2],["mend","hurtAlly",.18],["steal","target",.45,"selfHalf"]],{visual:'rampart',school:'ward'}], // Coalescence
 [102,96083028,"Clock Strikes Twelve","lunar","slam",1.61,[["hit","strongestOther",.61,"half"],["stagger","lowestOther",4,"knockout"]],{visual:'starfall',school:'lance'}], // Midnight
 [103,133489881,"Frequency Overtake","echo","stream",1.41,[["hit","next",.37],["haste","otherHurtAlly",2,"marked"],["weak","target",.36,"full"]],{visual:'shockGrid',school:'chain'}], // Doppler (Solo)
 [104,93340783,"Shadow Plate","abyss","sweep",1.34,[["evade","self",.63],["steal","shieldedOthers",.54],["weak","lowestOther",.26,"selfHalf"]],{visual:'spectralKeel',school:'vortex'}], // Cimmerian Shade
 [105,103925676,"Target Fixation","eye","pulse",1.45,[["mark","target",.42],["hit","weakOthers",.31],["fury","self",.41,"selfHalf"]],{visual:'coilwell',school:'rupture'}], // PSYCHOPATH (DeniPol)
 [106,125788781,"Geartrain Shunt","gear","spiral",1.35,[["stagger","target",4],["haste","otherHurtAlly",2],["strip","next",.75,"shielded"]],{visual:'scrapTurbine',school:'shatter'}], // TrakineS
 [107,137757402,"Polar Swap","portal","orbit",1.19,[["weak","allOthers",.24,"selfHalf"],["evade","hurtAlly",.56],["fury","sideAllies",.33,"full"]],{visual:'gateRelay',school:'ward'}], // Between Duality
 [108,72315402,"Red Star Terminal","meteor","slam",1.85,[["hit","highestHpOther",.51],["mark","allOthers",.21,"knockout"]],{visual:'starfall',school:'rupture',cost:3,pierce:.22}], // arcturus
 [109,73214186,"False Floor Fangs","thorns","fan",1.35,[["stagger","neighbors",5],["hit","target",.46,"full"]],{visual:'spikeQuake',school:'rupture'}], // Diabolic ClubStep
 [110,93792764,"Honeycomb Breakout","magma","sweep",1.27,[["fury","allAllies",.21],["mark","next",.27],["shield","otherHurtAlly",.32,"knockout"]],{visual:'rampart',school:'ward'}], // BEELINE (Solo)
 [111,129235528,"Lucid Detour","portal","sweep",1.21,[["mend","hurtAlly",.15],["evade","allAllies",.25,"selfHalf"],["lock","strongestOther",2,"marked"]],{visual:'gateRelay',school:'siphon'}], // DreamStep
 [112,69685815,"Infinite Breaker","wave","stream",1.42,[["hit","neighbors",.32],["hit","highestHpOther",.25],["strip","target",1,"charging"]],{visual:'waterfall',school:'surge'}], // Sonic Wave Infinity
 [113,59075347,"Nine Gates Below","abyss","slam",1.66,[["lock","allOthers",2,"knockout"],["stagger","target",5,"full"],["steal","target",.41]],{visual:'spikeQuake',school:'vortex',cost:3}], // Tartarus
 [114,110991117,"Cataract Rush","wave","slam",1.36,[["hit","allOthers",.21],["purge","sideAllies",1],["mend","otherHurtAlly",.16,"shielded"]],{visual:'waterfall',school:'surge'}], // Waterfall
 [115,95031870,"Missing Piece","gear","fan",1.29,[["steal","next",1],["mend","self",.12,"marked"],["haste","otherHurtAlly",2,"shielded"]],{visual:'scrapTurbine',school:'shatter'}], // Jigsaw
 [116,93917362,"Delta Split","prism","fan",1.38,[["hit","lowestOther",.46],["mark","highestHpOther",.29],["evade","otherHurtAlly",.37,"knockout"]],{visual:'prismBloom',school:'chain'}], // Delta
 [117,136135870,"Bank Shot","bullet","sweep",1.35,[["hit","strongestOther",.58],["hit","next",.26,"shielded"]],{visual:'crossfire',school:'lance',pierce:.4}], // Trickshot
 [118,109947627,"Twilight Threshold","portal","slam",1.42,[["lock","target",2],["stagger","next",5,"marked"],["evade","sideAllies",.3,"shielded"]],{visual:'gateRelay',school:'vortex'}], // BPATA MPAKA
 [119,107741051,"Seismic Warning","meteor","slam",1.46,[["hit","neighbors",.34],["stagger","highestHpOther",5],["weak","target",.35,"charging"]],{visual:'spikeQuake',school:'rupture'}], // Natural Disaster
 [120,94858072,"Wonder’s Afterimage","prism","spiral",1.22,[["evade","self",.67],["mend","otherHurtAlly",.12,"selfHalf"],["fury","otherHurtAlly",.42,"charging"]],{visual:'prismBloom',school:'siphon'}], // The Wonder of You
 [121,130464801,"Two-Step Verdict","scythe","sweep",1.40,[["hit","target",.22],["evade","otherHurtAlly",.44],["haste","self",2,"half"]],{visual:'bladeArc',school:'lance'}], // Dualist (Solo)
 [122,135547923,"Sanctuary Seal","halo","pulse",1.22,[["purge","allAllies",1],["mend","allAllies",.08],["stagger","strongestOther",5,"charging"]],{visual:'rampart',school:'ward',cost:3}], // Sanctity
 [123,60978746,"Gilded Citadel","halo","slam",1.37,[["shield","allAllies",.25],["hit","shieldedOthers",.22],["charge","self",1,"shielded"]],{visual:'rampart',school:'ward'}], // The Golden
 [124,148183384,"Reframed Timing","prism","spiral",1.27,[["haste","allAllies",1],["lock","target",2,"charging"],["fury","sideAllies",.26,"marked"]],{visual:'gateRelay',school:'vortex'}], // frame reframe
 [125,71025973,"Oblivion’s Toll","abyss","orbit",1.42,[["steal","allEnemies",.55,"shielded"],["drain","self",.33,"selfHalf"],["hit","lowestOther",.39,"half"]],{visual:'coilwell',school:'vortex',pierce:.24}], // Oblivion
 [126,107238250,"UFO Flyby","comet","stream",1.36,[["hit","next",.31],["evade","self",.57,"full"],["stagger","lowestOther",4,"knockout"]],{visual:'spectralKeel',school:'chain'}], // Viprin UFO
 [127,95176417,"Packet Storm","storm","fan",1.36,[["mark","allOthers",.18],["weak","markedOthers",.32],["haste","otherHurtAlly",2,"charging"]],{visual:'shockGrid',school:'chain'}], // NETWORK (Agat3)
 [128,104672501,"Third-Core Railshot","bullet","stream",1.95,[["hit","next",.46],["strip","strongestOther",1,"knockout"]],{visual:'crossfire',school:'lance',cost:3,pierce:.64}], // ATOMIC CANNON Mk III
 [129,90057148,"Containment Failure","gear","slam",1.54,[["stagger","allOthers",4,"selfHalf"],["hit","weakOthers",.49],["fury","self",.31]],{visual:'scrapTurbine',school:'shatter',cooldown:6}], // Terminal Rampancy
 [130,76543324,"Overgrowth Rampart","thorns","fan",1.25,[["shield","sideAllies",.47],["mend","self",.15],["weak","neighbors",.26,"marked"]],{visual:'spikeQuake',school:'ward'}], // Verdant Landscape
 [131,97086864,"Lightweight Orbit","comet","orbit",1.28,[["evade","sideAllies",.46],["hit","highestHpOther",.40],["charge","self",1,"selfHalf"]],{visual:'starfall',school:'surge'}], // Levigo
 [132,105748155,"Pressure Valve","magma","pulse",1.40,[["stagger","target",4,"shielded"],["hit","next",.38],["steal","next",.57,"charging"]],{visual:'secondSun',school:'shatter',pierce:.18}], // Checked Steam
 [133,123467310,"Sakupen Sky-Fall","meteor","slam",1.75,[["hit","neighbors",.47],["fury","self",.32,"full"],["mend","otherHurtAlly",.13,"knockout"]],{visual:'starfall',school:'rupture',cost:3}], // Heavenly Sakupen
 [134,88203501,"Unknown Variable","eye","spiral",1.29,[["lock","highestHpOther",2],["evade","otherHurtAlly",.48,"full"],["strip","target",.66,"marked"]],{visual:'keyCascade',school:'vortex'}], // UNKNOWN
 [135,132751236,"Spirit Redline","storm","stream",1.30,[["haste","otherHurtAlly",3],["fury","allAllies",.19],["weak","strongestOther",.24,"selfHalf"]],{visual:'shockGrid',school:'chain'}], // SPIRIT OVERCLOCK
 [136,120060187,"Azure Compression","wave","pulse",1.57,[["steal","target",.66],["hit","target",.27,"shielded"],["stagger","next",4,"full"]],{visual:'waterfall',school:'surge',pierce:.22}], // azure blast
 [137,75286957,"Crimson Flow","scythe","spiral",1.46,[["drain","self",.46],["drain","otherHurtAlly",.29,"selfHalf"],["mark","lowestOther",.33,"half"]],{visual:'bladeArc',school:'siphon'}], // Shukketsu
 [138,123674931,"Glitched Backbeat","echo","fan",1.32,[["hit","next",.28],["hit","next",.27,"marked"],["stagger","strongestOther",4,"charging"],["haste","self",1]],{visual:'shockGrid',school:'chain'}], // Breakcore
 [139,137334994,"What Was That?","abyss","orbit",1.31,[["purge","self",1],["mark","neighbors",.27,"half"],["evade","hurtAlly",.44,"knockout"]],{visual:'keyCascade',school:'vortex',cooldown:4}], // idontknowwhatthisis
 [140,88442157,"Thermal Runaway","magma","slam",1.63,[["hit","markedOthers",.43],["weak","target",.37,"full"],["hit","target",.29,"selfHalf"]],{visual:'secondSun',school:'surge'}], // Critical Heat
 [141,87130877,"Unbalanced Flywheel","saw","spiral",1.36,[["stagger","lowestOther",5],["hit","neighbors",.24],["shield","self",.43,"charging"]],{visual:'scrapTurbine',school:'shatter'}], // WOBBLING MACHINE (Solo)
 [142,93732702,"Faceted Hammer","crystal","slam",1.56,[["steal","shieldedOthers",.70],["hit","target",.49,"marked"]],{visual:'prismBloom',school:'shatter'}], // Crystal Crusher (Solo)
 [143,110705712,"Little False Key","portal","orbit",1.18,[["lock","target",1,"charging"],["evade","otherHurtAlly",.49],["charge","self",1,"marked"]],{visual:'keyCascade',school:'vortex',cooldown:4}], // limbo but uwu ig idk
 [144,71885708,"Silkstep","halo","sweep",1.23,[["evade","allAllies",.25],["mend","otherHurtAlly",.11],["haste","self",2,"selfHalf"]],{visual:'rampart',school:'ward'}], // Graceful
 [145,113364415,"Corner of Your Eye","eye","spiral",1.31,[["weak","allOthers",.26],["lock","weakOthers",2,"marked"],["mark","target",.32,"charging"]],{visual:'coilwell',school:'vortex',cooldown:6}], // paranoia (amplitron)
 [146,115380769,"Starlight Escort","lunar","orbit",1.28,[["hit","strongestOther",.35],["shield","otherHurtAlly",.57],["fury","sideAllies",.25,"knockout"]],{visual:'starfall',school:'ward'}], // Starlit Stroll
 [147,87071894,"Rage Fault","meteor","slam",1.66,[["fury","self",.48,"selfHalf"],["stagger","target",5],["hit","next",.46,"knockout"]],{visual:'spikeQuake',school:'rupture'}], // The Paroxysm of Rage
 [148,112242564,"Echo Transfusion","echo","pulse",1.44,[["drain","allAllies",.13],["hit","lowestOther",.38,"marked"],["mend","self",.17,"knockout"]],{visual:'shockGrid',school:'siphon'}], // Blood Echo
 [149,79771070,"Skyline Glimmer","comet","stream",1.29,[["hit","target",.35,"full"],["evade","sideAllies",.39],["haste","otherHurtAlly",1,"knockout"]],{visual:'spectralKeel',school:'surge'}], // Aerial Gleam
 [150,127023313,"Hard Disconnect","storm","pulse",1.30,[["lock","target",3],["stagger","strongestOther",5,"charging"],["steal","target",.59,"shielded"]],{visual:'packetDrop',school:'vortex',pierce:.28}], // DISCONNECT
];

export const extraLevelMoves=[
 [null,61079355,"Saw Garden","saw","fan",1.39,[["hit","target",0.17],["hit","neighbors",0.32],["hit","next",0.2]],{"visual":"acu"}], // Acu
 [null,54953085,"Phase Fold","eye","spiral",1.42,[["lock","target",2],["shield","otherHurtAlly",0.41],["weak","neighbors",0.24,"full"]],{"visual":"domain"}], // Thinking Space
 [null,11588490,"Spectrum Tunnel","portal","stream",1.28,[["hit","next",0.29],["charge","self",1,"marked"],["purge","self",1]],{"visual":"paracosm"}], // Ultra Paracosm
 [null,58673581,"Empty Throne","abyss","spiral",1.58,[["lock","lowestOther",3],["weak","allOthers",0.19,"knockout"]]], // Kenos
 [null,52374843,"Constellation Lock","orb","orbit",1.42,[["mark","next",0.29],["hit","highestHpOther",0.39],["heal","self",0.28,"marked"]],{"visual":"orbit"}], // Zodiac
 [null,42584142,"Redline Hunger","scythe","sweep",1.49,[["drain","self",0.48],["hit","lowestOther",0.35,"selfHalf"],["mark","target",0.25,"half"]]], // Bloodlust
 [null,68668045,"Final Service","halo","pulse",1.32,[["purge","allAllies",1],["shield","hurtAlly",0.38],["hit","strongestOther",0.39,"charging"]]], // Congregation
 [null,26681070,"Sonic Split","wave","fan",1.53,[["hit","neighbors",0.34],["lock","next",2,"marked"]]], // Sonic Wave
 [null,28220417,"Blackwing Dive","scythe","slam",1.61,[["hit","lowestOther",0.44],["shield","self",0.42,"knockout"]]], // Yatagarasu
 [null,27122654,"Overclocked Ascent","gear","stream",1.49,[["hit","highestHpOther",0.4],["shield","sideAllies",0.31,"charging"]]], // Artificial Ascent
 [null,23262780,"Four-Fang Drop","thorns","slam",1.61,[["hit","target",0.31],["strip","allOthers",0.38],["mark","next",0.25,"knockout"]]], // Sakupen Hell
 [null,55520,"Roadside Rod","storm","stream",1.25,[["hit","next",0.34],["shield","self",0.28,"full"]]], // THE LIGHTNING ROAD
 [null,3543219,"Finish Line Draft","comet","stream",1.33,[["hit","next",0.3],["charge","self",1,"half"],["weak","target",0.25,"full"]]], // Speed Racer
 [null,2997354,"Checksum Spike","gear","sweep",1.34,[["strip","target",0.54],["mark","next",0.26,"shielded"]]], // DeCode
 [null,56210242,"Thermal Shock","crystal","fan",1.3,[["hit","neighbors",0.31],["weak","target",0.37,"marked"]]], // Shiver
 [null,56587109,"Pocket Portal","portal","spiral",1.24,[["heal","otherHurtAlly",0.52],["lock","target",1,"half"]]], // phjork
];

export const bonusMoves=[
 [null,0,"Syringe Dream Core","pulse","stream",1.3,[["drain","otherHurtAlly",0.44],["purge","hurtAlly",1],["shield","self",0.31,"selfHalf"]],{"visual":"syringe"}],
 [null,0,"Orb Garden","orb","orbit",1.29,[["hit","neighbors",0.24],["mark","lowestOther",0.28],["charge","self",1,"full"]],{"visual":"orbit"}],
 [null,0,"Gravity Relay","abyss","spiral",1.38,[["weak","strongestOther",0.35],["shield","sideAllies",0.27]]],
 [null,0,"Prism Break","prism","fan",1.41,[["strip","target",1],["hit","shieldedOthers",0.24],["mark","target",0.18,"shielded"]]],
 [null,0,"Rampart Kick","shield","slam",1.42,[["shield","self",0.32],["shield","sideAllies",0.2],["purge","self",1,"charging"]]],
 [null,0,"Echo Chamber","echo","pulse",1.34,[["hit","markedOthers",0.31],["mark","next",0.29],["charge","self",1,"knockout"]]],
];
