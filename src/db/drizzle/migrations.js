// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_small_electro.sql';
import m0001 from './0001_conscious_wraith.sql';
import m0002 from './0002_chief_infant_terrible.sql';
import m0003 from './0003_square_dark_beast.sql';
import m0004 from './0004_rich_warpath.sql';
import m0005 from './0005_fresh_goblin_queen.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005
    }
  }
  