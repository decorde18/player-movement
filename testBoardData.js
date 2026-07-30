const { getBoardData } = require('./src/app/player-board/actions');
(async () => {
  try {
    const data = await getBoardData(1);
    console.log('Board Data:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
})();
