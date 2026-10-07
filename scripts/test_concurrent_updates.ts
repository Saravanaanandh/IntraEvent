/**
 * Concurrency test script:
 * Simulates 25+ simultaneous requests firing at the same participant record,
 * verifying that atomic findOneAndUpdate with $set and $inc prevents
 * any lost updates or score overwrites.
 *
 * Usage:
 *   npx tsx scripts/test_concurrent_updates.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import {
  connectMongo,
  ParticipantDoc,
  recordViolationAtomic,
  updateParticipantRound1Atomic,
  updateParticipantFieldsAtomic,
} from '../src/server/db.js';

async function runConcurrencyTest() {
  console.log('[test] Connecting to MongoDB...');
  await connectMongo();

  const testPid = `test_concurrent_${Date.now()}`;
  console.log(`[test] Creating test participant: ${testPid}`);

  await ParticipantDoc.findOneAndUpdate(
    { pid: testPid },
    {
      pid: testPid,
      data: {
        id: testPid,
        name: 'Concurrent Test User',
        registerNo: 'TEST_CONCURRENT',
        year: 'II',
        round1Completed: false,
        round1Score: 0,
        round2Completed: false,
        round2Score: 0,
        totalScore: 0,
        violations: { tabHidden: 0, fullscreenExit: 0 },
      },
    },
    { upsert: true, new: true }
  ).exec();

  console.log('[test] Firing 25 simultaneous concurrent update operations...');

  const tasks: Promise<any>[] = [];

  // 10 concurrent tab violations ($inc)
  for (let i = 0; i < 10; i++) {
    tasks.push(recordViolationAtomic(testPid, 'tab'));
  }

  // 10 concurrent fullscreen violations ($inc)
  for (let i = 0; i < 10; i++) {
    tasks.push(recordViolationAtomic(testPid, 'fs'));
  }

  // 1 concurrent Round 1 completion ($set)
  tasks.push(
    updateParticipantRound1Atomic(testPid, {
      round1Score: 465,
      round1Evals: [{ test: true }],
      round1PromptsUsed: 7,
      totalScore: 77.5,
    })
  );

  // 4 concurrent field updates ($set)
  for (let i = 0; i < 4; i++) {
    tasks.push(updateParticipantFieldsAtomic(testPid, { year: 'III' }));
  }

  // Execute all 25 parallel writes concurrently
  await Promise.all(tasks);

  // Read final state from MongoDB
  const finalDoc = await ParticipantDoc.findOne({ pid: testPid }).lean().exec();
  const data = (finalDoc as any)?.data;

  console.log('[test] Final document state in MongoDB:', JSON.stringify(data, null, 2));

  let passed = true;
  if (data.round1Score !== 465) {
    console.error(`❌ FAILED: round1Score was ${data.round1Score}, expected 465!`);
    passed = false;
  } else {
    console.log(`✅ PASSED: round1Score is 465 (not lost or overwritten).`);
  }

  if (data.round1Completed !== true) {
    console.error(`❌ FAILED: round1Completed was not true!`);
    passed = false;
  } else {
    console.log(`✅ PASSED: round1Completed is true.`);
  }

  if (data.violations?.tabHidden !== 10) {
    console.error(`❌ FAILED: tabHidden was ${data.violations?.tabHidden}, expected 10!`);
    passed = false;
  } else {
    console.log(`✅ PASSED: tabHidden incremented to exactly 10.`);
  }

  if (data.violations?.fullscreenExit !== 10) {
    console.error(`❌ FAILED: fullscreenExit was ${data.violations?.fullscreenExit}, expected 10!`);
    passed = false;
  } else {
    console.log(`✅ PASSED: fullscreenExit incremented to exactly 10.`);
  }

  // Cleanup test record
  await ParticipantDoc.deleteOne({ pid: testPid }).exec();
  console.log('[test] Cleaned up test record.');

  await mongoose.disconnect();

  if (passed) {
    console.log('\n🎉 ALL CONCURRENCY TESTS PASSED! No lost updates or race conditions occurred.');
  } else {
    process.exit(1);
  }
}

runConcurrencyTest().catch((e) => {
  console.error('[test] Fatal error:', e);
  process.exit(1);
});
