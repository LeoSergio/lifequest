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
