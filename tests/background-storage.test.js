const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const backgroundSource = fs.readFileSync(path.join(__dirname, '..', 'extension', 'background.js'), 'utf8');

function storageArea(initial = {}) {
  const data = structuredClone(initial);
  return {
    data,
    failNextSet: false,
    async get(keys) {
      if (keys == null) return structuredClone(data);
      const selected = {};
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        if (Object.hasOwn(data, key)) selected[key] = structuredClone(data[key]);
      }
      return selected;
    },
    async set(values) {
      if (this.failNextSet) {
        this.failNextSet = false;
        throw new Error('simulated storage failure');
      }
      Object.assign(data, structuredClone(values));
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    },
  };
}

async function loadBackground(initialStorage = {}) {
  const local = storageArea(initialStorage);
  const noopEvent = { addListener() {}, removeListener() {} };
  const context = vm.createContext({
    chrome: {
      action: { onClicked: noopEvent },
      runtime: {
        getManifest: () => ({ version: 'test' }),
        getURL: value => value,
        onMessage: noopEvent,
      },
      scripting: { executeScript: async () => [{ result: null }] },
      storage: { local },
      tabs: {
        create: async () => ({ id: 1 }),
        get: async () => ({ url: 'https://practiscore.com/associate/step2' }),
        onUpdated: noopEvent,
        remove: async () => {},
      },
    },
    console,
    Date,
    Map,
    Object,
    Promise,
    Set,
    TextEncoder,
    clearTimeout,
    setTimeout,
    structuredClone,
  });
  vm.runInContext(`${backgroundSource}\n;globalThis.__hfcTest = {
    storageMigrationPromise, resolveHistoryDiscovery, collectMatchHistory,
    normalizeHistorySync, createBackup, importBackup, fetchScores, isReusableMatchCache
  };`, context);
  await context.__hfcTest.storageMigrationPromise;
  return { context, local, api: context.__hfcTest };
}

const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const thirdId = '33333333-3333-4333-8333-333333333333';
const delayedId = '44444444-4444-4444-8444-444444444444';

function completeCache(schemaVersion = 1) {
  return {
    cached_for: 'A103',
    stages: [{ num: 1, name: 'Stage 1', time: 10, fastest_combined_time: 10, is_classifier: false }],
    cache_completeness: {
      schema_version: schemaVersion,
      state: 'complete',
      expected_stage_count: 1,
      fetched_stage_count: 1,
      failed_stages: [],
    },
  };
}

function syncMetadata(overrides = {}) {
  return {
    schemaVersion: 1,
    cachedFor: 'A103',
    highWaterDate: '2026-09-07',
    highWaterIds: [firstId],
    knownIds: [firstId, secondId, thirdId],
    lastFullScanAt: Date.now(),
    lastSuccessfulScanAt: Date.now(),
    runsSinceFullScan: 1,
    ...overrides,
  };
}

test('compatible complete caches migrate without losing stages or preferences', async () => {
  const { local } = await loadBackground({
    memberNumber: 'A103',
    matchCache: { [firstId]: completeCache(1) },
    stageOverrides: { [firstId]: { '01|Stage 1': { included: false } } },
    storageMetadata: { schemaVersion: 1 },
  });

  assert.equal(local.data.storageMetadata.schemaVersion, 2);
  assert.equal(local.data.matchCache[firstId].cache_completeness.schema_version, 3);
  assert.deepEqual(local.data.matchCache[firstId].stages, [{ num: 1, name: 'Stage 1', time: 10, fastest_combined_time: 10, is_classifier: false }]);
  assert.deepEqual(local.data.stageOverrides[firstId], { '01|Stage 1': { included: false } });
});

test('complete caches without raw-time benchmarks are repaired instead of reused', async () => {
  const { api } = await loadBackground();
  const legacy = completeCache(2);
  delete legacy.stages[0].fastest_combined_time;
  assert.equal(api.isReusableMatchCache(legacy, 'A103'), false);
});

