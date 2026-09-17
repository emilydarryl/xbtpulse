import test from 'node:test';
import assert from 'node:assert/strict';
import {readableTag,readableTagGroups} from '../lib/readable-tags.mjs';
test('readable tags consolidate noise, preserve conflicting names, and never use ownership aliases',()=>{
 assert.equal(readableTag('! AlphaPool AlphaPool ,'),'AlphaPool');
 assert.equal(readableTag('X j /nodeStratum/'),'nodeStratum');
 assert.equal(readableTag('solo Quai Network ;'),'Quai Network');
 assert.equal(readableTag('CEO of LukeCoin'),'CEO of LukeCoin');
 assert.equal(readableTag('Test Test'),'Test Test');
 assert.equal(readableTag('AlphaPool Quai Network'),'AlphaPool + Quai Network');
 assert.equal(readableTag('notAlphaPool'),'Unclassified tag text');
 assert.equal(readableTag('new unknown text'),'Unclassified tag text');
 assert.equal(readableTag(''),'No recorded tag');
 const g=readableTagGroups([{tag:'! AlphaPool',blocks:2,share:.5},{tag:'AlphaPool ,',blocks:1,share:.25},{tag:'',blocks:1,share:.25}]);
 assert.equal(g[0].blocks,3);assert.equal(g[0].variants,2);assert.equal(g[0].share,.75);assert.equal(g[1].unknown,true);
});
