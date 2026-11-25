import {openGameDatabase} from '../server/sqlite.mjs';

export function createGameDatabase() {
 return openGameDatabase(':memory:');
}
