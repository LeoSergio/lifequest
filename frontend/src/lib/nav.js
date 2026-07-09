import { writable } from 'svelte/store';

// Navegação bem simples de propósito: só um valor reativo compartilhado
// entre a NavBar (que escreve) e o App (que lê pra decidir o que renderizar).
// Se o app crescer muito, dá pra trocar por svelte-spa-router sem
// precisar reescrever as telas — elas não sabem que essa store existe.
export const currentRoute = writable('dashboard'); // 'dashboard' | 'pantry'
