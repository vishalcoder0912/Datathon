import { callOllamaAI } from './apps/backend/src/services/ollama-service.js';

async function test() {
  const dataset = {
    name: 'Sample Test Data',
    rowCount: 2,
    columns: [
      { name: 'age', type: 'number' },
      { name: 'salary', type: 'number' },
      { name: 'experience', type: 'number' },
      { name: 'department', type: 'string' }
    ],
    rows: [
      { age: 25, salary: 50000, experience: 2, department: 'Sales' },
      { age: 30, salary: 60000, experience: 5, department: 'Engineering' }
    ]
  };
  
  console.log("Calling Ollama...");
  const start = Date.now();
  const response = await callOllamaAI(dataset, "What is the average salary by department?");
  const end = Date.now();
  console.log(`Took ${end - start}ms`);
  console.log(response);
}

test();
