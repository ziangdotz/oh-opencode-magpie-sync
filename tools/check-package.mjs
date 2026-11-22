import { strict as assert } from 'node:assert';
import plugin from 'opencode-magpie-sync';
assert.equal(plugin.id, 'magpie.sync');
assert.equal(typeof plugin.setup, 'function');
console.log('Built package export loaded');
