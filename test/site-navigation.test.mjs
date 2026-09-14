import test from 'node:test';
import assert from 'node:assert/strict';
import {siteNavigation} from '../lib/site-navigation.mjs';
test('shared navigation preserves page controls and highlights current route',()=>{const html='<head></head><body><header class="topbar"><a>Old</a><div class="header-right"><button id="logout">Logout</button></div></header><main>Body</main>';const output=siteNavigation(html,'/compare');assert.match(output,/id="logout"/);assert.match(output,/<main>Body/);assert.match(output,/href="\/compare" aria-current="page"/);assert.match(output,/class="current-tool"/);assert.match(output,/site-navigation.js/);assert.ok(!output.includes('<a>Old</a>'));assert.equal(siteNavigation('plain','/'),'plain');});
