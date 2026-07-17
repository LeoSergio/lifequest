import fs from 'fs';
import * as svelte from 'svelte/compiler';

try {
  const source = fs.readFileSync('src/routes/Onboarding.svelte', 'utf-8');
  svelte.compile(source, { filename: 'Onboarding.svelte' });
  console.log("Compilation successful!");
} catch (e) {
  console.error("Compilation error:");
  console.error(e);
}