test('missing, corrupt, stale, and explicit metadata select full discovery', async () => {
  const { api } = await loadBackground();
  const list = [{ match_id: firstId }];

  assert.equal(api.resolveHistoryDiscovery(list, null, 'A103').mode, 'full');
  assert.equal(api.resolveHistoryDiscovery(list, syncMetadata({ cachedFor: 'B999' }), 'A103').mode, 'full');
  assert.equal(api.resolveHistoryDiscovery(list, syncMetadata({ runsSinceFullScan: 10 }), 'A103').mode, 'full');
  assert.equal(api.resolveHistoryDiscovery(list, syncMetadata(), 'A103', true).mode, 'full');
  assert.equal(api.resolveHistoryDiscovery(list, syncMetadata(), 'A103').mode, 'incremental');
});

test('incremental discovery keeps same-day unknown IDs and stops after two known overlap pages', async () => {
  const { context, api } = await loadBackground();
  context.__pages = [
    { signature: 'new', hasNextPage: true, _ready: true, matches: [{ match_id: delayedId, date: '2026-09-07' }] },
    { signature: 'known-1', hasNextPage: true, _ready: true, matches: [{ match_id: firstId, date: '2026-09-07' }] },
    { signature: 'known-2', hasNextPage: true, _ready: true, matches: [{ match_id: secondId, date: '2026-09-06' }] },
    { signature: 'unread', hasNextPage: false, _ready: true, matches: [{ match_id: thirdId, date: '2026-09-05' }] },
  ];
  vm.runInContext('let __pageIndex = 0; runInTab = async (_tab, fn) => fn === extractMatchList ? __pages[Math.min(__pageIndex, __pages.length - 1)] : (++__pageIndex, true); sleep = async () => {};', context);
  const discovery = api.resolveHistoryDiscovery(
    [{ match_id: firstId }, { match_id: secondId }, { match_id: thirdId }],
    syncMetadata(),
    'A103'
  );
  const history = await api.collectMatchHistory(1, () => {}, discovery);

  assert.equal(history.pagesRead, 3);
  assert.equal(history.verifiedOverlap, true);
  assert.equal(history.fullScanComplete, false);
  assert.deepEqual([...history.matches].map(match => match.match_id), [delayedId, firstId, secondId]);
});

test('malformed dates disable incremental stopping and complete full pagination', async () => {
  const { context, api } = await loadBackground();
  context.__pages = [
    { signature: 'bad-date', hasNextPage: true, _ready: true, matches: [{ match_id: firstId, date: 'unknown' }] },
    { signature: 'last', hasNextPage: false, _ready: true, matches: [{ match_id: secondId, date: '2026-09-06' }] },
  ];
  vm.runInContext('let __pageIndex = 0; runInTab = async (_tab, fn) => fn === extractMatchList ? __pages[Math.min(__pageIndex, __pages.length - 1)] : (++__pageIndex, true); sleep = async () => {};', context);
  const discovery = api.resolveHistoryDiscovery([{ match_id: firstId }, { match_id: secondId }], syncMetadata(), 'A103');
  const history = await api.collectMatchHistory(1, () => {}, discovery);

  assert.equal(history.pagesRead, 2);
  assert.equal(history.fullScanComplete, true);
  assert.match(history.reason, /malformed/);
});

test('an unsettled next page reports incomplete discovery without inventing completion', async () => {
  const { context, api } = await loadBackground();
  context.__pages = [
    { signature: 'first', hasNextPage: true, _ready: true, matches: [{ match_id: firstId, date: '2026-09-07' }] },
    { signature: 'first', hasNextPage: true, _ready: true, matches: [{ match_id: firstId, date: '2026-09-07' }] },
  ];
  vm.runInContext('let __pageIndex = 0; runInTab = async (_tab, fn) => fn === extractMatchList ? __pages[Math.min(__pageIndex, __pages.length - 1)] : (++__pageIndex, true); sleep = async () => {};', context);
  const discovery = api.resolveHistoryDiscovery([{ match_id: firstId }], syncMetadata(), 'A103');
  const history = await api.collectMatchHistory(1, () => {}, discovery);

  assert.equal(history.complete, false);
  assert.equal(history.fullScanComplete, false);
  assert.equal(history.pagesRead, 1);
  assert.deepEqual([...history.matches].map(match => match.match_id), [firstId]);
});

