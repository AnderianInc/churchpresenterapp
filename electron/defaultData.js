/**
 * electron/defaultData.js
 *
 * CJS bridge — re-exports the canonical default songs from the renderer layer.
 *
 * The authoritative data lives in src/data/defaultSongs.js (ES module).
 * Because electron/main.js runs in CommonJS, we duplicate the minimal data
 * here rather than transpiling. IMPORTANT: keep this in sync with
 * src/data/defaultSongs.js. Any song added to one must be added to the other.
 *
 * Stable IDs ensure that the first-run data file matches what the renderer
 * would produce — preventing ghost duplicates after reinstall.
 */

const defaultSongs = [
  {
    id: 'default-song-1', title: 'Amazing Grace', author: 'John Newton',
    key: 'G', tempo: 'Slow', tags: ['hymn', 'classic'],
    slides: [
      { id: 'ds1-s1', type: 'verse',  label: 'Verse 1', lines: 'Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.' },
      { id: 'ds1-s2', type: 'chorus', label: 'Chorus',  lines: "My chains are gone, I've been set free\nMy God, my Savior has ransomed me\nAnd like a flood His mercy rains\nUnending love, amazing grace" },
      { id: 'ds1-s3', type: 'verse',  label: 'Verse 2', lines: "'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed." },
      { id: 'ds1-s4', type: 'verse',  label: 'Verse 3', lines: "Through many dangers, toils and snares,\nI have already come;\n'Tis grace hath brought me safe thus far,\nAnd grace will lead me home." },
      { id: 'ds1-s5', type: 'verse',  label: 'Verse 4', lines: 'The Lord has promised good to me,\nHis Word my hope secures;\nHe will my Shield and Portion be,\nAs long as life endures.' },
    ],
    background: { type: 'color', value: '#0a0f1e' }, textColor: '#ffffff', fontSize: 44, fontFamily: 'Georgia',
  },
  {
    id: 'default-song-2', title: '10,000 Reasons (Bless the Lord)', author: 'Matt Redman',
    key: 'G', tempo: 'Medium', tags: ['contemporary', 'worship'],
    slides: [
      { id: 'ds2-s1', type: 'chorus', label: 'Chorus',  lines: "Bless the Lord, O my soul\nO my soul\nWorship His holy name\nSing like never before\nO my soul\nI'll worship Your holy name" },
      { id: 'ds2-s2', type: 'verse',  label: 'Verse 1', lines: "The sun comes up, it's a new day dawning\nIt's time to sing Your song again\nWhatever may pass and whatever lies before me\nLet me be singing when the evening comes" },
      { id: 'ds2-s3', type: 'verse',  label: 'Verse 2', lines: "You're rich in love and You're slow to anger\nYour name is great and Your heart is kind\nFor all Your goodness, I will keep on singing\nTen thousand reasons for my heart to find" },
      { id: 'ds2-s4', type: 'verse',  label: 'Verse 3', lines: "And on that day when my strength is failing\nThe end draws near and my time has come\nStill my soul will sing Your praise unending\nTen thousand years and then forevermore" },
    ],
    background: { type: 'color', value: '#0d1117' }, textColor: '#ffffff', fontSize: 42, fontFamily: 'Georgia',
  },
  {
    id: 'default-song-3', title: 'How Great Thou Art', author: 'Stuart K. Hine',
    key: 'Bb', tempo: 'Medium', tags: ['hymn', 'classic'],
    slides: [
      { id: 'ds3-s1', type: 'verse',  label: 'Verse 1', lines: 'O Lord my God, when I in awesome wonder\nConsider all the worlds Thy hands have made\nI see the stars, I hear the rolling thunder\nThy power throughout the universe displayed' },
      { id: 'ds3-s2', type: 'chorus', label: 'Chorus',  lines: 'Then sings my soul, my Savior God to Thee\nHow great Thou art, how great Thou art\nThen sings my soul, my Savior God to Thee\nHow great Thou art, how great Thou art' },
      { id: 'ds3-s3', type: 'verse',  label: 'Verse 2', lines: 'When through the woods and forest glades I wander\nAnd hear the birds sing sweetly in the trees\nWhen I look down from lofty mountain grandeur\nAnd see the brook and feel the gentle breeze' },
      { id: 'ds3-s4', type: 'verse',  label: 'Verse 3', lines: "And when I think that God, His Son not sparing\nSent Him to die, I scarce can take it in\nThat on the cross, my burden gladly bearing\nHe bled and died to take away my sin" },
    ],
    background: { type: 'color', value: '#0f0d1a' }, textColor: '#ffffff', fontSize: 40, fontFamily: 'Georgia',
  },
  {
    id: 'default-song-4', title: 'Oceans (Where Feet May Fail)', author: 'Hillsong United',
    key: 'D', tempo: 'Slow', tags: ['contemporary', 'worship'],
    slides: [
      { id: 'ds4-s1', type: 'verse',  label: 'Verse 1', lines: "You call me out upon the waters\nThe great unknown where feet may fail\nAnd there I find You in the mystery\nIn oceans deep, my faith will stand" },
      { id: 'ds4-s2', type: 'chorus', label: 'Chorus',  lines: "And I will call upon Your name\nAnd keep my eyes above the waves\nWhen oceans rise, my soul will rest in Your embrace\nFor I am Yours and You are mine" },
      { id: 'ds4-s3', type: 'bridge', label: 'Bridge',  lines: "Spirit lead me where my trust is without borders\nLet me walk upon the waters\nWherever You would call me\nTake me deeper than my feet could ever wander\nAnd my faith will be made stronger\nIn the presence of my Savior" },
    ],
    background: { type: 'color', value: '#061525' }, textColor: '#ffffff', fontSize: 40, fontFamily: 'Georgia',
  },
  {
    id: 'default-song-5', title: 'What a Beautiful Name', author: 'Hillsong Worship',
    key: 'D', tempo: 'Medium', tags: ['contemporary', 'worship'],
    slides: [
      { id: 'ds5-s1', type: 'verse',  label: 'Verse 1', lines: "You were the Word at the beginning\nOne with God the Lord Most High\nYour hidden glory in creation\nNow revealed in You our Christ" },
      { id: 'ds5-s2', type: 'chorus', label: 'Chorus',  lines: "What a beautiful name it is\nWhat a beautiful name it is\nThe name of Jesus Christ my King\nWhat a beautiful name it is\nNothing compares to this\nWhat a beautiful name it is\nThe name of Jesus" },
      { id: 'ds5-s3', type: 'bridge', label: 'Bridge',  lines: "Death could not hold You\nThe veil tore before You\nYou silenced the boast of sin and grave\nThe heavens are roaring\nThe praise of Your glory\nFor You are raised to life again" },
    ],
    background: { type: 'color', value: '#0d0a1e' }, textColor: '#ffffff', fontSize: 42, fontFamily: 'Georgia',
  },
  {
    id: 'default-song-6', title: 'Goodness of God', author: 'Bethel Music',
    key: 'E', tempo: 'Medium', tags: ['contemporary', 'worship'],
    slides: [
      { id: 'ds6-s1', type: 'verse',  label: 'Verse 1', lines: "I love You Lord\nOh Your mercy never fails me\nAll my days I've been held in Your hands\nFrom the moment that I wake up\nUntil I lay my head\nI will sing of the goodness of God" },
      { id: 'ds6-s2', type: 'chorus', label: 'Chorus',  lines: "All my life You have been faithful\nAll my life You have been so, so good\nWith every breath that I am able\nI will sing of the goodness of God" },
      { id: 'ds6-s3', type: 'bridge', label: 'Bridge',  lines: "Your goodness is running after\nIt's running after me\nYour goodness is running after\nIt's running after me\nWith my life laid down\nI'm surrendered now\nI give You everything" },
    ],
    background: { type: 'color', value: '#0a1500' }, textColor: '#ffffff', fontSize: 42, fontFamily: 'Georgia',
  },
];

module.exports = { defaultSongs };
