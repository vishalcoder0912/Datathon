"use strict";

module.exports = {
  generateRandomEmail: (context, events, done) => {
    context.vars.$randomEmail = `stress_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.insightflow.ai`;
    done();
  },
};
