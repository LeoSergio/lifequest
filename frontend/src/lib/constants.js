// Lista fixa pra manter simples no MVP. Se um dia precisar ser dinâmico
// (usuário criando categorias próprias), isso vira uma tabela no Dexie.
export const PANTRY_CATEGORIES = [
  'Proteínas',
  'Carboidratos',
  'Vegetais',
  'Frutas',
  'Laticínios',
  'Temperos',
  'Outros'
];

export const MUSCLE_GROUPS = ['Peito', 'Costas', 'Bíceps', 'Tríceps', 'Pernas', 'Ombro', 'Core'];

export const EQUIPMENT_TYPES = ['Peso livre', 'Máquina', 'Barra', 'Halteres', 'Peso corporal'];

export const WEEKDAYS = [
  { value: null, label: 'Livre' },
  { value: 'seg', label: 'Segunda' },
  { value: 'ter', label: 'Terça' },
  { value: 'qua', label: 'Quarta' },
  { value: 'qui', label: 'Quinta' },
  { value: 'sex', label: 'Sexta' },
  { value: 'sab', label: 'Sábado' },
  { value: 'dom', label: 'Domingo' }
];

// Objetivo escolhido no onboarding — usado pra colorir o resumo semanal
// da Dashboard (ex: perder peso e o peso caiu = progresso; ganhar peso e
// o peso caiu = alerta), não pra travar nenhuma funcionalidade.
export const GOALS = [
  { value: 'lose_weight', label: 'Perder peso' },
  { value: 'gain_weight', label: 'Ganhar peso' },
  { value: 'gain_muscle', label: 'Ganhar massa muscular' },
  { value: 'maintain', label: 'Manter o peso' }
];