test('bounded full reconciliation persists all discovered IDs and authoritatively removes stale history', async () => {
  const { context, local, api } = await loadBackground({
    memberNumber: 'A103',
    lastMatchList: [{ match_id: thirdId, match_name: 'Stale IDPA Match', date: '2019-01-01' }],
  });
  context.__history = {
    matches: [
      { match_id: firstId, match_name: 'Recent IDPA Match', date: '2026-09-01' },
      { match_id: delayedId, match_name: 'Older IDPA Backfill', date: '2020-01-01' },
    ],
    complete: true,
    fullScanComplete: true,
    verifiedOverlap: false,
    pagesRead: 4,
    reason: 'reached end of history',
  };
  vm.runInContext('waitForTabLoad = async () => {}; sleep = async () => {}; collectMatchHistory = async () => __history;', context);

  const response = await api.fetchScores('A103', 'Test Shooter', {
    value: '6m', label: '6 mo', start: '2026-03-07', end: '2026-09-07',
  }, { fullHistory: true });
  const persistedIds = local.data.lastMatchList.map(match => match.match_id);

  assert.deepEqual(persistedIds, [firstId, delayedId]);
  assert.deepEqual([...local.data.matchHistorySync.knownIds], persistedIds);
  assert.equal(response.fetchDiagnostics.inRangeMatches, 1);
  assert.equal(response.fetchDiagnostics.newMatches, 0);
  assert.equal(response.results.length, 2);
});

test('incremental reconciliation persists an out-of-range unknown ID and preserves prior history', async () => {
  const { context, local, api } = await loadBackground({
    memberNumber: 'A103',
    lastMatchList: [{ match_id: secondId, match_name: 'Existing IDPA Match', date: '2025-01-01', match_type: 'IDPA' }],
    matchHistorySync: syncMetadata({ knownIds: [secondId], highWaterDate: '2025-01-01', highWaterIds: [secondId] }),
  });
  context.__history = {
    matches: [
      { match_id: firstId, match_name: 'Recent IDPA Match', date: '2026-09-01' },
      { match_id: delayedId, match_name: 'Older IDPA Backfill', date: '2020-01-01' },
    ],
    complete: true,
    fullScanComplete: false,
    verifiedOverlap: true,
    pagesRead: 2,
    reason: 'verified overlap across 2 settled page(s)',
  };
  vm.runInContext('waitForTabLoad = async () => {}; sleep = async () => {}; collectMatchHistory = async () => __history;', context);

  await api.fetchScores('A103', 'Test Shooter', {
    value: '6m', label: '6 mo', start: '2026-03-07', end: '2026-09-07',
  });
  const persistedIds = local.data.lastMatchList.map(match => match.match_id);

  assert.deepEqual(persistedIds, [firstId, delayedId, secondId]);
  assert.ok(local.data.matchHistorySync.knownIds.every(id => persistedIds.includes(id)));
});

test('backup round trip validates ownership and restores all managed history keys', async () => {
  const source = await loadBackground({
    memberNumber: 'A103',
    name: 'Test Shooter',
    matchCache: { [firstId]: completeCache(1) },
    lastMatchList: [{ match_id: firstId, match_name: 'Test Match', date: '2026-09-07' }],
    selectedDivision: 'co',
    fetchTimeline: '6m',
    last8Matches: true,
  });
  const backup = await source.api.createBackup();
  const target = await loadBackground();
  const result = await target.api.importBackup(backup);

  assert.equal(result.matches, 1);
  assert.equal(target.local.data.memberNumber, 'A103');
  assert.equal(target.local.data.matchCache[firstId].cached_for, 'A103');
  assert.equal(target.local.data.last8Matches, true);

  backup.data.matchCache[firstId].cached_for = 'B999';
  await assert.rejects(target.api.importBackup(backup), /ownership/);
});

test('restore rejects malformed nested cache data before changing storage', async () => {
  const source = await loadBackground({
    memberNumber: 'A103',
    matchCache: { [firstId]: completeCache(1) },
    lastMatchList: [{ match_id: firstId, match_name: 'Imported', date: '2026-09-07' }],
  });
  const backup = await source.api.createBackup();
  backup.data.matchCache[firstId].stages = 'invalid';
  const target = await loadBackground({ name: 'Untouched' });

  await assert.rejects(target.api.importBackup(backup), /stage data/);
  assert.equal(target.local.data.name, 'Untouched');
  assert.equal(target.local.data.matchCache, undefined);
});

