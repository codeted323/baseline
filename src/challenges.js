'use strict';
/* ---------------------------------------------------------------
   Challenges: long sentences in the style of the 1800s. The sentences
   are new (not quotations), so their punctuation follows the modern
   comma rules of the lessons. Each one uses only parts from the lessons.
   --------------------------------------------------------------- */
const PTA = (w) => PT(w);                     // a single participle used as an adjective ("the dying fire")

Object.assign(SENT, {
  v01: { s: 'On a cold evening in November, a tired traveler in a dark cloak knocked at the door of the old inn, and the landlord, a stout man with a red face, let him in.',
    conj: 'and', clauses: [
      { S: W('traveler', 'a', 'tired', P('in', W('cloak', 'a', 'dark'))),
        V: W('knocked', P('On', W('evening', 'a', 'cold', P('in', W('November')))), P('at', W('door', 'the', P('of', W('inn', 'the', 'old'))))) },
      { S: W('landlord', 'the', AP(W('man', 'a', 'stout', P('with', W('face', 'a', 'red'))))), V: W('let', 'in'), DO: W('him') }],
    cm: { November: 'intro', inn: 'compound', landlord: 'apNon', face: 'apNon' }, trap: { cloak: 'sv' } },

  v02: { s: 'There was in the house a small room at the top of the stairs, and in that room, which no one had entered for many years, the children found a chest of old letters.',
    ind: [EXPL('There')], conj: 'and', clauses: [
      { S: W('room', 'a', 'small', P('at', W('top', 'the', P('of', W('stairs', 'the'))))), V: W('was', P('in', W('house', 'the'))) },
      { S: W('children', 'the'),
        V: W('found', P('in', W('room', 'that', AC({ S: W('one', 'no'), V: VB('had entered', P('for', W('years', 'many'))), DO: REL('which') })))),
        DO: W('chest', 'a', P('of', W('letters', 'old'))) }],
    cm: { stairs: 'compound', 'room#2': 'acNon', years: 'acNon' }, trap: { There: 'expl' } },

  v03: { s: 'Although the night was dark and cold, the faithful old servant, who had served the family for forty years, walked to the village without a lantern, and he returned before dawn with the doctor.',
    conj: 'and', clauses: [
      { S: W('servant', 'the', 'faithful', 'old', AC({ S: REL('who'), V: VB('had served', P('for', W('years', 'forty'))), DO: W('family', 'the') })),
        V: W('walked', SC('Although', { S: W('night', 'the'), V: W('was'), PA: C('and', W('dark'), W('cold')) }), P('to', W('village', 'the')), P('without', W('lantern', 'a'))) },
      { S: W('he'), V: W('returned', P('before', W('dawn')), P('with', W('doctor', 'the'))) }],
    cm: { cold: 'introClause', servant: 'acNon', years: 'acNon', lantern: 'compound' }, trap: { dark: 'pair', faithful: 'cumul' } },

  v04: { s: 'My dear sister, I write to you from the house of our late uncle, a gloomy building on the edge of the moor, and I must tell you that the servants are very strange.',
    ind: [ADDR(W('sister', 'My', 'dear'))], conj: 'and', clauses: [
      { S: W('I'), V: W('write', P('to', W('you')), P('from', W('house', 'the', P('of', W('uncle', 'our', 'late')),
          AP(W('building', 'a', 'gloomy', P('on', W('edge', 'the', P('of', W('moor', 'the'))))))))) },
      { S: W('I'), V: VB('must tell', IO(W('you'))), DO: NC('that', { S: W('servants', 'the'), V: W('are'), PA: W('strange', 'very') }) }],
    cm: { sister: 'addr', uncle: 'apNon', moor: 'compound' }, trap: { 'you#2': 'ncNo' },
    ctx: 'The appositive “a gloomy building on the edge of the moor” renames “house,” not “uncle.”' },

  v05: { s: 'When the carriage had disappeared beyond the hill, the young widow, returning slowly to the empty drawing room, played the old song that her husband had loved; outside, the rain beat softly against the tall windows of the house.',
    conj: ['x'], clauses: [
      { S: W('widow', 'the', 'young', PT('returning', null, 'slowly', P('to', W('room', 'the', 'empty', 'drawing')))),
        V: W('played', SC('When', { S: W('carriage', 'the'), V: VB('had disappeared', P('beyond', W('hill', 'the'))) })),
        DO: W('song', 'the', 'old', AC({ S: W('husband', 'her'), V: VB('had loved'), DO: REL('that') })) },
      { S: W('rain', 'the'), V: W('beat', 'outside', 'softly', P('against', W('windows', 'the', 'tall', P('of', W('house', 'the'))))) }],
    cm: { hill: 'introClause', widow: 'partNon', room: 'partNon', loved: 'semi', outside: 'introShort?' }, trap: { song: 'acRestr' } },

  v06: { s: 'If you ever visit the little town of Wexcombe, which lies in a green valley between two rivers, you will see on the hill above it the ruins of a castle that once belonged to the greatest family in the county.',
    S: W('you'),
    V: VB('will see', SC('If', { S: W('you'), V: W('visit', 'ever'),
        DO: W('town', 'the', 'little', P('of', W('Wexcombe', AC({ S: REL('which'), V: W('lies', P('in', W('valley', 'a', 'green', P('between', W('rivers', 'two'))))) })))) }),
      P('on', W('hill', 'the', P('above', W('it'))))),
    DO: W('ruins', 'the', P('of', W('castle', 'a', AC({ S: REL('that'), V: W('belonged', 'once', P('to', W('family', 'the', 'greatest', P('in', W('county', 'the'))))) })))),
    cm: { Wexcombe: 'acNon', rivers: 'introClause' }, trap: { castle: 'acRestr' } },

  v07: { s: 'That the old miser had hidden his gold somewhere in the house was well known to everyone in the village, but searching for it brought nothing but trouble, for the house was guarded by a fierce dog and a fiercer housekeeper.',
    conj: ['but', 'for'], clauses: [
      { S: NC('That', { S: W('miser', 'the', 'old'), V: VB('had hidden', 'somewhere', P('in', W('house', 'the'))), DO: W('gold', 'his') }),
        V: W('was'), PA: W('known', 'well', P('to', W('everyone', P('in', W('village', 'the'))))) },
      { S: GR('searching', null, P('for', W('it'))), V: W('brought'), DO: W('nothing', P('but', W('trouble'))) },
      { S: W('house', 'the'), V: VB('was guarded', P('by', C('and', W('dog', 'a', 'fierce'), W('housekeeper', 'a', 'fiercer')))) }],
    cm: { village: 'compound', trouble: 'compound' }, trap: { house: 'sv', it: 'sv', dog: 'pair' } },

  v08: { s: 'Alas, my friend, the fortune that your grandfather had gathered with such patience was lost in a single year; his son, a careless young man with expensive habits, spent it on horses, cards, and fine clothes, and the old estate was sold to a stranger.',
    ind: [INTJ('Alas'), ADDR(W('friend', 'my'))], conj: ['x', 'and'], clauses: [
      { S: W('fortune', 'the', AC({ S: W('grandfather', 'your'), V: VB('had gathered', P('with', W('patience', 'such'))), DO: REL('that') })),
        V: VB('was lost', P('in', W('year', 'a', 'single'))) },
      { S: W('son', 'his', AP(W('man', 'a', 'careless', 'young', P('with', W('habits', 'expensive'))))),
        V: W('spent', P('on', C('and', W('horses'), W('cards'), W('clothes', 'fine')))), DO: W('it') },
      { S: W('estate', 'the', 'old'), V: VB('was sold', P('to', W('stranger', 'a'))) }],
    cm: { Alas: 'intj', friend: 'addr', year: 'semi', son: 'apNon', habits: 'apNon', horses: 'series', cards: 'serial?', clothes: 'compound' },
    trap: { fortune: 'acRestr', patience: 'sv' } },

  v09: { s: 'The old professor, having spent forty years in the study of ancient languages, believed that every word had a history, and he would often stop his lectures to tell his weary students the long story of a single verb, which had traveled from Persia to England.',
    conj: 'and', clauses: [
      { S: W('professor', 'The', 'old', PT('having spent', { DO: W('years', 'forty') }, P('in', W('study', 'the', P('of', W('languages', 'ancient')))))),
        V: W('believed'), DO: NC('that', { S: W('word', 'every'), V: W('had'), DO: W('history', 'a') }) },
      { S: W('he'), V: VB('would stop', 'often', INF('tell', { DO: W('story', 'the', 'long', P('of', W('verb', 'a', 'single',
          AC({ S: REL('which'), V: VB('had traveled', P('from', W('Persia')), P('to', W('England'))) })))) }, IO(W('students', 'his', 'weary')))),
        DO: W('lectures', 'his') }],
    cm: { professor: 'partNon', languages: 'partNon', history: 'compound', verb: 'acNon' }, trap: { believed: 'ncNo' } },

  v10: { s: 'Taking nothing but a small bag and a letter from her brother, Eleanor left the house by the garden door before the servants had risen; nobody noticed her departure, and by noon she was already far away on the road to London, a city that she had never seen.',
    conj: ['x', 'and'], clauses: [
      { S: W('Eleanor', PT('Taking', { DO: W('nothing', P('but', C('and', W('bag', 'a', 'small'), W('letter', 'a', P('from', W('brother', 'her')))))) })),
        V: W('left', P('by', W('door', 'the', 'garden')), SC('before', { S: W('servants', 'the'), V: VB('had risen') })), DO: W('house', 'the') },
      { S: W('nobody'), V: W('noticed'), DO: W('departure', 'her') },
      { S: W('she'), V: W('was', 'already', W('away', 'far'), P('by', W('noon')),
          P('on', W('road', 'the', P('to', W('London', AP(W('city', 'a', AC({ S: W('she'), V: VB('had seen', 'never'), DO: REL('that') }))))))) ) }],
    cm: { brother: 'introPart', risen: 'semi', departure: 'compound', noon: 'introShort?', London: 'apNon' }, trap: { bag: 'pair', door: 'scAfter' } },

  v11: { s: 'The two sisters, who had not spoken for three years, met at last in the garden of their childhood home, a crumbling house that their father had built; neither of them said a word at first, but when the younger sister began to weep, the elder gently took her hand.',
    conj: ['x', 'but'], clauses: [
      { S: W('sisters', 'The', 'two', AC({ S: REL('who'), V: VB('had spoken', 'not', P('for', W('years', 'three'))) })),
        V: W('met', P('at', W('last')), P('in', W('garden', 'the', P('of', W('home', 'their', 'childhood',
          AP(W('house', 'a', PTA('crumbling'), AC({ S: W('father', 'their'), V: VB('had built'), DO: REL('that') })))))))) },
      { S: W('neither', P('of', W('them'))), V: W('said', P('at', W('first'))), DO: W('word', 'a') },
      { S: W('elder', 'the'), V: W('took', 'gently', SC('when', { S: W('sister', 'the', 'younger'), V: W('began'), DO: INF('weep') })), DO: W('hand', 'her') }],
    cm: { sisters: 'acNon', years: 'acNon', home: 'apNon', built: 'semi', first: 'compound', weep: 'introClause' }, trap: { house: 'acRestr' } },

  v12: { s: 'The dinner being over, the ladies withdrew to the drawing room, and the gentlemen, who remained at the table with their wine, began a long, noisy argument about politics; the old colonel declared that the government was ruining the country, the young curate defended it with great courage, and their host, a timid man who disliked quarrels, said nothing at all.',
    ind: [ABS(W('dinner', 'The', PT('being', { PA: W('over') })))], conj: ['and', 'x', 'x', 'and'], clauses: [
      { S: W('ladies', 'the'), V: W('withdrew', P('to', W('room', 'the', 'drawing'))) },
      { S: W('gentlemen', 'the', AC({ S: REL('who'), V: W('remained', P('at', W('table', 'the')), P('with', W('wine', 'their'))) })),
        V: W('began'), DO: W('argument', 'a', 'long', 'noisy', P('about', W('politics'))) },
      { S: W('colonel', 'the', 'old'), V: W('declared'), DO: NC('that', { S: W('government', 'the'), V: VB('was ruining'), DO: W('country', 'the') }) },
      { S: W('curate', 'the', 'young'), V: W('defended', P('with', W('courage', 'great'))), DO: W('it') },
      { S: W('host', 'their', AP(W('man', 'a', 'timid', AC({ S: REL('who'), V: W('disliked'), DO: W('quarrels') })))),
        V: W('said'), DO: W('nothing', P('at', W('all'))) }],
    cm: { over: 'abs', room: 'compound', gentlemen: 'acNon', wine: 'acNon', long: 'coord', politics: 'semi', country: 'series', courage: 'compound', host: 'apNon', quarrels: 'apNon' },
    trap: { declared: 'ncNo', man: 'acRestr' } },

  v13: { s: 'When the long winter had at last released its grip upon the valley, the farmers, who had waited through the dark months in their lonely cottages, came down from the hills with their families, bringing wool, cheese, and the first lambs of the season to the market in the town; they sold their goods to merchants from the city, bought salt, cloth, and iron, and drank to the health of the young queen, who smiled from a portrait above the door of every inn.',
    conj: ['x'], clauses: [
      { S: W('farmers', 'the', AC({ S: REL('who'), V: VB('had waited', P('through', W('months', 'the', 'dark')), P('in', W('cottages', 'their', 'lonely'))) }),
          PT('bringing', { DO: C('and', W('wool'), W('cheese'), W('lambs', 'the', 'first', P('of', W('season', 'the')))) }, P('to', W('market', 'the', P('in', W('town', 'the')))))),
        V: W('came', 'down', P('from', W('hills', 'the')), P('with', W('families', 'their')),
          SC('When', { S: W('winter', 'the', 'long'), V: VB('had released', P('at', W('last')), P('upon', W('valley', 'the'))), DO: W('grip', 'its') })) },
      { S: W('they'), V: C('and',
          { V: W('sold', P('to', W('merchants', P('from', W('city', 'the'))))), DO: W('goods', 'their') },
          { V: W('bought'), DO: C('and', W('salt'), W('cloth'), W('iron')) },
          W('drank', P('to', W('health', 'the', P('of', W('queen', 'the', 'young',
            AC({ S: REL('who'), V: W('smiled', P('from', W('portrait', 'a', P('above', W('door', 'the', P('of', W('inn', 'every'))))))) }))))))) }],
    cm: { valley: 'introClause', farmers: 'acNon', cottages: 'acNon', families: 'partNon', wool: 'series', cheese: 'serial?', town: 'semi',
      city: 'series', salt: 'series', cloth: 'serial?', iron: 'serial?', queen: 'acNon' } },

  v14: { s: 'Reader, if you had stood upon the deck of that small ship on the night of the great storm, you would have seen the captain, a gaunt old man with a white beard, standing alone at the wheel; you would have heard the terrible roar of the wind, which tore the sails from their ropes and flung them into the sea; and you would have understood why the sailors, brave men in every other danger, prayed silently in the darkness that their ship might survive until the morning.',
    ind: [ADDR(W('Reader'))], conj: ['x', 'and'], clauses: [
      { S: W('you'),
        V: VB('would have seen', SC('if', { S: W('you'), V: VB('had stood', P('upon', W('deck', 'the', P('of', W('ship', 'that', 'small')))),
          P('on', W('night', 'the', P('of', W('storm', 'the', 'great'))))) })),
        DO: W('captain', 'the', AP(W('man', 'a', 'gaunt', 'old', P('with', W('beard', 'a', 'white')))), PT('standing', null, 'alone', P('at', W('wheel', 'the')))) },
      { S: W('you'), V: VB('would have heard'),
        DO: W('roar', 'the', 'terrible', P('of', W('wind', 'the', AC({ S: REL('which'),
          V: C('and', { V: W('tore', P('from', W('ropes', 'their'))), DO: W('sails', 'the') }, { V: W('flung', P('into', W('sea', 'the'))), DO: W('them') }) })))) },
      { S: W('you'), V: VB('would have understood'),
        DO: NC(null, { S: W('sailors', 'the', AP(W('men', 'brave', P('in', W('danger', 'every', 'other'))))),
          V: W('prayed', 'why', 'silently', P('in', W('darkness', 'the'))),
          DO: NC('that', { S: W('ship', 'their'), V: VB('might survive', P('until', W('morning', 'the'))) }) }) }],
    cm: { Reader: 'addr', storm: 'introClause', captain: 'apNon', beard: 'apNon', wheel: 'semi', wind: 'acNon', sea: 'semiSeries', sailors: 'apNon', danger: 'apNon' },
    trap: { understood: 'ncNo', darkness: 'ncNo', ropes: 'pair' } },

  v15: { s: 'Alas, my dear Margaret, there was no longer any hope; the doctor, a grave young man who had come from London on the morning train, examined our poor father for an hour, listened to his heart, and told us quietly that he would not live through the night; and our mother, who had nursed him with such devotion through all the long weeks of his illness, sat beside his bed without a word, holding his thin hand in hers, while outside the window the snow fell silently upon the garden that he had planted with his own hands long ago.',
    ind: [INTJ('Alas'), ADDR(W('Margaret', 'my', 'dear')), EXPL('there')], conj: ['x', 'and'], clauses: [
      { S: W('hope', 'any'), V: W('was', W('longer', 'no')) },
      { S: W('doctor', 'the', AP(W('man', 'a', 'grave', 'young', AC({ S: REL('who'), V: VB('had come', P('from', W('London')), P('on', W('train', 'the', 'morning'))) })))),
        V: C('and',
          { V: W('examined', P('for', W('hour', 'an'))), DO: W('father', 'our', 'poor') },
          W('listened', P('to', W('heart', 'his'))),
          { V: W('told', 'quietly', IO(W('us'))), DO: NC('that', { S: W('he'), V: VB('would live', 'not', P('through', W('night', 'the'))) }) }) },
      { S: W('mother', 'our', AC({ S: REL('who'), V: VB('had nursed', P('with', W('devotion', 'such')), P('through', W('weeks', 'all', 'the', 'long', P('of', W('illness', 'his'))))), DO: W('him') }),
          PT('holding', { DO: W('hand', 'his', 'thin') }, P('in', W('hers')))),
        V: W('sat', P('beside', W('bed', 'his')), P('without', W('word', 'a')),
          SC('while', { S: W('snow', 'the'), V: W('fell', P('outside', W('window', 'the')), 'silently', P('upon', W('garden', 'the',
            AC({ S: W('he'), V: VB('had planted', P('with', W('hands', 'his', 'own')), W('ago', 'long')), DO: REL('that') })))) })) }],
    cm: { Alas: 'intj', Margaret: 'addr', hope: 'semi', doctor: 'apNon', train: 'apNon', hour: 'series', heart: 'serial?', night: 'semiSeries',
      mother: 'acNon', illness: 'acNon', word: 'partNon', hers: 'partNon' },
    trap: { there: 'expl', quietly: 'ncNo', garden: 'acRestr', man: 'acRestr' } },

  v16: { s: 'The old house, a gloomy pile of gray stone that the villagers avoided after dark, stood at the end of a narrow lane; its windows, which had not been cleaned for many years, looked out upon a garden of weeds and broken statues, and its owner, a lonely widower who had quarreled with all his relations, sat by a dying fire through the long winter evenings, reading the faded letters of his dead wife until the last candle had burned away; then, as the cold light of morning crept across the floor, the old man would fall asleep in his chair, and the house would be silent again.',
    conj: ['x', 'and', 'x', 'and'], clauses: [
      { S: W('house', 'The', 'old', AP(W('pile', 'a', 'gloomy', P('of', W('stone', 'gray')), AC({ S: W('villagers', 'the'), V: W('avoided', P('after', W('dark'))), DO: REL('that') })))),
        V: W('stood', P('at', W('end', 'the', P('of', W('lane', 'a', 'narrow'))))) },
      { S: W('windows', 'its', AC({ S: REL('which'), V: VB('had been cleaned', 'not', P('for', W('years', 'many'))) })),
        V: W('looked', 'out', P('upon', W('garden', 'a', P('of', C('and', W('weeds'), W('statues', PTA('broken'))))))) },
      { S: W('owner', 'its', AP(W('widower', 'a', 'lonely', AC({ S: REL('who'), V: VB('had quarreled', P('with', W('relations', 'all', 'his'))) }))),
          PT('reading', { DO: W('letters', 'the', PTA('faded'), P('of', W('wife', 'his', 'dead'))) }, SC('until', { S: W('candle', 'the', 'last'), V: VB('had burned', 'away') }))),
        V: W('sat', P('by', W('fire', 'a', PTA('dying'))), P('through', W('evenings', 'the', 'long', 'winter'))) },
      { S: W('man', 'the', 'old'),
        V: VB('would fall', 'then', SC('as', { S: W('light', 'the', 'cold', P('of', W('morning'))), V: W('crept', P('across', W('floor', 'the'))) }), P('in', W('chair', 'his'))),
        PA: W('asleep') },
      { S: W('house', 'the'), V: VB('would be', 'again'), PA: W('silent') }],
    cm: { house: 'apNon', dark: 'apNon', lane: 'semi', windows: 'acNon', years: 'acNon', statues: 'compound', owner: 'apNon', relations: 'apNon', evenings: 'partNon',
      away: 'semi', then: 'introShort?', floor: 'introClause', chair: 'compound' },
    trap: { stone: 'acRestr', widower: 'acRestr', weeds: 'pair' } },
});

/* The ladder, from the shortest sentence to the longest. */
const CHALLENGES = [
  { key: 'v01', tier: 0 }, { key: 'v02', tier: 0 }, { key: 'v03', tier: 0 }, { key: 'v04', tier: 0 },
  { key: 'v05', tier: 1 }, { key: 'v06', tier: 1 }, { key: 'v07', tier: 1 }, { key: 'v08', tier: 1 },
  { key: 'v09', tier: 2 }, { key: 'v10', tier: 2 }, { key: 'v11', tier: 2 }, { key: 'v12', tier: 2 },
  { key: 'v13', tier: 3 }, { key: 'v14', tier: 3 }, { key: 'v15', tier: 3 }, { key: 'v16', tier: 3 },
];
const TIERS = ['Long', 'Longer', 'Very long', 'Monstrous'];
