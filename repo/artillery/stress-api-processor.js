"use strict";

module.exports = {
  generateRandomDatasetId: (context, events, done) => {
    const ids = ["local-test-1", "local-test-2", "test-salary", "test-sales"];
    context.vars.$randomDatasetId = ids[Math.floor(Math.random() * ids.length)];
    done();
  },
  generateDatasetRows: (context, events, done) => {
    const rowCount = 10 + Math.floor(Math.random() * 90);
    const rows = [];
    for (let i = 0; i < rowCount; i++) {
      rows.push({
        id: i + 1,
        name: `Record_${i + 1}`,
        value: Math.random() * 1000,
        category: ["A", "B", "C"][i % 3],
        date: "2024-01-01",
      });
    }
    context.vars.$datasetRows = rows;
    done();
  },
};