test('restore rejects malformed classifier and stage fields before changing storage', async () => {
  const source = await loadBackground({
    memberNumber: 'A103',
    matchCache: { [firstId]: completeCache(1) },
    lastMatchList: [{ match_id: firstId, match_name: 'Imported', date: '2026-09-07' }],
    classificationData: { member_number: 'A103', classifiers: [], divisions: {} },
  });
  const backup = await source.api.createBackup();
  const target = await loadBackground({ name: 'Untouched' });

  backup.data.classificationData.classifiers = [null];
  await assert.rejects(target.api.importBackup(backup), /classification records/);
  backup.data.classificationData.classifiers = [];
  backup.data.matchCache[firstId].stages[0].name = {};
  await assert.rejects(target.api.importBackup(backup), /stage fields/);
  backup.data.matchCache[firstId].stages[0].name = 'Stage 1';
  backup.data.classificationData.divisions = { CarryOptics: { class_: 42, pct: '75' } };
  await assert.rejects(target.api.importBackup(backup), /division values/);
  assert.equal(target.local.data.name, 'Untouched');
});

test('restore requires confirmation before replacing another owner history', async () => {
  const source = await loadBackground({
    memberNumber: 'A103',
    matchCache: { [firstId]: completeCache(1) },
    lastMatchList: [{ match_id: firstId, match_name: 'Imported', date: '2026-09-07' }],
  });
  const backup = await source.api.createBackup();
  const target = await loadBackground({
    memberNumber: 'B999',
    matchCache: { [secondId]: { ...completeCache(2), cached_for: 'B999' } },
    lastMatchList: [{ match_id: secondId, match_name: 'Existing', date: '2026-09-01' }],
    matchHistorySync: { cachedFor: 'B999' },
  });

  await assert.rejects(target.api.importBackup(backup), error => error.code === 'OWNER_CONFLICT');
  await target.api.importBackup(backup, { replaceExistingOwner: true });
  assert.equal(target.local.data.memberNumber, 'A103');
  assert.equal(target.local.data.matchCache[secondId], undefined);
  assert.equal(target.local.data.lastMatchList[0].match_id, firstId);
});

test('name-only restore detects owner conflicts and removes omitted managed keys', async () => {
  const source = await loadBackground({
    name: 'Shooter One',
    matchCache: { [firstId]: { ...completeCache(1), cached_for: null } },
    lastMatchList: [{ match_id: firstId, match_name: 'Imported', date: '2026-09-07' }],
  });
  const backup = await source.api.createBackup();
  const target = await loadBackground({
    name: 'Shooter Two',
    matchCache: { [secondId]: { ...completeCache(2), cached_for: null } },
    lastMatchList: [{ match_id: secondId, match_name: 'Existing', date: '2026-09-01' }],
    deselectedMatches: [secondId],
  });

  await assert.rejects(target.api.importBackup(backup), error => error.code === 'OWNER_CONFLICT');
  await target.api.importBackup(backup, { replaceExistingOwner: true });
  assert.equal(target.local.data.name, 'Shooter One');
  assert.equal(target.local.data.deselectedMatches, undefined);
});

test('failed restore write leaves the previous managed state unchanged', async () => {
  const source = await loadBackground({
    memberNumber: 'A103',
    matchCache: { [firstId]: completeCache(1) },
    lastMatchList: [{ match_id: firstId, match_name: 'Imported', date: '2026-09-07' }],
  });
  const backup = await source.api.createBackup();
  const target = await loadBackground({
    memberNumber: 'A103',
    matchCache: { [secondId]: completeCache(2) },
    lastMatchList: [{ match_id: secondId, match_name: 'Existing', date: '2026-09-01' }],
    deselectedMatches: [secondId],
  });
  const before = structuredClone(target.local.data);
  target.local.failNextSet = true;

  await assert.rejects(target.api.importBackup(backup), /simulated storage failure/);
  assert.deepEqual(target.local.data, before);
});
