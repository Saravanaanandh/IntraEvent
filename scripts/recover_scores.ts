/**
 * One-off script to recover lost/overwritten Round 1 scores from MongoDB FELieSession docs.
 *
 * Usage:
 *   npx tsx scripts/recover_scores.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectMongo, ParticipantDoc, LieSessionDoc, ConfigDoc } from '../src/server/db.js';
import { evaluateLieConversation, scoreLieEfficiency, estimateTokens } from '../src/server/lieEngine.js';
import { finalScoreOutOf100 } from '../src/server/app.js';

async function runRecovery() {
  console.log('[recovery] Connecting to MongoDB...');
  await connectMongo();

  const configDoc = await ConfigDoc.findOne({ pid: 'global' }).lean().exec();
  const cfg = (configDoc as any)?.data || {};
  const truth = {
    label: cfg.truthLabel || '',
    keywords: cfg.truthKeywords || [],
    falseLabel: cfg.falseLabel || '',
    falseKeywords: cfg.falseKeywords || [],
  };
  console.log(`[recovery] Using truth label: "${truth.label}", false label: "${truth.falseLabel}"`);

  const participants = await ParticipantDoc.find({}).lean().exec();
  console.log(`[recovery] Inspecting ${participants.length} total participants...`);

  let recoveredCount = 0;

  for (const doc of participants) {
    const p = (doc as any).data;
    if (p.round1Score === 0) {
      const lieDoc = await LieSessionDoc.findOne({ pid: p.id }).lean().exec();
      const sess = (lieDoc as any)?.data;

      if (sess && sess.messages && sess.messages.length >= 2) {
        let timeSec = 0;
        const t0 = new Date(sess.messages[0].timestamp).getTime();
        const t1 = new Date(sess.messages[sess.messages.length - 1].timestamp).getTime();
        if (!isNaN(t0) && !isNaN(t1) && t1 >= t0) {
          timeSec = Math.round((t1 - t0) / 1000);
        }
        if (!timeSec && sess.startedAt) {
          timeSec = Math.min(900, Math.max(30, Math.round((Date.now() - sess.startedAt) / 1000)));
        }
        timeSec = Math.min(900, Math.max(30, timeSec));

        const totalTokens = sess.messages
          .filter((m: any) => m.sender === 'user')
          .reduce((a: number, m: any) => a + estimateTokens(m.text), 0);

        const ev = await evaluateLieConversation(sess.messages, sess.belief, truth);
        const passed = ev.evaluations.filter((e: any) => e.passed || e.isSuccess);
        const convinced = passed.length > 0;
        const finalBelief = convinced ? String(passed[0].answer || '') : truth.label;
        const promptsUsed = sess.promptsUsed || sess.messages.filter((m: any) => m.sender === 'user').length;
        const eff = scoreLieEfficiency(promptsUsed, timeSec, totalTokens, convinced, finalBelief);

        console.log(`  -> ${p.name} (${p.registerNo}): convinced=${convinced}, calculatedScore=${eff.finalScore}, prompts=${promptsUsed}`);

        if (convinced && eff.finalScore > 0) {
          const newTotal = finalScoreOutOf100(eff.finalScore, p.round2Score);
          await ParticipantDoc.findOneAndUpdate(
            { pid: p.id },
            {
              $set: {
                'data.round1Completed': true,
                'data.round1Score': eff.finalScore,
                'data.round1Evals': [{ ...eff, evaluations: ev.evaluations }],
                'data.round1PromptsUsed': promptsUsed,
                'data.totalScore': newTotal,
              },
            }
          ).exec();
          console.log(`     ✅ RECOVERED: ${p.name} — Round 1 Score: ${eff.finalScore}, Total Score: ${newTotal}`);
          recoveredCount++;
        }
      }
    }
  }

  console.log(`[recovery] Complete! Recovered scores for ${recoveredCount} participants.`);
  await mongoose.disconnect();
}

runRecovery().catch((err) => {
  console.error('[recovery] Error:', err);
  process.exit(1);
});
